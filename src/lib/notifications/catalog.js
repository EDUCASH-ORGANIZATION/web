// Catalogue des notifications (RD-NOTIF-01). Module pur : importable côté serveur et côté client.
// Titre et corps sont figés à la création par les constructeurs ci-dessous (vouvoiement, aucun tiret cadratin,
// aucune promesse non codée, aucun nom de prestataire). Le lien n'est jamais stocké : il est recalculé à la
// lecture par `notificationHref` à partir du type, de la mission et de l'acteur (aucune redirection ouverte).
import { isUuid } from "../vitrine/ids.js"
import { todayInBenin } from "../vitrine/dates.js"
import { formatDateFr } from "../vitrine/format.js"
import { formatAmount } from "../app/format.js"
import { clientConversationHref, clientMissionHref } from "../app/client-routes.js"
import {
  studentApplicationsHref,
  studentConversationHref,
  studentHomeHref,
  studentMissionHref,
  studentProfileHref,
  studentReviewHref,
  studentVerifyHref,
} from "../app/student-routes.js"
import { adminHomeHref, adminVerificationsHref } from "../app/admin-routes.js"

// Même liste que le CHECK de la table `notifications` (garde de cohérence : notifications-schema.guard).
export const NOTIFICATION_TYPES = Object.freeze([
  "application_received",
  "application_accepted",
  "application_rejected",
  "mission_cancelled",
  "payment_released",
  "review_received",
  "verification_approved",
  "verification_rejected",
  "verification_reset",
  "badge_revoked",
  "account_reactivated",
  "card_submitted",
  "message_received",
])

export const NOTIFICATION_SPACES = Object.freeze(["client", "student", "admin"])

export const TITLE_MAX = 120
export const BODY_MAX = 280
export const DEDUPE_KEY_MAX = 200
const MISSION_TITLE_MAX = 60
const NAME_MAX = 40
const ELLIPSIS = "..."

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

/** Texte sur une ligne : caractères de contrôle retirés, espaces réduits. */
function oneLine(value) {
  return typeof value === "string" ? value.replace(CONTROL_CHARS, " ").replace(/[ \t\r\n\f\v]+/g, " ").trim() : ""
}

/** Borne un texte à `max` caractères, avec « ... » (trois points) si coupé. */
export function truncate(value, max) {
  const text = oneLine(value)
  const chars = Array.from(text)
  if (chars.length <= max) return text
  return `${chars.slice(0, Math.max(0, max - ELLIPSIS.length)).join("").trimEnd()}${ELLIPSIS}`
}

/** Nom public « Prénom I. » (jamais le nom complet). Texte neutre si le nom est absent. */
export function shortName(fullName, fallback) {
  const parts = oneLine(fullName).split(" ").filter(Boolean)
  if (parts.length === 0) return fallback
  if (parts.length === 1) return truncate(parts[0], NAME_MAX)
  const last = parts[parts.length - 1]
  return `${truncate(parts[0], NAME_MAX)} ${last.charAt(0).toLocaleUpperCase("fr-FR")}.`
}

/** Titre de mission entre guillemets français, tronqué. */
function quoted(missionTitle) {
  const title = truncate(missionTitle, MISSION_TITLE_MAX)
  return `« ${title || "Mission EduCash"} »`
}

// Même libellé que OTHER_REASON (decision-schemas, non importé ici pour garder ce module léger côté client).
// Ce libellé seul n'apprend rien à l'étudiant : la phrase « Motif : ... » est omise.
export const OTHER_REASON_LABEL = "Autre motif"

/** Motif de refus : libellé de la liste fermée, première lettre en minuscule (sauf sigle). */
function reasonSentence(reasonLabel) {
  const label = truncate(reasonLabel, 80)
  if (!label) return ""
  if (label.toLocaleLowerCase("fr-FR") === OTHER_REASON_LABEL.toLocaleLowerCase("fr-FR")) return ""
  const [first, second] = Array.from(label)
  const lowered = second && second === second.toLocaleUpperCase("fr-FR") && second !== second.toLocaleLowerCase("fr-FR")
    ? label
    : `${first.toLocaleLowerCase("fr-FR")}${label.slice(first.length)}`
  return `Motif : ${lowered}.`
}

function dayStamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now())
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function build({ type, title, body = "", dedupeKey, missionId = null, actorId = null }) {
  return {
    type,
    title: truncate(title, TITLE_MAX),
    body: truncate(body, BODY_MAX),
    dedupeKey: String(dedupeKey).slice(0, DEDUPE_KEY_MAX),
    missionId: isUuid(missionId) ? missionId : null,
    actorId: isUuid(actorId) ? actorId : null,
  }
}

// ─── Constructeurs (un par événement produit) ────────────────────────────────────────────────

/** Au client : un étudiant a postulé. */
export function applicationReceived({ missionId, missionTitle, studentId, studentName }) {
  return build({
    type: "application_received",
    title: "Nouvelle candidature",
    body: `${shortName(studentName, "Un étudiant")} a postulé à ${quoted(missionTitle)}.`,
    dedupeKey: `application_received:${missionId}:${studentId}`,
    missionId,
    actorId: studentId,
  })
}

/** À l'étudiant retenu. */
export function applicationAccepted({ missionId, missionTitle, clientId, clientName, studentId }) {
  return build({
    type: "application_accepted",
    title: "Candidature acceptée",
    body: `${shortName(clientName, "Le client")} vous a retenu pour ${quoted(missionTitle)}. La mission démarre.`,
    dedupeKey: `application_accepted:${missionId}:${studentId}`,
    missionId,
    actorId: clientId,
  })
}

/** À un étudiant non retenu. */
export function applicationRejected({ missionId, missionTitle, clientId, studentId }) {
  return build({
    type: "application_rejected",
    title: "Candidature non retenue",
    body: `Votre candidature à ${quoted(missionTitle)} n'a pas été retenue.`,
    dedupeKey: `application_rejected:${missionId}:${studentId}`,
    missionId,
    actorId: clientId,
  })
}

/** À un étudiant dont la candidature était en attente. */
export function missionCancelled({ missionId, missionTitle, clientId }) {
  return build({
    type: "mission_cancelled",
    title: "Mission annulée",
    body: `La mission ${quoted(missionTitle)} a été annulée par le client.`,
    dedupeKey: `mission_cancelled:${missionId}`,
    missionId,
    actorId: clientId,
  })
}

/**
 * À l'étudiant retenu : fonds libérés. `amount` est le montant renvoyé par la libération ; s'il n'est pas un
 * nombre fini strictement positif, le titre reste générique (aucun montant inventé, jamais « + 0 FCFA »).
 */
export function paymentReleased({ missionId, missionTitle, clientId, amount }) {
  const known = typeof amount === "number" && Number.isFinite(amount) && Math.round(amount) > 0
  return build({
    type: "payment_released",
    title: known ? `Paiement reçu : ${formatAmount(amount, { sign: "credit" })}` : "Paiement reçu",
    body: `Le client a validé ${quoted(missionTitle)}.`,
    dedupeKey: `payment_released:${missionId}`,
    missionId,
    actorId: clientId,
  })
}

/** Avis reçu (étudiant noté par le client, ou client noté par l'étudiant). */
export function reviewReceived({ missionId, missionTitle, reviewerId, reviewerName }) {
  return build({
    type: "review_received",
    title: "Nouvel avis",
    body: `${shortName(reviewerName, "Un utilisateur")} vous a laissé un avis sur ${quoted(missionTitle)}.`,
    dedupeKey: `review_received:${missionId}:${reviewerId}`,
    missionId,
    actorId: reviewerId,
  })
}

/** Badge accordé. `verifiedUntil` : date de fin de validité (jamais une donnée de carte). */
export function verificationApproved({ verifiedUntil }) {
  const stamp = typeof verifiedUntil === "string" ? verifiedUntil : verifiedUntil instanceof Date ? verifiedUntil.toISOString() : ""
  const valid = stamp && !Number.isNaN(new Date(stamp).getTime())
  return build({
    type: "verification_approved",
    title: "Profil vérifié",
    body: valid ? `Votre badge est valable jusqu'au ${formatDateFr(stamp)}.` : "Votre badge est actif.",
    dedupeKey: `verification_approved:${valid ? stamp : "sans-date"}`,
  })
}

// Empreinte de dépôt calculée côté serveur (`dedupeFingerprint`, fingerprint.js) : la clé est lisible par son
// destinataire, elle ne contient jamais la date de dépôt en clair. Toute autre valeur est ignorée (repli unique).
const FINGERPRINT = /^[0-9a-f]{8,12}$/

function fingerprintPart(fingerprint) {
  return typeof fingerprint === "string" && FINGERPRINT.test(fingerprint) ? fingerprint : `t${Date.now().toString(36)}`
}

/**
 * Carte refusée : `reasonLabel` est un libellé de ADMIN_REJECTION_REASONS, jamais le message libre.
 * `fingerprint` : empreinte courte du dépôt (jamais la date brute).
 */
export function verificationRejected({ reasonLabel, fingerprint }) {
  const reason = reasonSentence(reasonLabel)
  return build({
    type: "verification_rejected",
    title: "Carte étudiante refusée",
    body: `${reason ? `${reason} ` : ""}Vous pouvez envoyer une nouvelle carte.`,
    dedupeKey: `verification_rejected:${fingerprintPart(fingerprint)}`,
  })
}

/** Refus levé par l'administration. `fingerprint` : empreinte courte du dépôt (jamais la date brute). */
export function verificationReset({ fingerprint }) {
  return build({
    type: "verification_reset",
    title: "Vous pouvez renvoyer votre carte",
    body: "Le refus de votre carte a été levé.",
    dedupeKey: `verification_reset:${fingerprintPart(fingerprint)}`,
  })
}

/** Badge retiré. Texte générique : le motif libre saisi par l'administrateur n'est jamais recopié. */
export function badgeRevoked({ at } = {}) {
  const date = dayStamp(at)
  return build({
    type: "badge_revoked",
    title: "Badge retiré",
    body: "Votre badge vérifié a été retiré. Consultez votre profil pour en savoir plus.",
    dedupeKey: `badge_revoked:${todayInBenin(date)}:${date.getTime()}`,
  })
}

/** Compte réactivé. */
export function accountReactivated({ at }) {
  const date = dayStamp(at)
  return build({
    type: "account_reactivated",
    title: "Votre compte est réactivé",
    body: "Vous pouvez de nouveau utiliser EduCash.",
    dedupeKey: `account_reactivated:${date.getTime()}`,
  })
}

/** Aux administrateurs : au plus une par étudiant et par jour (jour du Bénin). */
export function cardSubmitted({ studentId, studentName, at }) {
  return build({
    type: "card_submitted",
    title: "Nouveau dossier à examiner",
    body: `${shortName(studentName, "Un étudiant")} a envoyé sa carte étudiante.`,
    dedupeKey: `card_submitted:${studentId}:${todayInBenin(dayStamp(at))}`,
    actorId: studentId,
  })
}

// ─── Validation (avant écriture) ─────────────────────────────────────────────────────────────

/**
 * Contrôle d'une notification construite par le catalogue avant écriture.
 * @returns {boolean}
 */
export function isValidNotification(n) {
  return (
    Boolean(n) &&
    NOTIFICATION_TYPES.includes(n.type) &&
    typeof n.title === "string" && n.title.length >= 1 && Array.from(n.title).length <= TITLE_MAX &&
    typeof n.body === "string" && Array.from(n.body).length <= BODY_MAX &&
    typeof n.dedupeKey === "string" && n.dedupeKey.length >= 1 && n.dedupeKey.length <= DEDUPE_KEY_MAX &&
    (n.missionId === null || n.missionId === undefined || isUuid(n.missionId)) &&
    (n.actorId === null || n.actorId === undefined || isUuid(n.actorId))
  )
}

// ─── Lecture : lien, icône, action, regroupement ─────────────────────────────────────────────

// Types propres à chaque espace (un type d'un autre espace n'a pas de lien : jamais de redirection croisée).
const SPACE_TYPES = {
  client: ["application_received", "review_received", "account_reactivated", "message_received"],
  student: [
    "application_accepted",
    "application_rejected",
    "mission_cancelled",
    "payment_released",
    "review_received",
    "verification_approved",
    "verification_rejected",
    "verification_reset",
    "badge_revoked",
    "account_reactivated",
    "message_received",
  ],
  admin: ["card_submitted", "account_reactivated"],
}

/**
 * Lien interne d'une notification, construit par les fabriques d'URL. Toujours un chemin commençant par une
 * seule barre oblique. `null` si le type n'appartient pas à l'espace.
 * @param {{ type?: string, mission_id?: string|null, actor_id?: string|null }} row
 * @param {"client"|"student"|"admin"} space
 * @returns {string|null}
 */
export function notificationHref(row, space) {
  const type = row?.type
  if (!SPACE_TYPES[space]?.includes(type)) return null
  const missionId = isUuid(row.mission_id) ? row.mission_id : null
  const actorId = isUuid(row.actor_id) ? row.actor_id : null

  if (space === "client") {
    if (type === "application_received") {
      return missionId ? clientMissionHref(missionId, actorId ? { candidat: actorId } : {}) : clientMissionHref(null)
    }
    if (type === "review_received") return clientMissionHref(missionId)
    if (type === "message_received") return clientConversationHref(missionId, actorId)
    return "/client/dashboard"
  }

  if (space === "student") {
    switch (type) {
      case "application_accepted": return studentMissionHref(missionId)
      case "application_rejected":
      case "mission_cancelled": return studentApplicationsHref()
      case "payment_released": return studentReviewHref(missionId)
      case "review_received":
      case "badge_revoked": return studentProfileHref()
      case "message_received": return studentConversationHref(missionId)
      case "account_reactivated": return studentHomeHref()
      default: return studentVerifyHref()
    }
  }

  return type === "card_submitted" ? adminVerificationsHref() : adminHomeHref()
}

// Sécurité : le résultat est un chemin interne (utile aux tests d'abus et à la lecture).
export function isInternalPath(href) {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !/[\\\u0000-\u001f]/.test(href)
}

const ICONS = {
  application_received: "i-file",
  application_accepted: "i-check-circle",
  application_rejected: "i-x",
  mission_cancelled: "i-ban",
  payment_released: "i-coins",
  review_received: "i-star",
  verification_approved: "i-shield",
  verification_rejected: "i-alert-circle",
  verification_reset: "i-refresh",
  badge_revoked: "i-alert-triangle",
  account_reactivated: "i-user-check",
  card_submitted: "i-id-card",
  message_received: "i-message",
}

/** Icône du sprite (toujours une icône existante). */
export function notificationIcon(type) {
  return ICONS[type] ?? "i-bell"
}

const ACTION_LABELS = {
  application_received: "Voir la candidature",
  application_accepted: "Ouvrir la mission",
  payment_released: "Noter le client",
  verification_rejected: "Envoyer une nouvelle carte",
  card_submitted: "Examiner",
}

/** Libellé de l'action d'une notification, ou `null` (l'élément entier est alors le lien). */
export function notificationActionLabel(type) {
  return ACTION_LABELS[type] ?? null
}

/** Ton visuel : neutre pour tous les types de ce lot (aucun rouge). */
export function notificationTone() {
  return "neutre"
}

// Action prioritaire (bouton encre, un seul par vue), dans l'ordre de priorité.
const PRIMARY_TYPES = {
  client: ["application_received"],
  student: ["application_accepted", "verification_rejected"],
  admin: ["card_submitted"],
}

/**
 * Identifiant de la seule notification qui porte le bouton encre : la première non lue du premier type
 * prioritaire de l'espace. `null` s'il n'y en a pas.
 * @param {Array<{ id: string, type: string, read_at?: string|null }>} items
 * @param {"client"|"student"|"admin"} space
 * @returns {string|null}
 */
export function primaryNotificationId(items, space) {
  const list = Array.isArray(items) ? items : []
  for (const type of PRIMARY_TYPES[space] ?? []) {
    const hit = list.find((item) => item?.type === type && !item.read_at)
    if (hit) return hit.id
  }
  return null
}

/**
 * Regroupe par jour du Bénin : « Aujourd'hui » puis « Plus tôt ». Les groupes vides sont omis.
 * @param {Array<{ created_at: string }>} items
 * @param {Date} [now]
 * @returns {Array<{ key: "today"|"earlier", label: string, items: any[] }>}
 */
export function groupNotifications(items, now = new Date()) {
  const today = todayInBenin(now)
  const todayItems = []
  const earlier = []
  for (const item of Array.isArray(items) ? items : []) {
    const created = new Date(item?.created_at)
    const isToday = !Number.isNaN(created.getTime()) && todayInBenin(created) === today
    ;(isToday ? todayItems : earlier).push(item)
  }
  return [
    { key: "today", label: "Aujourd'hui", items: todayItems },
    { key: "earlier", label: "Plus tôt", items: earlier },
  ].filter((group) => group.items.length > 0)
}

const EMPTY_TEXTS = {
  client: "Vous retrouverez ici les candidatures reçues et les avis laissés sur vos missions.",
  student: "Vous retrouverez ici les réponses à vos candidatures et le suivi de votre badge.",
  admin: "Les nouveaux dossiers à examiner apparaîtront ici.",
}

/** Texte de l'état vide d'un espace (aucune promesse hors événements produits). */
export function emptyNotificationsText(space) {
  return EMPTY_TEXTS[space] ?? EMPTY_TEXTS.client
}

export const NOTIFICATIONS_EMPTY_TITLE = "Aucune notification"
export const NOTIFICATIONS_UNAVAILABLE_TITLE = "Notifications indisponibles"
export const NOTIFICATIONS_UNAVAILABLE_TEXT = "Impossible de charger vos notifications pour le moment."
