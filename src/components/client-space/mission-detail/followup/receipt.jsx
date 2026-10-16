import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { commissionLabel } from "./escrow-card"
import { formatMoment, movementDate } from "./timeline"

/**
 * Reçu d'une mission terminée, lu au grand livre du client. « Prélevé » est la ligne `release` (brute,
 * commission incluse) et « Versé » est `release - commission` quand les deux lignes existent ; à défaut,
 * seul « Prélevé » est affiché (jamais de détail mêlant grand livre et calcul). Sans libération au grand livre (mission héritée), seul le budget est rappelé.
 */
export function Receipt({ view, ledger, studentName, withPurchases = false }) {
  const title = withPurchases ? "Reçu du service" : "Reçu"
  const { receipt, split } = view
  const released = receipt.hasLedger && receipt.releasedGross > 0
  if (!released) {
    return (
      <section className="card2 fup2__money" aria-label={title}>
        <div className="sec2">
          <h2 className="sec2__title">{title}</h2>
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
    <section className="card2 fup2__money" aria-label={title}>
      <div className="sec2">
        <h2 className="sec2__title">{title}</h2>
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
      <div className="lines2">
        {releasedAt ? (
          <div className="lines2__row">
            <span>Libéré le</span>
            <b>{releasedAt}</b>
          </div>
        ) : null}
        <div className="lines2__row">
          <span>Moyen</span>
          <b>Portefeuille EduCash</b>
        </div>
      </div>
    </section>
  )
}

export default Receipt
