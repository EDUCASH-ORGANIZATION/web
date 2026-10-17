// Demandes de paiement d'achats (RD-ACHATS-01) : domaine pur. Constantes, machine à états, validation, formats et
// textes fixes, sans accès aux données ni import serveur : importable côté client comme côté serveur.
//
// Règles de l'argent, à ne jamais rouvrir :
// - le client paie le vendeur directement par MoMo, hors EduCash ; l'étudiant n'avance jamais d'argent ;
// - EduCash n'est ni partie, ni dépositaire, ni garant, et ne rembourse pas ;
// - l'estimation d'achats (missions.purchases_estimate) n'entre jamais dans le séquestre, le total ni le net ;
// - la commission porte sur le service seulement : rien dans ce module n'y touche.
import { z } from "zod"
import { formatAmount } from "../app/format.js"
import { isUuid } from "./proofs.js"

export { formatAmount as formatPurchaseAmount }

// ─── Constantes ──────────────────────────────────────────────────────────────────────────────

/** Statuts d'une demande. « cancelled » est un état de la table, jamais l'un des 4 statuts de la planche. */
export const PURCHASE_STATUSES = ["pending", "paid", "received", "reported", "cancelled"]

/** Bornes du montant total d'une demande, en FCFA entiers (bloquantes). */
export const PURCHASE_AMOUNT_MIN = 100
export const PURCHASE_AMOUNT_MAX = 500000

/** Nombre de demandes non annulées au plus par mission, et numéro d'ordre le plus haut (contrainte de la table). */
export const PURCHASE_MAX_PER_MISSION = 20
export const PURCHASE_MAX_SEQ = 99

/** Au-delà de ce multiple de l'estimation de départ, un avertissement (jamais bloquant) est affiché. */
export const ESTIMATE_SOFT_RATIO = 1.5

/** Débit : créations et modifications par étudiant, et signalements par utilisateur. */
export const PURCHASE_WRITE_LIMIT = { max: 5, windowMinutes: 10 }
export const PURCHASE_REPORT_LIMIT = { max: 10, windowHours: 24 }

/** Longueurs de champs (alignées sur les contraintes de la table). */
export const VENDOR_NAME_MIN = 2
export const VENDOR_NAME_MAX = 80
export const ITEMS_MAX = 120
export const PAID_REFERENCE_MAX = 40
export const REPORT_DETAILS_MIN = 10
export const REPORT_DETAILS_MAX = 1000

/** Types de numéro du vendeur. */
export const PAYEE_KINDS = [
  { value: "merchant", label: "Numéro marchand MoMo" },
  { value: "personal", label: "Numéro MoMo personnel" },
]

/** Types de message que le serveur écrit pour une demande (jamais envoyables par un utilisateur). */
export const PURCHASE_MESSAGE_TYPES = ["purchase_request", "purchase_event"]

/** Événements d'une demande qui donnent une ligne système dans la conversation. */
export const PURCHASE_EVENTS = ["updated", "cancelled", "paid", "received", "reported"]

/** Statuts de mission connus (valeurs en base). */
const MISSION_STATUSES = ["open", "in_progress", "done", "cancelled"]

/** Motifs de signalement d'une demande d'achats ; seul « other » est commun avec la messagerie. */
export const PURCHASE_REPORT_REASONS = [
  { value: "purchase_amount_mismatch", label: "Montant différent du ticket" },
  { value: "purchase_payee_mismatch", label: "Bénéficiaire MoMo différent du vendeur" },
  { value: "purchase_vendor_not_paid", label: "Le vendeur n'a pas reçu l'argent" },
  { value: "purchase_items_not_delivered", label: "Achats non livrés" },
  { value: "other", label: "Autre" },
]

// ─── Textes (vouvoiement : étudiant comme client) ───────────────────────────────────────────

/** Avertissement affiché avant tout paiement d'achats (décision 24). Source unique, réexportée par l'aide. */
export const PAYMENT_WARNING =
  "Vérifiez le nom du bénéficiaire affiché par MoMo avant de payer. EduCash n'intervient pas dans ce paiement."

/** Note du formulaire de l'étudiant : ce que le client lira. */
export const PURCHASE_STUDENT_FORM_NOTE = `Le client verra : « ${PAYMENT_WARNING} »`

/** Rappel à l'étudiant : l'argent des achats ne passe pas par lui. */
export const PURCHASE_STUDENT_MONEY_NOTE =
  "L'argent des achats ne passe jamais par EduCash ni par vous. Seul le service reste en séquestre."

/** Rappel au client et à l'étudiant sur un paiement fait hors plateforme. */
export const PURCHASE_NO_REFUND_NOTE = "Ce paiement a eu lieu hors EduCash : l'équipe ne peut pas le rembourser."

/** Avertissement non bloquant quand le total des demandes dépasse largement l'estimation de départ. */
export const PURCHASE_ESTIMATE_EXCEEDED_NOTE =
  "Le total des demandes dépasse largement l'estimation de départ. Vérifiez les tickets avant de payer."

/** Mention affichée sur une carte dont tous les signalements sont clos. */
export const PURCHASE_REVIEWED_LABEL = "Examiné par l'équipe EduCash"

/** Case obligatoire de la fenêtre « Payé ». */
export const PURCHASE_BENEFICIARY_CHECK_LABEL = "J'ai vérifié que le nom affiché par MoMo est bien celui du vendeur."

/** Raisons de refus d'une création, avec le message vouvoyé correspondant. */
export const PURCHASE_CREATE_REFUSALS = {
  role: "Seul l'étudiant retenu peut envoyer une demande de paiement d'achats.",
  mission: "Les demandes de paiement d'achats sont possibles seulement pendant la mission.",
  estimate: "Cette mission n'a pas d'achats prévus : vous ne pouvez pas envoyer de demande de paiement.",
  limit: `Vous avez atteint la limite de ${PURCHASE_MAX_PER_MISSION} demandes pour cette mission.`,
}

const STATUS_BADGES = {
  pending: { label: "En attente de paiement", variant: "alerte" },
  paid: { label: "Payé", variant: "neutre" },
  received: { label: "Reçu par le vendeur", variant: "succes" },
  reported: { label: "Signalé", variant: "erreur" },
  cancelled: { label: "Annulée", variant: "neutre" },
}

/**
 * Libellé d'un statut (les 4 statuts de la planche, plus « Annulée »), ou "" si le statut est inconnu.
 * @param {unknown} status
 * @returns {string}
 */
export function statusLabel(status) {
  return Object.hasOwn(STATUS_BADGES, status) ? STATUS_BADGES[status].label : ""
}

/**
 * Pastille d'un statut : libellé et variante du badge du système (`badge--<variante>`). Un statut inconnu
 * donne une pastille neutre sans libellé.
 * @param {unknown} status
 * @returns {{ label: string, variant: "alerte"|"neutre"|"succes"|"erreur" }}
 */
export function statusBadge(status) {
  return Object.hasOwn(STATUS_BADGES, status) ? { ...STATUS_BADGES[status] } : { label: "", variant: "neutre" }
}

/**
 * Libellé d'un motif de signalement d'achats, ou "" s'il est inconnu.
 * @param {unknown} reason
 * @returns {string}
 */
export function purchaseReportReasonLabel(reason) {
  return PURCHASE_REPORT_REASONS.find((r) => r.value === reason)?.label ?? ""
}

// ─── Formats ─────────────────────────────────────────────────────────────────────────────────

function isSeq(seq) {
  return Number.isInteger(seq) && seq >= 1 && seq <= PURCHASE_MAX_SEQ
}

/**
 * Numéro d'une demande : 2 -> "N° 2". Chaîne vide si le numéro est invalide.
 * @param {unknown} seq
 * @returns {string}
 */
export function requestNumber(seq) {
  return isSeq(seq) ? `N° ${seq}` : ""
}

const PHONE_SEPARATORS = /[\s.\-()  ]/g
const LOCAL_PHONE = /^01[0-9]{8}$/
const E164_PHONE = /^\+22901[0-9]{8}$/

// ─── Numéro à payer ──────────────────────────────────────────────────────────────────────────

/**
 * Analyse le « numéro à payer ». Champ structuré : il n'est jamais passé au filtre de coordonnées.
 * - marchand : 4 à 10 chiffres (espaces, points et tirets tolérés), et pas un numéro de téléphone ;
 * - perso : numéro béninois à 10 chiffres commençant par 01, avec ou sans +229, normalisé en `+22901XXXXXXXX`.
 * @param {unknown} raw
 * @param {unknown} kind "merchant" ou "personal"
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function parsePayeeNumber(raw, kind) {
  const text = typeof raw === "string" ? raw.slice(0, 64).replace(PHONE_SEPARATORS, "") : ""
  if (kind === "merchant") {
    if (LOCAL_PHONE.test(text)) {
      return { ok: false, error: "Ce numéro est un numéro de téléphone : choisissez « Numéro perso »." }
    }
    if (!/^[0-9]{4,10}$/.test(text)) return { ok: false, error: "Le code marchand compte de 4 à 10 chiffres." }
    return { ok: true, value: text }
  }
  if (kind === "personal") {
    let local = text
    if (text.startsWith("+229")) local = text.slice(4)
    else if (text.startsWith("00229")) local = text.slice(5)
    else if (text.startsWith("229") && text.length === 13) local = text.slice(3)
    if (!LOCAL_PHONE.test(local)) {
      return { ok: false, error: "Indiquez un numéro béninois de 10 chiffres commençant par 01 (exemple : 01 97 12 34 56)." }
    }
    return { ok: true, value: `+229${local}` }
  }
  return { ok: false, error: "Choisissez le type de numéro du vendeur." }
}

/**
 * Numéro à payer normalisé (marchand : chiffres ; perso : `+22901XXXXXXXX`), ou null s'il est invalide.
 * @param {unknown} raw
 * @param {unknown} kind
 * @returns {string|null}
 */
export function normalizePayeeNumber(raw, kind) {
  const parsed = parsePayeeNumber(raw, kind)
  return parsed.ok ? parsed.value : null
}

/**
 * Affichage d'un numéro normalisé : `+229 01 97 12 34 56` (espaces insécables) pour un numéro perso, les
 * chiffres tels quels pour un code marchand. Chaîne vide si la valeur n'est pas un numéro normalisé.
 * @param {unknown} number
 * @returns {string}
 */
export function formatPayeeNumber(number) {
  if (typeof number !== "string") return ""
  if (E164_PHONE.test(number)) {
    const d = number.slice(4)
    return `+229 ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`
  }
  return /^[0-9]{4,10}$/.test(number) && !LOCAL_PHONE.test(number) ? number : ""
}

// Clé de comparaison d'un téléphone : les 8 chiffres béninois. Retire l'indicatif (00229, 229, +229) puis le « 01 » de
// tête du format à 10 chiffres, de sorte que l'ancien format à 8 chiffres, le format à 10 chiffres et le format
// international donnent la même clé. Une valeur qui n'a pas la forme d'un téléphone garde ses chiffres tels quels
// (un code marchand de 6 chiffres ne ressemble donc à aucun téléphone).
function phoneKey(raw) {
  if (typeof raw !== "string") return ""
  let digits = raw.slice(0, 64).replace(/[^0-9]/g, "")
  if (digits.startsWith("00229") && (digits.length === 13 || digits.length === 15)) digits = digits.slice(5)
  else if (digits.startsWith("229") && (digits.length === 11 || digits.length === 13)) digits = digits.slice(3)
  if (digits.length === 10 && digits.startsWith("01")) digits = digits.slice(2)
  return digits
}

/**
 * Le numéro à payer est-il le téléphone de profil indiqué (étudiant ou client) ? Comparaison faite côté serveur :
 * le téléphone de profil ne quitte jamais le serveur. Quel que soit le format du téléphone de profil.
 * @param {unknown} payeeNumber
 * @param {unknown} profilePhone
 * @returns {boolean}
 */
export function isProfilePhone(payeeNumber, profilePhone) {
  const a = phoneKey(payeeNumber)
  const b = phoneKey(profilePhone)
  return a !== "" && a === b
}

// ─── Montant ─────────────────────────────────────────────────────────────────────────────────

const AMOUNT_ERROR = `Le montant doit être un nombre entier de FCFA, de ${PURCHASE_AMOUNT_MIN} à 500 000.`

/**
 * Montant total indiqué : un entier, ou une chaîne de chiffres avec espaces de milliers tolérés. Ni décimale, ni
 * signe, ni notation scientifique, ni hors des bornes.
 * @param {unknown} raw
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
export function parsePurchaseAmount(raw) {
  let value = NaN
  if (typeof raw === "number") value = raw
  else if (typeof raw === "string") {
    const digits = raw.slice(0, 32).replace(/[\s  ]/g, "")
    if (/^[0-9]{1,9}$/.test(digits)) value = Number(digits)
  }
  if (!Number.isSafeInteger(value) || value < PURCHASE_AMOUNT_MIN || value > PURCHASE_AMOUNT_MAX) {
    return { ok: false, error: AMOUNT_ERROR }
  }
  return { ok: true, value }
}

/**
 * Le total des demandes dépasse-t-il 1,5 fois l'estimation de départ ? Sans estimation : jamais. L'estimation
 * sert de repère d'avertissement, elle n'est additionnée à rien.
 * @param {{ requested: number, estimate: number|null|undefined }} totals
 * @returns {boolean}
 */
export function exceedsEstimate({ requested, estimate } = {}) {
  if (!Number.isFinite(requested) || !Number.isFinite(estimate) || estimate <= 0) return false
  return requested > estimate * ESTIMATE_SOFT_RATIO
}

/**
 * Totaux d'une liste de demandes. Les lignes invalides (statut inconnu, montant non entier ou négatif) sont
 * ignorées. Une demande annulée n'est comptée nulle part ; « paid » regroupe les statuts Payé et Reçu ; une demande
 * signalée est comptée à part. L'estimation de départ n'est jamais un paramètre : elle n'est jamais additionnée.
 * @param {Array<{ status?: string, amount?: number }>} requests
 * @returns {{ count: number, requested: number, paid: number, pending: number, reported: number }}
 */
export function purchaseTotals(requests) {
  const totals = { count: 0, requested: 0, paid: 0, pending: 0, reported: 0 }
  if (!Array.isArray(requests)) return totals
  for (const row of requests) {
    const amount = row?.amount
    if (!Number.isSafeInteger(amount) || amount <= 0) continue
    const status = row?.status
    if (status === "cancelled" || !PURCHASE_STATUSES.includes(status)) continue
    totals.count += 1
    totals.requested += amount
    if (status === "pending") totals.pending += amount
    else if (status === "reported") totals.reported += amount
    else totals.paid += amount
  }
  return totals
}

/**
 * Prochain numéro d'ordre d'une mission (maximum plus un), ou null au-delà de 99.
 * @param {Array<{ seq?: number }>} requests toutes les demandes de la mission, annulées comprises
 * @returns {number|null}
 */
export function nextSeq(requests) {
  const max = Array.isArray(requests) ? requests.reduce((m, r) => (isSeq(r?.seq) && r.seq > m ? r.seq : m), 0) : 0
  return max + 1 <= PURCHASE_MAX_SEQ ? max + 1 : null
}

// ─── Machine à états ─────────────────────────────────────────────────────────────────────────

const BOTH = ["student", "client"]
const IN_PROGRESS = ["in_progress"]
const IN_PROGRESS_OR_DONE = ["in_progress", "done"]

// Chaque action : statuts de départ, statut d'arrivée, rôles et statuts de mission autorisés (D1 et D5).
const ACTIONS = {
  edit: { from: ["pending"], to: "pending", roles: ["student"], missions: IN_PROGRESS },
  cancel: { from: ["pending"], to: "cancelled", roles: ["student"], missions: IN_PROGRESS },
  markPaid: { from: ["pending"], to: "paid", roles: ["client"], missions: IN_PROGRESS_OR_DONE },
  confirmReceived: { from: ["paid"], to: "received", roles: ["student"], missions: IN_PROGRESS_OR_DONE },
  report: { from: ["pending", "paid", "received", "reported"], to: "reported", roles: BOTH, missions: MISSION_STATUSES },
}

/**
 * Passage d'un statut à un autre autorisé pour ce rôle (sans regarder la mission). Seul le client marque
 * « Payé », seul l'étudiant crée, modifie, annule et confirme la réception, les deux signalent. Un statut qui
 * ne change pas n'est une transition que pour la modification d'une demande en attente.
 * @param {unknown} from
 * @param {unknown} to
 * @param {unknown} role "student" ou "client"
 * @returns {boolean}
 */
export function canTransition(from, to, role) {
  return Object.values(ACTIONS).some(
    (a) => a.from.includes(from) && a.to === to && a.roles.includes(role) && (from !== to || a.to === "pending"),
  )
}

/**
 * Actions possibles sur une demande pour ce rôle, dans l'ordre d'affichage (action principale d'abord) :
 * `edit`, `cancel`, `markPaid`, `confirmReceived`, `report`. Un statut de mission inconnu ou un rôle inconnu
 * (l'admin n'agit jamais ici) ne donne rien. « Signaler » n'est plus proposé à qui a déjà signalé (D6).
 * @param {{ status: unknown, role: unknown, missionStatus: unknown, alreadyReportedByMe?: boolean }} context
 * @returns {Array<"edit"|"cancel"|"markPaid"|"confirmReceived"|"report">}
 */
export function allowedActions({ status, role, missionStatus, alreadyReportedByMe = false } = {}) {
  if (!BOTH.includes(role) || !MISSION_STATUSES.includes(missionStatus)) return []
  return Object.entries(ACTIONS)
    .filter(([name, a]) => {
      if (!a.from.includes(status) || !a.roles.includes(role) || !a.missions.includes(missionStatus)) return false
      return name !== "report" || alreadyReportedByMe !== true
    })
    .map(([name]) => name)
}

/**
 * Une nouvelle demande est-elle possible ? Réservé à l'étudiant, sur une mission en cours avec achats prévus
 * (estimation non nulle), tant que la limite de demandes non annulées n'est pas atteinte.
 * @param {{ role: unknown, missionStatus: unknown, purchasesEstimate: unknown, activeCount: number, nextSeq?: number|null }} context
 * @returns {{ ok: true } | { ok: false, reason: "role"|"mission"|"estimate"|"limit", message: string }}
 */
export function canCreateRequest({ role, missionStatus, purchasesEstimate, activeCount, nextSeq: seq } = {}) {
  const refuse = (reason) => ({ ok: false, reason, message: PURCHASE_CREATE_REFUSALS[reason] })
  if (role !== "student") return refuse("role")
  if (missionStatus !== "in_progress") return refuse("mission")
  if (!Number.isFinite(purchasesEstimate) || purchasesEstimate <= 0) return refuse("estimate")
  if (!Number.isFinite(activeCount) || activeCount >= PURCHASE_MAX_PER_MISSION || seq === null) return refuse("limit")
  return { ok: true }
}

// ─── Textes fixes des messages ───────────────────────────────────────────────────────────────

/**
 * Contenu FIXE d'un message d'achat, écrit par le serveur : sans numéro, sans nom de vendeur, sans montant. Ces
 * messages ne passent jamais par le filtre de coordonnées. Null si le type, l'événement ou le numéro est invalide.
 * @param {"purchase_request"|"purchase_event"} type
 * @param {number} seq numéro d'ordre de la demande
 * @param {"updated"|"cancelled"|"paid"|"received"|"reported"} [event] requis pour « purchase_event »
 * @returns {string|null}
 */
export function purchaseMessageContent(type, seq, event) {
  if (!isSeq(seq)) return null
  const number = requestNumber(seq)
  if (type === "purchase_request") return `Demande de paiement d'achats ${number}`
  if (type !== "purchase_event") return null
  switch (event) {
    case "updated":
      return `La demande ${number} a été modifiée.`
    case "cancelled":
      return `La demande ${number} a été annulée.`
    case "paid":
      return `La demande ${number} est marquée « Payé ».`
    case "received":
      return `Le vendeur a bien reçu le paiement de la demande ${number}.`
    case "reported":
      return `La demande ${number} a été signalée.`
    default:
      return null
  }
}

/**
 * Le contenu est-il exactement l'un des textes fixes de ce type de message pour cette demande ?
 * @param {string} type
 * @param {number} seq
 * @param {unknown} content
 * @returns {boolean}
 */
export function isPurchaseMessageContent(type, seq, content) {
  if (typeof content !== "string") return false
  if (type === "purchase_request") return content === purchaseMessageContent(type, seq)
  return PURCHASE_EVENTS.some((event) => content === purchaseMessageContent(type, seq, event))
}

// ─── Schémas de validation ───────────────────────────────────────────────────────────────────

const PATH_MAX = 200

function issue(ctx, message) {
  ctx.addIssue({ code: "custom", message })
  return z.NEVER
}

// Ligne de texte : espaces réduits, caractères de contrôle et de formatage retirés. Vide permis seulement si facultatif.
function lineField({ min = 0, max, required, message }) {
  return z.unknown().transform((raw, ctx) => {
    if (raw === undefined || raw === null) raw = ""
    if (typeof raw !== "string") return issue(ctx, message)
    const value = raw.replace(/\s+/gu, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim()
    if (value === "" && !required) return null
    return value.length < min || value.length > max ? issue(ctx, message) : value
  })
}

const idField = (message) =>
  z.unknown().transform((raw, ctx) => (isUuid(raw) ? raw.toLowerCase() : issue(ctx, message)))

const pathField = (message) =>
  z.unknown().transform((raw, ctx) => (typeof raw === "string" && raw.length > 0 && raw.length <= PATH_MAX ? raw : issue(ctx, message)))

const versionField = z.unknown().transform((raw, ctx) =>
  Number.isSafeInteger(raw) && raw >= 1 ? raw : issue(ctx, "Cette demande a changé. Rouvrez-la pour continuer."),
)

const amountField = z.unknown().transform((raw, ctx) => {
  const parsed = parsePurchaseAmount(raw)
  return parsed.ok ? parsed.value : issue(ctx, parsed.error)
})

const kindField = z
  .unknown()
  .transform((raw, ctx) =>
    PAYEE_KINDS.some((k) => k.value === raw) ? raw : issue(ctx, "Choisissez le type de numéro du vendeur."),
  )

// Contenu d'une demande : normalise le numéro selon le type choisi.
const contentShape = {
  payeeKind: kindField,
  payeeNumber: z.unknown(),
  payeePhotoPath: pathField("Ajoutez la photo du numéro marchand ou du panneau."),
  vendorName: lineField({
    min: VENDOR_NAME_MIN,
    max: VENDOR_NAME_MAX,
    required: true,
    message: `Le nom du vendeur compte de ${VENDOR_NAME_MIN} à ${VENDOR_NAME_MAX} caractères.`,
  }),
  items: lineField({ max: ITEMS_MAX, message: `Les articles comptent ${ITEMS_MAX} caractères au plus.` }),
  amount: amountField,
  ticketPhotoPath: pathField("Ajoutez la photo du ticket ou des articles."),
}

function withNormalizedPayee(schema) {
  return schema.transform((value, ctx) => {
    const parsed = parsePayeeNumber(value.payeeNumber, value.payeeKind)
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.error, path: ["payeeNumber"] })
      return z.NEVER
    }
    return { ...value, payeeNumber: parsed.value }
  })
}

/** Création : l'identifiant de la demande est choisi avant le téléversement des photos (dossier de preuves). */
export const createPurchaseSchema = withNormalizedPayee(
  z.object({
    missionId: idField("Cette mission est introuvable."),
    requestId: idField("Cette demande est introuvable."),
    ...contentShape,
  }),
)

/** Modification d'une demande en attente : mêmes champs, plus la version lue par l'étudiant. */
export const editPurchaseSchema = withNormalizedPayee(
  z.object({
    requestId: idField("Cette demande est introuvable."),
    expectedVersion: versionField,
    ...contentShape,
  }),
)

/** Annulation d'une demande en attente, et confirmation de réception : l'identifiant et la version lue. */
export const purchaseVersionSchema = z.object({
  requestId: idField("Cette demande est introuvable."),
  expectedVersion: versionField,
})

/** « Payé » : capture du SMS et case du bénéficiaire obligatoires, référence facultative. */
export const markPaidSchema = z.object({
  requestId: idField("Cette demande est introuvable."),
  expectedVersion: versionField,
  smsPhotoPath: pathField("Joignez la capture du SMS de paiement."),
  beneficiaryConfirmed: z.literal(true, { error: "Confirmez avoir vérifié le nom du bénéficiaire." }),
  paidReference: z.unknown().transform((raw, ctx) => {
    if (raw === undefined || raw === null) return null
    const message = `La référence ne contient que des lettres, des chiffres et des tirets (${PAID_REFERENCE_MAX} caractères au plus).`
    if (typeof raw !== "string") return issue(ctx, message)
    const value = raw.trim()
    if (value === "") return null
    return /^[A-Za-z0-9-]+$/.test(value) && value.length <= PAID_REFERENCE_MAX ? value : issue(ctx, message)
  }),
})

/** Signalement : un motif d'achats (ou « Autre ») et une explication de 10 à 1 000 caractères. */
export const reportPurchaseSchema = z.object({
  requestId: idField("Cette demande est introuvable."),
  reason: z
    .unknown()
    .transform((raw, ctx) =>
      PURCHASE_REPORT_REASONS.some((r) => r.value === raw) ? raw : issue(ctx, "Choisissez un motif de signalement."),
    ),
  details: z.unknown().transform((raw, ctx) => {
    const message = `Expliquez le problème en ${REPORT_DETAILS_MIN} à ${REPORT_DETAILS_MAX} caractères.`
    if (typeof raw !== "string") return issue(ctx, message)
    const value = raw
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/gu, " ")
      .replace(/[^\P{Cc}\n]|\p{Cf}/gu, "")
      .trim()
    return value.length < REPORT_DETAILS_MIN || value.length > REPORT_DETAILS_MAX ? issue(ctx, message) : value
  }),
})
