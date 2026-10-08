const BENIN_TZ = "Africa/Porto-Novo"

/**
 * Montant en FCFA, ex. "12 500 FCFA".
 * @param {number} n
 * @returns {string}
 */
export function formatFcfa(n) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(n) || 0)} FCFA`
}

/**
 * Date en français, ex. "8 octobre 2026". Une date seule "AAAA-MM-JJ" n'est pas décalée.
 * @param {string|Date} isoOrDate
 * @returns {string}
 */
export function formatDateFr(isoOrDate) {
  const dateOnly = typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
  const date = dateOnly ? new Date(`${isoOrDate}T00:00:00Z`) : new Date(isoOrDate)
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : BENIN_TZ,
  }).format(date)
}

/**
 * Entier avec séparateur de milliers, sans unité, ex. "12 500".
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtInt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}
