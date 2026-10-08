import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { VitrinePage } from "../shared/vitrine-page"

const TABS = [
  { key: "mentions", href: "/legal/mentions", label: "Mentions légales" },
  { key: "privacy", href: "/legal/privacy", label: "Politique de confidentialité" },
  { key: "terms", href: "/legal/terms", label: "Conditions d’utilisation" },
]

const NUMBERED_TITLE = /^(\d+)\.\s*/

// Numéro et libellé du sommaire : repris du titre s'il est numéroté, sinon de la position.
function tocEntry({ id, title }, index) {
  const match = title.match(NUMBERED_TITLE)
  const number = match ? match[1] : String(index + 1)
  return { id, number: number.padStart(2, "0"), label: title.replace(NUMBERED_TITLE, "") }
}

function Toc({ entries }) {
  return (
    <nav className="v09-toc" aria-label="Sommaire">
      <b>Sommaire</b>
      {entries.map(({ id, number, label }) => (
        <a key={id} href={`#${id}`}>
          <span>{number}</span>
          {label}
        </a>
      ))}
    </nav>
  )
}

// Gabarit commun des pages légales (maquette V09) : en-tête à onglets, sommaire
// collant en bureau, dépliable en mobile, texte à largeur de lecture.
export function LegalLayout({ current, title, updatedAt, sections, children }) {
  const entries = sections.map(tocEntry)
  const others = TABS.filter((tab) => tab.key !== current)
  return (
    <VitrinePage>
      <div className="v09-head grid-bg">
        <Icon name="sc-burst" className="scribble v09-scribble" />
        <span className="eyebrow">Légal</span>
        <h1 className="display display--xl ds-mt-3">{title}</h1>
        <div className="v09-meta">
          <span className="badge badge--citron">
            <Icon name="i-refresh" />
            Dernière mise à jour : {updatedAt}
          </span>
        </div>
        <nav className="v09-tabs" aria-label="Pages légales">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={tab.key === current ? "is-active" : undefined}
              aria-current={tab.key === current ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="v09-layout">
        <div className="ds-desk-only">
          <Toc entries={entries} />
        </div>
        <details className="v09-acc ds-mob-only">
          <summary className="v09-acc__btn">
            <span>Sommaire</span>
            <Icon name="i-chevron-down" />
          </summary>
          <Toc entries={entries} />
        </details>
        <article className="v09-prose ds-measure-read">
          {children}
          <div className="v09-see">
            <span className="body-s muted">Voir aussi :</span>
            {others.map((tab) => (
              <Link key={tab.key} className="chip chip--sm" href={tab.href}>
                {tab.label}
              </Link>
            ))}
            <Link className="link body-s" href="/contact">
              Nous contacter
              <Icon name="i-arrow-right" className="ic ic--16" />
            </Link>
          </div>
        </article>
      </div>
    </VitrinePage>
  )
}
