import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { SPRITE_VERSION } from "@/components/design/sprite"
import { MISSION_TYPES, missionTypeLabel } from "@/lib/constants/missions"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"

const SPRITE = `/sprite.svg?v=${SPRITE_VERSION}`
const OTHER = "Autre"

// Présentation de chaque type (forme, teinte, exemple), la clé est la valeur en base.
const TYPE_STYLE = {
  "Cours particuliers": {
    shape: "sh-burst", card: " v-cat--big", sq: "",
    example: "Répétiteur à domicile, devoirs du soir, préparation au BEPC et au BAC.",
  },
  "Livraison": {
    shape: "sh-circle", card: "", sq: " ic-sq--givre",
    example: "Tu fais le marché pour une famille. Les achats, c'est le client qui les paie au vendeur.",
  },
  "Saisie": {
    shape: "sh-quarter", card: " v-cat--encre", sq: "",
    example: "Excel, courriers, mise en page.",
  },
  "Babysitting": {
    shape: "sh-heart", card: " v-cat--citron", sq: " ic-sq--encre",
    example: "Sortie d'école, soirée, samedi.",
  },
  "Traduction": {
    shape: "sh-tri", card: "", sq: " ic-sq--givre",
    example: "Français, anglais, fon, yoruba.",
  },
  "Community Management": {
    shape: "sh-star", card: " v-cat--lavande", sq: " ic-sq--blanc",
    example: "Pages Facebook, visuels, publications.",
  },
  "Démarches": {
    shape: "sh-cross", card: " v-etu-cat--span2", sq: "",
    example: "Déposer un dossier, faire la queue à la mairie, à la SBEE, à la banque.",
  },
}
const FALLBACK_STYLE = { shape: "sh-circle", card: "", sq: " ic-sq--givre", example: "" }

// Ordre de la maquette : la grille est composée autour de « Cours particuliers ».
const ORDER = ["Cours particuliers", "Livraison", "Saisie", "Babysitting", "Traduction", "Community Management", "Démarches"]

function typeHref(type) {
  return `/missions?type=${encodeURIComponent(type)}`
}

// Services de /etudiants (maquette V05 v3) : tous les types de MISSION_TYPES, libellés du dictionnaire.
// Chaque lien filtre /missions sur la valeur en base.
export function EtudiantsServices() {
  const known = ORDER.filter((t) => MISSION_TYPES.includes(t))
  const extra = MISSION_TYPES.filter((t) => t !== OTHER && !ORDER.includes(t))
  const types = [...known, ...extra]

  return (
    <section className="section" id="services">
      <div className="section__head">
        <div>
          <span className="eyebrow eyebrow--bleu">{MISSION_TYPES.length} services</span>
          <h2 className="display display--l ds-mt-3">
            Des petites missions.<br /><span className="hl-bleu">Du vrai cash.</span>
          </h2>
        </div>
        <p className="muted ds-measure-s ds-text-right">Chaque carte ouvre la liste des missions de ce service.</p>
      </div>
      <div className="v-cats v-etu-cats">
        {types.map((type) => {
          const s = TYPE_STYLE[type] ?? FALLBACK_STYLE
          const label = missionTypeLabel(type)
          return (
            <Link
              key={type}
              className={`v-cat${s.card}`}
              href={typeHref(type)}
              aria-label={`Voir les missions : ${label}`}
            >
              <svg className="v-cat__shape" aria-hidden="true" focusable="false">
                <use href={`${SPRITE}#${s.shape}`} />
              </svg>
              <div className="v-cat__top">
                <span className={`ic-sq${s.sq}`}><Icon name={TYPE_ICON[type] ?? "i-briefcase"} /></span>
                <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
              </div>
              <div>
                <div className="v-cat__name">{label}</div>
                {s.example ? <div className="v-cat__ex">{s.example}</div> : null}
              </div>
            </Link>
          )
        })}
        {MISSION_TYPES.includes(OTHER) ? (
          <Link className="v-cat v-cat--wide" href={typeHref(OTHER)} aria-label={`Voir les missions : ${missionTypeLabel(OTHER)}`}>
            <span className="ic-sq ic-sq--lg ic-sq--blanc"><Icon name={TYPE_ICON[OTHER] ?? "i-sparkles"} /></span>
            <div className="ds-grow">
              <div className="v-cat__name">{missionTypeLabel(OTHER)}</div>
              <div className="v-cat__ex">
                Inventaire, aide pour une cérémonie, hôtesse d&rsquo;un jour : tout ce qui ne rentre pas ailleurs.
              </div>
            </div>
            <span className="v-cat__go"><Icon name="i-arrow-up-right" /></span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
