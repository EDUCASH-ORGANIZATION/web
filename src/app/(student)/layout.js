// @ds-screen RD-STUDENT-01
import { redirect } from "next/navigation"
import { isInternalPath } from "@/lib/auth/internal-path"
import { getStudentShellData } from "@/lib/actions/student-shell.actions"
import {
  getStudentNotifications,
  getStudentUnreadNotificationCount,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
} from "@/lib/actions/student-notifications.actions"
import { AppShell } from "@/components/app-shell/app-shell"
import { STUDENT_NAV } from "@/components/student-space/shell/student-nav"
import { ToastProvider } from "@/components/app-ui/toast"
import { OfflineBanner } from "@/components/app-ui/offline-banner"
import { PwaInstallBannerLoader } from "@/components/shared/pwa-install-banner-loader"

export default async function StudentLayout({ children }) {
  // Garde : getStudentShellData exige profiles.role = student (jamais user_metadata), refuse un compte
  // suspendu et renvoie la destination fail-closed (connexion, accueil ou tableau de bord du bon rôle).
  const data = await getStudentShellData()
  // La coquille est exigée : une réponse sans `shell` (refus, réponse vide) ne rend jamais les enfants.
  // La destination n'est suivie que si c'est un chemin interne ; sinon accueil. redirect() hors try/catch.
  if (!data?.shell) redirect(isInternalPath(data?.redirectTo) ? data.redirectTo : "/")
  const { shell } = data

  return (
    <div className="ds e2">
      <ToastProvider>
        <OfflineBanner />
        <AppShell
          nav={STUDENT_NAV}
          user={{ id: shell.userId, fullName: shell.fullName }}
          unreadCount={shell.unreadCount}
          notifications={{
            count: shell.notificationCount,
            actions: {
              list: getStudentNotifications,
              count: getStudentUnreadNotificationCount,
              markRead: markStudentNotificationRead,
              markAll: markAllStudentNotificationsRead,
            },
          }}
        >
          <PwaInstallBannerLoader space="student" />
          {children}
        </AppShell>
      </ToastProvider>
    </div>
  )
}
