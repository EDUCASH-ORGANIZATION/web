// Règles de modération de la messagerie (RD-MSG-01). Module pur : constantes et fonctions sans accès aux données,
// importable côté client comme côté serveur.

/** Types de détection du filtre de coordonnées (colonne kinds du journal). */
export const CONTACT_KINDS = ["phone", "email", "link", "social", "phone_split", "contact_keyword", "payment_keyword"]
/** Types masqués dans le texte ; les mots-clés ne sont jamais masqués. */
export const MASKABLE_KINDS = ["phone", "email", "link", "social", "phone_split"]

/** Nombre de messages masqués, sur la fenêtre ci-dessous, qui déclenche l'alerte admin. */
export const CONTACT_ALERT_THRESHOLD = 3
/** Fenêtre glissante, en jours, du compteur de messages masqués. */
export const CONTACT_ALERT_WINDOW_DAYS = 30

/** Fenêtre, en minutes, dans laquelle le serveur relit les messages précédents pour repérer un numéro découpé. */
export const SPLIT_WINDOW_MINUTES = 5
/** Nombre de messages texte précédents du même expéditeur relus pour repérer un numéro découpé. */
export const SPLIT_LOOKBACK = 2

/** Motifs de signalement proposés à l'utilisateur (textes visibles, au vouvoiement). */
export const REPORT_REASONS = [
  { value: "harassment", label: "Harcèlement ou insulte" },
  { value: "scam", label: "Arnaque ou demande d'argent" },
  { value: "contact_details", label: "Coordonnées ou contact hors EduCash" },
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "other", label: "Autre" },
]

/** Statuts d'un signalement : ouvert, en cours, résolu, classé. */
export const REPORT_STATUSES = ["open", "in_progress", "resolved", "dismissed"]

/** Longueur maximale du commentaire libre d'un signalement. */
export const REPORT_DETAILS_MAX = 1000

/**
 * Référence lisible d'un signalement : 42 -> "SIG-0042".
 * @param {number} number numéro séquentiel du signalement (entier positif)
 * @returns {string | null} null si le numéro n'est pas un entier positif
 */
export function reportReference(number) {
  if (!Number.isSafeInteger(number) || number < 1) return null
  return `SIG-${String(number).padStart(4, "0")}`
}
