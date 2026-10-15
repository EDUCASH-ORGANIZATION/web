// @ds-screen RD-STUDENT-01
import { NotificationsPage } from "@/components/notifications/notifications-page"
import {
  getStudentNotifications,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
} from "@/lib/actions/student-notifications.actions"

export const metadata = { title: "Notifications - EduCash" }

// Page mince : l'action de l'espace contrôle le rôle et lit les notifications de l'appelant ; la vue reçoit les
// données et les actions en props. `?filtre=non-lues` ne fait qu'un filtre : aucune action sur un GET.
export default async function StudentNotificationsPage({ searchParams } = {}) {
  const params = (await searchParams) ?? {}
  const filter = params.filtre === "non-lues" ? "unread" : "all"
  const result = await getStudentNotifications({ filtre: filter === "unread" ? "non-lues" : undefined })
  return (
    <NotificationsPage
      key={filter}
      space="student"
      filter={filter}
      nowIso={new Date().toISOString()}
      initial={result.error ? null : { items: result.items, nextCursor: result.nextCursor, unreadCount: result.unreadCount }}
      actions={{ list: getStudentNotifications, markRead: markStudentNotificationRead, markAll: markAllStudentNotificationsRead }}
    />
  )
}
