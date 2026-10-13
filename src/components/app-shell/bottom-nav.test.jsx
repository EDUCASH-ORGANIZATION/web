import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

let pathname = "/client/dashboard"
let unread = 0

vi.mock("next/navigation", () => ({ usePathname: () => pathname }))
vi.mock("./unread-provider", () => ({ useUnread: () => unread }))

const { BottomNav } = await import("./bottom-nav")
const { CLIENT_NAV } = await import("../client-space/shell/client-nav")

// Modèles fixtures conformes au contrat (étudiant et admin sont fournis par ST-03).
const STUDENT = [
  { key: "accueil", label: "Accueil", href: "/dashboard", icon: "i-home" },
  { key: "missions", label: "Missions", href: "/student/missions", icon: "i-briefcase" },
  { key: "candidatures", label: "Candidatures", href: "/applications", icon: "i-file" },
  { key: "messages", label: "Messages", href: "/messages", icon: "i-message", badge: "messages" },
]
const ADMIN = [
  { key: "accueil", label: "Accueil", href: "/admin/dashboard", icon: "i-home" },
  { key: "verifications", label: "Vérifications", href: "/admin/verifications", icon: "i-user-check", badge: "verifications", badgeUnit: "en attente" },
  { key: "utilisateurs", label: "Utilisateurs", href: "/admin/users", icon: "i-users" },
]
const ADMIN_MORE = {
  key: "plus",
  label: "Plus",
  icon: "i-more-h",
  items: [
    { key: "missions", label: "Missions", href: "/admin/missions", icon: "i-briefcase" },
    { key: "portefeuilles", label: "Portefeuilles", href: "/admin/wallets", icon: "i-wallet" },
  ],
}

function render(props, at, unreadCount = 0) {
  pathname = at
  unread = unreadCount
  return renderToStaticMarkup(<BottomNav {...props} />)
}

describe("BottomNav : client", () => {
  const items = CLIENT_NAV.mobile

  it("4 onglets et le CTA central, un seul onglet actif avec libellé, les autres en icône seule avec aria-label", () => {
    const html = render({ items }, "/client/dashboard")
    expect(html.match(/<a /g)).toHaveLength(5)
    expect(html.match(/class="bnav-item/g)).toHaveLength(4)
    expect(html.match(/is-active/g)).toHaveLength(1)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('<span class="bnav-label">Accueil</span>')
    expect(html.match(/class="bnav-label"/g)).toHaveLength(1)
    for (const label of ["Missions", "Messages", "Portefeuille"]) expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain('<nav class="bottom-nav bottom-nav--v2" aria-label="Navigation mobile">')
  })

  it("les icônes sont masquées aux technologies d'assistance", () => {
    const html = render({ items }, "/client/dashboard")
    expect(html.match(/<svg class="ic" aria-hidden="true"/g)).toHaveLength(5)
  })

  it("CTA central : lien rond entre Missions et Messages, nom accessible, sans libellé ni pastille", () => {
    const html = render({ items }, "/client/dashboard", 3)
    const cta = html.match(/<a class="bottom-nav__cta"[^>]*>.*?<\/a>/)[0]
    expect(cta).toBe(
      '<a class="bottom-nav__cta" aria-label="Publier une mission" href="/client/missions/new">' +
        '<svg class="ic" aria-hidden="true" focusable="false"><use href="/sprite.svg?v=' + cta.match(/v=([^#]*)#/)[1] + '#i-plus"></use></svg></a>',
    )
    expect(html.indexOf("bottom-nav__cta")).toBeGreaterThan(html.indexOf('href="/client/missions"'))
    expect(html.indexOf("bottom-nav__cta")).toBeLessThan(html.indexOf('href="/client/messages"'))
    expect(html).not.toContain("Publier une mission</span>")
  })

  it("sur la page de publication : anneau (aria-current) sur le CTA, aucune pastille ni onglet actif", () => {
    const html = render({ items }, "/client/missions/new")
    expect(html).toMatch(/<a class="bottom-nav__cta" aria-current="page" aria-label="Publier une mission" href="\/client\/missions\/new">/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).not.toContain("is-active")
    expect(html).not.toContain("bnav-label")
  })

  it("le CTA n'enlève pas la pastille de l'onglet actif ailleurs", () => {
    const html = render({ items }, "/client/missions/abc")
    expect(html.match(/is-active/g)).toHaveLength(1)
    expect(html).not.toContain("bottom-nav__cta\" aria-current")
  })

  it("étudiant et admin : aucun CTA", () => {
    expect(render({ items: STUDENT }, "/dashboard")).not.toContain("bottom-nav__cta")
    expect(render({ items: ADMIN, more: ADMIN_MORE }, "/admin/dashboard")).not.toContain("bottom-nav__cta")
  })

  it("actif selon la route", () => {
    expect(render({ items }, "/client/missions/abc")).toMatch(/is-active" aria-current="page" href="\/client\/missions"/)
    expect(render({ items }, "/client/missions/new")).not.toContain("is-active")
    expect(render({ items }, "/client/messages/x")).toMatch(/is-active" aria-current="page" href="\/client\/messages"/)
  })

  it("messages non lus : nom accessible avec compteur et pastille masquée", () => {
    const html = render({ items }, "/client/dashboard", 3)
    expect(html).toContain('aria-label="Messages, 3 non lus"')
    expect(html).toContain('<i class="bnav-item__dot" aria-hidden="true">3</i>')
  })

  it("150 non lus : 99+ et « plus de 99 non lus » ; 0 : aucune pastille", () => {
    const high = render({ items }, "/client/dashboard", 150)
    expect(high).toContain('<i class="bnav-item__dot" aria-hidden="true">99+</i>')
    expect(high).toContain("Messages, plus de 99 non lus")
    expect(render({ items }, "/client/dashboard", 0)).not.toContain("bnav-item__dot")
  })

  it("onglet actif avec compteur : pastille et nom accessible complet", () => {
    const html = render({ items }, "/client/messages", 4)
    expect(html).toContain('<span class="bnav-label">Messages</span>')
    expect(html).toContain('aria-label="Messages, 4 non lus"')
  })
})

describe("BottomNav : étudiant", () => {
  const props = { items: STUDENT, hideBelow: ["/messages"], reserveSpace: true }

  it("barre sur les écrans de liste, avec espaceur avant la nav", () => {
    for (const at of ["/dashboard", "/student/missions", "/applications", "/messages"]) {
      const html = render(props, at)
      expect(html.indexOf('<div class="bnav2-spacer" aria-hidden="true"></div>')).toBe(0)
      expect(html.indexOf("<nav")).toBeGreaterThan(0)
    }
  })

  it("masquée (ni barre ni espaceur) sur la conversation ; visible sur le détail de mission (aucune barre de candidature fixe ne l'occupe)", () => {
    expect(render(props, "/messages/abc")).toBe("")
    const detail = render(props, "/student/missions/42")
    expect(detail).toContain("<nav")
    expect(detail).toContain('<div class="bnav2-spacer" aria-hidden="true"></div>')
    expect(detail).toMatch(/is-active" aria-current="page" href="\/student\/missions"/)
  })

  it("rendue sur /messagesx (préfixe de texte)", () => {
    expect(render(props, "/messagesx")).toContain("<nav")
  })

  it("sans reserveSpace : pas d'espaceur", () => {
    expect(render({ items: STUDENT }, "/dashboard")).not.toContain("bnav2-spacer")
  })

  it("Candidatures actif sur /applications", () => {
    expect(render(props, "/applications")).toContain('<span class="bnav-label">Candidatures</span>')
  })
})

describe("BottomNav : admin", () => {
  const props = { items: ADMIN, more: ADMIN_MORE, counts: { verifications: 2 }, reserveSpace: true }

  it("badge Vérifications avec l'unité « en attente »", () => {
    const html = render(props, "/admin/dashboard")
    expect(html).toContain('aria-label="Vérifications, 2 en attente"')
    expect(html).toContain('<i class="bnav-item__dot" aria-hidden="true">2</i>')
  })

  it("Plus : bouton de divulgation fermé, panneau masqué au rendu initial", () => {
    const html = render(props, "/admin/dashboard")
    expect(html).toMatch(/<button type="button" class="bnav-item" aria-expanded="false" aria-controls="bnav2-more-panel" aria-label="Plus">/)
    expect(html).toMatch(/<ul id="bnav2-more-panel" class="bnav2-more__panel" hidden="">/)
    expect(html.match(/<nav /g)).toHaveLength(1)
  })

  it("Plus actif sur /admin/wallets : pastille « Plus » et lien du panneau en aria-current", () => {
    const html = render(props, "/admin/wallets")
    expect(html).toMatch(/<button type="button" class="bnav-item is-active"[^>]*aria-label="Plus, Portefeuilles"><svg[^>]*>.*?<\/svg><span class="bnav-label">Plus<\/span>/)
    expect(html).toMatch(/class="bnav2-more__link" aria-current="page"[^>]*>.*?Portefeuilles/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html.match(/class="bnav-label"/g)).toHaveLength(1)
  })

  it("Plus inactif ailleurs : aucun aria-current, aucun libellé sur le bouton", () => {
    const html = render(props, "/admin/users")
    expect(html).not.toMatch(/<span class="bnav-label">Plus/)
    expect(html).toMatch(/is-active" aria-current="page" href="\/admin\/users"/)
  })

  it("la valeur explicite de counts l'emporte sur les non lus du fournisseur", () => {
    const html = render({ items: STUDENT, counts: { messages: 7 } }, "/dashboard", 2)
    expect(html).toContain('aria-label="Messages, 7 non lus"')
  })

  it("aucun utilitaire Tailwind ni style en ligne", () => {
    const html = render(props, "/admin/wallets", 0)
    expect(html).not.toContain("style=")
    expect(html).not.toMatch(/class="[^"]*\b(?:flex|grid|bg-|text-|p-\d|gap-)/)
  })
})
