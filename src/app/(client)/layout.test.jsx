// Garde du layout client : sans coquille, jamais de rendu des enfants ; destination interne seulement.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const getClientShellData = vi.fn()
const redirect = vi.fn((to) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { to })
})

vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to) }))
vi.mock("@/lib/actions/client-shell.actions", () => ({ getClientShellData: (...a) => getClientShellData(...a) }))
vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: ({ children, user, unreadCount, notifications }) => (
    <div
      data-testid="shell"
      data-user={user.fullName}
      data-unread={unreadCount}
      data-notifications={notifications?.count}
      data-notification-actions={notifications ? Object.keys(notifications.actions).sort().join(",") : ""}
    >
      {children}
    </div>
  ),
}))
vi.mock("@/components/client-space/shell/client-nav", () => ({ CLIENT_NAV: [] }))
vi.mock("@/components/app-ui/toast", () => ({ ToastProvider: ({ children }) => <>{children}</> }))
vi.mock("@/components/app-ui/offline-banner", () => ({ OfflineBanner: () => null }))
vi.mock("@/components/shared/pwa-install-banner-loader", () => ({ PwaInstallBannerLoader: () => null }))

import ClientLayout from "./layout"

const CHILD = <p>contenu-protege</p>

beforeEach(() => {
  getClientShellData.mockReset()
  redirect.mockClear()
})

describe("(client)/layout", () => {
  it("refus : redirige vers la destination interne et ne rend jamais les enfants", async () => {
    getClientShellData.mockResolvedValue({ error: "refus", redirectTo: "/auth/login?suspended=1" })
    await expect(ClientLayout({ children: CHILD })).rejects.toMatchObject({ to: "/auth/login?suspended=1" })
    expect(redirect).toHaveBeenCalledWith("/auth/login?suspended=1")
  })

  it("l'action lève : aucun rendu des enfants (échec fermé)", async () => {
    getClientShellData.mockRejectedValue(new Error("boom"))
    await expect(ClientLayout({ children: CHILD })).rejects.toThrow("boom")
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([{}, undefined, null])("réponse vide %j : redirige vers l'accueil", async (value) => {
    getClientShellData.mockResolvedValue(value)
    await expect(ClientLayout({ children: CHILD })).rejects.toMatchObject({ to: "/" })
  })

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", undefined])(
    "redirectTo non interne %j : redirige vers l'accueil",
    async (redirectTo) => {
      getClientShellData.mockResolvedValue({ error: "refus", redirectTo })
      await expect(ClientLayout({ children: CHILD })).rejects.toMatchObject({ to: "/" })
    }
  )

  it("succès : rend les enfants dans la coquille", async () => {
    getClientShellData.mockResolvedValue({ shell: { userId: "u1", fullName: "Rosine", unreadCount: 2 } })
    const out = renderToStaticMarkup(await ClientLayout({ children: CHILD }))
    expect(out).toContain("contenu-protege")
    expect(out).toContain('data-user="Rosine"')
    expect(out).toContain('data-unread="2"')
    expect(redirect).not.toHaveBeenCalled()
  })

  it("transmet le compteur de notifications et les quatre actions de l'espace client à la coquille", async () => {
    getClientShellData.mockResolvedValue({ shell: { userId: "u1", fullName: "Rosine", unreadCount: 2, notificationCount: 5 } })
    const out = renderToStaticMarkup(await ClientLayout({ children: CHILD }))
    expect(out).toContain('data-notifications="5"')
    expect(out).toContain('data-notification-actions="count,list,markAll,markRead"')
  })
})
