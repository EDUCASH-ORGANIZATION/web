// @ds-screen RD-STUDENT-01
// Onglets de « Mes candidatures » (E04) : classement par statut de candidature et de mission. Pur.

/** @type {ReadonlyArray<{ id: "en-attente" | "en-cours" | "terminees" | "non-retenues", label: string }>} */
export const APPLICATION_TABS = [
  { id: "en-attente", label: "En attente" },
  { id: "en-cours", label: "En cours" },
  { id: "terminees", label: "Terminées" },
  { id: "non-retenues", label: "Non retenues" },
]

/**
 * Onglet d'une candidature.
 * - En attente : candidature en attente sur une mission encore ouverte.
 * - En cours : candidature retenue, mission non terminée ni annulée.
 * - Terminées : candidature retenue, mission terminée.
 * - Non retenues : refusée, ou mission fermée sans toi (autre étudiant retenu, mission annulée).
 * Quand `userId` est donné et que la mission a un autre étudiant retenu (`selected_student_id`), la candidature
 * est « Non retenue » quel que soit son statut : le classement ne dépend pas que de la sécurité de la base.
 * @param {{ status?: string, missions?: { status?: string, selected_student_id?: string | null } | null }} application
 * @param {string} [userId] Étudiant connecté
 * @returns {"en-attente" | "en-cours" | "terminees" | "non-retenues"}
 */
export function applicationTab(application, userId) {
  const status = application?.status
  const missionStatus = application?.missions?.status
  const selected = application?.missions?.selected_student_id
  if (userId && selected && selected !== userId) return "non-retenues"
  if (status === "accepted") {
    if (missionStatus === "done") return "terminees"
    if (missionStatus === "cancelled") return "non-retenues"
    return "en-cours"
  }
  if (status === "rejected") return "non-retenues"
  return missionStatus === undefined || missionStatus === "open" ? "en-attente" : "non-retenues"
}

/**
 * Répartit les candidatures par onglet, avec les compteurs.
 * @param {Array<{ status?: string, missions?: { status?: string } | null }>} applications
 * @returns {{ groups: Record<string, Array>, counts: Record<string, number> }}
 */
export function groupApplications(applications) {
  const groups = Object.fromEntries(APPLICATION_TABS.map((t) => [t.id, []]))
  for (const application of Array.isArray(applications) ? applications : []) {
    groups[applicationTab(application)].push(application)
  }
  const counts = Object.fromEntries(APPLICATION_TABS.map((t) => [t.id, groups[t.id].length]))
  return { groups, counts }
}

/**
 * Onglet affiché : celui de l'URL s'il existe, sinon le premier non vide, sinon « En attente ».
 * @param {unknown} requested Valeur brute de `?onglet=` (un onglet valide est gardé même vide)
 * @param {Record<string, number>} counts
 */
export function defaultApplicationTab(requested, counts) {
  const value = Array.isArray(requested) ? requested[0] : requested
  if (APPLICATION_TABS.some((t) => t.id === value)) return value
  return APPLICATION_TABS.find((t) => (counts?.[t.id] ?? 0) > 0)?.id ?? APPLICATION_TABS[0].id
}
