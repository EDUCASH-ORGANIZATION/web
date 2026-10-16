// @ds-screen RD-STUDENT-01
import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/app/format"
import { safeDateFr } from "@/lib/student-space/mission-view"
import { commissionLabel } from "./earning-lines"

/**
 * Reçu d'une mission terminée, lu au grand livre de l'étudiant : le montant versé est la ligne `release`
 * (son NET). Sans ligne, aucun montant n'est affiché : « Paiement en cours de traitement ».
 * Le budget et la commission ne sont montrés que si le budget est valide (`split` non null).
 * @param {{ split: { total: number, commission: number }|null, receipt: { hasLedger: boolean, net: number|null, date: string|null } }} props
 */
export function Receipt({ split, receipt }) {
  const paid = receipt.hasLedger && receipt.net !== null
  const date = safeDateFr(receipt.date)
  return (
    <section className="e2-sec e2-05-lines" aria-label="Reçu">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Reçu</h2>
        {paid ? (
          <span className="badge badge--succes badge--sm">
            <Icon name="i-check" />
            Payé
          </span>
        ) : null}
      </div>
      <div className="e2-sec__body">
        {paid ? (
          <>
            <div className="e2-kv">
              {split ? (
                <>
                  <div className="e2-kv__row">
                    <span>Budget du client (100 %)</span>
                    <b>{formatFcfa(split.total)}</b>
                  </div>
                  <div className="e2-kv__row">
                    <span>{commissionLabel()}</span>
                    <b>{`− ${formatFcfa(split.commission)}`}</b>
                  </div>
                </>
              ) : null}
              <div className="e2-kv__row e2-kv__row--total">
                <span>Versé sur votre portefeuille</span>
                <b>{formatFcfa(receipt.net)}</b>
              </div>
            </div>
            {date ? <p className="e2-05-caption">{`Versé le ${date}`}</p> : null}
          </>
        ) : (
          <p className="e2-05-caption">Paiement en cours de traitement</p>
        )}
      </div>
    </section>
  )
}

export default Receipt
