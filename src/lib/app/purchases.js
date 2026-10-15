// Mission avec achats : estimation indicative des achats, en FCFA. Pure.
// L'estimation n'est jamais bloquée, ne porte aucune commission et ne déclenche aucun paiement : elle prévient
// le client du montant qu'il devra prévoir de son côté. Le service reste le seul montant en séquestre.
import { formatAmount } from "./format.js"

/** Plafond de l'estimation : celui du budget (9 chiffres) et de la contrainte SQL. */
export const PURCHASES_ESTIMATE_MAX = 999999999

/**
 * Estimation lue en base ou reçue d'un client : un nombre fini strictement positif et borné, arrondi au
 * franc, sinon null. Aucune chaîne non numérique, aucun NaN ni Infinity n'est accepté.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function purchasesEstimateOf(raw) {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null
  if (typeof raw !== "number" && typeof raw !== "string") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > PURCHASES_ESTIMATE_MAX) return null
  const rounded = Math.round(n)
  return rounded > 0 ? rounded : null
}

/**
 * Ligne d'information d'une mission avec achats, ou null si aucune estimation (rien n'est affiché).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function purchasesLine(raw) {
  const estimate = purchasesEstimateOf(raw)
  return estimate === null ? null : `Achats estimés : environ ${formatAmount(estimate)}, non bloqués`
}
