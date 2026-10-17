import "server-only"
import {
  ACTOR_KINDS,
  CLOSURE_EVENTS,
  CLOSURE_REASONS,
  RECENT_WITHDRAWAL_DAYS,
  closureAuditEntry,
  closureBlockers,
  closureDueAt,
  closureState,
} from "@/lib/account-closure/closure-rules"
import { banAuthUser, unbanAuthUser } from "@/lib/actions/account-closure-auth"
import { sendEmail } from "@/lib/email"

/**
 * Coeur serveur de la fermeture et de la réactivation d'un compte (RD-CLOSE-01). Le client (service role) est
 * injecté par l'appelant, qui a déjà contrôlé le rôle admin : aucune création de client ici. Pas de "use server" :
 * ces fonctions ne doivent jamais devenir des actions appelables du navigateur.
 *
 * Écritures permises : UPDATE de `profiles` (colonnes de cycle et `is_suspended` seulement), INSERT dans
 * `account_closure_events`, appels de l'adaptateur auth et envoi d'e-mail. AUCUN effacement de donnée ici.
 * Journal `[account-closure]` : uuid et codes seulement, jamais d'adresse, de nom ni de téléphone.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_LIMIT = 50
const MISSING_SCHEMA_CODES = ["42703", "42P01", "PGRST205", "PGRST204"]
const ERR_GENERIC = "L'opération n'a pas pu aboutir. Réessayez dans un instant."
const ERR_NOT_FOUND = "Compte introuvable."
const ERR_PSEUDONYMIZED = "Réactivation impossible : les données ont été pseudonymisées."
const ERR_NOT_CLOSED = "Ce compte n'est pas fermé."

const PROFILE_COLUMNS = "user_id, role, full_name, is_suspended, closed_at, pseudonymized_at, closure_prev_suspended"

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

function toIso(now) {
  const date = now instanceof Date ? now : new Date(now ?? Date.now())
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function logCode(label, error) {
  console.error(`[account-closure] ${label}`, String(error?.code ?? "erreur"))
}

function isMissingSchema(error) {
  return MISSING_SCHEMA_CODES.includes(error?.code)
}

/** Lecture du profil de cycle. @returns {Promise<{ profile: object } | { error: object|null, missing?: boolean }>} */
async function readProfile(service, userId) {
  try {
    const { data, error } = await service.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle()
    if (error) return { error }
    if (!data) return { error: null, notFound: true }
    return { profile: data }
  } catch {
    return { error: { code: "exception" } }
  }
}

/** Vérifie que les objets du script 96 existent avant toute écriture (colonne ou table absente = rien d'écrit). */
async function schemaReady(service) {
  try {
    const { error } = await service.from("account_closure_events").select("id").limit(1)
    if (error) {
      logCode("schema", error)
      return false
    }
    return true
  } catch {
    console.error("[account-closure] schema", "exception")
    return false
  }
}

async function countRows(query) {
  const { count, error } = await query
  if (error || !Number.isInteger(count)) return undefined
  return count
}

/**
 * Compteurs de blocage d'un compte. Toute lecture en erreur donne `{ readError: true }` (fail-closed).
 * @returns {Promise<object>}
 */
async function readCounts(service, userId, now) {
  const since = new Date((now instanceof Date ? now : new Date(now)).getTime() - RECENT_WITHDRAWAL_DAYS * DAY_MS)
  const both = (a, b) => `${a}.eq.${userId},${b}.eq.${userId}`
  try {
    const head = { count: "exact", head: true }
    const [
      activeClientMissions,
      activeStudentMissions,
      openPurchases,
      openReports,
      recentWithdrawals,
      pendingTransactions,
      wallet,
    ] = await Promise.all([
      countRows(
        service.from("missions").select("id", head).eq("client_id", userId).in("status", ["open", "in_progress"]),
      ),
      countRows(
        service.from("missions").select("id", head).eq("selected_student_id", userId).eq("status", "in_progress"),
      ),
      countRows(
        service
          .from("purchase_requests")
          .select("id", head)
          .or(both("student_id", "client_id"))
          .in("status", ["pending", "paid"]),
      ),
      countRows(
        service
          .from("reports")
          .select("id", head)
          .or(both("reporter_id", "reported_user_id"))
          .in("status", ["open", "in_progress"]),
      ),
      countRows(
        service
          .from("wallet_transactions")
          .select("id", head)
          .eq("user_id", userId)
          .eq("type", "withdrawal")
          .gte("created_at", since.toISOString()),
      ),
      countRows(
        service.from("transactions").select("id", head).or(both("client_id", "student_id")).eq("status", "pending"),
      ),
      service.from("wallets").select("balance, reserved").eq("user_id", userId),
    ])
    if (wallet.error || !Array.isArray(wallet.data)) return { readError: true }
    let walletBalance = 0
    let walletReserved = 0
    for (const row of wallet.data) {
      walletBalance += Number(row.balance ?? 0)
      walletReserved += Number(row.reserved ?? 0)
    }
    return {
      activeClientMissions,
      activeStudentMissions,
      openPurchases,
      openReports,
      recentWithdrawals,
      pendingTransactions,
      walletBalance,
      walletReserved,
    }
  } catch {
    return { readError: true }
  }
}

/**
 * Instantané des conditions de fermeture, à passer à `closureBlockers`. Lecture en erreur : `{ readError: true }`.
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {string} userId
 * @param {{ now?: Date|number|string }} [options]
 * @returns {Promise<object>}
 */
export async function readClosureSnapshot(service, userId, { now = new Date() } = {}) {
  if (!isUuid(userId) || toIso(now) === null) return { readError: true }
  const read = await readProfile(service, userId)
  if (!read.profile) return { readError: true }
  const counts = await readCounts(service, userId, now)
  return { ...counts, role: read.profile.role }
}

/**
 * Historique des événements de fermeture d'un compte (le plus récent d'abord), colonnes explicites.
 * @returns {Promise<{ events: object[] } | { error: string }>}
 */
export async function readClosureHistory(service, userId) {
  if (!isUuid(userId)) return { error: ERR_GENERIC }
  try {
    const { data, error } = await service
      .from("account_closure_events")
      .select("event, actor_kind, actor_id, reason_code, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)
    if (error || !Array.isArray(data)) {
      logCode("history", error)
      return { error: ERR_GENERIC }
    }
    return { events: data }
  } catch {
    return { error: ERR_GENERIC }
  }
}

/** Dernier événement du compte. @returns {Promise<{ kind: string|null } | { error: true }>} */
async function lastEventKind(service, userId) {
  try {
    const { data, error } = await service
      .from("account_closure_events")
      .select("event")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
    if (error || !Array.isArray(data)) return { error: true }
    return { kind: data[0]?.event ?? null }
  } catch {
    return { error: true }
  }
}

async function insertEvent(service, entry) {
  try {
    const { error } = await service.from("account_closure_events").insert(entry)
    if (error) {
      logCode("event", error)
      return false
    }
    return true
  } catch {
    console.error("[account-closure] event", "exception")
    return false
  }
}

async function readAuthUser(service, userId) {
  try {
    const { data, error } = await service.auth.admin.getUserById(userId)
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

async function notify(service, userId, template, data) {
  const user = await readAuthUser(service, userId)
  if (!user?.email) return
  try {
    await sendEmail(template, user.email, data(user))
  } catch {
    console.error("[account-closure] email", "exception")
  }
}

function logEntry(entry) {
  console.info("[account-closure]", JSON.stringify(entry))
}

function validateActor(actor, allowedKinds) {
  if (!actor || !allowedKinds.includes(actor.kind)) return false
  return actor.kind === ACTOR_KINDS.ADMIN ? isUuid(actor.id) : actor.id === undefined || actor.id === null
}

function actorId(actor) {
  return actor.kind === ACTOR_KINDS.ADMIN ? actor.id : null
}

/**
 * Enregistre l'événement de fermeture s'il manque (dernier événement différent de `closed`), puis envoie l'e-mail
 * une seule fois (seulement quand l'événement vient d'être écrit).
 * @returns {Promise<boolean>} faux si l'événement n'a pas pu être garanti
 */
async function ensureClosedEvent(service, { userId, actor, reasonCode, profile, dueAt }) {
  const last = await lastEventKind(service, userId)
  if (last.error) return false
  if (last.kind === CLOSURE_EVENTS.CLOSED) return true
  const entry = closureAuditEntry({
    userId,
    event: CLOSURE_EVENTS.CLOSED,
    actorKind: actor.kind,
    actorId: actorId(actor),
    reasonCode,
  })
  if (!(await insertEvent(service, entry))) return false
  logEntry(entry)
  await notify(service, userId, "account-closed", () => ({
    name: profile.full_name ?? "",
    reactivationDeadline: dueAt,
  }))
  return true
}

/**
 * Ferme un compte (réversible) : blocages, verrou conditionnel, bannissement, événement, e-mail.
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {{ userId: string, actor: { kind: "admin"|"self", id?: string }, reasonCode: string, now?: Date|number|string }} input
 * @returns {Promise<
 *   { success: true, alreadyClosed: boolean, complete: boolean, dueAt: string|null }
 *   | { blocked: string[] }
 *   | { error: string }
 * >} `dueAt` : échéance de pseudonymisation (ISO). `complete: false` : relancer la fermeture (idempotente).
 */
export async function closeAccountCore(service, { userId, actor, reasonCode, now = new Date() } = {}) {
  const nowIso = toIso(now)
  if (
    !isUuid(userId) ||
    nowIso === null ||
    !validateActor(actor, [ACTOR_KINDS.ADMIN, ACTOR_KINDS.SELF]) ||
    !Object.values(CLOSURE_REASONS).includes(reasonCode)
  ) {
    return { error: ERR_GENERIC }
  }
  if (!(await schemaReady(service))) return { error: ERR_GENERIC }

  const read = await readProfile(service, userId)
  if (read.notFound) return { error: ERR_NOT_FOUND }
  if (!read.profile) {
    if (isMissingSchema(read.error)) {
      logCode("profile", read.error)
      return { error: ERR_GENERIC }
    }
    logCode("profile", read.error)
    return { blocked: ["READ_ERROR"] }
  }
  const profile = read.profile

  if (profile.closed_at !== null && profile.closed_at !== undefined) {
    return resumeClosure(service, { userId, actor, reasonCode, profile })
  }

  const selfAdmin = actor.kind === ACTOR_KINDS.ADMIN && actor.id.toLowerCase() === userId.toLowerCase()
  const evaluate = async () => {
    const counts = await readCounts(service, userId, new Date(nowIso))
    const codes = closureBlockers({ ...counts, role: profile.role })
    return selfAdmin && !codes.includes("ROLE_ADMIN") ? ["ROLE_ADMIN", ...codes] : codes
  }
  if (typeof profile.is_suspended !== "boolean") return { blocked: ["READ_ERROR"] }
  const blockers = await evaluate()
  if (blockers.length > 0) return { blocked: blockers }

  // Verrou : une seule fermeture simultanée écrit (condition sur closed_at, is_suspended lu et rôle).
  const previous = profile.is_suspended
  let locked
  try {
    locked = await service
      .from("profiles")
      .update({ closed_at: nowIso, is_suspended: true, closure_prev_suspended: previous })
      .eq("user_id", userId)
      .is("closed_at", null)
      .eq("is_suspended", previous)
      .neq("role", "admin")
      .select("user_id")
  } catch {
    locked = { error: { code: "exception" } }
  }
  if (locked.error || !Array.isArray(locked.data)) {
    logCode("lock", locked.error)
    return { error: ERR_GENERIC }
  }
  if (locked.data.length === 0) {
    // Course perdue (ou compte devenu admin) : relecture, aucune écriture.
    const again = await readProfile(service, userId)
    if (again.profile && again.profile.closed_at !== null && again.profile.closed_at !== undefined) {
      return {
        success: true,
        alreadyClosed: true,
        complete: false,
        dueAt: closureDueAt(again.profile.closed_at)?.toISOString() ?? null,
      }
    }
    return { error: ERR_GENERIC }
  }

  const after = await evaluate()
  if (after.length > 0) {
    let undone
    try {
      undone = await service
        .from("profiles")
        .update({ closed_at: null, is_suspended: previous, closure_prev_suspended: null })
        .eq("user_id", userId)
        .eq("closed_at", nowIso)
        .is("pseudonymized_at", null)
        .select("user_id")
    } catch {
      undone = { error: { code: "exception" } }
    }
    if (undone.error || !Array.isArray(undone.data) || undone.data.length === 0) {
      logCode("unlock", undone.error)
      return { error: ERR_GENERIC }
    }
    return { blocked: after }
  }

  const dueAt = closureDueAt(nowIso)?.toISOString() ?? null
  const banned = await banAuthUser(service, userId)
  const eventOk = await ensureClosedEvent(service, { userId, actor, reasonCode, profile, dueAt })
  return { success: true, alreadyClosed: false, complete: banned.ok && eventOk, dueAt }
}

/** Reprise d'une fermeture déjà posée : bannissement et événement garantis, e-mail seulement si l'événement manquait. */
async function resumeClosure(service, { userId, actor, reasonCode, profile }) {
  const dueAt = closureDueAt(profile.closed_at)?.toISOString() ?? null
  const state = closureState(profile)
  if (state !== "closed") return { success: true, alreadyClosed: true, complete: true, dueAt }
  const banned = await banAuthUser(service, userId)
  const eventOk = await ensureClosedEvent(service, { userId, actor, reasonCode, profile, dueAt })
  return { success: true, alreadyClosed: true, complete: banned.ok && eventOk, dueAt }
}

async function ensureReopenedEvent(service, { userId, actor, reasonCode, profile }) {
  const last = await lastEventKind(service, userId)
  if (last.error) return false
  if (last.kind !== CLOSURE_EVENTS.CLOSED) return true
  const entry = closureAuditEntry({
    userId,
    event: CLOSURE_EVENTS.REOPENED,
    actorKind: actor.kind,
    actorId: actor.id,
    reasonCode,
  })
  if (!(await insertEvent(service, entry))) return false
  logEntry(entry)
  await notify(service, userId, "account-reopened", () => ({ name: profile.full_name ?? "" }))
  return true
}

function isBanned(user, now) {
  const until = Date.parse(user?.banned_until ?? "")
  return Number.isFinite(until) && until > now
}

/**
 * Réactive un compte fermé, tant qu'il n'est pas pseudonymisé (admin seulement).
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {{ userId: string, actor: { kind: "admin", id: string }, reasonCode: string, now?: Date|number|string }} input
 * @returns {Promise<
 *   { success: true, complete: boolean, alreadyActive: boolean }
 *   | { error: string, code?: "PSEUDONYMIZED" | "NOT_CLOSED" }
 * >}
 */
export async function reopenAccountCore(service, { userId, actor, reasonCode, now = new Date() } = {}) {
  const nowIso = toIso(now)
  if (
    !isUuid(userId) ||
    nowIso === null ||
    !validateActor(actor, [ACTOR_KINDS.ADMIN]) ||
    !Object.values(CLOSURE_REASONS).includes(reasonCode)
  ) {
    return { error: ERR_GENERIC }
  }
  if (!(await schemaReady(service))) return { error: ERR_GENERIC }

  const read = await readProfile(service, userId)
  if (read.notFound) return { error: ERR_NOT_FOUND }
  if (!read.profile) {
    logCode("profile", read.error)
    return { error: ERR_GENERIC }
  }
  let profile = read.profile
  if (profile.pseudonymized_at !== null && profile.pseudonymized_at !== undefined) {
    return { error: ERR_PSEUDONYMIZED, code: "PSEUDONYMIZED" }
  }

  let alreadyActive = profile.closed_at === null || profile.closed_at === undefined
  if (alreadyActive) {
    // Reprise : seul un bannissement resté en place justifie une action (sinon le compte n'a jamais été fermé).
    const user = await readAuthUser(service, userId)
    if (!user) return { error: ERR_GENERIC }
    if (!isBanned(user, new Date(nowIso).getTime())) return { error: ERR_NOT_CLOSED, code: "NOT_CLOSED" }
  } else {
    // Mise à jour conditionnelle : exclut la revendication du cron (même ligne, pseudonymized_at null).
    let updated
    try {
      updated = await service
        .from("profiles")
        .update({
          closed_at: null,
          is_suspended: profile.closure_prev_suspended === true,
          closure_prev_suspended: null,
        })
        .eq("user_id", userId)
        .not("closed_at", "is", null)
        .is("pseudonymized_at", null)
        .select("user_id")
    } catch {
      updated = { error: { code: "exception" } }
    }
    const failed = Boolean(updated.error) || !Array.isArray(updated.data)
    if (failed) logCode("reopen", updated.error)
    // Refus de la garde en base (pseudonymisation posée entre-temps) : relecture, même issue que 0 ligne.
    if (failed || updated.data.length === 0) {
      const again = await readProfile(service, userId)
      if (!again.profile) return { error: ERR_GENERIC }
      profile = again.profile
      if (profile.pseudonymized_at !== null && profile.pseudonymized_at !== undefined) {
        return { error: ERR_PSEUDONYMIZED, code: "PSEUDONYMIZED" }
      }
      if (profile.closed_at !== null && profile.closed_at !== undefined) return { error: ERR_GENERIC }
      if (failed) return { error: ERR_GENERIC }
      alreadyActive = true
    }
  }

  const unbanned = await unbanAuthUser(service, userId)
  const eventOk = await ensureReopenedEvent(service, { userId, actor, reasonCode, profile })
  return { success: true, complete: unbanned.ok && eventOk, alreadyActive }
}
