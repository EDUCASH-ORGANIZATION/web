import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { commissionLabel } from "./escrow-card"
import { formatMoment, movementDate } from "./timeline"

/**
 * Reçu d'une mission terminée, lu au grand livre du client (réservé, commission). Le versé à l'étudiant
 * est celui de escrowSplit(budget) : la ligne `release` du grand livre est au brut, la ligne nette est
 * invisible du client. Sans libération au grand livre (mission héritée), seul le budget est rappelé.
 */
export function Receipt({ view, ledger, studentName }) {
  const { receipt, split } = view
  const released = receipt.hasLedger && receipt.releasedGross > 0
  if (!released) {
    return (
      <section className="card2" aria-label="Reçu">
        <div className="sec2">
          <h2 className="sec2__title">Reçu</h2>
        </div>
        <Lines rows={[{ label: "Budget de la mission", value: split.total }]} />
        <p className="note2">Le détail du paiement n&apos;est pas disponible pour cette mission.</p>
      </section>
    )
  }
  const releasedAt = formatMoment(movementDate(ledger, "release"))
  return (
    <section className="card2" aria-label="Reçu">
      <div className="sec2">
        <h2 className="sec2__title">Reçu</h2>
        <StatusBadge label="Payé" tone="succes" icon="i-check" />
      </div>
      <Lines
        rows={[
          { label: "Prélevé du séquestre", value: receipt.reserved || split.total },
          { label: commissionLabel(), value: receipt.commission || split.commission, sign: "debit" },
        ]}
        total={{ label: `Versé à ${studentName}`, value: split.student }}
      />
      <dl className="fup2__facts">
        {releasedAt ? (
          <div>
            <dt>Libéré le</dt>
            <dd>{releasedAt}</dd>
          </div>
        ) : null}
        <div>
          <dt>Moyen</dt>
          <dd>Portefeuille EduCash</dd>
        </div>
      </dl>
    </section>
  )
}

export default Receipt
