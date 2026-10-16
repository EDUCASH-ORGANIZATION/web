// @ds-screen RD-STUDENT-01
import { formatFcfa } from "@/lib/app/format"
import { clientFirstName } from "@/lib/student-space/mission-view"

/**
 * Bloc « Achats de la mission » du suivi (E05, mission avec achats) : à la place des demandes de paiement de la planche
 * (supprimées par la décision 24), l'estimation indicative et la règle « payés par le client directement au vendeur,
 * hors EduCash » (D3). Aucun montant d'achat réel n'est connu. Composant pur.
 * `purchases` : estimation valide (purchasesEstimateOf). Mission annulée : rien n'est plus à acheter, le bloc disparaît.
 * @param {{ purchases: number, clientName: string, cancelled?: boolean }} props
 */
export function PurchasesBlock({ purchases, clientName, cancelled = false }) {
  if (cancelled) return null
  const who = clientFirstName(clientName) ?? "Le client"
  return (
    <section className="e2-sec e2-05-purchases" aria-label="Achats de la mission">
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Achats de la mission</h2>
        <span className="badge badge--neutre badge--sm">Hors EduCash</span>
      </div>
      <div className="e2-sec__body">
        <div className="e2-kv">
          <div className="e2-kv__row">
            <span>Achats estimés · indicatif</span>
            <b>{`≈ ${formatFcfa(purchases)}`}</b>
          </div>
        </div>
        <p className="e2-05-caption">
          {`${who} paie les vendeurs directement par MoMo : ces montants ne sont ni bloqués ni soumis à la commission. Au marché, envoyez-lui la photo du ticket ou des articles dans la conversation.`}
        </p>
      </div>
    </section>
  )
}

export default PurchasesBlock
