import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { MISSION_TYPES, MISSION_TYPE_TAGLINES, missionTypeLabel } from "@/lib/constants/missions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"
import { formatFcfa } from "@/lib/vitrine/format"
import { publishHref } from "@/lib/utils/publish-prefill"

const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`
const OTHER = "Autre"

// Présentation de chaque type (forme, teinte, exemple vouvoyé) reprise de la maquette V01 v3.
// Les libellés, accroches et icônes viennent des dictionnaires partagés.
const TYPE_STYLE = {
  "Livraison": {
    shape: "sh-burst", card: " v-cat--big", sq: "",
    example: "Dantokpa, Ganhi, Saint-Michel : l'étudiant fait vos achats et vous rapporte tout.",
  },
  "Cours particuliers": {
    shape: "sh-circle", card: "", sq: " ic-sq--givre",
    example: "Répétiteur de maths, anglais, physique. Devoirs du soir, BEPC et BAC.",
  },
  "Babysitting": {
    shape: "sh-heart", card: " v-cat--citron", sq: " ic-sq--encre",
    example: "Sortie d'école, soirée, samedi : quelqu'un de sûr avec les enfants.",
  },
  "Saisie": {
    shape: "sh-quarter", card: " v-cat--encre", sq: "",
    example: "Factures sur Excel pour une boutique, courriers, CV, mise en page d'un dossier.",
  },
  "Community Management": {
    shape: "sh-star", card: " v-cat--lavande", sq: " ic-sq--blanc",
    example: "La page Facebook de votre commerce, visuels et publications.",
  },
  "Traduction": {
    shape: "sh-tri", card: "", sq: " ic-sq--givre",
    example: "Français, anglais, fon, yoruba : documents, courriers, sous-titres.",
  },
  "Démarches": {
    shape: "sh-cross", card: " v-cat--double", sq: " ic-sq--givre",
    example: "Déposer un dossier, faire la queue à la mairie, à la SBEE ou à la banque.",
  },
}
const FALLBACK_STYLE = { shape: "sh-circle", card: "", sq: " ic-sq--givre", example: "" }
const OTHER_EXAMPLE = "Un inventaire, un coup de main pour une cérémonie : décrivez-le."

// Ordre d'affichage : la grille est composée autour de la carte « Marché et achats ».
const ORDER = [
  "Livraison", "Cours particuliers", "Babysitting", "Saisie", "Community Management", "Traduction", "Démarches",
]

function cardLabel(type) {
  return `Publier une mission : ${missionTypeLabel(type)}`
}

// Services de l'accueil (maquette V01 v3). Chaque carte ouvre la publication avec le service choisi.
export function HomeCatalog() {
  const known = ORDER.filter((t) => MISSION_TYPES.includes(t))
  const extra = MISSION_TYPES.filter((t) => t !== OTHER && !ORDER.includes(t))
  const types = [...known, ...extra]

  return (
    <section className="section" id="services">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">Services</span>
          <h2 className="display display--xl ds-mt-3">
            Ce que vous<br /><span className="hl-bleu">pouvez confier.</span>
          </h2>
        </div>
        <p className="muted ds-measure-s ds-text-right">
          Chaque carte ouvre la publication avec le service déjà choisi. Vous fixez le budget, dès{" "}
          {formatFcfa(MIN_DEPOSIT_AMOUNT)}.
        </p>
      </div>
      <div className="v-cats">
        {types.map((type) => {
          const s = TYPE_STYLE[type] ?? FALLBACK_STYLE
          const tagline = MISSION_TYPE_TAGLINES[type]
          return (
            <Link key={type} className={`v-cat${s.card}`} href={publishHref({ type })} aria-label={cardLabel(type)}>
              <svg className="v-cat__shape" aria-hidden="true" focusable="false">
                <use href={`${SPRITE}#${s.shape}`} />
              </svg>
              <div className="v-cat__top">
                <span className={`ic-sq${s.sq}`}><Icon name={TYPE_ICON[type] ?? "i-briefcase"} /></span>
                <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
              </div>
              <div>
                <div className="v-cat__name">{missionTypeLabel(type)}</div>
                {s.example ? (
                  <div className="v-cat__ex">
                    {tagline ? <><b>{tagline}.</b>{" "}</> : null}
                    {s.example}
                  </div>
                ) : null}
              </div>
            </Link>
          )
        })}
        {MISSION_TYPES.includes(OTHER) ? (
          <Link className="v-cat v-cat--wide" href={publishHref({ type: OTHER })} aria-label={cardLabel(OTHER)}>
            <span className="ic-sq ic-sq--lg ic-sq--blanc"><Icon name={TYPE_ICON[OTHER]} /></span>
            <div className="ds-grow">
              <div className="v-cat__name">{missionTypeLabel(OTHER)}</div>
              <div className="v-cat__ex">{OTHER_EXAMPLE}</div>
            </div>
            <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
