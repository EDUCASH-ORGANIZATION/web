import Link from "next/link"
import { Icon } from "@/components/design/icon"

const KIND = {
  empty: { className: "empty", icon: "i-search" },
  error: { className: "empty empty--erreur", icon: "i-alert-triangle" },
}

// Bloc d'état vide ou d'erreur (maquette V01). Les actions sont des liens.
// `titleAs` choisit la balise du titre (ex. "h1" quand le bloc est le seul contenu de la page).
export function StateBlock({ kind = "empty", title, text, actions = [], titleAs: Title = "div" }) {
  const { className, icon } = KIND[kind] ?? KIND.empty
  return (
    <div className={className}>
      <div className="empty__art">
        <span className="ic-sq"><Icon name={icon} /></span>
      </div>
      <Title className="empty__title">{title}</Title>
      {text ? <div className="empty__text">{text}</div> : null}
      {actions.length > 0 ? (
        <div className="empty__actions">
          {actions.map(({ href, label, variant = "primary" }) => (
            <Link key={`${href}-${label}`} className={`btn btn--${variant} btn--sm`} href={href}>
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
