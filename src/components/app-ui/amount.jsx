import { formatAmount } from "@/lib/app/format"

const NBSP = "\u00A0"

/**
 * Sépare un montant formaté en chiffres (signe compris) et unité, ex. "47 600" et "FCFA".
 * @param {number} value
 * @param {"debit" | "credit" | "none"} [sign]
 * @returns {{ text: string, unit: string }}
 */
export function splitAmount(value, sign = "none") {
  const full = formatAmount(value, { sign })
  const at = full.lastIndexOf(NBSP)
  return { text: full.slice(0, at), unit: full.slice(at + 1) }
}

const SIZES = new Set(["xl", "l", "m", "s"])

// Montant : chiffres tabulaires Figtree, unité en petit. `sign` "credit" colore en vert, "debit" affiche un vrai moins.
export function Amount({ value, sign = "none", size = "m" }) {
  const { text, unit } = splitAmount(value, sign)
  const tone = sign === "credit" ? " amount--plus" : sign === "debit" ? " amount--moins" : ""
  return (
    <span className={`amount${SIZES.has(size) ? ` amount--${size}` : ""}${tone}`}>
      {text}
      <small>{unit}</small>
    </span>
  )
}

export default Amount
