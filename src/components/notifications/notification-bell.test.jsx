import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationsProvider } from "./notifications-provider"
import { NotificationBell, NotificationBellLink } from "./notification-bell"

const render = (node, count) =>
  renderToStaticMarkup(
    <NotificationsProvider space="client" initialCount={count} actions={{}}>
      {node}
    </NotificationsProvider>,
  )

describe("NotificationBell (bureau)", () => {
  it("avec des non lues : libellé avec le nombre, point bleu, panneau fermé", () => {
    const out = render(<NotificationBell allHref="/client/notifications" />, 2)
    expect(out).toContain('aria-label="Notifications, 2 non lues"')
    expect(out).toContain('aria-expanded="false"')
    expect(out).toContain("iconbtn2__dot")
    expect(out).toContain("i-bell")
    expect(out).not.toContain("ntf-pop")
    expect(out).not.toContain("aria-controls")
  })

  it("sans non lue : libellé « Notifications », aucun point", () => {
    const out = render(<NotificationBell allHref="/client/notifications" />, 0)
    expect(out).toContain('aria-label="Notifications"')
    expect(out).not.toContain("iconbtn2__dot")
  })

  it("région aria-live polite vide au premier rendu (aucune annonce)", () => {
    const out = render(<NotificationBell allHref="/client/notifications" />, 5)
    expect(out).toMatch(/<span class="sr-only" role="status" aria-live="polite"><\/span>/)
  })

  it("bouton de type button (jamais un envoi de formulaire)", () => {
    expect(render(<NotificationBell allHref="/client/notifications" />, 1)).toContain('type="button"')
  })

  it("sans fournisseur : rien", () => {
    expect(renderToStaticMarkup(<NotificationBell allHref="/client/notifications" />)).toBe("")
  })
})

describe("NotificationBellLink (mobile)", () => {
  it("lien vers la page de l'espace, libellé avec le compteur", () => {
    const out = render(<NotificationBellLink href="/student/notifications" />, 1)
    expect(out).toContain('href="/student/notifications"')
    expect(out).toContain('aria-label="Notifications, 1 non lue"')
    expect(out).toContain("iconbtn2__dot")
    expect(out).not.toContain("<button")
  })

  it("compteur à 0 : aucun point", () => {
    const out = render(<NotificationBellLink href="/student/notifications" />, 0)
    expect(out).not.toContain("iconbtn2__dot")
  })
})
