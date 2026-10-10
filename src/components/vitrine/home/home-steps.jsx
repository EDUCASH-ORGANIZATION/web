import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/vitrine/format"
import { MIN_BUDGET } from "./home-content"

// Budget de l'exemple du premier pas (illustration, pas une donnée de la base).
const STEP_EXAMPLE_BUDGET = 5000

// Section « Comment ça marche » : parcours client en trois étapes, sans avance d'argent.
export function HomeSteps() {
  return (
    <section className="section" id="etapes">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Comment ça marche</span>
          <h2 className="display display--xl ds-mt-3">
            3 étapes.<br /><span className="hl-bleu">Aucune avance.</span>
          </h2>
        </div>
        <p className="muted ds-measure-s ds-text-right">
          Un seul moyen de paiement&nbsp;: votre portefeuille EduCash, rechargé par Mobile Money.
        </p>
      </div>
      <div className="v-steps">
        <div className="v-step">
          <span className="v-step__num">01</span>
          <div className="v-step__mini ds-desk-only">
            <span className="ic-sq ic-sq--sm"><Icon name="i-pencil" /></span>
            <div className="ds-grow"><b>Marché du samedi à Dantokpa</b><small>Cotonou · samedi avant 12 h</small></div>
            <span className="amount amount--s">{formatFcfa(STEP_EXAMPLE_BUDGET)}</span>
          </div>
          <div>
            <h3 className="v-step__title">Publiez votre besoin</h3>
            <p className="v-step__text">
              Deux minutes&nbsp;: ce qu&rsquo;il faut faire, où, quand, pour quel budget. Dès {formatFcfa(MIN_BUDGET)},
              bloqués sur EduCash jusqu&rsquo;à votre validation.
            </p>
          </div>
        </div>
        <div className="v-step v-step--bleu">
          <span className="v-step__num">02</span>
          <div className="v-step__mini ds-desk-only">
            <span className="ic-sq ic-sq--sm"><Icon name="i-id-card" /></span>
            <div className="ds-grow"><b>Candidature reçue</b><small>Carte étudiante vérifiée</small></div>
            <span className="btn btn--primary btn--sm">Retenir</span>
          </div>
          <div>
            <h3 className="v-step__title">Choisissez un étudiant vérifié</h3>
            <p className="v-step__text">
              Des étudiants de votre ville postulent. Vous lisez leur profil, vous discutez, vous retenez celui qui vous
              convient.
            </p>
          </div>
        </div>
        <div className="v-step v-step--citron">
          <span className="v-step__num">03</span>
          <div className="v-step__mini ds-desk-only">
            <span className="ic-sq ic-sq--sm ic-sq--encre"><Icon name="i-check" /></span>
            <div className="ds-grow"><b>Mission terminée</b><small>Confirmer la fin ou signaler un problème</small></div>
          </div>
          <div>
            <h3 className="v-step__title">Validez pour payer</h3>
            <p className="v-step__text">
              L&rsquo;argent part seulement quand vous confirmez que c&rsquo;est fait. Rien d&rsquo;automatique.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
