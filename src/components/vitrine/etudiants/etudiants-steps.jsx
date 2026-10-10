import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { COMMISSION_RATE, netAmount } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/vitrine/format"

const SHARE = 100 - Math.round(COMMISSION_RATE * 100)
const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`
const EXAMPLE_BUDGET = 25000

// Trois étapes côté étudiant (maquette V05 v3), sans onglets.
export function EtudiantsSteps() {
  return (
    <section className="section" id="etapes">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Comment ça marche</span>
          <h2 className="display display--xl ds-mt-3">
            3 étapes.<br /><span className="hl-bleu">Zéro galère.</span>
          </h2>
        </div>
      </div>
      <div className="v-steps">
        <div className="v-step">
          <span className="v-step__num">01</span>
          <div className="v-step__ui row ds-desk-only">
            <span className="verified verified--sm">
              <svg aria-hidden="true" focusable="false"><use href={`${SPRITE}#seal-citron`} /></svg>
              Vérifié
            </span>
            <span className="tag">Carte étudiante</span>
          </div>
          <div>
            <h3 className="v-step__title">Crée ton profil</h3>
            <p className="v-step__text">
              Gratuit. Tes compétences, ta ville, ton numéro MoMo. La carte étudiante n&rsquo;est demandée qu&rsquo;au
              moment de postuler.
            </p>
          </div>
        </div>
        <div className="v-step v-step--bleu">
          <span className="v-step__num">02</span>
          <div className="v-step__mini ds-desk-only">
            <span className="ic-sq ic-sq--sm"><Icon name="i-receipt" /></span>
            <div className="ds-grow"><b>Marché à Dantokpa</b><small>Cotonou · samedi 8 h</small></div>
            <span className="btn btn--accent btn--sm">Postuler</span>
          </div>
          <div>
            <h3 className="v-step__title">Postule en un message</h3>
            <p className="v-step__text">
              Filtre par ville, service et budget. Le client lit ton profil et te choisit. Tu vois toujours ce que tu
              touches avant de postuler.
            </p>
          </div>
        </div>
        <div className="v-step v-step--citron">
          <span className="v-step__num">03</span>
          <div className="push ds-desk-only">
            <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="" width={40} height={40} />
            <div>
              <div className="push__title">+ {formatFcfa(netAmount(EXAMPLE_BUDGET))}</div>
              <div className="caption">Versé sur ton portefeuille</div>
            </div>
          </div>
          <div>
            <h3 className="v-step__title">Encaisse sur ton MoMo</h3>
            <p className="v-step__text">
              Une fois la mission faite, le client valide la fin de mission. Tu touches {SHARE} % du budget, versé sur
              ton portefeuille EduCash, et tu le retires sur ton Mobile Money.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
