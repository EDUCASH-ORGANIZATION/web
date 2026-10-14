// @ds-screen RD-STUDENT-01
import { splitAmount } from "@/components/app-ui/amount"

const AXIS_AT = [0, 2, 4, 6]

/** Hauteur d'une barre, de 0 à 10 (dixièmes de la plus haute) : une classe de la feuille, jamais un style en ligne. */
export function barLevel(total, max) {
  if (!(max > 0) || !(total > 0)) return 0
  return Math.max(1, Math.round((total / max) * 10))
}

/** « 17 août » depuis un lundi `YYYY-MM-DD`, "" si la date est invalide. */
export function weekLabel(start) {
  const date = new Date(`${start}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)
}

function Figure({ value, caption }) {
  const money = splitAmount(value)
  return (
    <div>
      <div className="e2-amount e2-amount--m">
        {money.text}
        <small>{money.unit}</small>
      </div>
      <div className="caption muted">{caption}</div>
    </div>
  )
}

/**
 * Carte blanche « Vos gains » : les 8 dernières semaines en barres neutres (la semaine en cours en encre)
 * et le total depuis l'inscription. Vue pure ; `gains` vient de `getStudentWallet` (net de l'étudiant).
 * @param {{ gains: { weeks: Array<{ start: string, total: number }>, eightWeeks: number, total: number } }} props
 */
export function EarningsChart({ gains }) {
  const max = Math.max(0, ...gains.weeks.map((w) => w.total))
  const last = gains.weeks.length - 1
  return (
    <section className="card2" aria-label="Vos gains">
      <h2 className="e2-08-title">Vos gains</h2>
      <div className="e2-08-figures">
        <Figure value={gains.eightWeeks} caption="gagnés ces 8 dernières semaines" />
        <Figure value={gains.total} caption="au total depuis votre inscription" />
      </div>
      <div className="e2-08-bars" role="img" aria-label={`Gains des 8 dernières semaines : ${splitAmount(gains.eightWeeks).text} FCFA au total`}>
        {gains.weeks.map((w, i) => (
          <i key={w.start} data-h={barLevel(w.total, max)} className={i === last ? "is-now" : undefined} />
        ))}
      </div>
      <div className="e2-08-axis" aria-hidden="true">
        {AXIS_AT.map((i) => (
          <span key={i}>{weekLabel(gains.weeks[i]?.start)}</span>
        ))}
        <span>Cette semaine</span>
      </div>
    </section>
  )
}

export default EarningsChart
