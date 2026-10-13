import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { commissionLabel } from "./escrow-card"
import { formatMoment, movementDate } from "./timeline"

/**
 * Reçu d'une mission terminée, lu au grand livre du client. « Prélevé » est la ligne `release` (brute,
 * commission incluse) et « Versé » est `release - commission` quand les deux lignes existent ; à défaut,
 * seul « Prélevé » est affiché (jamais de détail mêlant grand livre et calcul). Sans libération au grand livre (mission héritée), seul le budget est rappelé.
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
  // Sans ligne de commission au grand livre, commission et versé ne sont pas connus : aucun détail issu d'une autre source.
  const detailed = receipt.student !== null
  const releasedAt = formatMoment(movementDate(ledger, "release"))
  return (
    <section className="card2" aria-label="Reçu">
      <div className="sec2">
        <h2 className="sec2__title">Reçu</h2>
        <StatusBadge label="Payé" tone="succes" icon="i-check" />
      </div>
      {detailed ? (
        <Lines
          rows={[
            { label: "Prélevé du séquestre", value: receipt.releasedGross },
            { label: commissionLabel(), value: receipt.commission, sign: "debit" },
          ]}
          total={{ label: `Versé à ${studentName}`, value: receipt.student }}
        />
      ) : (
        <Lines rows={[{ label: "Prélevé du séquestre", value: receipt.releasedGross }]} />
      )}
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
