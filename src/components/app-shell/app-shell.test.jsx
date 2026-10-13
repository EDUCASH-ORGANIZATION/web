import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"

let pathname = "/client/dashboard"
let unread = 2

vi.mock("next/navigation", () => ({ usePathname: () => pathname }))
vi.mock("@/hooks/use-unread-count", () => ({ useUnreadCount: (_id, initial) => (unread ?? initial) }))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))

const { AppShell } = await import("./app-shell")
const { CLIENT_NAV } = await import("../client-space/shell/client-nav")

const USER = { id: "client-1", fullName: "Rosine Houngbédji" }

function render(over = {}, at = "/client/dashboard") {
  pathname = at
  return renderToStaticMarkup(
    <AppShell nav={CLIENT_NAV} user={USER} unreadCount={2} {...over}>
      <p>Contenu de la page</p>
    </AppShell>,
  )
}

function navHtml(html, className) {
  const start = html.indexOf(`<nav class="${className}`)
  return html.slice(start, html.indexOf("</nav>", start))
}

describe("AppShell (rendu statique)", () => {
  it("pose la coquille v2, le cadre, la sidebar et le contenu dans main#contenu", () => {
    const html = render()
    expect(html).toContain('class="shell shell--v2"')
    expect(html).toContain('class="shell__frame"')
    expect(html).toContain('<aside class="sidebar">')
    expect(html).toContain('class="shell__main"')
    expect(html).toMatch(/<main id="contenu" class="page2" tabindex="-1"><p>Contenu de la page<\/p><\/main>/)
  })

  it("le lien d'évitement est le premier élément et vise main#contenu", () => {
    const html = render()
    expect(html.indexOf("ds-skip-link")).toBeLessThan(html.indexOf("<aside"))
    expect(html).toContain('href="#contenu"')
    expect(html).toContain("Aller au contenu")
  })

  it("une seule navigation au bureau, une seule barre du bas, aucune sidebar dupliquée", () => {
    const html = render()
    expect(html.match(/<aside/g)).toHaveLength(1)
    expect(html.match(/class="bottom-nav bottom-nav--v2"/g)).toHaveLength(1)
    expect(html.match(/<main/g)).toHaveLength(1)
  })

  it("ajoute shell--detail pour les écrans de détail", () => {
    expect(render({ detail: true })).toContain('class="shell shell--v2 shell--detail"')
  })

  it("bureau : logo blanc au ratio du viewBox, espace, CTA, groupes", () => {
    const html = render()
    expect(html).toMatch(/src="\/logo-horizontal-blanc\.svg"[^>]*width="165" height="40"/)
    expect(html).toContain("Espace client")
    expect(html).toMatch(/btn btn--sidebar btn--sm btn--block sidebar__cta" href="\/client\/missions\/new"/)
    expect(html).toContain("Publier une mission")
    for (const label of ["Accueil", "Mes missions", "Messages", "Portefeuille", "Compte", "Mon profil", "Aide"]) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain("Agenda")
    expect(html).not.toContain("Paramètres")
  })

  it("bureau : aria-current seulement sur l'élément actif", () => {
    const side = navHtml(render(), "sidebar__nav")
    expect(side.match(/aria-current="page"/g)).toHaveLength(1)
    expect(side).toMatch(/nav-item is-active" aria-current="page"[^>]*>.*?Accueil/)
    const missions = navHtml(render({}, "/client/missions/42"), "sidebar__nav")
    expect(missions).toMatch(/is-active" aria-current="page" href="\/client\/missions"|href="\/client\/missions"[^>]*class="nav-item is-active"/)
  })

  it("/client/missions/new n'active pas Mes missions au bureau", () => {
    const side = navHtml(render({}, "/client/missions/new"), "sidebar__nav")
    expect(side).not.toContain("aria-current")
  })

  it("compteur de messages : « 99+ » borné, nom accessible complet, masqué si zéro", () => {
    unread = 2
    expect(navHtml(render(), "sidebar__nav")).toContain('aria-label="Messages, 2 non lus"')
    unread = 250
    const high = render()
    expect(navHtml(high, "sidebar__nav")).toContain('<span class="count" aria-hidden="true">99+</span>')
    expect(navHtml(high, "sidebar__nav")).toContain("plus de 99 non lus")
    expect(navHtml(high, "bottom-nav")).toContain('<i class="bnav-item__dot" aria-hidden="true">99+</i>')
    unread = 0
    const none = render()
    expect(none).not.toContain('class="count"')
    expect(none).not.toContain("bnav-item__dot")
    unread = 2
  })

  it("identité et déconnexion par formulaire (server action)", () => {
    const html = render()
    expect(html).toContain("Rosine Houngbédji")
    expect(html).toContain(">RH<")
    expect(html).toMatch(/<form[^>]*><button type="submit" class="iconbtn2" aria-label="Déconnexion"/)
  })

  it("barre du haut : recherche GET vers la liste des missions, raccourci « / », pas de cloche", () => {
    const html = render()
    expect(html).toMatch(/<form role="search" action="\/client\/missions" method="get">/)
    expect(html).toContain('name="q"')
    expect(html).toContain('aria-label="Rechercher une mission"')
    expect(html).toContain('aria-keyshortcuts="/"')
    expect(html).toContain("<kbd")
    expect(html).not.toContain("Notifications")
    expect(html).not.toContain("i-bell")
  })

  it("mobile : en-tête avec logo symbole et avatar vers le profil", () => {
    const html = render()
    expect(html).toContain('class="mtop2"')
    expect(html).toMatch(/src="\/logo-symbole-bleu\.svg"[^>]*width="34" height="32"/)
    expect(html).toMatch(/class="av2 av2--sm" aria-label="Mon profil" href="\/client\/profile"/)
  })

  it("mobile : barre du bas de 5 onglets, actif marqué, Publier actif sur /client/missions/new", () => {
    const html = render({}, "/client/missions/new")
    const bar = navHtml(html, "bottom-nav")
    expect(bar.match(/class="bnav-item(?: is-active)?"/g)).toHaveLength(5)
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1)
    expect(bar).toMatch(/bnav-item is-active" aria-current="page" href="\/client\/missions\/new"/)
    expect(bar).toContain('class="bnav-label">Publier</span>')
    expect(bar).toContain('aria-label="Navigation principale"')
  })

  it("les deux navigations portent un nom accessible", () => {
    expect(render().match(/aria-label="Navigation principale"/g)).toHaveLength(2)
  })

  it("aucune classe Tailwind, aucun style en ligne, aucun lien vers /client/notifications", () => {
    const html = render()
    expect(html).not.toMatch(/class="[^"]*\b(?:flex|grid|bg-|text-|p-\d|gap-)/)
    expect(html).not.toContain("style=")
    expect(html).not.toContain("/client/notifications")
  })
})

describe("configuration client : aucun lien vers une route inexistante", () => {
  const APP = path.join(process.cwd(), "src/app")

  function pages(dir, acc = []) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) pages(full, acc)
      else if (name === "page.js" || name === "page.jsx") acc.push(path.relative(APP, path.dirname(full)))
    }
    return acc
  }

  const routes = pages(APP).map((dir) =>
    "/" + dir.split(path.sep).filter((seg) => !/^\(.*\)$/.test(seg)).join("/"),
  )
  const matches = (href) =>
    routes.some((route) => {
      const pattern = new RegExp("^" + route.replace(/\[[^\]]+\]/g, "[^/]+") + "/?$")
      return pattern.test(href)
    })

  const hrefs = [
    CLIENT_NAV.homeHref,
    CLIENT_NAV.profileHref,
    CLIENT_NAV.cta.href,
    CLIENT_NAV.search.action,
    ...CLIENT_NAV.groups.flatMap((g) => g.items.map((i) => i.href)),
    ...CLIENT_NAV.mobile.map((i) => i.href),
  ]

  it("chaque href de la configuration correspond à une page existante", () => {
    const missing = [...new Set(hrefs)].filter((href) => !matches(href))
    expect(missing).toEqual([])
  })

  it("le détecteur reconnaît une route absente", () => {
    expect(matches("/client/notifications")).toBe(false)
    expect(matches("/client/missions/42")).toBe(true)
  })
})
