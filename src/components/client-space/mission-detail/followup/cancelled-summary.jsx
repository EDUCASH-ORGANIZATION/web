import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { missionTypeLabel } from "@/lib/constants/missions"
import { PaidPurchaseRow, paidRequests } from "./receipt"
import { formatMoment } from "./timeline"

/**
 * Colonne droite d'une mission annulée : remboursement (montant et date du mouvement `refund` du grand
 * livre) et rappel de la mission. Aucun montant n'est inventé : sans mouvement, le remboursement n'est pas affiché.
 * `purchases` (`detail.purchases`, facultatif) : les achats déjà payés en direct sont rappelés hors EduCash, sans
 * addition ni remboursement ; sans achat payé, le rendu est inchangé.
 */
export function CancelledSummary({ mission, view, applicationsCount, purchases }) {
  const { refund, receipt } = view
  const paid = paidRequests(purchases)
  return (
    <>
      <section className="card2" aria-label="Remboursement">
        <div className="sec2">
          <h2 className="sec2__title">Remboursement</h2>
          {refund ? <StatusBadge label="Remboursé" icon="i-undo" /> : null}
        </div>
        {refund ? (
          <>
            <Lines
              rows={receipt.reserved > 0 ? [{ label: "Budget qui était en séquestre", value: receipt.reserved }] : []}
              total={{ label: "Remboursé sur votre portefeuille", value: refund.amount }}
            />
            <dl className="fup2__facts">
              <div>
                <dt>Date</dt>
                <dd>{formatMoment(refund.date)}</dd>
              </div>
              <div>
                <dt>Disponible</dt>
                <dd>Immédiatement</dd>
              </div>
            </dl>
            {receipt.commission === 0 ? (
              <p className="note2">
                <Icon name="i-info" />
                <span>Rien n&apos;a été prélevé : aucune commission sur une mission annulée.</span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="note2">
            <Icon name="i-info" />
            <span>Aucun remboursement n&apos;est enregistré pour cette mission.</span>
          </p>
        )}
      </section>
      {paid.length > 0 ? (
        <section className="card2 fup2__paid--side" aria-label="Achats payés en direct">
          <div className="sec2">
            <h2 className="sec2__title">Achats payés en direct</h2>
            <StatusBadge label="Hors EduCash" icon="i-banknote" />
          </div>
          <div>
            {paid.map((request) => (
              <PaidPurchaseRow key={request.id} request={request} />
            ))}
          </div>
          <p className="note2">
            <Icon name="i-info" />
            <span>
              Ces achats ont été payés directement aux vendeurs, hors EduCash. Le remboursement du séquestre ne les
              concerne pas et EduCash ne peut pas les rembourser.
            </span>
          </p>
        </section>
      ) : null}
      <section className="card2" aria-label="La mission">
        <div className="sec2">
          <h2 className="sec2__title">La mission</h2>
        </div>
        <dl className="fup2__facts">
          <div>
            <dt>Type</dt>
            <dd>{missionTypeLabel(mission.type)}</dd>
          </div>
          {mission.city ? (
            <div>
              <dt>Lieu</dt>
              <dd>{mission.city}</dd>
            </div>
          ) : null}
          <div>
            <dt>Candidatures</dt>
            <dd>{applicationsCount}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}

export default CancelledSummary
