import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"

/**
 * Carte « Achats pour votre compte » (C08, C11) : la seule donnée réelle est l'estimation donnée à la
 * publication (`missions.purchases_estimate`), jamais bloquée, sans commission. Aucune demande de paiement,
 * aucun vendeur, aucun montant payé : ces données n'existent pas. Le mot « séquestre » n'est écrit que si les
 * paiements sont activés. `estimate` vient de purchasesEstimateOf (nombre > 0).
 */
export function PurchasesCard({ estimate, paymentsEnabled = false }) {
  return (
    <section className="card2 fup2__purchases" aria-label="Achats pour votre compte">
      <div className="sec2">
        <h2 className="sec2__title">Achats pour votre compte</h2>
        <StatusBadge label="Hors EduCash" icon="i-banknote" />
      </div>
      <Lines rows={[{ label: "Estimation donnée à la publication", value: estimate }]} />
      <p className="note2">
        <Icon name="i-info" />
        <span>
          {paymentsEnabled
            ? "Vous payez les vendeurs directement par MoMo. Ces paiements ne passent pas par le séquestre, ne supportent aucune commission et EduCash ne peut pas les rembourser."
            : "Vous payez les vendeurs directement par MoMo. Ces paiements ne supportent aucune commission et EduCash ne peut pas les rembourser."}
        </span>
      </p>
    </section>
  )
}

export default PurchasesCard
