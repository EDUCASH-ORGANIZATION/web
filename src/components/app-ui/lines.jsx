import { formatAmount } from "@/lib/app/format"

/**
 * Récapitulatif en lignes libellé / montant, avec total optionnel.
 * `rows` : [{ label, value (nombre), sign? }] ; `total` : { label, value, sign? }.
 */
export function Lines({ rows = [], total }) {
  return (
    <div className="lines2">
      {rows.map((row) => (
        <div className="lines2__row" key={row.label}>
          <span>{row.label}</span>
          <b>{formatAmount(row.value, { sign: row.sign })}</b>
        </div>
      ))}
      {total ? (
        <div className="lines2__row lines2__row--total">
          <span>{total.label}</span>
          <b>{formatAmount(total.value, { sign: total.sign })}</b>
        </div>
      ) : null}
    </div>
  )
}

export default Lines
