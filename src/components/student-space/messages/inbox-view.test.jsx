import { afterEach, describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { declarationsOf } from "@/qa/fidelity/css-rules"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
// Chemin et paramètres d'adresse de la page rendue (la liste les lit par usePathname et useSearchParams).
const nav = { pathname: "/messages", search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const { StudentInboxView, createDebouncedRefresh, REFRESH_DELAY_MS, nextOpened } = await import("./inbox-view")
const { inboxHref, subtitleOf } = await import("./inbox-list")

const NOW = "2026-10-13T12:00:00Z"
const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const M3 = "11111111-1111-4111-8111-111111111113"

const conv = (over) => ({
  key: `${M1}:c1`,
  missionId: M1,
  name: "Marc D.",
  avatarUrl: null,
  missionTitle: "Cours de maths niveau 3e",
  state: "candidate",
  preview: "C'est bien rue 6.112 ce soir ?",
  lastAt: "2026-10-13T09:48:00Z",
  unreadCount: 0,
  ...over,
})

const LIST = [
  conv({ unreadCount: 2 }),
  conv({ key: `${M2}:c1`, missionId: M2, missionTitle: "Traduction d'un flyer", state: "in_progress", preview: "Vous : Fichier envoyé.", lastAt: "2026-10-12T09:00:00Z" }),
  conv({ key: `${M3}:c2`, missionId: M3, name: "Rosine H.", missionTitle: "Saisie de fiches", state: "done", preview: "Merci !", lastAt: "2026-10-06T09:00:00Z" }),
]

function render(props, { pathname = "/messages", search = "" } = {}) {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(<StudentInboxView now={NOW} {...props} />)
}
const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const TUTOIEMENT = /\b(tu|toi|ton|ta|tes)\b|Réessaie|Essaie\b|Choisis\b|Vérifie\b|Patiente\b/i

describe("StudentInboxView : boîte vide", () => {
  const html = render({ result: { conversations: [] } })

  it("invite avec un texte vouvoyé et un seul bouton encre vers les missions", () => {
    expect(html).toContain("Pas encore de message")
    expect(html).toContain("Vos échanges apparaîtront ici dès qu&#x27;un client vous écrit ou vous retient.")
    expect(html).toContain('<a href="/student/missions" class="btn btn--dark">Explorer les missions</a>')
    expect(html.match(/btn btn--dark/g)).toHaveLength(1)
  })

  it("n'affiche ni recherche ni filtre et garde un seul h1", () => {
    expect(html).not.toContain('role="search"')
    expect(html).not.toContain("e2-pill")
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("Aucun message")
  })
})

describe("StudentInboxView : erreur", () => {
  it("affiche une erreur annoncée et vouvoyée, distincte du vide", () => {
    const html = render({ result: { error: "Impossible de charger vos messages. Veuillez réessayer." } })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible d&#x27;afficher vos messages")
    expect(html).toContain("Impossible de charger vos messages. Veuillez réessayer.")
    expect(html).not.toContain("Pas encore de message")
    expect(h1Count(html)).toBe(1)
    expect(html).not.toMatch(TUTOIEMENT)
  })

  it("traite un résultat sans liste comme une erreur", () => {
    const html = render({ result: {} })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Vos messages ne sont pas touchés.")
  })
})

describe("StudentInboxView : liste", () => {
  const html = render({ result: { conversations: LIST } })

  it("affiche une ligne par conversation, vers /messages/<mission>", () => {
    expect(html.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(3)
    expect(html).toContain(`href="/messages/${M1}"`)
    expect(html).toContain(`href="/messages/${M2}"`)
    expect(html).toContain(`href="/messages/${M3}"`)
    expect(html).toContain("Marc D.")
    expect(html).toContain("Rosine H.")
  })

  it("montre le nom, l'aperçu, la mission en petit et l'heure du Bénin", () => {
    expect(html).toContain('<div class="e2-06-convo__name">Marc D.</div>')
    expect(html).toContain('<div class="e2-06-convo__preview">Vous : Fichier envoyé.</div>')
    expect(html).toContain('<div class="e2-06-convo__mission">Cours de maths niveau 3e · candidature</div>')
    expect(html).toContain("10:48")
    expect(html).toContain("Hier")
    expect(html).toContain("6 oct.")
  })

  it("repère les non lus en encre : ligne marquée, compteur lisible par les lecteurs d'écran", () => {
    expect(html.match(/e2-06-convo is-unread/g)).toHaveLength(1)
    expect(html).toContain('<span class="e2-06-count">2<span class="sr-only"> messages non lus</span></span>')
    expect(html).toContain("2 non lus")
  })

  it("garde un seul h1 et des pastilles reliées à l'adresse, la courante marquée", () => {
    expect(h1Count(html)).toBe(1)
    expect(html).toContain('href="/messages" class="e2-pill is-active" aria-current="page"')
    expect(html).toContain('href="/messages?filtre=non-lues" class="e2-pill"')
    expect(html).toContain("<b>2</b>")
  })

  it("propose la recherche en GET, bornée, avec un libellé", () => {
    expect(html).toContain('role="search" action="/messages" method="get"')
    expect(html).toContain('name="q"')
    expect(html).toContain('maxLength="100"')
    expect(html).toContain('aria-label="Rechercher dans les messages"')
  })

  it("est vouvoyée (aucun marqueur de tutoiement)", () => {
    expect(html).not.toMatch(TUTOIEMENT)
    expect(html).toContain("Choisissez une conversation")
  })

  it("distingue deux missions du même client en deux lignes", () => {
    expect(html.match(/<div class="e2-06-convo__name">Marc D\.<\/div>/g)).toHaveLength(2)
  })

  it("annonce un message non lu au singulier", () => {
    const one = render({ result: { conversations: [conv({ unreadCount: 1 })] } })
    expect(one).toContain('<span class="sr-only"> message non lu</span>')
    expect(one).toContain("1 non lu")
  })
})

describe("StudentInboxView : filtre Non lues", () => {
  it("ne garde que les conversations non lues et marque la pastille", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=non-lues" })
    expect(html.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    expect(html).toContain('href="/messages?filtre=non-lues" class="e2-pill is-active" aria-current="page"')
    expect(html).toContain('<input type="hidden" name="filtre" value="non-lues"/>')
  })

  it("dit que tout est lu quand rien n'est non lu, avec un lien de retour", () => {
    const html = render({ result: { conversations: [conv()] } }, { search: "filtre=non-lues" })
    expect(html).toContain("Aucun message non lu")
    expect(html).toContain("Vous avez lu tous vos messages.")
    expect(html).toContain('href="/messages" class="hero2__link">Voir toutes les conversations')
    expect(html).toContain("Tout est lu")
  })
})

describe("StudentInboxView : recherche", () => {
  it("filtre par nom, mission ou aperçu, sans tenir compte des accents ni de la casse", () => {
    const byName = render({ result: { conversations: LIST } }, { search: "q=rosine" })
    expect(byName.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    const byMission = render({ result: { conversations: LIST } }, { search: "q=TRADUCTION" })
    expect(byMission).toContain(`href="/messages/${M2}?q=TRADUCTION"`)
    expect(byMission.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
  })

  it("conserve la recherche dans le champ et dans les liens de filtre", () => {
    const html = render({ result: { conversations: LIST } }, { search: "q=marc" })
    expect(html).toContain('value="marc"')
    expect(html).toContain('href="/messages?q=marc&amp;filtre=non-lues"')
  })

  it("affiche un vide dédié, avec la recherche échappée et un lien pour l'effacer", () => {
    const html = render({ result: { conversations: LIST } }, { search: `q=${encodeURIComponent('<img src=x onerror="alert(1)">')}` })
    expect(html).not.toContain("<img")
    expect(html).toContain("Aucune conversation pour")
    expect(html).toContain("Essayez un autre mot.")
    expect(html).toContain('href="/messages" class="hero2__link">Effacer la recherche')
    expect(html).toContain("e2-06-pane")
  })
})

describe("StudentInboxView : sécurité d'affichage", () => {
  it("échappe un nom ou un aperçu contenant du HTML", () => {
    const html = render({
      result: { conversations: [conv({ name: "<script>alert(1)</script>", preview: '<b onclick="x()">gras</b>' })] },
    })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<b onclick")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("aides de la boîte de réception", () => {
  it("inboxHref omet les paramètres vides", () => {
    expect(inboxHref()).toBe("/messages")
    expect(inboxHref({ q: "" })).toBe("/messages")
    expect(inboxHref({ q: "a b" })).toBe("/messages?q=a+b")
    expect(inboxHref({ unreadOnly: true })).toBe("/messages?filtre=non-lues")
    expect(inboxHref({ q: "x", unreadOnly: true })).toBe("/messages?q=x&filtre=non-lues")
  })

  it("subtitleOf décrit la relation avec la mission", () => {
    const states = ["candidate", "in_progress", "done", "cancelled", "rejected", "closed"]
    const texts = states.map((state) => subtitleOf(conv({ state })))
    expect(texts[0]).toBe("Cours de maths niveau 3e · candidature")
    expect(texts[1]).toBe("Cours de maths niveau 3e · en cours")
    expect(new Set(texts).size).toBe(states.length)
    expect(subtitleOf(conv({ missionTitle: "" }))).toContain("Mission")
  })
})

describe("StudentInboxView : filtre En cours", () => {
  const html = render({ result: { conversations: LIST } }, { search: "filtre=en-cours" })

  it("ne garde que les missions en cours et marque la pastille", () => {
    expect(html.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    expect(html).toContain(`href="/messages/${M2}?filtre=en-cours"`)
    expect(html).toContain('href="/messages?filtre=en-cours" class="e2-pill is-active" aria-current="page"')
    expect(html).toContain('<input type="hidden" name="filtre" value="en-cours"/>')
  })

  it("propose trois pastilles : Toutes, Non lues avec compteur, En cours", () => {
    expect(html.match(/class="e2-pill( is-active)?"/g)).toHaveLength(3)
    expect(html).toMatch(/>Toutes<\/a>.*Non lues<b>2<\/b>.*En cours<\/a>/s)
  })

  it("combine la recherche et le filtre", () => {
    const both = render({ result: { conversations: LIST } }, { search: "q=traduction&filtre=en-cours" })
    expect(both.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    const none = render({ result: { conversations: LIST } }, { search: "q=rosine&filtre=en-cours" })
    expect(none).toContain("Aucune conversation pour")
  })

  it("dit qu'aucune conversation n'est en cours, avec un lien de retour", () => {
    const empty = render({ result: { conversations: [conv({ state: "done" })] } }, { search: "filtre=en-cours" })
    expect(empty).toContain("Aucune conversation en cours")
    expect(empty).toContain('href="/messages" class="hero2__link">Voir toutes les conversations')
  })

  it("ignore une valeur de filtre inconnue", () => {
    const other = render({ result: { conversations: LIST } }, { search: "filtre=autre" })
    expect(other.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(3)
  })
})

describe("StudentInboxView : deux volets", () => {
  const open = (extra) =>
    render({ result: { conversations: LIST }, ...extra }, { pathname: `/messages/${M1}` })

  it("garde la liste visible à côté de la conversation ouverte", () => {
    const html = open({ children: <section className="e2-07-pane">Fil de test</section> })
    expect(html).toContain('data-view="conversation"')
    expect(html).toContain('<section class="e2-07-pane">Fil de test</section>')
    expect(html.match(/class="e2-06-convo( is-unread)?( is-active)?"/g)).toHaveLength(3)
    expect(html).not.toContain("e2-06-pane")
  })

  it("repère la ligne de la conversation ouverte et seulement elle", () => {
    const html = open({ children: <section /> })
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toContain(`href="/messages/${M1}" class="e2-06-convo is-active" aria-current="true"`)
  })

  it("compte la conversation ouverte comme lue (compteur et pastille retirés)", () => {
    const html = open({ children: <section /> })
    expect(html).not.toContain("e2-06-count")
    expect(html).toContain("Tout est lu")
  })

  it("garde la recherche et le filtre dans les liens des conversations et reste sur la conversation", () => {
    const html = render(
      { result: { conversations: LIST }, children: <section /> },
      { pathname: `/messages/${M2}`, search: "filtre=en-cours" },
    )
    expect(html).toContain(`href="/messages/${M2}?filtre=en-cours"`)
    expect(html).toContain(`action="/messages/${M2}"`)
    expect(html).toContain(`href="/messages/${M2}" class="e2-pill"`)
  })

  it("sans conversation ouverte : liste seule en petit écran, volet vide et aucune ligne active", () => {
    const html = render({ result: { conversations: LIST }, children: <section>Fil de test</section> })
    expect(html).toContain('data-view="list"')
    expect(html).toContain("e2-06-pane")
    expect(html).not.toContain("Fil de test")
    expect(html).not.toContain("aria-current=\"true\"")
  })

  it("trie dans l'ordre reçu du plus récent au plus ancien (aucun retri dans la vue)", () => {
    const html = render({ result: { conversations: LIST } })
    expect(html.indexOf(M1)).toBeLessThan(html.indexOf(M2))
    expect(html.indexOf(M2)).toBeLessThan(html.indexOf(M3))
  })

  it("affiche le jour et le compteur dans la ligne de date, un seul h1 « Messages »", () => {
    const html = render({ result: { conversations: LIST } })
    expect(html).toContain('<span class="e2-06-day">Mardi 13 octobre · </span>2 non lus')
    expect(html).toContain("Messages</h1>")
    expect(h1Count(html)).toBe(1)
  })
})

describe("StudentInboxView : conversation sans liste exploitable", () => {
  const PANE = <section className="e2-07-pane">Fil de test</section>
  const open = { pathname: `/messages/${M1}` }

  it("liste vide : garde la conversation et un vide compact à gauche, sans la page vide", () => {
    const html = render({ result: { conversations: [] }, children: PANE }, open)
    expect(html).toContain('data-view="conversation"')
    expect(html).toContain("Fil de test")
    expect(html).toMatch(/<section class="e2-06-list" aria-label="Conversations"><div class="e2-06-list__items">.*Pas encore de message.*<\/section>/s)
    expect(html).not.toContain('aria-label="Aucune conversation"')
    expect(html).toContain("Pas encore de message")
  })

  it("liste en erreur : l'erreur reste dans le volet gauche et la conversation s'affiche", () => {
    const html = render({ result: { error: "Impossible de charger vos messages." }, children: PANE }, open)
    expect(html).toContain('data-view="conversation"')
    expect(html).toContain("Fil de test")
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('aria-label="Erreur de chargement"')
  })

  it("sur /messages, la liste vide ou en erreur garde la page pleine", () => {
    expect(render({ result: { conversations: [] } })).toContain('aria-label="Aucune conversation"')
    expect(render({ result: { error: "x" } })).toContain('aria-label="Erreur de chargement"')
  })

  it("garde un seul h1 dans ces états", () => {
    expect(h1Count(render({ result: { conversations: [] }, children: PANE }, open))).toBe(1)
    expect(h1Count(render({ result: { error: "x" }, children: PANE }, open))).toBe(1)
  })
})

describe("StudentInboxView : remise à zéro locale des non lus", () => {
  it("la conversation ouverte est comptée lue, le reste garde son compteur", () => {
    const list = [conv({ unreadCount: 2 }), conv({ key: `${M2}:c1`, missionId: M2, unreadCount: 3 })]
    const html = render({ result: { conversations: list }, children: <section /> }, { pathname: `/messages/${M2}` })
    expect(html).toContain("2 non lus")
    expect(html).not.toContain("5 non lus")
  })
})

describe("nextOpened : mémoire des conversations ouvertes", () => {
  it("garde M1 quand M2 est ouverte avec le même résultat, et se vide quand le résultat change", () => {
    const result = { conversations: [] }
    const s1 = nextOpened({ result, ids: [] }, result, M1)
    expect(s1.ids).toEqual([M1])
    const s2 = nextOpened(s1, result, M2)
    expect(s2.ids).toEqual([M1, M2])
    expect(nextOpened(s2, result, M1)).toBe(s2)
    expect(nextOpened(s2, result, null)).toBe(s2)
    const s3 = nextOpened(s2, { conversations: [] }, M2)
    expect(s3.ids).toEqual([M2])
  })
})

describe("rafraîchissement regroupé", () => {
  afterEach(() => vi.useRealTimers())

  it("un INSERT et un UPDATE rapprochés ne déclenchent qu'un refresh", () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const scheduler = createDebouncedRefresh(refresh)
    scheduler.trigger()
    vi.advanceTimersByTime(REFRESH_DELAY_MS - 50)
    scheduler.trigger()
    vi.advanceTimersByTime(REFRESH_DELAY_MS - 1)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    scheduler.trigger()
    scheduler.cancel()
    vi.advanceTimersByTime(REFRESH_DELAY_MS * 2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe("pages d'erreur du segment [missionId]", () => {
  it("la conversation introuvable porte un h2 et aucun h1 (le layout porte le h1)", async () => {
    const { default: NotFound } = await import("@/app/(student)/messages/[missionId]/not-found")
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain("<h2")
    expect(html).not.toContain("<h1")
    expect(html).toContain('href="/messages"')
  })

  it("la page de conversation rend son erreur en h2 avec un lien de retour", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(student)/messages/[missionId]/page.js"), "utf8")
    expect(page).toContain('titleAs="h2"')
    expect(page).not.toContain('titleAs="h1"')
    expect(page).toContain('action={{ href: "/messages", label: "Retour aux messages" }}')
  })
})

describe("structure du segment messages", () => {
  const root = join(process.cwd(), "src/app/(student)/messages")

  it("n'a aucun loading.js sous messages/ (le 404 de [missionId] resterait un 200)", () => {
    expect(existsSync(join(root, "loading.js"))).toBe(false)
    expect(existsSync(join(root, "[missionId]", "loading.js"))).toBe(false)
  })

  it("le layout porte le marqueur, lit les conversations hors Suspense et ne touche pas aux données", () => {
    const layout = readFileSync(join(root, "layout.js"), "utf8")
    expect(layout.startsWith("// @ds-screen RD-STUDENT-01")).toBe(true)
    expect(layout).toContain("getStudentConversations")
    expect(layout).not.toContain("<Suspense")
    expect(layout).not.toMatch(/supabase|\.from\("/)
  })

  it("la page ne rend que le volet vide porté par la vue", () => {
    const page = readFileSync(join(root, "page.js"), "utf8")
    expect(page.startsWith("// @ds-screen RD-STUDENT-01")).toBe(true)
    expect(page).toContain("return null")
    expect(page).not.toMatch(/supabase|\.from\("/)
  })
})

describe("styles des deux volets", () => {
  const css = readFileSync(join(process.cwd(), "src/app/design/student/e06.css"), "utf8")
  const MOBILE = { media: "max-width: 1023.98px" }

  it("grille liste + volet de 360 px à 1440, gouttière de 20 px", () => {
    const grid = declarationsOf(css, ".e2-06-inbox")
    expect(grid["grid-template-columns"]).toBe("clamp(280px, 26vw, 360px) minmax(0, 1fr)")
    expect(grid.gap).toBe("var(--s-5)")
  })

  it("sous 1024 px : une colonne, liste seule ou volet seul selon l'attribut", () => {
    expect(declarationsOf(css, ".e2-06-inbox", MOBILE)["grid-template-columns"]).toBe("minmax(0, 1fr)")
    expect(declarationsOf(css, '.e2-06-inbox[data-view="list"] > :not(.e2-06-list)', MOBILE).display).toBe("none")
    expect(declarationsOf(css, '.e2-06-inbox[data-view="conversation"] > .e2-06-list', MOBILE).display).toBe("none")
  })

  it("sous 1024 px : titre de page masqué en conversation, jour réservé au bureau", () => {
    const head = declarationsOf(css, '.head2:has(+ .e2-06-inbox[data-view="conversation"])', MOBILE)
    expect(head.display).toBeUndefined()
    expect(head.position).toBe("absolute")
    expect(head["clip-path"]).toBe("inset(50%)")
    expect(declarationsOf(css, ".e2-06-day", MOBILE).display).toBe("none")
  })
})
