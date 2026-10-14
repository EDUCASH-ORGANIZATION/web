// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/app/format"
import { COMMISSION_RATE } from "@/lib/constants/missions"

const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

/** Libellé de la commission, issu de COMMISSION_RATE (jamais un taux écrit en dur). */
export const commissionLabel = () => `Commission EduCash (${COMMISSION_PERCENT} %)`

/**
 * « Ce que vous touchez » d'une mission en cours : budget, commission, votre part (escrowSplit), badge « En séquestre ».
 * Le badge et la phrase sur le séquestre n'apparaissent que si les paiements sont ouverts (`paymentsEnabled`) :
 * sinon un texte neutre, sans promesse de fonds bloqués.
 * Mission annulée : une explication, aucun montant.
 * @param {{ split: { total: number, commission: number, student: number }, cancelled: boolean,
 *   paymentsEnabled?: boolean }} props
 */
export function EarningLines({ split, cancelled, paymentsEnabled = false }) {
  return (
    <section className="e2-sec e2-05-lines" aria-label="Ce que vous touchez">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Ce que vous touchez</h2>
        {cancelled || !paymentsEnabled ? null : (
          <span className="badge badge--neutre badge--sm">
            <Icon name="i-lock" />
            En séquestre
          </span>
        )}
      </div>
      <div className="e2-sec__body">
        {cancelled ? (
          <p className="e2-05-caption">Cette mission a été annulée : aucun montant ne vous est dû.</p>
        ) : (
          <>
            <div className="e2-kv">
              <div className="e2-kv__row">
                <span>Budget du client (100 %)</span>
                <b>{formatFcfa(split.total)}</b>
              </div>
              <div className="e2-kv__row">
                <span>{commissionLabel()}</span>
                <b>{`− ${formatFcfa(split.commission)}`}</b>
              </div>
              <div className="e2-kv__row e2-kv__row--total">
                <span>{`Votre part (${100 - COMMISSION_PERCENT} %)`}</span>
                <b>{formatFcfa(split.student)}</b>
              </div>
            </div>
            <p className="e2-05-caption">
              {paymentsEnabled
                ? "Le budget est bloqué en séquestre. Votre part arrive sur votre portefeuille quand le client confirme la fin de la mission."
                : "Ces montants sont indicatifs : les paiements ne sont pas encore ouverts sur la plateforme."}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

export default EarningLines
