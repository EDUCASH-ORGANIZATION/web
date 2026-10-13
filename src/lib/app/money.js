// Répartition d'un montant bloqué en séquestre (commission de netAmount). Pur.
import { netAmount } from "../constants/missions.js"

/**
 * @param {number|null|undefined} budget Budget de la mission en FCFA
 * @returns {{ total: number, commission: number, student: number }}
 */
export function escrowSplit(budget) {
  const total = Math.round(Number(budget) || 0)
  const student = netAmount(total)
  return { total, commission: total - student, student }
}
