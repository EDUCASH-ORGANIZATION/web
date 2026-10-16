import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { COMMISSION_RATE } from "@/lib/constants/missions"

export const commissionLabel = () => `Commission EduCash ${Math.round(COMMISSION_RATE * 100)} %`

/**
 * Carte « Séquestre » d'une mission en cours : budget bloqué, commission, part de l'étudiant et bouton
 * « Confirmer la fin » (encre). Les montants viennent de escrowSplit (`split`). Avec achats, la note rappelle que
 * seul le service est bloqué (`since` : date du blocage, déjà mise en forme, ou vide).
 */
export function EscrowCard({ split, studentName, onConfirm, withPurchases = false, since = "" }) {
  return (
    <section className="card2 fup2__money" aria-label="Séquestre">
      <div className="sec2">
        <h2 className="sec2__title">Séquestre</h2>
        <StatusBadge label="En séquestre" icon="i-lock" />
      </div>
      <Lines
        rows={[
          { label: "Budget bloqué", value: split.total },
          { label: commissionLabel(), value: split.commission, sign: "debit" },
        ]}
        total={{ label: `Versé à ${studentName}`, value: split.student }}
      />
      <button type="button" className="btn btn--dark btn--block fup2__desk" onClick={onConfirm}>
        <Icon name="i-check-circle" />
        Confirmer la fin
      </button>
      <p className="note2">
        <Icon name="i-lock" />
        <span>
          {withPurchases
            ? `${since ? `Bloqué le ${since} pour` : "Bloqué pour"} le service seulement. Les achats ne passent pas par EduCash.`
            : "Les fonds ne sont versés qu'après votre validation de la fin de la mission."}
        </span>
      </p>
    </section>
  )
}

export default EscrowCard
