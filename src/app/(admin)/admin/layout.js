// @ds-screen RD-ADMIN-01
import { redirect } from "next/navigation"
import { isInternalPath } from "@/lib/auth/internal-path"
import { getAdminShellData } from "@/lib/actions/admin-shell.actions"
import {
  getAdminNotifications,
  getAdminUnreadNotificationCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/lib/actions/admin-notifications.actions"
import { AppShell } from "@/components/app-shell/app-shell"
import { ADMIN_NAV } from "@/components/admin-space/shell/admin-nav"
import { ToastProvider } from "@/components/app-ui/toast"
import { OfflineBanner } from "@/components/app-ui/offline-banner"

export default async function AdminLayout({ children }) {
  // Garde : getAdminShellData exige profiles.role = admin (jamais user_metadata), refuse un compte suspendu et
  // renvoie la destination fail-closed (connexion, accueil ou tableau de bord du bon rôle).
  const data = await getAdminShellData()
  // La coquille est exigée : une réponse sans `shell` (refus, réponse vide) ne rend jamais les enfants.
  // La destination n'est suivie que si c'est un chemin interne ; sinon accueil. redirect() hors try/catch.
  if (!data?.shell) redirect(isInternalPath(data?.redirectTo) ? data.redirectTo : "/")
  const { shell } = data

  return (
    <div className="ds a2">
      <ToastProvider>
        <OfflineBanner title="Vous êtes hors connexion." text="Les actions sont désactivées." />
        <AppShell
          nav={ADMIN_NAV}
          user={{ id: shell.userId, fullName: shell.fullName }}
          counts={{ verifications: shell.pendingCount, reports: shell.reportsOpenCount }}
          notifications={{
            count: shell.notificationCount,
            actions: {
              list: getAdminNotifications,
              count: getAdminUnreadNotificationCount,
              markRead: markAdminNotificationRead,
              markAll: markAllAdminNotificationsRead,
            },
          }}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </div>
  )
}
