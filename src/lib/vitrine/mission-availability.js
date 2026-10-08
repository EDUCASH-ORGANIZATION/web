import { isPastDeadline } from "./dates"

export const CLOSED_REASON_LABELS = {
  expired: "Échéance dépassée",
  in_progress: "Mission pourvue",
  done: "Terminée",
  cancelled: "Annulée",
}

/**
 * Indique si une mission accepte encore des candidatures.
 * @param {{ status: string, deadline?: string|null }} mission
 * @param {string} today "AAAA-MM-JJ"
 * @returns {{ accepting: boolean, reason: null|"expired"|"in_progress"|"done"|"cancelled" }}
 */
export function missionAvailability({ status, deadline }, today) {
  if (status === "open") {
    if (isPastDeadline(deadline, today)) return { accepting: false, reason: "expired" }
    return { accepting: true, reason: null }
  }
  if (status === "in_progress" || status === "done" || status === "cancelled") {
    return { accepting: false, reason: status }
  }
  return { accepting: false, reason: "cancelled" }
}
