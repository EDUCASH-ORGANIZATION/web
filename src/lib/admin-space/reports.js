// @ds-screen RD-ADMIN-01
// Libellés et règles d'affichage des signalements (AD09, AD10). Module pur : aucune lecture de données.

export const REPORT_TABS = ["a-traiter", "resolus", "classes"]
export const DEFAULT_REPORT_TAB = "a-traiter"
export const DEFAULT_REPORT_SORT = "anciens"
export const REPORT_NOTE_MAX = 500

export const REPORT_TAB_LABELS = {
  "a-traiter": "À traiter",
  resolus: "Résolus",
  classes: "Classés",
}

const STATUS_VIEWS = {
  open: { label: "Ouvert", tone: "erreur" },
  in_progress: { label: "En cours", tone: "alerte" },
  resolved: { label: "Résolu", tone: "succes" },
  dismissed: { label: "Classé", tone: "neutre" },
}

/** Libellé et ton du badge d'un statut ; un statut inconnu reste lisible, sans couleur d'alerte. */
export function reportStatusView(status) {
  return STATUS_VIEWS[status] ?? { label: "Statut inconnu", tone: "neutre" }
}

/** Origine d'un signalement : saisi par un utilisateur ou levé par l'analyse automatique des messages. */
export function reportSourceLabel(source) {
  return source === "auto" ? "Alerte automatique" : "Signalement d'un utilisateur"
}

const KIND_LABELS = {
  phone: "Numéro de téléphone",
  email: "Adresse e-mail",
  link: "Lien",
  social: "Réseau social",
  phone_split: "Numéro découpé en plusieurs messages",
  contact_keyword: "Mot de contournement",
  payment_keyword: "Mot de paiement hors EduCash",
}

/** Libellé d'un type de détection (jamais la valeur détectée). */
export function detectionKindLabel(kind) {
  return KIND_LABELS[kind] ?? "Autre détection"
}

const MESSAGE_TYPE_LABELS = {
  text: "Message texte",
  image: "Image",
  voice: "Message vocal",
  location: "Position partagée",
}

export function messageTypeLabel(type) {
  return MESSAGE_TYPE_LABELS[type] ?? "Message"
}

/** Détections triées de la plus fréquente à la moins fréquente : [{ kind, label, count }]. */
export function detectionRows(byKind) {
  return Object.entries(byKind ?? {})
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([kind, count]) => ({ kind, label: detectionKindLabel(kind), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
}

/**
 * Actions possibles selon le statut : prendre en charge un signalement ouvert, résoudre ou classer un signalement
 * pris en charge. Un signalement clos n'a plus d'action.
 */
export function reportActions(status) {
  return {
    take: status === "open",
    close: status === "in_progress",
  }
}

const BENIN_TZ = "Africa/Porto-Novo"

/** Date et heure au Bénin, ex. « 8 oct. · 09:02 ». Chaîne vide si la date est absente ou illisible. */
export function reportMoment(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: BENIN_TZ }).format(date)
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: BENIN_TZ }).format(date)
  return `${day} · ${time}`
}
