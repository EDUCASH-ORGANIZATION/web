import { Icon } from "@/components/design/icon"
import {
  NOTIFICATIONS_EMPTY_TITLE,
  NOTIFICATIONS_UNAVAILABLE_TEXT,
  NOTIFICATIONS_UNAVAILABLE_TITLE,
  emptyNotificationsText,
} from "@/lib/notifications/catalog"

// États calmes du centre de notifications (vues pures). Le vide et l'indisponibilité sont distincts : le
// second est annoncé (role="alert") et propose « Réessayer » ; aucun rouge dans ce lot.

/** Aucune notification (ou aucune non lue avec le filtre actif). */
export function NotificationsEmpty({ space, unreadOnly = false, compact = false }) {
  return (
    <div className={compact ? "empty2 empty2--sm" : "empty2"}>
      <span className="empty2__ic">
        <Icon name="i-bell" />
      </span>
      <p className="empty2__title">{unreadOnly ? "Aucune notification non lue" : NOTIFICATIONS_EMPTY_TITLE}</p>
      <p className="empty2__text">
        {unreadOnly ? "Vous avez tout lu. Les nouvelles notifications apparaîtront ici." : emptyNotificationsText(space)}
      </p>
    </div>
  )
}

/** Lecture impossible (table absente ou erreur) : le bouton relance la lecture via `onRetry`. */
export function NotificationsUnavailable({ onRetry, compact = false }) {
  return (
    <div className={compact ? "empty2 empty2--sm" : "empty2"} role="alert">
      <span className="empty2__ic">
        <Icon name="i-bell" />
      </span>
      <p className="empty2__title">{NOTIFICATIONS_UNAVAILABLE_TITLE}</p>
      <p className="empty2__text">{NOTIFICATIONS_UNAVAILABLE_TEXT}</p>
      {onRetry ? (
        <button type="button" className="btn btn--soft btn--sm" onClick={onRetry}>
          <Icon name="i-refresh" />
          Réessayer
        </button>
      ) : null}
    </div>
  )
}

/** Squelette de chargement : un seul bloc annoncé aux lecteurs d'écran. */
export function NotificationsSkeleton({ count = 3 }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement des notifications</span>
      <div className="ntf-skeleton" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skel ntf-skeleton__row" />
        ))}
      </div>
    </div>
  )
}
