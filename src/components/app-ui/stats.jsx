import { splitAmount } from "./amount"

// Groupe d'indicateurs sobres en ligne (3 colonnes sur bureau).
export function StatGroup({ label, children }) {
  return (
    <section className="stats2" aria-label={label}>
      {children}
    </section>
  )
}

// Un indicateur : `amount` (nombre, rendu en FCFA) ou `value` (texte libre, ex. un compteur).
export function Stat({ label, amount, sign = "none", value, sub }) {
  const money = amount === undefined || amount === null ? null : splitAmount(amount, sign)
  return (
    <div className="stat2">
      <span className="stat2__label">{label}</span>
      <span className="stat2__value">
        {money ? (
          <>
            {money.text}
            <small>{money.unit}</small>
          </>
        ) : (
          value
        )}
      </span>
      {sub ? <span className="stat2__sub">{sub}</span> : null}
    </div>
  )
}

export default StatGroup
