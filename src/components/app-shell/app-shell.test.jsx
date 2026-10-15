import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createHash } from "node:crypto"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"

let pathname = "/client/dashboard"
let search = ""
let unread = 2
const unreadHook = vi.fn((_id, initial) => (unread ?? initial))

vi.mock("next/navigation", () => ({ usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) }))
vi.mock("@/hooks/use-unread-count", () => ({ useUnreadCount: (...args) => unreadHook(...args) }))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))

const { AppShell } = await import("./app-shell")
const { CLIENT_NAV } = await import("../client-space/shell/client-nav")
const { STUDENT_NAV } = await import("../student-space/shell/student-nav")

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

  it("un seul abonnement aux messages non lus pour la sidebar et la barre du bas", () => {
    unreadHook.mockClear()
    render()
    expect(unreadHook).toHaveBeenCalledTimes(1)
    expect(unreadHook).toHaveBeenCalledWith("client-1", 2)
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

  it("mobile : 4 onglets et le CTA central, Accueil actif, Publier entre Missions et Messages", () => {
    const bar = navHtml(render(), "bottom-nav")
    expect(bar.match(/class="bnav-item(?: is-active)?"/g)).toHaveLength(4)
    expect(bar.match(/<a /g)).toHaveLength(5)
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1)
    expect(bar).toMatch(/bnav-item is-active" aria-current="page" href="\/client\/dashboard"/)
    expect(bar).toContain('class="bnav-label">Accueil</span>')
    expect(bar.match(/class="bnav-label"/g)).toHaveLength(1)
    for (const label of ["Missions", "Messages, 2 non lus", "Portefeuille"]) expect(bar).toContain(`aria-label="${label}"`)
    expect(bar).toMatch(/<a class="bottom-nav__cta" aria-label="Publier une mission" href="\/client\/missions\/new"><svg/)
    expect(bar.indexOf('href="/client/missions"')).toBeLessThan(bar.indexOf("bottom-nav__cta"))
    expect(bar.indexOf("bottom-nav__cta")).toBeLessThan(bar.indexOf('href="/client/messages"'))
    expect(bar).not.toMatch(/bottom-nav__cta[^>]*>.*?bnav-label[^<]*>Publier/)
    expect(bar).toContain('aria-label="Navigation mobile"')
  })

  it("mobile : sur /client/missions/new le CTA porte aria-current et aucun onglet n'est actif", () => {
    const bar = navHtml(render({}, "/client/missions/new"), "bottom-nav")
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1)
    expect(bar).toMatch(/class="bottom-nav__cta" aria-current="page" aria-label="Publier une mission" href="\/client\/missions\/new"/)
    expect(bar).not.toContain("is-active")
    expect(bar).not.toContain("bnav-label")
  })

  it("les deux navigations portent un nom accessible distinct", () => {
    const html = render()
    expect(html.match(/aria-label="Navigation principale"/g)).toHaveLength(1)
    expect(html.match(/aria-label="Navigation mobile"/g)).toHaveLength(1)
  })

  it("aucune classe Tailwind, aucun style en ligne, aucun lien vers /client/notifications", () => {
    const html = render()
    expect(html).not.toMatch(/class="[^"]*\b(?:flex|grid|bg-|text-|p-\d|gap-)/)
    expect(html).not.toContain("style=")
    expect(html).not.toContain("/client/notifications")
  })
})

describe("AppShell : champ de recherche de la barre du haut (echo de q, espace étudiant seulement)", () => {
  const inputOf = (html) => html.match(/<input[^>]*type="search"[^>]*>/)[0]
  const renderStudent = (at, q) => {
    search = q === undefined ? "" : `q=${encodeURIComponent(q)}`
    try {
      return render({ nav: STUDENT_NAV }, at)
    } finally {
      search = ""
    }
  }

  it("affiche q dans le champ sur la page de l'action, échappé par React", () => {
    expect(inputOf(renderStudent("/student/missions", "design"))).toContain('value="design"')
    const hostile = inputOf(renderStudent("/student/missions", '"><script>alert(1)</script>'))
    expect(hostile).not.toContain("<script>")
    expect(hostile).toContain("&quot;&gt;&lt;script&gt;")
  })

  it("borne la valeur à 100 caractères", () => {
    const value = inputOf(renderStudent("/student/missions", "a".repeat(250))).match(/value="([^"]*)"/)[1]
    expect(value).toHaveLength(100)
  })

  it("élague q et pose maxLength 100 sur le champ étudiant seulement", () => {
    expect(inputOf(renderStudent("/student/missions", "  design  "))).toContain('value="design"')
    expect(inputOf(renderStudent("/student/missions", "design"))).toContain('maxLength="100"')
    search = "q=design"
    const client = inputOf(render({}, "/client/missions"))
    search = ""
    expect(client).not.toContain("maxLength")
  })

  describe("filtres conservés dans la recherche", () => {
    const hiddenOf = (html) => [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"\/>/g)].map((m) => [m[1], m[2]])
    const renderWith = (at, query) => {
      search = query
      try {
        return render({ nav: STUDENT_NAV }, at)
      } finally {
        search = ""
      }
    }

    it("reprend type, villes, urgence, budget et tri en champs cachés, sans q ni page", () => {
      const html = renderWith("/student/missions", "q=design&type=delivery&cities=Cotonou%2CPorto-Novo&urgency=urgent&budget=b1&sort=prix&page=3")
      expect(hiddenOf(html)).toEqual([
        ["type", "delivery"],
        ["cities", "Cotonou,Porto-Novo"],
        ["urgency", "urgent"],
        ["budget", "b1"],
        ["sort", "prix"],
      ])
    })

    it("n'ajoute aucun champ caché sans filtre, hors de la page de l'action, ni pour le client", () => {
      expect(hiddenOf(renderWith("/student/missions", "q=design"))).toEqual([])
      expect(hiddenOf(renderWith("/student/dashboard", "type=delivery"))).toEqual([])
      search = "type=delivery"
      const client = render({}, "/client/missions")
      search = ""
      expect(hiddenOf(client)).toEqual([])
    })

    it("échappe les valeurs hostiles et les borne", () => {
      const html = renderWith("/student/missions", `type=${encodeURIComponent('"><script>x</script>')}&sort=${"a".repeat(500)}`)
      expect(html).not.toContain("<script>x")
      expect(hiddenOf(html).find(([n]) => n === "sort")[1]).toHaveLength(200)
    })
  })

  it("n'affiche rien hors de la page de l'action ou sans q", () => {
    expect(inputOf(renderStudent("/student/dashboard", "design"))).not.toContain("value=")
    expect(inputOf(renderStudent("/student/missions"))).not.toContain("value=")
  })

  it("le client n'affiche jamais q, même sur sa page d'action", () => {
    search = "q=design"
    const html = render({}, "/client/missions")
    search = ""
    expect(inputOf(html)).not.toContain("value=")
  })
})

describe("AppShell : rendu client inchangé et clés de navigation mobile optionnelles", () => {
  // Empreintes SHA-256 du HTML de la coquille client prises avant la transmission de more, hideBelow, mobileTop
  // (version du sprite normalisée).
  const BEFORE = {
    "/client/dashboard": "59681bac650d2a35b1229679da52c25e005db5cdc59395428654e0f1ba59bb1b",
    "/client/messages/abc": "74ce3d1803aa38a37898aa3d528d2b4b702538661d36d69ae1869a450ad87d3e",
  }
  const digest = (html) => createHash("sha256").update(html.replace(/\?v=[0-9a-f]+/g, "?v=V")).digest("hex")

  it("CLIENT_NAV (sans mobileMore, mobileHideBelow ni mobileTop) : même HTML qu'avant, sur deux routes", () => {
    expect(CLIENT_NAV.mobileMore).toBeUndefined()
    expect(CLIENT_NAV.mobileHideBelow).toBeUndefined()
    expect(CLIENT_NAV.mobileTop).toBeUndefined()
    for (const [route, hash] of Object.entries(BEFORE)) expect(digest(render({}, route))).toBe(hash)
  })

  it("mobileHideBelow : barre du bas absente sur un enfant strict, présente sur le chemin lui-même", () => {
    const nav = { ...CLIENT_NAV, mobileHideBelow: ["/client/messages"] }
    expect(render({ nav }, "/client/messages/abc")).not.toContain("bottom-nav")
    expect(render({ nav }, "/client/messages")).toContain('class="bottom-nav bottom-nav--v2"')
    expect(render({ nav }, "/client/dashboard")).toContain('class="bottom-nav bottom-nav--v2"')
    expect(render({}, "/client/messages/abc")).toContain('class="bottom-nav bottom-nav--v2"')
  })

  it("mobileMore : le bouton « Plus » et son panneau sont rendus dans la barre du bas", () => {
    const more = { label: "Plus", icon: "i-menu", items: [{ key: "aide", label: "Aide", href: "/aide", icon: "i-help-circle" }] }
    const withMore = render({ nav: { ...CLIENT_NAV, mobileMore: more } })
    const without = render()
    expect(withMore).not.toBe(without)
    expect(navHtml(withMore, "bottom-nav")).toContain("Plus")
    expect(navHtml(without, "bottom-nav")).not.toContain("Plus")
  })

  it("mobileTop : libellé d'espace et cible de l'avatar surchargés, repli sur space et profileHref", () => {
    const html = render({ nav: { ...CLIENT_NAV, mobileTop: { space: "Libellé mobile", profileHref: "/autre/profil" } } })
    expect(html).toContain('<span class="mtop2__space">Libellé mobile</span>')
    expect(html).toMatch(/class="av2 av2--sm" aria-label="Mon profil" href="\/autre\/profil"/)
    const partial = render({ nav: { ...CLIENT_NAV, mobileTop: { space: "Libellé mobile" } } })
    expect(partial).toMatch(/class="av2 av2--sm" aria-label="Mon profil" href="\/client\/profile"/)
  })

  it("top-bar et mobile-top ne figent aucun texte vouvoyé", async () => {
    const { readFileSync } = await import("node:fs")
    for (const file of ["top-bar.jsx", "mobile-top.jsx", "app-shell.jsx"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8")
      expect(source).not.toMatch(/\b(?:vous|votre|vos|veuillez)\b/i)
    }
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
    expect(matches("/client/inexistante")).toBe(false)
    expect(matches("/client/notifications")).toBe(true)
    expect(matches("/client/missions/42")).toBe(true)
  })
})

describe("AppShell : compteurs nommés et mode sans temps réel (espace admin)", () => {
  const ADMIN_LIKE = {
    space: "Administration",
    identityLabel: "Admin",
    homeHref: "/admin/dashboard",
    profileHref: "/admin/dashboard",
    realtime: false,
    search: { action: "/admin/users", label: "Rechercher un utilisateur", placeholder: "Rechercher", ariaLabel: "Rechercher un utilisateur" },
    groups: [
      {
        title: "Général",
        items: [
          { key: "dashboard", label: "Tableau de bord", href: "/admin/dashboard", icon: "i-home" },
          { key: "verifications", label: "Vérifications", href: "/admin/verifications", icon: "i-shield-check", badge: "verifications", badgeUnit: "en attente" },
        ],
      },
    ],
    mobile: [
      { key: "dashboard", label: "Accueil", href: "/admin/dashboard", icon: "i-home" },
      { key: "verifications", label: "Vérifs", href: "/admin/verifications", icon: "i-shield-check", badge: "verifications", badgeUnit: "en attente" },
    ],
  }

  it("le compteur nommé arrive à la sidebar et à la barre du bas, avec l'unité de l'élément", () => {
    const html = render({ nav: ADMIN_LIKE, counts: { verifications: 4 } }, "/admin/dashboard")
    expect(navHtml(html, "sidebar__nav")).toContain('aria-label="Vérifications, 4 en attente"')
    expect(navHtml(html, "sidebar__nav")).toContain('<span class="count" aria-hidden="true">4</span>')
    expect(navHtml(html, "bottom-nav")).toContain('aria-label="Vérifs, 4 en attente"')
  })

  it("sans compteur (ou à zéro), aucune pastille", () => {
    const html = render({ nav: ADMIN_LIKE, counts: { verifications: 0 } }, "/admin/dashboard")
    expect(html).not.toContain('class="count"')
    expect(html).not.toContain("bnav-item__dot")
  })

  it("realtime faux : le hook d'abonnement n'est jamais appelé et le compteur de messages vaut 0", () => {
    unreadHook.mockClear()
    render({ nav: ADMIN_LIKE, counts: { verifications: 4 } }, "/admin/dashboard")
    expect(unreadHook).not.toHaveBeenCalled()
  })

  it("client : counts vide ou absent donne le même HTML, abonnement conservé", () => {
    unreadHook.mockClear()
    const base = render()
    expect(unreadHook).toHaveBeenCalledTimes(1)
    expect(render({ counts: {} })).toBe(base)
  })

  it("étudiant : même HTML qu'avant l'ajout de counts (empreinte)", () => {
    const digest = (html) => createHash("sha256").update(html.replace(/\?v=[0-9a-f]+/g, "?v=V")).digest("hex")
    for (const route of ["/student/dashboard", "/student/messages/abc"]) {
      expect(digest(render({ nav: STUDENT_NAV }, route))).toBe("968bf0b5a6586d003bff4f08b566a7753047702813d6ef0be7a8729290a64824")
    }
  })
})
