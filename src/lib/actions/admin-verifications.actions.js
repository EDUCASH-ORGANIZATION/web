"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email/index"
import { todayInBenin } from "@/lib/vitrine/dates"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { escapeLike } from "@/lib/student-space/explore-query"
import { notify as notifyInApp } from "@/lib/notifications/notify"
import { badgeRevoked, verificationApproved, verificationRejected, verificationReset } from "@/lib/notifications/catalog"
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
  beninDay,
  classifyDossier,
  dossierHints,
  matchesDelay,
  parseVerificationParams,
  sortQueue,
} from "@/lib/admin-space/verification-queue"
import {
  inChunks,
  logAdminAction,
  readAllRows,
  requireAdminService,
  signStudentCard,
} from "./admin-context"

const ERR_INVALID = "Ce dossier est introuvable."
const ERR_STATE = "Ce dossier a déjà été traité ou a changé. Rechargez la page."
const ERR_WRITE = "La décision n'a pas pu être enregistrée. Réessayez dans un instant."
const ERR_READ = "Les dossiers n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_TOKEN = "Ce dossier a changé. Rechargez la page."
const ERR_SUSPENDED = "Ce compte est suspendu : sa carte ne peut pas être traitée. Réactivez le compte avant de décider."
const ERR_SUSPENDED_RESET =
  "Ce compte est suspendu : son refus ne peut pas être réinitialisé. Réactivez le compte avant de décider."
const CARDS_BUCKET = "student-cards"

const PROFILE_COLUMNS =
  "user_id, full_name, avatar_url, is_verified, verified_until, rejection_reason, verification_submitted_at, created_at"
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://educash.bj"

function revalidateQueue() {
  revalidatePath("/admin/verifications")
  revalidatePath("/admin/dashboard")
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

/** Chemin de carte attendu : une chaîne non vide et bornée, sinon refus (le chemin fait partie du jeton). */
function readCardPath(value) {
  if (typeof value !== "string" || value === "" || value.length > 300) return { invalid: true }
  return { path: value }
}

/** Dossier tel que lu avant une décision : profil de l'étudiant (rôle étudiant seulement) et présence de la carte. */
async function readDossier(service, userId) {
  const [profileRes, cardRes] = await Promise.all([
    service
      .from("profiles")
      .select("user_id, full_name, is_verified, is_suspended, verified_until, rejection_reason, verification_submitted_at")
      .eq("user_id", userId)
      .eq("role", "student")
      .maybeSingle(),
    service.from("student_profiles").select("school, card_url").eq("user_id", userId).not("card_url", "is", null).maybeSingle(),
  ])
  if (profileRes.error || cardRes.error) return { failed: true }
  if (!profileRes.data) return { missing: true }
  return {
    profile: profileRes.data,
    hasCard: Boolean(cardRes.data),
    school: cardRes.data?.school ?? null,
    cardPath: cardRes.data ? toOwnedStoragePath(cardRes.data.card_url, CARDS_BUCKET, userId) : null,
  }
}

// Noms de fichiers générés par l'application : `card-<uuid>.<ext>` (inscription) et
// `carte-<horodatage>-<uuid8>.<jpg|png|pdf>` (renvoi depuis l'espace étudiant, voir cardStoragePath dans
// src/lib/storage/card-paths.js). Ils ne contiennent aucune donnée personnelle.
const GENERATED_CARD_NAME = [
  /^card-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/i,
  /^carte-\d{10,16}-[0-9a-f]{8}\.(jpg|png|pdf)$/i,
]

/**
 * Référence du fichier de carte pour le journal, sans dossier ni identifiant de l'utilisateur. Règle : un nom généré
 * par l'application (voir GENERATED_CARD_NAME : `card-<uuid>.<ext>` ou `carte-<horodatage>-<uuid8>.<jpg|png|pdf>`)
 * est gardé tel quel ; tout autre nom (un ancien `card_url` peut porter
 * le nom d'origine du fichier, donc une donnée personnelle) est remplacé par `fichier-<8 premiers caractères du
 * SHA-256 du nom>` suivi de l'extension si elle est lisible (1 à 5 lettres ou chiffres). Le nom d'origine n'est
 * jamais écrit dans le journal.
 */
function fileRef(cardUrl) {
  if (typeof cardUrl !== "string" || cardUrl === "") return null
  const name = cardUrl.split(/[?#]/)[0].split("/").pop()
  if (!name) return null
  if (GENERATED_CARD_NAME.some((re) => re.test(name))) return name
  const dot = name.lastIndexOf(".")
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
  const short = createHash("sha256").update(name).digest("hex").slice(0, 8)
  return /^[a-z0-9]{1,5}$/.test(ext) ? `fichier-${short}.${ext}` : `fichier-${short}`
}

/** Nom, établissement et adresse du destinataire de l'e-mail de décision (adresse lue côté serveur). */
async function readEmailTarget(service, userId) {
  const [profileRes, schoolRes, authRes] = await Promise.all([
    service.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    service.from("student_profiles").select("school").eq("user_id", userId).maybeSingle(),
    service.auth.admin.getUserById(userId),
  ])
  if (profileRes.error) console.error("[admin-verifications] e-mail : lecture du nom impossible")
  if (schoolRes.error) console.error("[admin-verifications] e-mail : lecture de l'établissement impossible")
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
 * Écrit la notification in-app de la décision, avant l'e-mail. Ne lève jamais : la décision est déjà écrite, un
 * échec de notification ne change ni le résultat ni l'envoi de l'e-mail.
 * @param {string} userId
 * @param {() => object} build constructeur du catalogue (appelé dans le try)
 */
async function notifyDecision(userId, build) {
  try {
    await notifyInApp({ recipientId: userId, ...build() })
  } catch {
    console.error("[admin-verifications] notification non écrite")
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

/** Valide l'identifiant et lit le dossier ; renvoie le dossier « À examiner » (même carte que celle affichée) ou un refus. */
async function pendingDossier(service, userId, today, expectedCardPath) {
  const id = uuidSchema.safeParse(userId)
  if (!id.success) return { error: ERR_INVALID }
  const dossier = await readDossier(service, id.data)
  if (dossier.failed) return { error: ERR_WRITE }
  if (dossier.missing || !dossier.hasCard) return { error: ERR_STATE }
  const { profile } = dossier
  if (profile.is_suspended === true) return { error: ERR_SUSPENDED }
  // Jeton composite : la carte lue maintenant doit être celle que l'administrateur a vue.
  if (!dossier.cardPath || dossier.cardPath !== expectedCardPath) return { error: ERR_STATE }
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
 * après l'écriture. Le jeton est composite : date de dépôt ET chemin de la carte affichés. Le chemin est relu avant
 * l'écriture (refus si la carte a changé) et la date garde l'UPDATE conditionnel ; un double clic, un autre
 * administrateur ou une carte remplacée depuis l'affichage donnent un refus sans écriture ni e-mail. Un étudiant
 * suspendu n'est pas validé. La relecture du chemin et l'UPDATE restent deux requêtes : une carte envoyée entre les
 * deux est neutralisée par l'enregistrement de l'étudiant, qui écrit la carte puis remet `is_verified` à faux.
 * @param {string} userId
 * @param {{ expectedSubmittedAt?: string | null, expectedCardPath?: string }} [options]
 * @returns {Promise<{ success: true, verifiedUntil: string, emailSent: boolean } | { error: string }>}
 */
export async function approveStudentCard(userId, { expectedSubmittedAt, expectedCardPath } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const token = readToken(expectedSubmittedAt)
  if (token.invalid) return { error: ERR_TOKEN }
  const cardPath = readCardPath(expectedCardPath)
  if (cardPath.invalid) return { error: ERR_TOKEN }
  try {
    const today = todayInBenin()
    const found = await pendingDossier(service, userId, today, cardPath.path)
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
    await notifyDecision(found.id, () => verificationApproved({ verifiedUntil }))
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
 * @param {{ reason?: string, message?: string, expectedSubmittedAt?: string | null, expectedCardPath?: string }} [input]
 * @returns {Promise<{ success: true, emailSent: boolean } | { error: string }>}
 */
export async function rejectStudentCard(userId, { reason, message, expectedSubmittedAt, expectedCardPath } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { admin, service } = ctx

  const parsed = rejectSchema.safeParse({ reason, message })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Motif invalide." }
  const token = readToken(expectedSubmittedAt)
  if (token.invalid) return { error: ERR_TOKEN }
  const cardPath = readCardPath(expectedCardPath)
  if (cardPath.invalid) return { error: ERR_TOKEN }
  try {
    const found = await pendingDossier(service, userId, todayInBenin(), cardPath.path)
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
    // Notification : le libellé de la liste fermée, jamais le message libre de l'administrateur.
    await notifyDecision(found.id, () =>
      verificationRejected({ reasonLabel: label, submittedAt: found.dossier.profile.verification_submitted_at }),
    )
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
 * Efface le motif d'un refus et retire la carte refusée : le dossier passe en « Incomplets » jusqu'à ce que
 * l'étudiant renvoie une carte (il ne revient jamais en « À examiner » avec l'ancienne carte). Seulement si un
 * motif existe ; un compte suspendu n'est pas réinitialisé (comme pour la validation et le refus).
 *
 * Ordre et conditions (aucune écriture inconditionnelle) :
 * 1. relectures SUCCESSIVES (deux requêtes, donc deux instantanés) : d'abord le chemin de carte actuel (`old`),
 *    PUIS le profil (motif non nul, jeton `verification_submitted_at`, compte non suspendu). L'ordre compte : le
 *    renvoi d'une carte passe par `student_profiles_card_guard`, qui efface le motif dans la même transaction. Un
 *    renvoi entre les deux lectures laisse donc un profil relu sans motif : refus sans aucune écriture. Des lectures
 *    parallèles pourraient voir l'ancien motif et la nouvelle carte, et l'étape 2 effacerait la nouvelle carte ;
 * 2. effacement de la carte seulement si le chemin est toujours `old` (exactement une ligne, sinon refus
 *    sans autre écriture) ; étape sautée s'il n'y a plus de carte ;
 * 3. effacement du motif seulement si le motif est toujours présent, le jeton inchangé et l'étudiant non vérifié
 *    (exactement une ligne).
 * Une carte renvoyée après les deux lectures et avant 2 fait échouer l'étape 2 (chemin différent de `old`) ; une
 * carte renvoyée entre 2 et 3 efface le motif et date le dépôt : l'étape 3 ne trouve aucune ligne et la nouvelle
 * carte est conservée. Si l'étape 3 échoue, le dossier reste « Refusés » sans carte (côté étudiant : carte
 * refusée, aucune candidature possible, renvoi possible) et l'action peut être relancée.
 *
 * La garde SQL de production autorise `card_url` NULL (supabase/schema.sql, `student_profiles_card_guard` :
 * `if new.card_url is null then return new`, sans toucher au profil). La preuve du refus reste dans le journal `verification.reject`. Le fichier refusé
 * reste dans le bucket (orphelin accepté, aucune suppression) ; le journal `verification.reset` n'en garde qu'une
 * référence (`fileRef`), sans l'identifiant de l'utilisateur ni un nom de fichier d'origine.
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
    // 1. Relectures successives, jamais en parallèle : le chemin de la carte d'abord, le profil ensuite. Une carte
    // renvoyée entre les deux efface le motif (déclencheur) : le profil relu n'a plus de motif, refus sans écriture.
    const cardRes = await service.from("student_profiles").select("card_url").eq("user_id", id.data).maybeSingle()
    if (cardRes.error) {
      console.error("[admin-verifications] reset-read:", cardRes.error.message)
      return { error: ERR_WRITE }
    }
    const profileRes = await service
      .from("profiles")
      .select("user_id, is_suspended, rejection_reason, verification_submitted_at")
      .eq("user_id", id.data)
      .eq("role", "student")
      .maybeSingle()
    if (profileRes.error) {
      console.error("[admin-verifications] reset-read:", profileRes.error.message)
      return { error: ERR_WRITE }
    }
    const profile = profileRes.data
    if (!profile || profile.rejection_reason === null || profile.rejection_reason === undefined) return { error: ERR_STATE }
    if (profile.is_suspended === true) return { error: ERR_SUSPENDED_RESET }
    const motif = profile.rejection_reason
    const token = profile.verification_submitted_at ?? null
    const old = cardRes.data?.card_url ?? null

    // 2. La carte n'est effacée que si elle est toujours celle qui a été refusée.
    if (old !== null) {
      const { data, error } = await service
        .from("student_profiles")
        .update({ card_url: null })
        .eq("user_id", id.data)
        .eq("card_url", old)
        .select("user_id")
      if (error) {
        console.error("[admin-verifications] reset-card:", error.message)
        return { error: ERR_WRITE }
      }
      if (!Array.isArray(data) || data.length !== 1) return { error: ERR_STATE }
    }

    // 3. Le motif n'est effacé que si le dossier n'a pas changé depuis la relecture (motif présent, même jeton) et
    // si l'étudiant n'est pas vérifié (défense en profondeur : « motif non nul » ne l'assure que par convention).
    const written = await writeOne(
      service,
      id.data,
      { rejection_reason: null, verification_submitted_at: null },
      (q) => {
        const c = q.not("rejection_reason", "is", null).eq("is_verified", false)
        return token === null ? c.is("verification_submitted_at", null) : c.eq("verification_submitted_at", token)
      },
      "reset",
    )
    if (written.error) return { error: written.error }

    logAdminAction({
      adminId: admin.userId,
      action: "verification.reset",
      targetId: id.data,
      before: { rejectionReason: motif, fileRef: fileRef(old) },
      after: { rejectionReason: null },
      reason: why.data,
    })
    await notifyDecision(id.data, () => verificationReset({ token: token ?? undefined }))
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
    await notifyDecision(id.data, () => badgeRevoked({ reasonLabel: why.data, at: new Date() }))
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
  const rows = await readAllRows(
    () => apply(service.from(table).select("user_id")).order("user_id", { ascending: true }),
    "recherche",
  )
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
      readAllRows(
        () => service.from("profiles").select(PROFILE_COLUMNS).eq("role", "student").order("user_id", { ascending: true }),
        "file des étudiants",
      ),
      readAllRows(
        () => service.from("student_profiles").select("user_id").not("card_url", "is", null).order("user_id", { ascending: true }),
        "file des cartes",
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
    if (params.delai && params.onglet === "a-examiner") {
      tabRows = tabRows.filter((entry) => matchesDelay(dossierHints(entry.dossier, now), params.delai))
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
        submittedOn: beninDay(dossier.submittedAt),
        // Jour d'échéance seul (colonne de type date), jamais l'horodatage complet ; null si absent ou illisible.
        verifiedUntil: typeof dossier.verifiedUntil === "string" && /^\d{4}-\d{2}-\d{2}/.test(dossier.verifiedUntil.trim()) ? dossier.verifiedUntil.trim().slice(0, 10) : null,
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
      // Le filtre Délai n'existe que sur À examiner : ailleurs il n'est ni appliqué, ni renvoyé, ni recopié dans les liens.
      delai: params.onglet === "a-examiner" ? params.delai : "",
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

/** Dossier ouvert : seul endroit où la carte (URL signée courte) et la date de dépôt sont lues. */
async function openDossier(service, { profile, dossier, tab }, now) {
  const declaredRes = await service
    .from("student_profiles")
    .select("school, level, card_url")
    .eq("user_id", profile.user_id)
    .maybeSingle()
  if (declaredRes.error) throw new Error("Lecture impossible.")
  const hints = dossierHints(dossier, now)
  const cardView = await signStudentCard(service, profile.user_id, declaredRes.data?.card_url, 300)
  return {
    userId: profile.user_id,
    name: profile.full_name ?? "",
    avatarUrl: profile.avatar_url ?? null,
    school: declaredRes.data?.school ?? null,
    level: declaredRes.data?.level ?? null,
    tab,
    kind: hints.kind,
    overdue48h: hints.overdue48h,
    ageDays: hints.ageDays,
    age: ageLabel(now, dossier.submittedAt ?? dossier.createdAt),
    submittedAt: profile.verification_submitted_at ?? null,
    submittedOn: beninDay(profile.verification_submitted_at),
    today: todayInBenin(now),
    cardPath: toOwnedStoragePath(declaredRes.data?.card_url, CARDS_BUCKET, profile.user_id),
    createdAt: profile.created_at ?? null,
    verifiedUntil: profile.verified_until ?? null,
    rejectionReason: profile.rejection_reason ?? null,
    hasCard: dossier.hasCard,
    cardView,
    actions: allowedActions(tab),
  }
}
