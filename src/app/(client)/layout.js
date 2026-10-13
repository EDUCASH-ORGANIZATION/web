// @ds-screen RD-CLIENT-01
import { redirect } from "next/navigation"
import { isInternalPath } from "@/lib/auth/internal-path"
import { getClientShellData } from "@/lib/actions/client-shell.actions"
import { AppShell } from "@/components/app-shell/app-shell"
import { CLIENT_NAV } from "@/components/client-space/shell/client-nav"
import { ToastProvider } from "@/components/app-ui/toast"
import { OfflineBanner } from "@/components/app-ui/offline-banner"
import { PwaInstallBannerLoader } from "@/components/shared/pwa-install-banner-loader"

export default async function ClientLayout({ children }) {
  // Garde : getClientShellData exige profiles.role = client (jamais user_metadata), refuse un compte
  // suspendu et renvoie la destination fail-closed (connexion, accueil ou tableau de bord du bon rôle).
  const data = await getClientShellData()
  // La coquille est exigée : une réponse sans `shell` (refus, réponse vide) ne rend jamais les enfants.
  // La destination n'est suivie que si c'est un chemin interne ; sinon accueil. redirect() hors try/catch.
  if (!data?.shell) redirect(isInternalPath(data?.redirectTo) ? data.redirectTo : "/")
  const { shell } = data

  return (
    <div className="ds c2">
      <ToastProvider>
        <OfflineBanner />
        <AppShell nav={CLIENT_NAV} user={{ id: shell.userId, fullName: shell.fullName }} unreadCount={shell.unreadCount}>
          <PwaInstallBannerLoader space="client" />
          {children}
        </AppShell>
      </ToastProvider>
    </div>
  )
}
