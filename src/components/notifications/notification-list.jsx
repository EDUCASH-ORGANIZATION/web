import { NotificationItem } from "./notification-item"

/**
 * Liste groupée « Aujourd'hui » / « Plus tôt » (vue pure). `groups` vient de `groupNotifications`.
 * `primaryId` : l'unique notification qui porte le bouton encre. `headingAs` : niveau du titre de groupe
 * (h2 sur une page, h3 dans le panneau).
 */
export function NotificationList({ groups, now, primaryId = null, onOpen, headingAs: Heading = "h2" }) {
  return (
    <div className="ntf-groups">
      {groups.map((group) => (
        <section key={group.key} className="ntf-group">
          <Heading className="ntf-group__label">{group.label}</Heading>
          <ul className="ntf-list">
            {group.items.map((item) => (
              <NotificationItem key={item.id} item={item} now={now} primary={item.id === primaryId} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
