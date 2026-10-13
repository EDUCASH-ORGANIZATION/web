"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"

/**
 * Relance d'un bloc en erreur : callback optionnel (ex. `reset` d'un error.js), puis rafraîchissement
 * des données de la page. Exporté pour les tests.
 */
export function retry(router, onRetry) {
  onRetry?.()
  router.refresh()
}

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

// Erreur de chargement, distincte du vide : annoncée (role alert) avec un bouton « Réessayer ».
export function ErrorState({
  title = "Un problème est survenu",
  text = "Le chargement a échoué. Vos données et vos fonds ne sont pas touchés.",
  compact = false,
  onRetry,
  titleAs: Title = "div",
}) {
  const router = useRouter()
  return (
    <div className={compact ? "empty2 empty2--sm" : "empty2"} role="alert">
      <span className="empty2__ic empty2__ic--erreur">
        <Icon name="i-alert-triangle" />
      </span>
      <Title className="empty2__title">{title}</Title>
      {text ? <div className="empty2__text">{text}</div> : null}
      <button type="button" className="btn btn--soft btn--sm" onClick={() => retry(router, onRetry)}>
        <Icon name="i-refresh" />
        Réessayer
      </button>
    </div>
  )
}

export default EmptyState
