import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { MISSION_TYPES } from "@/lib/constants/missions"

const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`
const OTHER = "Autre"

// Présentation de chaque type (icône, forme, teinte, exemples) reprise de la maquette V01.
const TYPE_STYLE = {
  "Cours particuliers": {
    icon: "i-book", shape: "sh-burst", card: " v-cat--big", sq: "",
    example: "Maths, anglais, physique, préparation au BEPC et au BAC.",
  },
  "Livraison": {
    icon: "i-bike", shape: "sh-circle", card: "", sq: " ic-sq--givre",
    example: "Colis, courses, documents en zem ou à pied.",
  },
  "Saisie": {
    icon: "i-keyboard", shape: "sh-quarter", card: " v-cat--encre", sq: "",
    example: "Excel, fiches clients, transcription.",
  },
  "Babysitting": {
    icon: "i-baby", shape: "sh-heart", card: " v-cat--citron", sq: " ic-sq--encre",
    example: "Garde après l'école, sorties, soirées.",
  },
  "Traduction": {
    icon: "i-languages", shape: "sh-tri", card: "", sq: " ic-sq--givre",
    example: "Français, anglais, fongbé, yoruba.",
  },
  "Community Management": {
    icon: "i-megaphone", shape: "sh-star", card: " v-cat--lavande", sq: " ic-sq--blanc",
    example: "Page Facebook, visuels, publications.",
  },
}
const FALLBACK_STYLE = { icon: "i-briefcase", shape: "sh-circle", card: "", sq: " ic-sq--givre", example: "" }

// Ordre de la maquette : la grille est composée autour de « Cours particuliers ».
const ORDER = ["Cours particuliers", "Livraison", "Saisie", "Babysitting", "Traduction", "Community Management"]

function typeHref(type) {
  return `/missions?type=${encodeURIComponent(type)}`
}

// Catalogue des types de missions (maquette V01). Chaque carte filtre /missions sur le type.
export function HomeCatalog() {
  const known = ORDER.filter((t) => MISSION_TYPES.includes(t))
  const extra = MISSION_TYPES.filter((t) => t !== OTHER && !ORDER.includes(t))
  const types = [...known, ...extra]

  return (
    <section className="section">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">{MISSION_TYPES.length} types de missions</span>
          <h2 className="display display--xl ds-mt-3">
            Des petites missions.<br /><span className="hl-bleu">Du vrai cash.</span>
          </h2>
        </div>
        <p className="muted ds-measure-s ds-text-right">
          Chaque carte ouvre la liste des missions filtrée sur ce type.
        </p>
      </div>
      <div className="v-cats">
        {types.map((type) => {
          const s = TYPE_STYLE[type] ?? FALLBACK_STYLE
          return (
            <Link
              key={type}
              className={`v-cat${s.card}`}
              href={typeHref(type)}
              aria-label={`Voir les missions ${type}`}
            >
              <svg className="v-cat__shape" aria-hidden="true" focusable="false">
                <use href={`${SPRITE}#${s.shape}`} />
              </svg>
              <div className="v-cat__top">
                <span className={`ic-sq${s.sq}`}><Icon name={s.icon} /></span>
                <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
              </div>
              <div>
                <div className="v-cat__name">{type}</div>
                {s.example ? <div className="v-cat__ex">{s.example}</div> : null}
              </div>
            </Link>
          )
        })}
        {MISSION_TYPES.includes(OTHER) ? (
          <Link className="v-cat v-cat--wide" href={typeHref(OTHER)} aria-label={`Voir les missions ${OTHER}`}>
            <span className="ic-sq ic-sq--lg ic-sq--blanc"><Icon name="i-sparkles" /></span>
            <div className="ds-grow">
              <div className="v-cat__name">{OTHER}</div>
              <div className="v-cat__ex">
                Aide à un déménagement, inventaire, hôtesse d&rsquo;un jour : tout ce qui ne rentre pas ailleurs.
              </div>
            </div>
            <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
