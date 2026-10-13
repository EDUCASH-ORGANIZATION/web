// Filtres et présentation des mouvements du portefeuille client. Pur.
// Lecture seule des constantes de base : `database.constants.js` est un module pur sans accès Supabase.
import { WALLET_TRANSACTION_TYPES } from "../supabase/database.constants.js"

const MINUS = "−"

/**
 * Libellé, signe affiché et type de chaque mouvement vu du client.
 * Réserver et retirer sortent du disponible (signe moins) ; recharger et rembourser l'augmentent.
 * Libérer et prélever la commission déplacent des fonds déjà bloqués : aucun signe.
 */
export const WALLET_TX_VIEW = {
  deposit: { label: "Recharge", sign: "+", direction: "credit" },
  reserve: { label: "Réservation", sign: MINUS, direction: "debit" },
  release: { label: "Libération", sign: "", direction: "none" },
  commission: { label: "Commission", sign: "", direction: "none" },
  refund: { label: "Remboursement", sign: "+", direction: "credit" },
  withdrawal: { label: "Retrait", sign: MINUS, direction: "debit" },
}

/** Les 7 filtres de C14 : `types` null signifie tous les types. */
export const WALLET_FILTERS = [
  { id: "tout", label: "Tout", types: null },
  { id: "recharges", label: "Recharges", types: ["deposit"] },
  { id: "reservations", label: "Réservations", types: ["reserve"] },
  { id: "liberations", label: "Libérations", types: ["release"] },
  { id: "commissions", label: "Commissions", types: ["commission"] },
  { id: "remboursements", label: "Remboursements", types: ["refund"] },
  { id: "retraits", label: "Retraits", types: ["withdrawal"] },
]

/**
 * Identifiant de filtre valide, "tout" par défaut.
 * @param {unknown} value Valeur brute de `?filtre=`
 * @returns {string}
 */
export function parseWalletFilter(value) {
  const v = Array.isArray(value) ? value[0] : value
  return WALLET_FILTERS.some((f) => f.id === v) ? v : "tout"
}

/**
 * Garde les mouvements du filtre.
 * @param {Array<{ type: string }>} transactions
 * @param {string} filterId
 */
export function filterWalletTransactions(transactions, filterId) {
  const filter = WALLET_FILTERS.find((f) => f.id === filterId)
  if (!filter || !filter.types) return transactions
  return transactions.filter((t) => filter.types.includes(t.type))
}

/**
 * @param {string} type Type de mouvement en base
 * @returns {{ label: string, sign: string, direction: "credit" | "debit" | "none" }}
 */
export function walletTxView(type) {
  const known = WALLET_TRANSACTION_TYPES.includes(type) && Object.hasOwn(WALLET_TX_VIEW, type)
  return known ? WALLET_TX_VIEW[type] : { label: "Mouvement", sign: "", direction: "none" }
}
