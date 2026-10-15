"use server"

import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email/index"
import { todayInBenin } from "@/lib/vitrine/dates"
import { escapeLike } from "@/lib/student-space/explore-query"
import {
  OTHER_REASON,
  reasonSchema,
  rejectSchema,
  uuidSchema,
} from "@/lib/admin-space/decision-schemas"
import {
  QUEUE_PAGE_SIZE,
  VERIFICATION_TABS,
  allowedActions,
  ageLabel,
  badgeUntil,
  classifyDossier,
  dossierHints,
  parseVerificationParams,
  sortQueue,
} from "@/lib/admin-space/verification-queue"
import {
  MAX_CARD_ROWS,
  READ_PAGE_SIZE,
  inChunks,
  logAdminAction,
  requireAdminService,
  signStudentCard,
} from "./admin-context"

const ERR_INVALID = "Ce dossier est introuvable."
const ERR_STATE = "Ce dossier a déjà été traité ou a changé. Rechargez la page."
const ERR_WRITE = "La décision n'a pas pu être enregistrée. Réessayez dans un instant."
const ERR_READ = "Les dossiers n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_TOKEN = "Ce dossier a changé. Rechargez la page."

const PROFILE_COLUMNS =
  "user_id, full_name, avatar_url, is_verified, verified_until, rejection_reason, verification_submitted_at, created_at"
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://educash.bj"

function revalidateQueue() {
  revalidatePath("/admin/verifications")
  revalidatePath("/admin/dashboard")
}

/** Lit toutes les lignes d'une requête par pages de 1000, jusqu'à la borne de sécurité. */
async function readAll(buildQuery) {
  const rows = []
  for (let from = 0; from < MAX_CARD_ROWS; from += READ_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + READ_PAGE_SIZE - 1)
    if (error) throw new Error("Lecture impossible.")
    rows.push(...(data ?? []))
    if ((data ?? []).length < READ_PAGE_SIZE) break
  }
  return rows
}

function firstName(fullName) {
  return typeof fullName === "string" && fullName.trim() !== "" ? fullName.trim().split(/\s+/)[0] : "Étudiant"
}

/** Jeton d'état : la date de dépôt de la carte telle que lue (ou absente). Valeur illisible : null et refus. */
function readToken(value) {
  if (value === undefined || value === null || value === "") return { token: null }
  if (typeof value !== "string" || value.length > 40 || Number.isNaN(new Date(value).getTime())) return { invalid: true }
  return { token: value }
}

/** Dossier tel que lu avant une décision : profil de l'étudiant (rôle étudiant seulement) et présence de la carte. */
async function readDossier(service, userId) {
  const [profileRes, cardRes] = await Promise.all([
    service
      .from("profiles")
      .select("user_id, full_name, is_verified, verified_until, rejection_reason, verification_submitted_at")
      .eq("user_id", userId)
      .eq("role", "student")
      .maybeSingle(),
    service.from("student_profiles").select("school").eq("user_id", userId).not("card_url", "is", null).maybeSingle(),
  ])
  if (profileRes.error || cardRes.error) return { failed: true }
  if (!profileRes.data) return { missing: true }
  return { profile: profileRes.data, hasCard: Boolean(cardRes.data), school: cardRes.data?.school ?? null }
}

/** Nom, établissement et adresse du destinataire de l'e-mail de décision (adresse lue côté serveur). */
async function readEmailTarget(service, userId) {
  const [profileRes, schoolRes, authRes] = await Promise.all([
    service.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    service.from("student_profiles").select("school").eq("user_id", userId).maybeSingle(),
    service.auth.admin.getUserById(userId),
  ])
  return {
    name: firstName(profileRes.data?.full_name),
    school: schoolRes.data?.school ?? "votre établissement",
    email: authRes.data?.user?.email ?? null,
  }
}

/** Envoie l'e-mail de décision une seule fois ; un échec n'annule pas la décision et ne journalise aucune adresse. */
async function notify(service, userId, template, buildData) {
  try {
    const target = await readEmailTarget(service, userId)
    if (!target.email) {
      console.error("[admin-verifications] e-mail non envoyé (adresse introuvable):", template)
      return false
    }
    const result = await sendEmail(template, target.email, buildData(target))
    if (result?.error) {
      console.error("[admin-verifications] e-mail non envoyé:", template)
      return false
    }
    return true
  } catch {
    console.error("[admin-verifications] e-mail non envoyé:", template)
    return false
  }
}

/**
 * Écriture conditionnelle : exactement une ligne doit être modifiée. `apply` ajoute les conditions d'état.
 * @returns {Promise<{ ok: true } | { error: string }>}
 */
async function writeOne(service, userId, values, apply, tag) {
  const query = apply(service.from("profiles").update(values).eq("user_id", userId).eq("role", "student"))
  const { data, error } = await query.select("user_id")
  if (error) {
    console.error(`[admin-verifications] ${tag}:`, error.message)
    return { error: ERR_WRITE }
  }
  if (!Array.isArray(data) || data.length !== 1) return { error: ERR_STATE }
  return { ok: true }
}

/** Conditions d'état d'un dossier « À examiner » : pas de motif, non vérifié, même carte (jeton de dépôt). */
function pendingConditions(token) {
  return (query) => {
    const q = query.is("rejection_reason", null).eq("is_verified", false)
    return token === null ? q.is("verification_submitted_at", null) : q.eq("verification_submitted_at", token)
  }
}

/** Valide l'identifiant et lit le dossier ; renvoie le dossier « À examiner » ou un refus. */
async function pendingDossier(service, userId, today) {
  const id = uuidSchema.safeParse(userId)
  if (!id.success) return { error: ERR_INVALID }
  const dossier = await readDossier(service, id.data)
  if (dossier.failed) return { error: ERR_WRITE }
  if (dossier.missing || !dossier.hasCard) return { error: ERR_STATE }
  const { profile } = dossier
  const tab = classifyDossier(
    {
      isVerified: profile.is_verified === true,
      verifiedUntil: profile.verified_until,
      rejectionReason: profile.rejection_reason,
      hasCard: true,
      submittedAt: profile.verification_submitted_at,
    },
    today,
  )
  if (tab !== "a-examiner") return { error: ERR_STATE }
  return { id: id.data, dossier }
}

/**
 * Valide la carte d'un étudiant : badge d'un an (date du Bénin), e-mail `verification-approved` envoyé une seule fois,
 * après l'écriture. Écriture conditionnelle : un double clic, un autre administrateur ou une carte remplacée
 * depuis l'affichage (jeton différent) donnent un refus sans écriture ni e-mail.
 * @param {string} userId
 * @param {{ expectedSubmittedAt?: string | null }} [options]
 * @returns {Promise<{ success: true, verifiedUntil: string, emailSent: boolean } | { error: string }>}
 */
export async function approveStudentCard(userId, { expectedSubmittedAt } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const token = readToken(expectedSubmittedAt)
  if (token.invalid) return { error: ERR_TOKEN }
  try {
    const today = todayInBenin()
    const found = await pendingDossier(service, userId, today)
    if (found.error) return { error: found.error }

    const verifiedUntil = badgeUntil(today)
    const written = await writeOne(
      service,
      found.id,
      { is_verified: true, verified_until: verifiedUntil, rejection_reason: null },
      pendingConditions(token.token),
      "approve",
    )
    if (written.error) return { error: written.error }

    logAdminAction({
      adminId: admin.userId,
      action: "verification.approve",
      targetId: found.id,
      before: { isVerified: false, verifiedUntil: found.dossier.profile.verified_until },
      after: { isVerified: true, verifiedUntil },
    })
    const emailSent = await notify(service, found.id, "verification-approved", (t) => ({
      name: t.name,
      school: t.school,
      verifiedUntil,
      appUrl: APP_URL(),
    }))
    revalidateQueue()
    return { success: true, verifiedUntil, emailSent }
  } catch (err) {
    console.error("[admin-verifications] approve:", err?.message)
    return { error: ERR_WRITE }
  }
}

/**
 * Refuse la carte d'un étudiant avec un motif de la liste fermée (message facultatif, obligatoire pour « Autre motif »).
 * @param {string} userId
 * @param {{ reason?: string, message?: string, expectedSubmittedAt?: string | null }} [input]
 * @returns {Promise<{ success: true, emailSent: boolean } | { error: string }>}
 */
export async function rejectStudentCard(userId, { reason, message, expectedSubmittedAt } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const parsed = rejectSchema.safeParse({ reason, message })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Motif invalide." }
  const token = readToken(expectedSubmittedAt)
  if (token.invalid) return { error: ERR_TOKEN }
  try {
    const found = await pendingDossier(service, userId, todayInBenin())
    if (found.error) return { error: found.error }

    const { reason: label, message: note } = parsed.data
    const stored = label === OTHER_REASON ? note : label
    const written = await writeOne(
      service,
      found.id,
      { is_verified: false, verified_until: null, rejection_reason: stored },
      pendingConditions(token.token),
      "reject",
    )
    if (written.error) return { error: written.error }

    logAdminAction({
      adminId: admin.userId,
      action: "verification.reject",
      targetId: found.id,
      before: { isVerified: false, verifiedUntil: found.dossier.profile.verified_until },
      after: { isVerified: false, verifiedUntil: null },
      reason: stored,
    })
    const emailSent = await notify(service, found.id, "verification-rejected", (t) => ({
      name: t.name,
      rejectionReason: stored,
      customMessage: label === OTHER_REASON || note === "" ? null : note,
      appUrl: APP_URL(),
    }))
    revalidateQueue()
    return { success: true, emailSent }
  } catch (err) {
    console.error("[admin-verifications] reject:", err?.message)
    return { error: ERR_WRITE }
  }
}

/**
 * Efface le motif d'un refus pour permettre à l'étudiant de renvoyer une carte. Seulement si un motif existe.
 * @param {string} userId
 * @param {{ reason?: string }} [input] motif de l'administrateur (journal seulement)
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function resetStudentRejection(userId, { reason } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const id = uuidSchema.safeParse(userId)
  if (!id.success) return { error: ERR_INVALID }
  const why = reasonSchema.safeParse(reason)
  if (!why.success) return { error: why.error.issues[0]?.message ?? "Motif invalide." }
  try {
    const written = await writeOne(service, id.data, { rejection_reason: null }, (q) => q.not("rejection_reason", "is", null), "reset")
    if (written.error) return { error: written.error }
    logAdminAction({ adminId: admin.userId, action: "verification.reset", targetId: id.data, reason: why.data })
    revalidateQueue()
    return { success: true }
  } catch (err) {
    console.error("[admin-verifications] reset:", err?.message)
    return { error: ERR_WRITE }
  }
}

/**
 * Retire le badge d'un étudiant vérifié, avec un motif ; l'étudiant en est prévenu par l'e-mail de carte refusée.
 * @param {string} userId
 * @param {{ reason?: string }} [input]
 * @returns {Promise<{ success: true, emailSent: boolean } | { error: string }>}
 */
export async function revokeStudentBadge(userId, { reason } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const id = uuidSchema.safeParse(userId)
  if (!id.success) return { error: ERR_INVALID }
  const why = reasonSchema.safeParse(reason)
  if (!why.success) return { error: why.error.issues[0]?.message ?? "Motif invalide." }
  try {
    const written = await writeOne(
      service,
      id.data,
      { is_verified: false, verified_until: null, rejection_reason: why.data },
      (q) => q.eq("is_verified", true),
      "revoke",
    )
    if (written.error) return { error: written.error }
    logAdminAction({
      adminId: admin.userId,
      action: "verification.revoke",
      targetId: id.data,
      before: { isVerified: true },
      after: { isVerified: false },
      reason: why.data,
    })
    const emailSent = await notify(service, id.data, "verification-rejected", (t) => ({
      name: t.name,
      rejectionReason: why.data,
      customMessage: null,
      appUrl: APP_URL(),
    }))
    revalidateQueue()
    return { success: true, emailSent }
  } catch (err) {
    console.error("[admin-verifications] revoke:", err?.message)
    return { error: ERR_WRITE }
  }
}

/** Identifiants des étudiants dont la valeur de `column` satisfait `apply` (recherche par nom ou établissement). */
async function matchingIds(service, table, apply) {
  const rows = await readAll(() => apply(service.from(table).select("user_id")).order("user_id", { ascending: true }))
  return new Set(rows.map((row) => row.user_id))
}

/**
 * File de vérification : compteurs exacts des cinq onglets, lignes de l'onglet (plus anciens d'abord, 25 par page),
 * et, si `id` est fourni, le dossier ouvert (seul endroit où l'e-mail, la date de dépôt et l'URL signée de la
 * carte, valable 5 minutes, sont lus). Aucune URL signée dans les lignes de la liste.
 * @param {Record<string, string | string[] | undefined>} [searchParams]
 */
export async function getVerificationQueue(searchParams) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  try {
    const params = parseVerificationParams(searchParams)
    const now = new Date()
    const today = todayInBenin(now)

    const [students, cardRows] = await Promise.all([
      readAll(() => service.from("profiles").select(PROFILE_COLUMNS).eq("role", "student").order("user_id", { ascending: true })),
      readAll(() =>
        service.from("student_profiles").select("user_id").not("card_url", "is", null).order("user_id", { ascending: true }),
      ),
    ])
    const withCard = new Set(cardRows.map((row) => row.user_id))

    const dossiers = students.map((profile) => {
      const dossier = {
        isVerified: profile.is_verified === true,
        verifiedUntil: profile.verified_until,
        rejectionReason: profile.rejection_reason,
        hasCard: withCard.has(profile.user_id),
        submittedAt: profile.verification_submitted_at,
        createdAt: profile.created_at,
      }
      return { profile, dossier, tab: classifyDossier(dossier, today) }
    })

    const counts = Object.fromEntries(VERIFICATION_TABS.map((tab) => [tab, 0]))
    for (const entry of dossiers) counts[entry.tab] += 1

    const pending = sortQueue(
      dossiers.filter((entry) => entry.tab === "a-examiner"),
      (entry) => entry.dossier.submittedAt ?? entry.dossier.createdAt,
    )
    const oldestAgeDays = pending.length > 0 ? dossierHints(pending[0].dossier, now).ageDays : null

    let tabRows = dossiers.filter((entry) => entry.tab === params.onglet)
    if (params.q) {
      const names = await matchingIds(service, "profiles", (q) =>
        q.eq("role", "student").ilike("full_name", `%${escapeLike(params.q)}%`),
      )
      tabRows = tabRows.filter((entry) => names.has(entry.profile.user_id))
    }
    if (params.ecole) {
      const schools = await matchingIds(service, "student_profiles", (q) => q.eq("school", params.ecole))
      tabRows = tabRows.filter((entry) => schools.has(entry.profile.user_id))
    }
    tabRows = sortQueue(tabRows, (entry) => entry.dossier.submittedAt ?? entry.dossier.createdAt)

    const total = tabRows.length
    const pageCount = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE))
    const page = Math.min(params.page, pageCount)
    const slice = tabRows.slice((page - 1) * QUEUE_PAGE_SIZE, page * QUEUE_PAGE_SIZE)

    const declared = new Map()
    for (const chunk of inChunks(slice.map((entry) => entry.profile.user_id))) {
      const { data, error } = await service.from("student_profiles").select("user_id, school, level").in("user_id", chunk)
      if (error) throw new Error("Lecture impossible.")
      for (const row of data ?? []) declared.set(row.user_id, row)
    }

    const rows = slice.map(({ profile, dossier, tab }) => {
      const hints = dossierHints(dossier, now)
      return {
        userId: profile.user_id,
        name: profile.full_name ?? "",
        avatarUrl: profile.avatar_url ?? null,
        school: declared.get(profile.user_id)?.school ?? null,
        level: declared.get(profile.user_id)?.level ?? null,
        tab,
        kind: hints.kind,
        overdue48h: hints.overdue48h,
        age: ageLabel(now, dossier.submittedAt ?? dossier.createdAt),
      }
    })
    const schools = [...new Set(rows.map((row) => row.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"))

    let dossier = null
    let dossierNotFound = false
    if (params.id) {
      const entry = dossiers.find((item) => item.profile.user_id === params.id)
      if (entry) dossier = await openDossier(service, entry, now)
      else dossierNotFound = true
    }

    return {
      now: now.toISOString(),
      today,
      onglet: params.onglet,
      q: params.q,
      ecole: params.ecole,
      counts,
      oldestAgeDays,
      rows,
      total,
      page,
      pageCount,
      pageSize: QUEUE_PAGE_SIZE,
      schools,
      dossier,
      dossierNotFound,
    }
  } catch (err) {
    console.error("[admin-verifications] file:", err?.message)
    return { error: ERR_READ }
  }
}

/** Dossier ouvert : seul endroit où la carte (URL signée courte), l'e-mail et la date de dépôt sont lus. */
async function openDossier(service, { profile, dossier, tab }, now) {
  const [declaredRes, authRes] = await Promise.all([
    service.from("student_profiles").select("school, level, card_url").eq("user_id", profile.user_id).maybeSingle(),
    service.auth.admin.getUserById(profile.user_id),
  ])
  if (declaredRes.error) throw new Error("Lecture impossible.")
  const hints = dossierHints(dossier, now)
  const cardView = await signStudentCard(service, profile.user_id, declaredRes.data?.card_url, 300)
  return {
    userId: profile.user_id,
    name: profile.full_name ?? "",
    avatarUrl: profile.avatar_url ?? null,
    email: authRes.data?.user?.email ?? null,
    school: declaredRes.data?.school ?? null,
    level: declaredRes.data?.level ?? null,
    tab,
    kind: hints.kind,
    overdue48h: hints.overdue48h,
    ageDays: hints.ageDays,
    age: ageLabel(now, dossier.submittedAt ?? dossier.createdAt),
    submittedAt: profile.verification_submitted_at ?? null,
    createdAt: profile.created_at ?? null,
    verifiedUntil: profile.verified_until ?? null,
    rejectionReason: profile.rejection_reason ?? null,
    hasCard: dossier.hasCard,
    cardView,
    actions: allowedActions(tab),
  }
}
