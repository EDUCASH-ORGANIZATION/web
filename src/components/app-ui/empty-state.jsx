import Link from "next/link"
import { Icon } from "@/components/design/icon"

// Vide calme : ce qui manque et quoi faire. `titleAs` vaut "h1" quand le bloc est le seul contenu de la page.
export function EmptyState({ icon = "i-inbox", title, text, action, compact = false, titleAs: Title = "div" }) {
  return (
    <div className={compact ? "empty2 empty2--sm" : "empty2"}>
      <span className="empty2__ic">
        <Icon name={icon} />
      </span>
      <Title className="empty2__title">{title}</Title>
      {text ? <div className="empty2__text">{text}</div> : null}
      {action ? (
        <Link className="hero2__link" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

export default EmptyState
