import { Icon } from "@/components/design/icon"
import { Payers } from "../shared/payers"

function Stars() {
  return (
    <div className="stars" role="img" aria-label="Note sur 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="i-star" className="ic is-on" />
      ))}
    </div>
  )
}

// Trois preuves sous le hero (maquette V05 v3). La note réelle remplace le badge
// seulement quand assez d'avis existent (rating non nul).
export function EtudiantsProofs({ rating }) {
  return (
    <div className="v-proofs ds-mt-4">
      <div className="v-proof">
        <div>
          <div className="eyebrow">Retrait sur ton Mobile Money</div>
          <Payers />
        </div>
      </div>

      <div className="v-proof">
        <span className="ic-sq ic-sq--lg"><Icon name="i-lock" /></span>
        <div>
          <div className="v-proof__title">Ton argent est bloqué avant que tu bosses.</div>
          <div className="v-proof__text">
            Le client paie d&rsquo;avance. L&rsquo;argent reste en séquestre et arrive sur ton portefeuille dès qu&rsquo;il
            valide la mission.
          </div>
        </div>
      </div>

      {rating ? (
        <div className="v-proof">
          <div className="ds-grow">
            <div className="row row--nowrap ds-gap-2">
              <span className="amount amount--l">{rating.avg.toLocaleString("fr-FR")}</span>
              <span className="muted body-s">/ 5 · {rating.count} avis</span>
            </div>
            <Stars />
            <div className="v-proof__text">Note moyenne des missions terminées</div>
          </div>
          <span className="v-note">Donnée réelle</span>
        </div>
      ) : (
        <div className="v-proof">
          <span className="ic-sq ic-sq--lg ic-sq--bleu"><Icon name="i-shield" /></span>
          <div>
            <div className="v-proof__title">Un badge qui rassure.</div>
            <div className="v-proof__text">Ta carte est contrôlée par l&rsquo;équipe. Badge valable 1 an.</div>
          </div>
        </div>
      )}
    </div>
  )
}
