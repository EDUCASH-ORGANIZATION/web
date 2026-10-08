import { Icon } from "@/components/design/icon"
import { COMMISSION_RATE } from "@/lib/constants/missions"

const SHARE = 100 - Math.round(COMMISSION_RATE * 100)
const COMMISSION = Math.round(COMMISSION_RATE * 100)

function Qual({ tone = "", icon, iconTone = "", title, text }) {
  return (
    <div className={`v01-qual${tone}`}>
      <span className={`ic-sq${iconTone}`}><Icon name={icon} /></span>
      <div className="v01-qual__t">{title}</div>
      <p className="v01-qual__p">{text}</p>
    </div>
  )
}

function Fig({ tone = "", badge, value, unit, label, text }) {
  return (
    <div className={`v-fig${tone}`}>
      <span className="v-fig__live">{badge}</span>
      <span className="v-fig__n">{value}{unit ? <small>{unit}</small> : null}</span>
      <p className="v-fig__t"><b>{label}</b>{text}</p>
    </div>
  )
}

// Bloc de chiffres. Compteurs réels en mode "live", arguments qualitatifs sinon (décision 20).
export function HomeFigures({ figures }) {
  if (figures.mode !== "live") {
    return (
      <div className="v-figures">
        <div className="v-figures__head">
          <span className="eyebrow">Pourquoi EduCash</span>
          <h2 className="display display--l">
            Petit.<br />Mais<br /><span className="hl-citron">carré.</span>
          </h2>
        </div>
        <Qual
          icon="i-lock"
          title="Payé à coup sûr"
          text="L'argent est bloqué avant le début. Personne ne peut partir sans payer."
        />
        <Qual
          tone=" v01-qual--bleu"
          icon="i-id-card"
          title="Vérifiés à la main"
          text="Chaque carte étudiante est lue par l'équipe, pas par un robot."
        />
        <Qual
          tone=" v01-qual--citron"
          icon="i-percent"
          iconTone=" ic-sq--encre"
          title={`${SHARE} % pour toi`}
          text={`Une seule commission de ${COMMISSION} %, affichée avant de postuler.`}
        />
        <Qual
          icon="i-map-pin"
          title="3 villes, pas plus"
          text="Cotonou, Abomey-Calavi et Porto-Novo. On grandit quand c'est solide."
        />
      </div>
    )
  }

  return (
    <div className="v-figures">
      <div className="v-figures__head">
        <span className="eyebrow">En chiffres, en vrai</span>
        <h2 className="display display--l">
          Pas de<br />bluff.<br /><span className="hl-citron">Des faits.</span>
        </h2>
        <p className="body-s">Compteurs lus en direct dans la base.</p>
      </div>
      <Fig
        badge="En direct"
        value={figures.openMissions}
        label="missions ouvertes"
        text="à Cotonou, Calavi et Porto-Novo"
      />
      <Fig
        tone=" v-fig--bleu"
        badge="En direct"
        value={figures.verifiedStudents}
        label="étudiants vérifiés"
        text="carte contrôlée par l'équipe"
      />
      <Fig
        tone=" v-fig--citron"
        badge="Règle"
        value={SHARE}
        unit="%"
        label="du budget pour toi"
        text={`commission unique de ${COMMISSION} %`}
      />
      <Fig
        badge="Règle"
        value={72}
        unit="h"
        label="maximum pour être payé"
        text="après ta déclaration de fin"
      />
    </div>
  )
}
