// Statut affiché d'une mission, selon le tableau de _system/index.html section 08.
// Pur : importable côté client et serveur.
import { isPastDeadline } from "../vitrine/dates.js"

/**
 * @typedef {{ key: "open" | "overdue" | "in_progress" | "done" | "cancelled", label: string, tone: string }} MissionStatusView
 * `tone` est le modificateur du badge du système (`badge--<tone>`).
 */

const VIEWS = {
  open: { key: "open", label: "Ouverte", tone: "bleu" },
  overdue: { key: "overdue", label: "Échéance dépassée", tone: "erreur" },
  in_progress: { key: "in_progress", label: "En cours", tone: "citron" },
  done: { key: "done", label: "Terminée", tone: "succes" },
  cancelled: { key: "cancelled", label: "Annulée", tone: "neutre" },
}

/**
 * @param {{ status?: string, deadline?: string|null }} mission
 * @param {string} today Date du jour au Bénin "AAAA-MM-JJ" (`todayInBenin()`)
 * @returns {MissionStatusView}
 */
export function missionStatusView(mission, today) {
  const status = mission?.status
  if (status === "in_progress" || status === "done" || status === "cancelled") {
    return { ...VIEWS[status] }
  }
  if (isPastDeadline(mission?.deadline, today)) return { ...VIEWS.overdue }
  return { ...VIEWS.open }
}
