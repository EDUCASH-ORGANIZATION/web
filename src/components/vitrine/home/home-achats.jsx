import { Icon } from "@/components/design/icon"
import { formatFcfa } from "@/lib/vitrine/format"
import { PAYMENT_WARNING } from "../aide/aide-content"

const EXAMPLE_SERVICE = 5000
const EXAMPLE_PURCHASES = 18000

const ITEMS = ["Tomates, oignons, piment frais", "Poisson fumé et crevettes séchées", "Gari, sac de 5 kg"]

const STEPS = [
  {
    title: "Vous publiez la liste",
    text: "Avec le budget du service et une estimation des achats, à titre indicatif.",
  },
  {
    title: "Vous payez le vendeur par MoMo",
    text: "L'étudiant vous envoie le numéro marchand, le montant et la photo du ticket.",
  },
  {
    title: "Vous recevez tout, vous validez",
    text: "Le service de l'étudiant est alors payé. Pas avant.",
    accent: true,
  },
]

// Bloc « Le marché à votre place » de l'accueil (maquette V01 v3) : les achats sont payés au vendeur,
// EduCash ne bloque que le service de l'étudiant.
export function HomeAchats() {
  return (
    <section className="section" id="achats">
      <div className="v05-split v-achats-split">
        <div className="stack stack--6">
          <span className="eyebrow eyebrow--bleu">Le marché à votre place</span>
          <h2 className="display display--l">
            Votre marché,<br /><span className="hl-bleu">sans y passer<br />la matinée.</span>
          </h2>
          <p className="body-l">
            Vous envoyez la liste, un étudiant fait le marché à Dantokpa, Ganhi ou Saint-Michel et vous rapporte tout.
            Sur EduCash, vous ne payez que son service&nbsp;; les achats, vous les réglez directement au vendeur, par
            MoMo, sur photo du ticket.
          </p>
          <p className="muted">Personne n&rsquo;avance d&rsquo;argent pour l&rsquo;autre. EduCash ne prend rien sur les achats.</p>
        </div>

        <div className="v-achats">
          <div className="v-achats__head">
            <div>
              <div className="ds-h4"><Icon name="i-receipt" className="ic" />Marché du samedi · Dantokpa</div>
              <div className="v-achats__sub">Exemple de mission avec achats</div>
            </div>
            <div className="v-achats__est">
              <span className="amount amount--m">{formatFcfa(EXAMPLE_SERVICE)}</span>
              <small className="caption">service de l&rsquo;étudiant, bloqué</small>
            </div>
          </div>
          <div className="v-achats__body">
            <ul className="v-achats__list">
              {ITEMS.map((item) => <li key={item}>{item}</li>)}
              <li>Achats estimés à environ {formatFcfa(EXAMPLE_PURCHASES)}, payés au vendeur</li>
            </ul>
            <div className="v-achats__steps">
              {STEPS.map((step) => (
                <div key={step.title} className={`v-achats__step${step.accent ? " v-achats__step--citron" : ""}`}>
                  <div>
                    <b>{step.title}</b>
                    <div className="caption">{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="banner banner--alerte-doux">
              <Icon name="i-alert-triangle" className="ic" />
              <div className="banner__body">{PAYMENT_WARNING}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
