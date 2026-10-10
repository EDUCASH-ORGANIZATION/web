import { Icon } from "@/components/design/icon"
import { Payers } from "../shared/payers"

// Trois preuves sous le hero de l'accueil (maquette V01 v3) : paiement, séquestre, étudiants vérifiés.
export function HomeProofs() {
  return (
    <div className="v-proofs ds-mt-4">
      <div className="v-proof">
        <div>
          <div className="eyebrow">Paiement Mobile Money</div>
          <Payers />
        </div>
      </div>

      <div className="v-proof">
        <span className="ic-sq ic-sq--lg"><Icon name="i-lock" /></span>
        <div>
          <div className="v-proof__title">Votre argent est bloqué, pas dépensé.</div>
          <div className="v-proof__text">
            Il reste sur EduCash pendant la mission et ne part à l&rsquo;étudiant que quand vous validez. C&rsquo;est le
            séquestre.
          </div>
        </div>
      </div>

      <div className="v-proof">
        <span className="ic-sq ic-sq--lg ic-sq--bleu"><Icon name="i-shield" /></span>
        <div>
          <div className="v-proof__title">Des étudiants vérifiés à la main.</div>
          <div className="v-proof__text">Carte étudiante contrôlée par l&rsquo;équipe. Badge valable 1 an.</div>
        </div>
      </div>
    </div>
  )
}
