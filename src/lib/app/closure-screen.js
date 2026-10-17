// Logique pure des écrans « Fermer mon compte » (RD-CLOSE-01) : adresses, actions proposées pour chaque blocage,
// frise du délai de grâce et lecture prudente de la date limite portée par l'URL. Aucun accès aux données.
import { CLOSURE_GRACE_DAYS } from "../account-closure/closure-rules.js"
import { safeDateFr } from "./format.js"
import { clientMissionsHref, clientWalletHref } from "./client-routes.js"
import { studentApplicationsHref, studentMessagesHref, studentWalletHref } from "./student-routes.js"

export const CLOSURE_CONTACT_EMAIL = "contact@educash.bj"

const DAY_MS = 24 * 60 * 60 * 1000

/** Page de fermeture de chaque espace (routes actuelles conservées, comme les autres écrans de profil). */
export function closeAccountHref(space) {
  return space === "student" ? "/profile/close" : "/client/profile/close"
}

/** Profil de chaque espace, point de retour. */
export function closeProfileHref(space) {
  return space === "student" ? "/profile" : "/client/profile"
}

const MAIL_ACTION = { label: "Écrire à l'équipe", href: `mailto:${CLOSURE_CONTACT_EMAIL}` }

// Pour chaque code de blocage : icône, intitulé et action proposée par espace. `null` : aucune action.
const BLOCKERS = {
  MISSION_CLIENT_ACTIVE: {
    icon: "i-briefcase",
    title: "Mission ouverte ou en cours",
    action: { client: { label: "Voir mes missions", href: clientMissionsHref() } },
  },
  MISSION_STUDENT_ACTIVE: {
    icon: "i-clock",
    title: "Mission en cours",
    action: { student: { label: "Voir mes candidatures", href: studentApplicationsHref() } },
  },
  WALLET_NOT_EMPTY: {
    icon: "i-wallet",
    title: "Portefeuille à vider",
    action: {
      client: { label: "Voir mon portefeuille", href: clientWalletHref() },
      student: { label: "Retirer mes fonds", href: studentWalletHref() },
    },
  },
  PURCHASE_OPEN: {
    icon: "i-banknote",
    title: "Demande d'achats en cours",
    action: {
      client: { label: "Voir mes missions", href: clientMissionsHref() },
      student: { label: "Voir mes messages", href: studentMessagesHref() },
    },
  },
  REPORT_OPEN: { icon: "i-flag", title: "Signalement en cours", action: { client: MAIL_ACTION, student: MAIL_ACTION } },
  RECENT_WITHDRAWAL: {
    icon: "i-history",
    title: "Retrait récent",
    action: { student: { label: "Voir mon portefeuille", href: studentWalletHref() } },
  },
  TRANSACTION_PENDING: {
    icon: "i-history",
    title: "Transaction en attente",
    action: {
      client: { label: "Voir mon portefeuille", href: clientWalletHref() },
      student: { label: "Voir mon portefeuille", href: studentWalletHref() },
    },
  },
}

const FALLBACK = { icon: "i-info", title: "Vérification impossible", action: {} }

/**
 * Présentation d'un blocage pour un espace. Un code inconnu est traité comme une vérification impossible,
 * avec « Réessayer » (retour sur la page de fermeture).
 * @param {string} code
 * @param {"client"|"student"} space
 * @returns {{ icon: string, title: string, action: { label: string, href: string }|null }}
 */
export function blockerPresentation(code, space) {
  const entry = Object.hasOwn(BLOCKERS, code) ? BLOCKERS[code] : FALLBACK
  const role = space === "student" ? "student" : "client"
  const action = entry.action[role] ?? (entry === FALLBACK ? { label: "Réessayer", href: closeAccountHref(role) } : null)
  return { icon: entry.icon, title: entry.title, action }
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== "string" || value.trim() === "") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Frise du délai de grâce à partir de l'échéance (`dueAt`, dernier jour de réactivation). Sans échéance lisible,
 * les lignes parlent de durée (« Pendant 14 jours ») sans date.
 * @param {string|Date|null|undefined} dueAt
 * @returns {{ label: string, value: string }[]}
 */
export function graceTimeline(dueAt) {
  const due = toDate(dueAt)
  if (!due) {
    return [
      { label: "Aujourd'hui", value: "Accès coupé" },
      { label: `Pendant ${CLOSURE_GRACE_DAYS} jours`, value: "Réactivable sur demande" },
      { label: `Après ${CLOSURE_GRACE_DAYS} jours`, value: "Données effacées" },
    ]
  }
  return [
    { label: "Aujourd'hui", value: "Accès coupé" },
    { label: `Jusqu'au ${safeDateFr(due)}`, value: "Réactivable sur demande" },
    { label: `À partir du ${safeDateFr(new Date(due.getTime() + DAY_MS))}`, value: "Données effacées" },
  ]
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/

/**
 * Date limite de réactivation lue dans `?jusquau=`. Valeur d'URL non fiable : forme ISO stricte, et fenêtre
 * plausible (de la veille à la fin du délai de grâce plus un jour), sinon `null` (la page n'affiche alors aucune date).
 * @param {unknown} value
 * @param {Date} [now]
 * @returns {Date|null}
 */
export function parseClosureDeadline(value, now = new Date()) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string" || !ISO_RE.test(raw)) return null
  const date = toDate(raw)
  if (!date) return null
  const delta = date.getTime() - now.getTime()
  if (delta < -DAY_MS || delta > (CLOSURE_GRACE_DAYS + 1) * DAY_MS) return null
  return date
}
