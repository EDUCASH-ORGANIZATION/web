import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationItem } from "./notification-item"

const NOW = new Date("2026-10-15T12:00:00Z")
const base = {
  id: "n1",
  title: "Nouvelle candidature",
  body: "Afiavi D. a postulé à « Flyer ».",
  createdAt: "2026-10-15T10:00:00Z",
  unread: true,
  icon: "i-file",
  href: "/client/missions/m1",
  actionLabel: "Voir la candidature",
}
const html = (props) => renderToStaticMarkup(<ul><NotificationItem now={NOW} {...props} /></ul>)

describe("NotificationItem", () => {
  it("non lue : classe is-unread, texte « Non lue » pour les lecteurs d'écran, pastille grise", () => {
    const out = html({ item: base })
    expect(out).toContain("notif ntf-item is-unread")
    expect(out).toContain('<span class="sr-only">Non lue. </span>')
    expect(out).toContain("ic-sq ic-sq--givre")
    expect(out).toContain("il y a 2 h")
  })

  it("lue : aucune marque", () => {
    const out = html({ item: { ...base, unread: false } })
    expect(out).not.toContain("is-unread")
    expect(out).not.toContain("Non lue")
  })

  it("un seul lien par élément : l'action, le titre reste du texte", () => {
    const out = html({ item: base })
    expect(out.match(/<a /g)).toHaveLength(1)
    expect(out).toContain('href="/client/missions/m1"')
    expect(out).toContain("Voir la candidature")
    expect(out).toContain('class="link ntf-stretch"')
  })

  it("sans action : le titre est le lien unique", () => {
    const out = html({ item: { ...base, actionLabel: null } })
    expect(out.match(/<a /g)).toHaveLength(1)
    expect(out).toMatch(/<a [^>]*class="ntf-title-link ntf-stretch"[^>]*>Nouvelle candidature<\/a>/)
  })

  it("bouton encre seulement pour l'élément principal", () => {
    expect(html({ item: base, primary: true })).toContain("btn btn--dark btn--sm ntf-stretch")
    expect(html({ item: base })).not.toContain("btn--dark")
  })

  it("sans lien : texte seul, aucun <a>", () => {
    const out = html({ item: { ...base, href: null } })
    expect(out).not.toContain("<a ")
    expect(out).toContain("Nouvelle candidature")
  })

  it("XSS : titre et corps contenant du HTML sont échappés", () => {
    const out = html({
      item: { ...base, actionLabel: null, title: "<img src=x onerror=alert(1)>", body: "<script>alert(1)</script>" },
    })
    expect(out).not.toContain("<img")
    expect(out).not.toContain("<script>")
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(out).toContain("&lt;script&gt;")
  })

  it("aucun attribut de style ni de couleur en ligne", () => {
    expect(html({ item: base })).not.toMatch(/style=|dangerouslySetInnerHTML/)
  })
})
