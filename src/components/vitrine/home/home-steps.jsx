"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"
import { formatFcfa } from "@/lib/vitrine/format"

const SHARE = 100 - Math.round(COMMISSION_RATE * 100)
const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`

const TABS = [
  { id: "student", label: "Je suis étudiant" },
  { id: "client", label: "J'ai une mission" },
]

function StudentSteps() {
  return (
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
            Gratuit. Tes compétences, ta ville, ton numéro MoMo. La carte étudiante n&rsquo;est demandée qu&rsquo;au moment
            de postuler.
          </p>
        </div>
      </div>
      <div className="v-step v-step--bleu">
        <span className="v-step__num">02</span>
        <div className="v-step__mini ds-desk-only">
          <span className="ic-sq ic-sq--sm"><Icon name="i-keyboard" /></span>
          <div className="ds-grow"><b>Saisie de fiches</b><small>Exemple de mission</small></div>
          <span className="btn btn--accent btn--sm">Postuler</span>
        </div>
        <div>
          <h3 className="v-step__title">Postule en un message</h3>
          <p className="v-step__text">
            Filtre par ville, type et budget. Le client lit ton profil et te choisit. Tu vois toujours ce que tu touches
            avant de postuler.
          </p>
        </div>
      </div>
      <div className="v-step v-step--citron">
        <span className="v-step__num">03</span>
        <div className="push ds-desk-only">
          <img className="logo-sym" src="/logo-symbole-bleu.svg" alt="" width={40} height={40} />
          <div>
            <div className="push__title">Paiement reçu</div>
            <div className="caption">Versé sur ton MTN MoMo</div>
          </div>
        </div>
        <div>
          <h3 className="v-step__title">Encaisse sur ton MoMo</h3>
          <p className="v-step__text">
            Tu déclares « J&rsquo;ai terminé », le client confirme. Sans réponse sous 72 h, l&rsquo;argent est libéré quand
            même. Tu touches {SHARE} % du budget.
          </p>
        </div>
      </div>
    </div>
  )
}

function ClientSteps() {
  return (
    <div className="v-steps">
      <div className="v-step">
        <span className="v-step__num">01</span>
        <div className="v-step__mini ds-desk-only">
          <span className="ic-sq ic-sq--sm ic-sq--bleu"><Icon name="i-plus" /></span>
          <div className="ds-grow"><b>Recharger le portefeuille</b><small>Via FedaPay · MoMo ou carte</small></div>
        </div>
        <div>
          <h3 className="v-step__title">Rechargez votre portefeuille</h3>
          <p className="v-step__text">Une seule fois, depuis FedaPay. Minimum {formatFcfa(MIN_DEPOSIT_AMOUNT)}.</p>
        </div>
      </div>
      <div className="v-step v-step--bleu">
        <span className="v-step__num">02</span>
        <div className="v-step__mini ds-desk-only">
          <span className="badge badge--lavande badge--sm"><Icon name="i-lock" />En séquestre</span>
          <div className="ds-grow"><b>Votre mission</b><small>Budget bloqué</small></div>
        </div>
        <div>
          <h3 className="v-step__title">Publiez, choisissez</h3>
          <p className="v-step__text">
            Le budget est bloqué à la publication. Vous comparez les candidats vérifiés et retenez le bon.
          </p>
        </div>
      </div>
      <div className="v-step v-step--citron">
        <span className="v-step__num">03</span>
        <div className="v-step__mini ds-desk-only">
          <span className="ic-sq ic-sq--sm ic-sq--encre"><Icon name="i-check" /></span>
          <div className="ds-grow"><b>Mission confirmée</b><small>Fonds libérés à l&rsquo;étudiant</small></div>
        </div>
        <div>
          <h3 className="v-step__title">Validez, c&rsquo;est payé</h3>
          <p className="v-step__text">
            Vous confirmez la fin ou signalez un problème. Annulation avant le début : remboursement intégral.
          </p>
        </div>
      </div>
    </div>
  )
}

// Section « Comment ça marche » : segmenté étudiant / client (maquette V01), pilotable au clavier.
export function HomeSteps() {
  const [active, setActive] = useState("student")
  const tabRefs = useRef({})

  function select(id, focus) {
    setActive(id)
    if (focus) tabRefs.current[id]?.focus()
  }

  function onKeyDown(event, index) {
    const last = TABS.length - 1
    let next = null
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    event.preventDefault()
    select(TABS[next].id, true)
  }

  return (
    <section className="section" id="etapes">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Comment ça marche</span>
          <h2 className="display display--xl ds-mt-3">
            3 étapes.<br /><span className="hl-bleu">Zéro galère.</span>
          </h2>
        </div>
        <div className="segmented" role="tablist" aria-label="Choisis ton profil">
          {TABS.map(({ id, label }, index) => (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`etapes-tab-${id}`}
              aria-selected={active === id}
              aria-controls={`etapes-panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              className={active === id ? "segmented__item is-active" : "segmented__item"}
              onClick={() => select(id, false)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`etapes-panel-${id}`}
          aria-labelledby={`etapes-tab-${id}`}
          hidden={active !== id}
        >
          {active === id ? (id === "student" ? <StudentSteps /> : <ClientSteps />) : null}
        </div>
      ))}
    </section>
  )
}
