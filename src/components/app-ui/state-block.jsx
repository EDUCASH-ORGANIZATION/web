"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"

// EmptyState vit dans empty-state.jsx (sans "use client"). Ce module est un module client : l'importer
// depuis state-block en fait un composant client pour ses importeurs. Pour un rendu serveur, importer
// directement depuis "./empty-state".
export { EmptyState } from "./empty-state"

/**
 * Relance d'un bloc en erreur : callback optionnel (ex. `reset` d'un error.js), puis rafraîchissement
 * des données de la page. Exporté pour les tests.
 */
export function retry(router, onRetry) {
  onRetry?.()
  router.refresh()
}

// Un chemin interne seulement ("/..." et pas "//..."), jamais une adresse externe ni un schéma.
export function isInternalPath(href) {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")
}

// Erreur de chargement, distincte du vide : annoncée (role alert) avec un bouton « Réessayer ».
// `action` (optionnel, `{ href, label }`) ajoute un lien de sortie sous le bouton, chemin interne seulement.
// `title` et `text` ont des défauts vouvoyés communs à tous les espaces (registre unique) ; ils restent surchargeables.
export function ErrorState({
  title = "Un problème est survenu",
  text = "Le chargement a échoué. Vos données et vos fonds ne sont pas touchés.",
  compact = false,
  onRetry,
  action,
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
      {action && isInternalPath(action.href) ? (
        <Link className="hero2__link" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

export { EmptyState as default } from "./empty-state"
