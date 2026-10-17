// Règles pures de la fermeture de compte (RD-CLOSE-01) : cycle de vie, délai de grâce, blocages, patchs de
// pseudonymisation et entrées du journal. Module pur : aucun accès aux données, aucune lecture de l'environnement,
// aucun import serveur, Next ou Supabase. Tout est fail-closed : une valeur douteuse (date illisible, lecture
// échouée) ne rend jamais un compte réactivable ni pseudonymisable.
//
// Les dates sont lues et calculées en UTC. Une date sous forme de chaîne doit porter son fuseau explicite
// (Z ou +hh:mm), sinon elle est refusée.

/**
 * Délai de grâce (jours) entre la fermeture et la pseudonymisation automatique. Modifiable, mais doit rester
 * strictement inférieur à 30 jours pour tenir la promesse de la politique de confidentialité (test de garde).
 */
export const CLOSURE_GRACE_DAYS = 14

/** Comptes traités par passage du cron. */
export const ACCOUNT_BATCH = 20

/** Coupe-circuit : plus de nouveaux candidats que cela dans un passage, aucune nouvelle revendication. */
export const ACCOUNT_BREAKER = 10

/** Un retrait de moins de ce nombre de jours bloque la fermeture. */
export const RECENT_WITHDRAWAL_DAYS = 7

/** Libellé affiché à la place du nom d'un compte pseudonymisé (sert aussi de marqueur de fin). */
export const CLOSED_ACCOUNT_LABEL = "Compte clôturé"

/** Libellé affiché dans les écrans admin à la place d'une adresse pseudonyme. */
export const ERASED_EMAIL_LABEL = "Adresse effacée (compte clôturé)"

/** Domaine réservé (RFC 2606) des adresses pseudonymes. */
export const CLOSED_EMAIL_DOMAIN = "comptes-clotures.invalid"

const DAY_MS = 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TZ_RE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i

/**
 * Adresse pseudonyme d'un compte pseudonymisé.
 * @param {string} userId
 * @returns {string}
 */
export function pseudonymousEmail(userId) {
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    throw new Error("pseudonymousEmail : identifiant invalide")
  }
  return `${userId.toLowerCase()}@${CLOSED_EMAIL_DOMAIN}`
}

/**
 * Vrai si l'adresse est une adresse pseudonyme (domaine réservé exact, casse indifférente).
 * @param {unknown} address
 * @returns {boolean}
 */
export function isClosedEmail(address) {
  if (typeof address !== "string") return false
  const value = address.trim().toLowerCase()
  const at = value.lastIndexOf("@")
  return at > 0 && value.slice(at + 1) === CLOSED_EMAIL_DOMAIN
}

function normalizeName(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr-FR")
}

const RESERVED_NAME = normalizeName(CLOSED_ACCOUNT_LABEL)

/**
 * Vrai si le nom saisi imite le libellé réservé (casse, accents, espaces et caractères invisibles ignorés).
 * @param {unknown} name
 * @returns {boolean}
 */
export function isReservedDisplayName(name) {
  if (typeof name !== "string") return false
  return normalizeName(name) === RESERVED_NAME
}

function toMs(value) {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    if (!TZ_RE.test(value.trim())) return null
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

function hasValue(value) {
  return value !== null && value !== undefined
}

/**
 * État du cycle de vie d'un profil : active, closed, pseudonymizing ou pseudonymized.
 * @param {{ closed_at?: unknown, pseudonymized_at?: unknown, full_name?: unknown }|null|undefined} profile
 * @returns {"active"|"closed"|"pseudonymizing"|"pseudonymized"}
 */
export function closureState(profile) {
  if (!profile || typeof profile !== "object") return "active"
  if (hasValue(profile.pseudonymized_at)) {
    return profile.full_name === CLOSED_ACCOUNT_LABEL ? "pseudonymized" : "pseudonymizing"
  }
  return hasValue(profile.closed_at) ? "closed" : "active"
}

/**
 * La réactivation n'est possible que pour un compte fermé et pas encore pseudonymisé.
 * @param {object|null|undefined} profile
 * @returns {boolean}
 */
export function canReopen(profile) {
  return closureState(profile) === "closed"
}

/**
 * Échéance de pseudonymisation : fermeture + CLOSURE_GRACE_DAYS (calculée, non stockée).
 * @param {unknown} closedAt
 * @returns {Date|null} null si la date est absente ou illisible
 */
export function closureDueAt(closedAt) {
  const ms = toMs(closedAt)
  return ms === null ? null : new Date(ms + CLOSURE_GRACE_DAYS * DAY_MS)
}

/**
 * Vrai si le compte est fermé (non pseudonymisé) et que l'échéance est atteinte.
 * @param {object|null|undefined} profile
 * @param {Date|number|string} now
 * @returns {boolean}
 */
export function isDueForPseudonymization(profile, now) {
  if (closureState(profile) !== "closed") return false
  const due = closureDueAt(profile.closed_at)
  const nowMs = toMs(now)
  if (due === null || nowMs === null) return false
  return nowMs >= due.getTime()
}

export const CLOSURE_BLOCKERS = Object.freeze({
  READ_ERROR: "READ_ERROR",
  ROLE_ADMIN: "ROLE_ADMIN",
  MISSION_CLIENT_ACTIVE: "MISSION_CLIENT_ACTIVE",
  MISSION_STUDENT_ACTIVE: "MISSION_STUDENT_ACTIVE",
  WALLET_NOT_EMPTY: "WALLET_NOT_EMPTY",
  PURCHASE_OPEN: "PURCHASE_OPEN",
  REPORT_OPEN: "REPORT_OPEN",
  RECENT_WITHDRAWAL: "RECENT_WITHDRAWAL",
  TRANSACTION_PENDING: "TRANSACTION_PENDING",
})

const BLOCKER_MESSAGES = {
  READ_ERROR: {
    admin: "Les vérifications n'ont pas pu aboutir. Réessayez dans un instant.",
    self: "Nous n'avons pas pu vérifier l'état de votre compte. Réessayez dans un instant.",
  },
  ROLE_ADMIN: {
    admin: "Un compte administrateur ne peut pas être fermé depuis cet écran.",
    self: "Un compte administrateur ne peut pas être fermé de cette manière.",
  },
  MISSION_CLIENT_ACTIVE: {
    admin: "Ce compte a une mission ouverte ou en cours. Terminez-la ou annulez-la avant la fermeture.",
    self: "Vous avez une mission ouverte ou en cours. Terminez-la ou annulez-la avant de fermer votre compte.",
  },
  MISSION_STUDENT_ACTIVE: {
    admin: "Ce compte a une mission en cours en tant qu'étudiant. Terminez-la avant la fermeture.",
    self: "Vous avez une mission en cours. Terminez-la avant de fermer votre compte.",
  },
  WALLET_NOT_EMPTY: {
    admin: "Le portefeuille de ce compte n'est pas à zéro (solde ou montant réservé). Videz-le avant la fermeture.",
    self: "Votre portefeuille n'est pas à zéro (solde ou montant réservé). Retirez votre solde avant de fermer votre compte.",
  },
  PURCHASE_OPEN: {
    admin: "Ce compte a une demande d'achat en attente ou payée. Attendez son traitement avant la fermeture.",
    self: "Vous avez une demande d'achat en attente ou payée. Attendez son traitement avant de fermer votre compte.",
  },
  REPORT_OPEN: {
    admin: "Un signalement est en cours sur ce compte. Traitez-le avant la fermeture.",
    self: "Un signalement vous concernant est en cours de traitement. Vous pourrez fermer votre compte une fois celui-ci terminé.",
  },
  RECENT_WITHDRAWAL: {
    admin: `Ce compte a effectué un retrait il y a moins de ${RECENT_WITHDRAWAL_DAYS} jours. Réessayez plus tard.`,
    self: `Vous avez effectué un retrait il y a moins de ${RECENT_WITHDRAWAL_DAYS} jours. Réessayez plus tard.`,
  },
  TRANSACTION_PENDING: {
    admin: "Ce compte a une transaction en attente. Attendez son dénouement avant la fermeture.",
    self: "Vous avez une transaction en attente. Attendez son dénouement avant de fermer votre compte.",
  },
}

/**
 * Message de refus pour un code de blocage, au vouvoiement.
 * @param {string} code
 * @param {"admin"|"self"} [audience]
 * @returns {string}
 */
export function blockerMessage(code, audience = "admin") {
  const entry = Object.hasOwn(BLOCKER_MESSAGES, code) ? BLOCKER_MESSAGES[code] : BLOCKER_MESSAGES.READ_ERROR
  return audience === "self" ? entry.self : entry.admin
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0
}

function isAmount(value) {
  return typeof value === "number" && Number.isFinite(value)
}

const COUNT_FIELDS = {
  activeClientMissions: "MISSION_CLIENT_ACTIVE",
  activeStudentMissions: "MISSION_STUDENT_ACTIVE",
  openPurchases: "PURCHASE_OPEN",
  openReports: "REPORT_OPEN",
  recentWithdrawals: "RECENT_WITHDRAWAL",
  pendingTransactions: "TRANSACTION_PENDING",
}

function walletBlockers(snapshot, readOk) {
  const out = []
  if (!isAmount(snapshot.walletBalance) || !isAmount(snapshot.walletReserved)) {
    readOk.value = false
  } else if (snapshot.walletBalance !== 0 || snapshot.walletReserved !== 0) {
    out.push("WALLET_NOT_EMPTY")
  }
  return out
}

function evaluate(snapshot, { fields, withRole }) {
  const readOk = { value: !!snapshot && typeof snapshot === "object" && snapshot.readError !== true }
  if (!readOk.value) return ["READ_ERROR"]
  const found = new Set()
  if (withRole && snapshot.role === "admin") found.add("ROLE_ADMIN")
  if (withRole && typeof snapshot.role !== "string") readOk.value = false
  for (const [field, code] of Object.entries(COUNT_FIELDS)) {
    if (!fields.includes(code)) continue
    if (!isCount(snapshot[field])) readOk.value = false
    else if (snapshot[field] > 0) found.add(code)
  }
  for (const code of walletBlockers(snapshot, readOk)) found.add(code)
  if (!readOk.value) return ["READ_ERROR"]
  return Object.keys(CLOSURE_BLOCKERS).filter((code) => found.has(code))
}

const CLOSURE_FIELD_CODES = [
  "MISSION_CLIENT_ACTIVE",
  "MISSION_STUDENT_ACTIVE",
  "PURCHASE_OPEN",
  "REPORT_OPEN",
  "RECENT_WITHDRAWAL",
  "TRANSACTION_PENDING",
]

const PSEUDONYMIZATION_FIELD_CODES = [
  "MISSION_CLIENT_ACTIVE",
  "MISSION_STUDENT_ACTIVE",
  "PURCHASE_OPEN",
  "REPORT_OPEN",
  "TRANSACTION_PENDING",
]

/**
 * Blocages à la FERMETURE. Toute lecture manquante ou échouée donne ["READ_ERROR"] (fail-closed).
 * Instantané attendu : { readError?, role, activeClientMissions, activeStudentMissions, walletBalance,
 * walletReserved, openPurchases, openReports, recentWithdrawals, pendingTransactions }.
 * @param {object} snapshot
 * @returns {string[]} codes de CLOSURE_BLOCKERS, [] si rien ne bloque
 */
export function closureBlockers(snapshot) {
  return evaluate(snapshot, { fields: CLOSURE_FIELD_CODES, withRole: true })
}

/**
 * Blocages à la PSEUDONYMISATION (temps 3) : portefeuille, signalements, achats, transactions en attente, missions
 * actives (filet de sécurité) et erreurs de lecture. Le rôle et les retraits récents ne sont pas réévalués.
 * @param {object} snapshot
 * @returns {string[]}
 */
export function pseudonymizationBlockers(snapshot) {
  return evaluate(snapshot, { fields: PSEUDONYMIZATION_FIELD_CODES, withRole: false })
}

/** Mise à jour de `profiles` à la pseudonymisation (full_name est écrit en dernier, à part, par le cron). */
export const PROFILE_PSEUDONYM_PATCH = Object.freeze({
  avatar_url: null,
  bio: null,
  phone: null,
  fcm_token: null,
  rejection_reason: null,
  verification_submitted_at: null,
  verified_until: null,
  is_verified: false,
})

/** Mise à jour de `student_profiles` à la pseudonymisation. */
export const STUDENT_PROFILE_PSEUDONYM_PATCH = Object.freeze({
  school: null,
  level: null,
  availability: null,
  card_url: null,
  skills: Object.freeze([]),
})

export const CLOSURE_EVENTS = Object.freeze({
  CLOSED: "closed",
  REOPENED: "reopened",
  PSEUDONYMIZED: "pseudonymized",
})

export const ACTOR_KINDS = Object.freeze({ ADMIN: "admin", SELF: "self", SYSTEM: "system" })

export const CLOSURE_REASONS = Object.freeze({
  USER_REQUEST: "user_request",
  ADMIN_DECISION: "admin_decision",
})

const AUDIT_KEYS = ["user_id", "event", "actor_kind", "actor_id", "reason_code"]

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

/**
 * Ligne du journal `account_closure_events` : uuid, codes et rien d'autre.
 * @param {{ userId: string, event: string, actorKind: string, actorId?: string|null, reasonCode?: string|null }} input
 * @returns {{ user_id: string, event: string, actor_kind: string, actor_id: string|null, reason_code: string|null }}
 */
export function closureAuditEntry({ userId, event, actorKind, actorId = null, reasonCode = null } = {}) {
  if (!isUuid(userId)) throw new Error("closureAuditEntry : compte invalide")
  if (!Object.values(CLOSURE_EVENTS).includes(event)) throw new Error("closureAuditEntry : événement invalide")
  if (!Object.values(ACTOR_KINDS).includes(actorKind)) throw new Error("closureAuditEntry : acteur invalide")
  if (actorKind === ACTOR_KINDS.ADMIN && !isUuid(actorId)) throw new Error("closureAuditEntry : admin requis")
  if (actorKind !== ACTOR_KINDS.ADMIN && actorId !== null) throw new Error("closureAuditEntry : acteur non admin")
  if (reasonCode !== null && !Object.values(CLOSURE_REASONS).includes(reasonCode)) {
    throw new Error("closureAuditEntry : motif invalide")
  }
  return {
    user_id: userId.toLowerCase(),
    event,
    actor_kind: actorKind,
    actor_id: actorId === null ? null : actorId.toLowerCase(),
    reason_code: reasonCode,
  }
}

/**
 * Vrai si l'entrée ne contient que les cinq champs attendus, avec des uuid et des codes de listes fermées.
 * @param {unknown} entry
 * @returns {boolean}
 */
export function auditHasNoPersonalData(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
  const keys = Object.keys(entry)
  if (keys.some((key) => !AUDIT_KEYS.includes(key))) return false
  if (!isUuid(entry.user_id)) return false
  if (!Object.values(CLOSURE_EVENTS).includes(entry.event)) return false
  if (!Object.values(ACTOR_KINDS).includes(entry.actor_kind)) return false
  if (entry.actor_id !== undefined && entry.actor_id !== null && !isUuid(entry.actor_id)) return false
  if (
    entry.reason_code !== undefined &&
    entry.reason_code !== null &&
    !Object.values(CLOSURE_REASONS).includes(entry.reason_code)
  ) {
    return false
  }
  return true
}
