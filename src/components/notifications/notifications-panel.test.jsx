import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationsProvider } from "./notifications-provider"
import { NotificationsPanel } from "./notifications-panel"

const html = () =>
  renderToStaticMarkup(
    <NotificationsProvider space="student" initialCount={3} actions={{ list: async () => ({}) }}>
      <NotificationsPanel id="panneau" allHref="/student/notifications" onClose={() => {}} />
    </NotificationsProvider>,
  )

describe("NotificationsPanel (rendu initial)", () => {
  it("titre focalisable, panneau non modal, squelette pendant le premier chargement", () => {
    const out = html()
    expect(out).toContain('id="panneau"')
    expect(out).toMatch(/<h2 [^>]*tabindex="-1"[^>]*>Notifications<\/h2>/)
    expect(out).not.toContain("aria-modal")
    expect(out).not.toContain('role="dialog"')
    expect(out).toContain("Chargement des notifications")
  })

  it("filtres Toutes / Non lues avec état pressé", () => {
    const out = html()
    expect(out).toContain("Toutes")
    expect(out).toContain("Non lues")
    expect(out).toMatch(/aria-pressed="true"[^>]*>Toutes/)
    expect(out).toMatch(/aria-pressed="false"[^>]*>Non lues/)
  })

  it("pied : lien vers la page de l'espace ; aucun lien vers des réglages inexistants", () => {
    const out = html()
    expect(out).toContain('href="/student/notifications"')
    expect(out).toContain("Voir toutes les notifications")
    expect(out).not.toMatch(/Régler|Réglages|settings/i)
  })

  it("« Tout marquer comme lu » masqué tant que la liste n'est pas chargée", () => {
    expect(html()).not.toContain("Tout marquer comme lu")
  })
})
