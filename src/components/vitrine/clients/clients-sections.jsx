import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Faq } from "../shared/faq"
import { Payers } from "../shared/payers"
import { formatFcfa } from "@/lib/vitrine/format"
import { Scribble, Shape } from "./scribble"
import {
  COMMISSION_PERCENT,
  STUDENT_PERCENT,
  EXAMPLE_BUDGET,
  EXAMPLE_NET,
  EXAMPLE_COMMISSION,
  MIN_BUDGET,
  TYPE_CARDS,
  GUARANTEES,
  FAQ_ITEMS,
} from "./clients-content"

function SectionHead({ eyebrow, children, aside }) {
  return (
    <div className="section__head">
      <div>
        <span className="eyebrow eyebrow--bleu">{eyebrow}</span>
        <h2 className="display display--l ds-mt-3">{children}</h2>
      </div>
      {aside}
    </div>
  )
}

export function EscrowSteps() {
  return (
    <section className="section" id="sequestre">
      <div className="container">
        <SectionHead
          eyebrow="Le séquestre"
          aside={
            <p className="muted ds-measure-s ds-text-right">
              Un seul flux de paiement&nbsp;: votre portefeuille EduCash. Rien n&apos;est versé à l&apos;étudiant avant
              votre feu vert.
            </p>
          }
        >
          Votre argent attend.<br /><span className="hl-bleu">Vous validez.</span>
        </SectionHead>
        <div className="v-steps">
          <div className="v-step">
            <span className="v-step__num">01</span>
            <div className="v-step__ui"><Payers /></div>
            <div>
              <h3 className="v-step__title">Rechargez</h3>
              <p className="v-step__text">
                Votre portefeuille EduCash, par MTN MoMo ou Moov Money, via FedaPay. Dès {formatFcfa(MIN_BUDGET)}.
              </p>
            </div>
          </div>
          <div className="v-step v-step--bleu">
            <span className="v-step__num">02</span>
            <div className="v-step__mini">
              <span className="ic-sq ic-sq--sm"><Icon name="i-lock" /></span>
              <div className="ds-grow">
                <b>{formatFcfa(EXAMPLE_BUDGET)} bloqués</b>
                <small>Exemple de mission</small>
              </div>
            </div>
            <div>
              <h3 className="v-step__title">Publiez et choisissez</h3>
              <p className="v-step__text">
                Le budget est mis en séquestre à la publication. Vous lisez les profils, discutez, puis retenez un
                étudiant vérifié.
              </p>
            </div>
          </div>
          <div className="v-step v-step--citron">
            <span className="v-step__num">03</span>
            <div className="v-step__mini">
              <span className="ic-sq ic-sq--sm ic-sq--encre"><Icon name="i-check" /></span>
              <div className="ds-grow">
                <b>Mission terminée&nbsp;?</b>
                <small>Confirmer ou signaler un problème</small>
              </div>
            </div>
            <div>
              <h3 className="v-step__title">Validez</h3>
              <p className="v-step__text">
                L&apos;étudiant déclare la fin, vous confirmez et il est payé. Sans réponse de votre part sous
                72&nbsp;h, le paiement part automatiquement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Commission() {
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow={`${COMMISSION_PERCENT} %, et c'est tout`}>
          Une commission.<br /><span className="hl-bleu">Affichée.</span>
        </SectionHead>
        <div className="v05-split">
          <div className="stack stack--4">
            <p className="body-l">
              Le budget que vous publiez est le prix final. EduCash prélève {COMMISSION_PERCENT}&nbsp;% sur ce budget
              pour faire tourner le service&nbsp;: vérification des cartes, séquestre, support. L&apos;étudiant voit
              exactement ce qu&apos;il touchera avant de postuler.
            </p>
            <p className="muted">Pas d&apos;abonnement, pas de frais d&apos;inscription.</p>
          </div>
          <div className="v05-bill">
            <div className="v05-bill__total">
              <span className="h3">Vous payez le budget affiché</span>
              <span className="amount amount--xl">{formatFcfa(EXAMPLE_BUDGET)}</span>
            </div>
            <div
              className="v05-bar"
              role="img"
              aria-label={`${STUDENT_PERCENT} % pour l'étudiant, ${COMMISSION_PERCENT} % pour EduCash`}
            >
              <div className="v05-bar__etu">
                {formatFcfa(EXAMPLE_NET)}<small>{STUDENT_PERCENT}&nbsp;% pour l&apos;étudiant</small>
              </div>
              <div className="v05-bar__edu">
                {COMMISSION_PERCENT}&nbsp;%<small>{formatFcfa(EXAMPLE_COMMISSION)}</small>
              </div>
            </div>
            <div className="recap">
              <div className="recap__line"><span>Budget de la mission</span><b>{formatFcfa(EXAMPLE_BUDGET)}</b></div>
              <div className="recap__line">
                <span>Commission EduCash {COMMISSION_PERCENT}&nbsp;%</span><b>- {formatFcfa(EXAMPLE_COMMISSION)}</b>
              </div>
              <div className="recap__line recap__total"><span>Versé à l&apos;étudiant</span><b>{formatFcfa(EXAMPLE_NET)}</b></div>
            </div>
            <p className="caption muted">
              Exemple pour un budget de {formatFcfa(EXAMPLE_BUDGET)}. Rien ne s&apos;ajoute au budget. Les achats d&apos;une
              mission de courses se paient à part, au vendeur, sur justificatif.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function MissionTypes({ publishHref }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow={`${TYPE_CARDS.length} types de missions`}
          aside={<p className="muted ds-text-right">Chaque carte mène à la publication d&apos;une mission.</p>}
        >
          Ce que vous pouvez<br /><span className="hl-bleu">confier.</span>
        </SectionHead>
        <div className="v-cats">
          {TYPE_CARDS.map((c) => (
            <Link key={c.type} className={`v-cat ${c.variant}`.trim()} href={publishHref} aria-label={`Publier une mission ${c.type}`}>
              <Shape name={c.shape} className="v-cat__shape" />
              <div className="v-cat__top">
                <span className={`ic-sq ${c.square}`.trim()}><Icon name={c.icon} /></span>
                <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
              </div>
              <div>
                <div className="v-cat__name">{c.type}</div>
                <div className="v-cat__ex">{c.example}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Guarantees() {
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="Garanties">Si ça coince,<br /><span className="hl-bleu">on est là.</span></SectionHead>
        <div className="v05-guar">
          {GUARANTEES.map((g) => (
            <div key={g.title} className={`v05-g ${g.variant}`}>
              <Shape name={g.shape} className="v05-g__shape" />
              <span className={`ic-sq ${g.square}`.trim()}><Icon name={g.icon} /></span>
              <div className="v05-g__t">{g.title}</div>
              <p>{g.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ClientFaq() {
  const items = FAQ_ITEMS.map(({ id, question, answer, warning }) => ({
    id,
    question,
    answer: warning ? <>{answer} <b>{warning}</b></> : answer,
  }))
  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow="Questions de clients"
          aside={
            <Link className="btn btn--secondary" href="/aide">
              Toute l&apos;aide <Icon name="i-arrow-right" />
            </Link>
          }
        >
          Vous vous<br /><span className="hl-bleu">demandez&nbsp;?</span>
        </SectionHead>
        <Faq items={items} />
      </div>
    </section>
  )
}

export function ClientsCta({ publishHref }) {
  return (
    <div className="v-cta2 v-cta2--single">
      <div className="v-cta v-cta--bleu v05-cta grid-bg on-bleu">
        <span className="badge badge--citron ds-self-start">Deux minutes pour publier</span>
        <h2 className="display display--xl">Publiez votre<br /><span className="hl-citron">première mission.</span></h2>
        <p className="body-l ds-measure-l">
          Rédigez librement, le solde n&apos;est vérifié qu&apos;au moment de publier. Il manque de l&apos;argent&nbsp;?
          Vous rechargez sur place, le brouillon est gardé.
        </p>
        <div className="v-cta__actions">
          <Link className="btn btn--accent btn--lg" href={publishHref}>
            Publier une mission
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
        </div>
        <div className="v-cta__badge">
          <div><b>{MIN_BUDGET.toLocaleString("fr-FR")}</b><span>FCFA de budget minimum</span></div>
        </div>
        <Scribble name="sc-arrow" className="v-cta__scribble" viewBox="0 0 80 70" />
      </div>
    </div>
  )
}
