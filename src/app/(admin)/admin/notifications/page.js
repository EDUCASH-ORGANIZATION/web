// @ds-screen RD-ADMIN-01
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { NotificationsPage } from "@/components/notifications/notifications-page"
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/lib/actions/admin-notifications.actions"

export const metadata = { title: "Notifications - Admin EduCash" }

// Page mince : contrôle admin avant toute lecture (le layout le refait), puis action `admin-*` et vue. Le filtre
// `?filtre=non-lues` ne fait qu'un filtre : aucune action sur un GET.
export default async function AdminNotificationsPage({ searchParams } = {}) {
  const auth = await requireRole(["admin"])
  if (auth.error) redirect("/auth/login")

  const params = (await searchParams) ?? {}
  const filter = params.filtre === "non-lues" ? "unread" : "all"
  const result = await getAdminNotifications({ filtre: filter === "unread" ? "non-lues" : undefined })
  return (
    <NotificationsPage
      key={filter}
      space="admin"
      filter={filter}
      nowIso={new Date().toISOString()}
      initial={result.error ? null : { items: result.items, nextCursor: result.nextCursor, unreadCount: result.unreadCount }}
      actions={{ list: getAdminNotifications, markRead: markAdminNotificationRead, markAll: markAllAdminNotificationsRead }}
    />
  )
}
