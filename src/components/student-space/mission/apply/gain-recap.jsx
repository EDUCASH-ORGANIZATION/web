// @ds-screen RD-STUDENT-01
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { formatAmount } from "@/lib/app/format"

export const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)
export const STUDENT_PERCENT = 100 - COMMISSION_PERCENT

/**
 * Récapitulatif du gain en lignes clé / valeur : budget du client, commission, part de l'étudiant.
 * `split` vient de escrowSplit(budget) (jamais recalculé ici). Composant pur.
 * @param {{ split: { total: number, commission: number, student: number } }} props
 */
export function GainRecap({ split }) {
  return (
    <div className="e2-kv e2-03-recap">
      <div className="e2-kv__row">
        <span>Budget du client (100 %)</span>
        <b>{formatAmount(split.total)}</b>
      </div>
      <div className="e2-kv__row">
        <span>{`Commission EduCash (${COMMISSION_PERCENT} %)`}</span>
        <b>{formatAmount(split.commission, { sign: "debit" })}</b>
      </div>
      <div className="e2-kv__row e2-kv__row--total">
        <span>{`Vous touchez (${STUDENT_PERCENT} %)`}</span>
        <b>{formatAmount(split.student)}</b>
      </div>
    </div>
  )
}

export default GainRecap
