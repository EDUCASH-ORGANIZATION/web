import "server-only"
import {
  ACCOUNT_BATCH,
  ACCOUNT_BREAKER,
  ACTOR_KINDS,
  CLOSED_ACCOUNT_LABEL,
  CLOSURE_EVENTS,
  CLOSURE_GRACE_DAYS,
  PROFILE_PSEUDONYM_PATCH,
  STUDENT_PROFILE_PSEUDONYM_PATCH,
  auditHasNoPersonalData,
  closureAuditEntry,
  closureState,
  isDueForPseudonymization,
  pseudonymizationBlockers,
} from "@/lib/account-closure/closure-rules"
import { SUMMARY_FIELDS, cutoffDate, toTime } from "@/lib/purge/purge-rules"
import { removePaths } from "@/lib/purge/storage-walk"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { pseudonymizeAuthUser } from "@/lib/actions/account-closure-auth"

// Pseudonymisation définitive des comptes fermés dont le délai de grâce est écoulé (RD-CLOSE-01, ST-11a), appelée
// par la route de purge (catégorie `closed_accounts`). Le client service role est INJECTÉ par l'appelant. Module
// serveur sans "use server" : jamais une action appelable du navigateur. Aucun journal : seuls des compteurs sont
// renvoyés (aucun identifiant).
//
// Écritures permises, et seulement elles : UPDATE de `profiles` (revendication puis patch final) et de
// `student_profiles` ; DELETE de `notifications` (recipient_id) et de `applications` (student_id, pending ou
// rejected) ; suppression de fichiers Storage des compartiments avatars et student-cards, limitée aux chemins du
// dossier du compte ; INSERT dans `account_closure_events` ; adaptateur auth (jamais de suppression d'utilisateur).
//
// Reprise après interruption : `pseudonymized_at` revendique le compte, `full_name` = « Compte clôturé » est écrit
// EN DERNIER et sert de marqueur de fin. Tant qu'il manque, le compte est repris au passage suivant ; chaque étape
// est idempotente. Un compte revendiqué n'est jamais réactivable (garde du cœur de fermeture et de la base).

const AVATAR_BUCKET = "avatars"
const CARD_BUCKET = "student-cards"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UNIQUE_VIOLATION = "23505"

function emptyCounters() {
  return Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, 0]))
}

function expired(deadline) {
  return typeof deadline === "number" && Date.now() >= deadline
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function amount(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/** Compte les lignes d'une requête ; null à la moindre erreur (fail-closed). */
async function countRows(query) {
  const { count, error } = await query
  return error || !Number.isInteger(count) ? null : count
}

/** Nombre de signalements ouverts concernant le compte ; null à la moindre erreur de lecture (fail-closed). */
async function countOpenReports(service, userId) {
  try {
    return await countRows(
      service
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
        .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`),
    )
  } catch {
    return null
  }
}

/** Instantané des blocages du temps 3 pour un compte ; `readError` à la moindre lecture douteuse. */
async function readBlockerSnapshot(service, userId) {
  const mine = (a, b) => `${a}.eq.${userId},${b}.eq.${userId}`
  try {
    const head = { count: "exact", head: true }
    const [wallet, clientMissions, studentMissions, purchases, reports, pending] = await Promise.all([
      service.from("wallets").select("balance, reserved").eq("user_id", userId),
      countRows(service.from("missions").select("id", head).eq("client_id", userId).in("status", ["open", "in_progress"])),
      countRows(
        service.from("missions").select("id", head).eq("selected_student_id", userId).eq("status", "in_progress"),
      ),
      countRows(
        service
          .from("purchase_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "paid"])
          .or(mine("student_id", "client_id")),
      ),
      countRows(
        service
          .from("reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"])
          .or(mine("reporter_id", "reported_user_id")),
      ),
      countRows(
        service
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .or(mine("client_id", "student_id")),
      ),
    ])
    if (wallet.error || !Array.isArray(wallet.data) || wallet.data.length > 1) return { readError: true }
    const row = wallet.data[0] ?? { balance: 0, reserved: 0 }
    const balance = amount(row.balance ?? 0)
    const reserved = amount(row.reserved ?? 0)
    if (
      balance === null ||
      reserved === null ||
      clientMissions === null ||
      studentMissions === null ||
      purchases === null ||
      reports === null ||
      pending === null
    ) {
      return { readError: true }
    }
    return {
      walletBalance: balance,
      walletReserved: reserved,
      activeClientMissions: clientMissions,
      activeStudentMissions: studentMissions,
      openPurchases: purchases,
      openReports: reports,
      pendingTransactions: pending,
    }
  } catch {
    return { readError: true }
  }
}

/** Références de fichiers du compte : chemins valides dans son dossier, ou null si une lecture échoue. */
async function readFileRefs(service, userId) {
  const [profile, student] = await Promise.all([
    service.from("profiles").select("avatar_url").eq("user_id", userId),
    service.from("student_profiles").select("card_url").eq("user_id", userId),
  ])
  if (profile.error || student.error || !Array.isArray(profile.data) || !Array.isArray(student.data)) return null
  const pick = (rows, column, bucket) => {
    const paths = []
    for (const row of rows) {
      const path = toOwnedStoragePath(row?.[column], bucket, userId)
      // Une valeur absente ou hors du dossier du compte n'est jamais supprimée (le reste relève de la purge des orphelins).
      if (path !== null) paths.push(path)
    }
    return paths
  }
  return {
    avatars: pick(profile.data, "avatar_url", AVATAR_BUCKET),
    cards: pick(student.data, "card_url", CARD_BUCKET),
  }
}

/**
 * Étapes d'effacement d'un compte déjà revendiqué. Renvoie "done", "error" ou "deadline" (compte laissé en reprise).
 */
async function erase(service, userId, deadline) {
  const refs = await readFileRefs(service, userId)
  if (refs === null) return "error"

  const notifications = await service.from("notifications").delete().eq("recipient_id", userId)
  if (notifications.error) return "error"
  const applications = await service
    .from("applications")
    .delete()
    .eq("student_id", userId)
    .in("status", ["pending", "rejected"])
  if (applications.error) return "error"

  for (const [bucket, paths] of [
    [AVATAR_BUCKET, refs.avatars],
    [CARD_BUCKET, refs.cards],
  ]) {
    if (paths.length === 0) continue
    const removed = await removePaths(service, bucket, paths, { deadline })
    if (removed.arretBudget) return "deadline"
    if (removed.erreurs > 0) return "error"
  }

  const auth = await pseudonymizeAuthUser(service, userId)
  if (!auth.ok) return "error"

  const student = await service
    .from("student_profiles")
    .update({ ...STUDENT_PROFILE_PSEUDONYM_PATCH, skills: [] })
    .eq("user_id", userId)
  if (student.error) return "error"

  const entry = closureAuditEntry({
    userId,
    event: CLOSURE_EVENTS.PSEUDONYMIZED,
    actorKind: ACTOR_KINDS.SYSTEM,
  })
  if (!auditHasNoPersonalData(entry)) return "error"
  const event = await service.from("account_closure_events").insert(entry)
  // Un événement déjà écrit par un passage interrompu (index unique) n'est pas une erreur.
  if (event.error && event.error.code !== UNIQUE_VIOLATION) return "error"

  // full_name en dernier : marqueur de fin de la pseudonymisation.
  const profile = await service
    .from("profiles")
    .update({ ...PROFILE_PSEUDONYM_PATCH, full_name: CLOSED_ACCOUNT_LABEL })
    .eq("user_id", userId)
    .not("pseudonymized_at", "is", null)
    .select("user_id")
  if (profile.error || !Array.isArray(profile.data) || profile.data.length !== 1) return "error"
  return "done"
}

/**
 * Pseudonymise les comptes fermés échus et reprend les pseudonymisations interrompues.
 * @param {import("@supabase/supabase-js").SupabaseClient} service
 * @param {{ now: Date|number|string, mode?: "dry"|"real", deadline?: number, allowMass?: boolean }} options
 * @returns {Promise<{ categories: { closed_accounts: Record<string, number> }, stops: string[] }>}
 */
export async function pseudonymizeClosedAccounts(service, { now, mode, deadline, allowMass } = {}) {
  const counters = emptyCounters()
  const result = { categories: { closed_accounts: counters }, stops: [] }
  const stop = (reason) => {
    if (!result.stops.includes(reason)) result.stops.push(reason)
  }
  const dryRun = mode !== "real"
  const cutoff = cutoffDate(now, { days: CLOSURE_GRACE_DAYS })
  if (cutoff === null || toTime(now) === null) {
    stop("error")
    return result
  }
  const cutoffIso = cutoff.toISOString()

  try {
    const [resume, due] = await Promise.all([
      service
        .from("profiles")
        .select("user_id, closed_at, pseudonymized_at, full_name", { count: "exact" })
        .not("pseudonymized_at", "is", null)
        .or(`full_name.is.null,full_name.neq.${JSON.stringify(CLOSED_ACCOUNT_LABEL)}`)
        .order("pseudonymized_at", { ascending: true })
        .limit(ACCOUNT_BATCH),
      service
        .from("profiles")
        .select("user_id, closed_at, pseudonymized_at, full_name", { count: "exact" })
        .is("pseudonymized_at", null)
        .not("closed_at", "is", null)
        .lte("closed_at", cutoffIso)
        .order("closed_at", { ascending: true })
        .limit(ACCOUNT_BATCH),
    ])
    if (resume.error || due.error || !Array.isArray(resume.data) || !Array.isArray(due.data)) {
      counters.erreurs += 1
      stop("error")
      return result
    }
    const dueCount = Number.isInteger(due.count) ? due.count : due.data.length
    const resumeCount = Number.isInteger(resume.count) ? resume.count : resume.data.length
    counters.candidats = resumeCount + dueCount
    const breaker = allowMass !== true && dueCount > ACCOUNT_BREAKER
    if (breaker) stop("breaker")
    if (dryRun) {
      counters.examines = resume.data.length + due.data.length
      return result
    }

    const queue = [
      ...resume.data.map((row) => ({ row, claimed: true })),
      ...(breaker ? [] : due.data.map((row) => ({ row, claimed: false }))),
    ]
    for (const { row, claimed } of queue) {
      if (expired(deadline)) {
        stop("deadline")
        break
      }
      counters.examines += 1
      const userId = row?.user_id
      if (!isUuid(userId)) {
        counters.ignores += 1
        continue
      }
      if (claimed) {
        if (closureState(row) !== "pseudonymizing") {
          counters.ignores += 1
          continue
        }
      } else {
        if (!isDueForPseudonymization(row, now)) {
          counters.ignores += 1
          continue
        }
        if (pseudonymizationBlockers(await readBlockerSnapshot(service, userId)).length > 0) {
          counters.ignores += 1
          continue
        }
        // Revendication : exclusive de la réactivation (même ligne, même condition sur pseudonymized_at).
        const claim = await service
          .from("profiles")
          .update({ pseudonymized_at: new Date(toTime(now)).toISOString() })
          .eq("user_id", userId)
          .is("pseudonymized_at", null)
          .not("closed_at", "is", null)
          .lte("closed_at", cutoffIso)
          .select("user_id")
        if (claim.error || !Array.isArray(claim.data)) {
          counters.erreurs += 1
          continue
        }
        if (claim.data.length === 0) {
          counters.ignores += 1
          continue
        }
      }

      // Un signalement ouvert apparu après la revendication (ou pendant une reprise) suspend tout effacement : le
      // compte reste en reprise et sera réexaminé au passage suivant.
      const openReports = await countOpenReports(service, userId)
      if (openReports === null) {
        counters.erreurs += 1
        continue
      }
      if (openReports > 0) {
        counters.ignores += 1
        continue
      }

      const outcome = await erase(service, userId, deadline)
      if (outcome === "done") counters.supprimes += 1
      else if (outcome === "deadline") {
        stop("deadline")
        break
      } else counters.erreurs += 1
    }
  } catch {
    counters.erreurs += 1
    stop("error")
  }
  return result
}

