import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { formatRelative } from "@/lib/app/format"

/**
 * Un élément de notification (vue pure : aucune lecture de données, aucune action).
 * `item` est déjà calculé : { id, title, body, createdAt, unread, icon, href, actionLabel }.
 * Un seul lien par élément : l'action s'il y en a une (bouton encre si `primary`, sinon lien bleu), sinon le titre.
 * Le lien couvre toute la carte (classe `ntf-stretch`). `onOpen(item)` est fourni par le parent interactif.
 */
export function NotificationItem({ item, now, primary = false, onOpen }) {
  const { title, body, createdAt, unread, icon, href, actionLabel } = item
  const open = onOpen ? () => onOpen(item) : undefined
  const hasAction = Boolean(href && actionLabel)
  const time = formatRelative(createdAt, now)
  return (
    <li className={unread ? "notif ntf-item is-unread" : "notif ntf-item"}>
      <span className="ic-sq ic-sq--givre" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="notif__body">
        <p className="notif__title">
          {unread ? <span className="sr-only">Non lue. </span> : null}
          {href && !hasAction ? (
            <Link className="ntf-title-link ntf-stretch" href={href} prefetch={false} onClick={open}>
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {body ? <p className="notif__text">{body}</p> : null}
        {time ? (
          <p className="notif__time">
            <time dateTime={createdAt}>{time}</time>
          </p>
        ) : null}
        {hasAction ? (
          <div className="notif__actions">
            <Link
              className={primary ? "btn btn--dark btn--sm ntf-stretch" : "link ntf-stretch"}
              href={href}
              prefetch={false}
              onClick={open}
            >
              {actionLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  )
}
