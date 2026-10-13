// @ds-screen RD-STUDENT-01
// Filtres et présentation des mouvements du portefeuille étudiant. Pur.
// La commission n'est pas une ligne du grand livre de l'étudiant : elle figure dans chaque paiement.

const MINUS = "−"

/** Libellé, signe affiché et sens de chaque mouvement vu de l'étudiant. */
export const STUDENT_WALLET_TX_VIEW = {
  release: { label: "Paiement reçu", sign: "+", direction: "credit" },
  withdrawal: { label: "Retrait", sign: MINUS, direction: "debit" },
  refund: { label: "Remboursement", sign: "+", direction: "credit" },
}

/** `types` null signifie tous les types. */
export const STUDENT_WALLET_FILTERS = [
  { id: "tout", label: "Tout", types: null },
  { id: "paiements", label: "Paiements reçus", types: ["release"] },
  { id: "retraits", label: "Retraits", types: ["withdrawal"] },
  { id: "remboursements", label: "Remboursements", types: ["refund"] },
]

/**
 * Identifiant de filtre valide, "tout" par défaut.
 * @param {unknown} value Valeur brute de `?filtre=`
 * @returns {string}
 */
export function parseStudentWalletFilter(value) {
  const v = Array.isArray(value) ? value[0] : value
  return STUDENT_WALLET_FILTERS.some((f) => f.id === v) ? v : "tout"
}

/**
 * Types de mouvements à lire pour un filtre (null : tous).
 * @param {string} filterId
 * @returns {string[] | null}
 */
export function studentWalletFilterTypes(filterId) {
  return STUDENT_WALLET_FILTERS.find((f) => f.id === filterId)?.types ?? null
}

/**
 * Garde les mouvements du filtre.
 * @param {Array<{ type: string }>} transactions
 * @param {string} filterId
 */
export function filterStudentWalletTransactions(transactions, filterId) {
  const types = studentWalletFilterTypes(filterId)
  return types ? transactions.filter((t) => types.includes(t.type)) : transactions
}

/**
 * @param {string} type Type de mouvement en base
 * @returns {{ label: string, sign: string, direction: "credit" | "debit" | "none" }}
 */
export function studentWalletTxView(type) {
  return Object.hasOwn(STUDENT_WALLET_TX_VIEW, type)
    ? STUDENT_WALLET_TX_VIEW[type]
    : { label: "Mouvement", sign: "", direction: "none" }
}
