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
const nav = { pathname: "/client/messages", search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const { ClientInboxView, createDebouncedRefresh, REFRESH_DELAY_MS, nextOpened } = await import("./inbox-view")
const { inboxHref, subtitleOf, activeKeyOf } = await import("./inbox-list")

const NOW = "2026-10-13T12:00:00Z"
const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const S3 = "22222222-2222-4222-8222-222222222223"

const conv = (over) => ({
  key: `${M1}:${S1}`,
  missionId: M1,
  studentId: S1,
  name: "Awa K.",
  avatarUrl: null,
  missionTitle: "Traduire un flyer en anglais",
  state: "candidate",
  preview: "Oui, je peux vous envoyer un essai.",
  lastAt: "2026-10-13T09:48:00Z",
  unreadCount: 0,
  ...over,
})

// Deux candidats sur la même mission (M1), une mission en cours (M2).
const LIST = [
  conv({ unreadCount: 2 }),
  conv({ key: `${M1}:${S2}`, studentId: S2, name: "Sèna A.", preview: "Vous : À ce soir", lastAt: "2026-10-12T15:00:00Z" }),
  conv({ key: `${M2}:${S3}`, missionId: M2, studentId: S3, name: "Rosine H.", missionTitle: "Saisie de fiches", state: "in_progress", preview: "Merci !", lastAt: "2026-10-06T09:00:00Z" }),
]

function render(props, { pathname = "/client/messages", search = "" } = {}) {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(<ClientInboxView now={NOW} {...props} />)
}
const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const rows = (html) => (html.match(/class="convo( is-unread)?( is-active)?"/g) ?? []).length
const TUTOIEMENT = /\b(tu|toi|ton|ta|tes)\b|Réessaie|Essaie\b|Choisis\b|Vérifie\b|Patiente\b/i

describe("ClientInboxView : boîte vide", () => {
  const html = render({ result: { conversations: [] } })

  it("invite à lancer une discussion depuis une candidature, avec un bouton et un lien", () => {
    expect(html).toContain("Aucune conversation")
    expect(html).toContain("Lancez une discussion depuis une candidature")
    expect(html).toContain('<a href="/client/missions" class="btn btn--primary">Voir mes missions</a>')
    expect(html).toContain('<a href="/client/missions/new" class="link2">Publier une mission</a>')
  })

  it("n'affiche ni recherche ni filtre et garde un seul h1", () => {
    expect(html).not.toContain('role="search"')
    expect(html).not.toContain("segmented")
    expect(html).not.toContain("c-inbox ")
    expect(h1Count(html)).toBe(1)
  })
})

describe("ClientInboxView : erreur", () => {
  it("affiche une erreur annoncée, distincte du vide, avec un seul h1", () => {
    const html = render({ result: { error: "Impossible de charger vos messages. Veuillez réessayer." } })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible d&#x27;afficher vos messages")
    expect(html).toContain("Impossible de charger vos messages. Veuillez réessayer.")
    expect(html).not.toContain("Aucune conversation")
    expect(h1Count(html)).toBe(1)
    expect(html).not.toMatch(TUTOIEMENT)
  })

  it("traite une réponse sans liste comme une erreur", () => {
    expect(render({ result: undefined })).toContain('role="alert"')
  })
})

describe("ClientInboxView : liste", () => {
  const html = render({ result: { conversations: LIST } })

  it("rend une ligne par conversation, deux candidats d'une même mission restent distincts", () => {
    expect(rows(html)).toBe(3)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S1}"`)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}"`)
    expect(html).toContain(`href="/client/messages/${M2}?studentId=${S3}"`)
  })

  it("annonce le résumé, les non lus (compteur et texte caché), un seul h1", () => {
    expect(html).toContain("3 conversations · 2 non lues")
    expect(html).toContain('<span class="count">2<span class="sr-only"> messages non lus</span></span>')
    expect(html).toContain("Non lues (2)")
    expect(h1Count(html)).toBe(1)
  })

  it("affiche aperçu, mission avec relation et heure au fuseau du Bénin", () => {
    expect(html).toContain("Candidat · Traduire un flyer en anglais")
    expect(html).toContain("Saisie de fiches · en cours")
    expect(html).toContain("Vous : À ce soir")
    expect(html).toContain("10:48")
    expect(html).toContain("Hier")
  })

  it("range la liste, la recherche et le filtre dans la carte unique à deux volets", () => {
    expect(html).toContain('class="c-inbox inbox2" data-view="list"')
    expect(html).toContain('class="c-inbox__list"')
    expect(html).toContain('class="segmented segmented--block"')
    expect(html).toContain("c-inbox__thread inbox2__empty")
    expect(html).toContain("Choisissez une conversation")
    expect(html).not.toMatch(TUTOIEMENT)
  })

  it("garde l'ordre reçu (aucun retri dans la vue)", () => {
    expect(html.indexOf(S1)).toBeLessThan(html.indexOf(S2))
    expect(html.indexOf(S2)).toBeLessThan(html.indexOf(S3))
  })

  it("propose deux filtres : Toutes et Non lues avec compteur", () => {
    expect(html.match(/class="segmented__item/g)).toHaveLength(2)
    expect(html).toMatch(/>Toutes<\/a>.*Non lues \(2\)<\/a>/s)
    expect(html).not.toContain("En cours</a>")
    expect(html).toContain('href="/client/messages" class="segmented__item is-active" aria-current="page"')
  })
})

describe("ClientInboxView : deux volets et ligne active", () => {
  const PANE = <section className="conv2">Fil de test</section>

  it("garde la liste visible à côté de la conversation ouverte", () => {
    const html = render({ result: { conversations: LIST }, children: PANE }, { pathname: `/client/messages/${M2}`, search: `studentId=${S3}` })
    expect(html).toContain('data-view="conversation"')
    expect(html).toContain('<div class="c-inbox__thread"><section class="conv2">Fil de test</section></div>')
    expect(rows(html)).toBe(3)
    expect(html).not.toContain("inbox2__empty")
  })

  it("repère la ligne du bon étudiant quand deux étudiants écrivent sur la même mission", () => {
    const html = render({ result: { conversations: LIST }, children: PANE }, { pathname: `/client/messages/${M1}`, search: `studentId=${S2}` })
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}" class="convo is-active" aria-current="true"`)
    expect(html).not.toContain(`href="/client/messages/${M1}?studentId=${S1}" class="convo is-unread is-active"`)
  })

  it("sans studentId : seulement la ligne de l'étudiant retenu", () => {
    expect(activeKeyOf(LIST, `/client/messages/${M2}`, null)).toBe(`${M2}:${S3}`)
    // Deux candidats, aucun retenu : aucune ligne n'est devinée.
    expect(activeKeyOf(LIST, `/client/messages/${M1}`, null)).toBeNull()
    const retained = [LIST[0], { ...LIST[1], state: "in_progress" }]
    expect(activeKeyOf(retained, `/client/messages/${M1}`, null)).toBe(`${M1}:${S2}`)
    // Une seule candidature : la page n'ouvre aucun étudiant retenu, aucune ligne n'est marquée.
    expect(activeKeyOf([LIST[0]], `/client/messages/${M1}`, null)).toBeNull()
    expect(activeKeyOf(LIST, "/client/messages", null)).toBeNull()
    expect(activeKeyOf(LIST, `/client/messages/${M1}`, "autre")).toBeNull()
  })

  it("sans conversation ouverte : aucune ligne active et volet vide", () => {
    const html = render({ result: { conversations: LIST }, children: <section>Fil de test</section> })
    expect(html).not.toContain('aria-current="true"')
    expect(html).not.toContain("Fil de test")
  })

  it("garde recherche, filtre et étudiant dans les liens et l'action de la conversation ouverte", () => {
    const html = render(
      { result: { conversations: LIST }, children: PANE },
      { pathname: `/client/messages/${M1}`, search: `studentId=${S2}&filtre=non-lues&q=Sena` },
    )
    expect(html).toContain(`action="/client/messages/${M1}"`)
    expect(html).toContain(`<input type="hidden" name="studentId" value="${S2}"/>`)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}&amp;q=Sena&amp;filtre=non-lues"`)
  })

  it("compte la conversation ouverte comme lue (pastille retirée, total mis à jour)", () => {
    const html = render({ result: { conversations: LIST }, children: PANE }, { pathname: `/client/messages/${M1}`, search: `studentId=${S1}` })
    expect(html).not.toContain('class="count"')
    expect(html).toContain("Awa K. · Traduire un flyer en anglais")
  })

  it("garde les non lus des autres conversations", () => {
    const list = [conv({ unreadCount: 2 }), conv({ key: `${M2}:${S3}`, missionId: M2, studentId: S3, unreadCount: 3 })]
    const html = render({ result: { conversations: list }, children: PANE }, { pathname: `/client/messages/${M2}`, search: `studentId=${S3}` })
    expect(html).toMatch(/class="count">2</)
    expect(html).not.toMatch(/class="count">[35]</)
  })
})

describe("ClientInboxView : filtres et recherche", () => {
  it("ignore un filtre inconnu", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=zzz" })
    expect(rows(html)).toBe(3)
    expect(html).not.toContain('name="filtre"')
    expect(html).not.toContain("filtre=zzz")
  })

  it("filtre les non lues et marque le filtre", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=non-lues" })
    expect(rows(html)).toBe(1)
    expect(html).toContain('class="segmented__item is-active" aria-current="page">Non lues (2)')
    expect(html).toContain('<input type="hidden" name="filtre" value="non-lues"/>')
  })

  it("traite filtre=en-cours (réservé à l'étudiant) comme un filtre inconnu", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=en-cours" })
    expect(rows(html)).toBe(3)
    expect(html).not.toContain('name="filtre"')
    expect(html).not.toContain("filtre=en-cours")
    expect(html).toMatch(/segmented__item is-active"[^>]*aria-current="page">Toutes/)
  })

  it("dit que tout est lu quand rien n'est non lu", () => {
    const html = render({ result: { conversations: [conv()] } }, { search: "filtre=non-lues" })
    expect(html).toContain("Aucun message non lu")
    expect(html).toContain("Vous avez lu tous vos messages.")
  })

  it("filtre par nom, mission ou aperçu sans tenir compte des accents ni de la casse", () => {
    const byName = render({ result: { conversations: LIST } }, { search: "q=SENA" })
    expect(rows(byName)).toBe(1)
    expect(byName).toContain('value="SENA"')
    expect(rows(render({ result: { conversations: LIST } }, { search: "q=FICHES" }))).toBe(1)
  })

  it("explique l'absence de résultat avec la recherche échappée et un lien pour l'effacer", () => {
    const q = '<img src=x onerror="alert(1)">'
    const html = render({ result: { conversations: LIST } }, { search: `q=${encodeURIComponent(q)}` })
    expect(html).not.toContain("<img")
    expect(html).toContain("Aucune conversation pour")
    expect(html).toContain("Effacer la recherche")
  })

  it("échappe les caractères spéciaux de q dans les adresses", () => {
    const html = render({ result: { conversations: LIST } }, { search: "q=" + encodeURIComponent(`%<"&x`) })
    expect(html).not.toMatch(/<[^>]*[^&]<"/)
    expect(html).toContain("q=%25%3C%22%26x")
    expect(html).toContain("&lt;")
  })

  it("échappe un nom ou un aperçu contenant du HTML", () => {
    const html = render({ result: { conversations: [conv({ name: "<script>alert(1)</script>", preview: "<b>x</b>" })] } })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<b>x</b>")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("aides de la boîte de réception", () => {
  it("inboxHref omet les paramètres vides et encode la recherche", () => {
    expect(inboxHref()).toBe("/client/messages")
    expect(inboxHref({ q: "" })).toBe("/client/messages")
    expect(inboxHref({ q: "a b&c", unreadOnly: true })).toBe("/client/messages?q=a+b%26c&filtre=non-lues")
    expect(inboxHref({ base: `/client/messages/${M1}`, studentId: S1, q: "x" })).toBe(`/client/messages/${M1}?studentId=${S1}&q=x`)
  })

  it("subtitleOf nomme la relation de chaque état", () => {
    expect(subtitleOf({ state: "candidate", missionTitle: "T" })).toBe("Candidat · T")
    expect(subtitleOf({ state: "rejected", missionTitle: "T" })).toBe("Candidature refusée · T")
    expect(subtitleOf({ state: "done", missionTitle: "T" })).toBe("T · terminée")
    expect(subtitleOf({ state: "cancelled", missionTitle: "T" })).toBe("T · annulée")
    expect(subtitleOf({ state: "closed", missionTitle: "" })).toBe("Mission")
  })
})

describe("ClientInboxView : conversation sans liste exploitable", () => {
  const PANE = <section className="conv2">Fil de test</section>
  const open = { pathname: `/client/messages/${M1}` }

  it("liste vide : garde la conversation et un vide compact à gauche, sans la page vide", () => {
    const html = render({ result: { conversations: [] }, children: PANE }, open)
    expect(html).toContain('data-view="conversation"')
    expect(html).toContain("Fil de test")
    expect(html).toMatch(/<section class="c-inbox__list" aria-label="Conversations"><div class="inbox-rows2 convos2">.*Aucune conversation.*<\/section>/s)
    expect(html).not.toContain('aria-label="Aucune conversation"')
    expect(h1Count(html)).toBe(1)
  })

  it("liste en erreur : l'erreur reste à gauche et la conversation s'affiche", () => {
    const html = render({ result: { error: "Impossible de charger vos messages." }, children: PANE }, open)
    expect(html).toContain("Fil de test")
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('aria-label="Erreur de chargement"')
    expect(h1Count(html)).toBe(1)
  })

  it("sur /client/messages, la liste vide ou en erreur garde la page pleine", () => {
    expect(render({ result: { conversations: [] } })).toContain('aria-label="Aucune conversation"')
    expect(render({ result: { error: "x" } })).toContain('aria-label="Erreur de chargement"')
  })
})

describe("nextOpened : mémoire des conversations ouvertes", () => {
  it("garde la première quand la seconde est ouverte avec le même résultat, et se vide quand le résultat change", () => {
    const result = { conversations: [] }
    const s1 = nextOpened({ result, ids: [] }, result, "a")
    expect(s1.ids).toEqual(["a"])
    const s2 = nextOpened(s1, result, "b")
    expect(s2.ids).toEqual(["a", "b"])
    expect(nextOpened(s2, result, "a")).toBe(s2)
    expect(nextOpened(s2, result, null)).toBe(s2)
    expect(nextOpened(s2, { conversations: [] }, "b").ids).toEqual(["b"])
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

describe("segment client/messages", () => {
  const root = join(process.cwd(), "src/app/(client)/client/messages")

  it("n'a aucun loading.js (le 404 de [missionId] resterait un 200)", () => {
    expect(existsSync(join(root, "loading.js"))).toBe(false)
    expect(existsSync(join(root, "[missionId]", "loading.js"))).toBe(false)
  })

  it("le layout porte le marqueur, lit les conversations hors Suspense et ne touche pas aux données", () => {
    const layout = readFileSync(join(root, "layout.js"), "utf8")
    expect(layout.startsWith("// @ds-screen RD-CLIENT-01")).toBe(true)
    expect(layout).toContain("getClientConversations")
    expect(layout).not.toMatch(/<Suspense|from "react"/)
    expect(layout).not.toMatch(/supabase|\.from\("/)
  })

  it("la page ne rend que le volet vide porté par la vue", () => {
    const page = readFileSync(join(root, "page.js"), "utf8")
    expect(page).toContain("return null")
    expect(page).not.toMatch(/<Suspense|searchParams/)
  })

  it("la page de conversation rend son erreur en h2 avec le lien de retour (le layout porte le seul h1)", async () => {
    const page = readFileSync(join(root, "[missionId]", "page.js"), "utf8")
    expect(page).toContain('titleAs="h2"')
    expect(page).not.toContain('titleAs="h1"')
    vi.resetModules()
    vi.doMock("@/lib/actions/message.actions", () => ({ getClientConversation: async () => ({ error: "Impossible de charger." }) }))
    vi.doMock("@/lib/actions/message-report.actions", () => ({ reportClientMessage: vi.fn() }))
    vi.doMock("@/lib/actions/purchase-request.actions", () => ({
      markPurchasePaid: vi.fn(),
      reportPurchaseRequestAsClient: vi.fn(),
      getClientPurchaseRequests: vi.fn(),
    }))
    const { default: Page } = await import("@/app/(client)/client/messages/[missionId]/page")
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ missionId: M1 }), searchParams: Promise.resolve({}) }))
    vi.doUnmock("@/lib/actions/message.actions")
    vi.doUnmock("@/lib/actions/message-report.actions")
    vi.doUnmock("@/lib/actions/purchase-request.actions")
    expect(html).toContain("<h2")
    expect(html).not.toContain("<h1")
    expect(html).toContain('href="/client/messages"')
    expect(html).toContain("Retour aux messages")
  })

  it("la conversation introuvable porte un h2 et aucun h1 (le layout porte le h1)", async () => {
    const { default: NotFound } = await import("@/app/(client)/client/messages/[missionId]/not-found")
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain("<h2")
    expect(html).not.toContain("<h1")
  })
})

describe("styles des deux volets", () => {
  const css = readFileSync(join(process.cwd(), "src/app/design/client/c12.css"), "utf8")
  const MOBILE = { media: "max-width: 1023.98px" }

  it("grille liste 360 px + volet, sans gouttière", () => {
    const grid = declarationsOf(css, ".inbox2")
    expect(grid["grid-template-columns"]).toBe("360px minmax(0, 1fr)")
    expect(grid.gap).toBe("0")
  })

  it("le filtre segmenté de la liste est sur fond givre", () => {
    const segmented = declarationsOf(css, ".c2 .segmented")
    expect(segmented.background).toBe("var(--c-givre)")
  })

  it("sous 1024 px : une colonne, liste seule ou volet seul selon l'attribut", () => {
    expect(declarationsOf(css, ".inbox2", MOBILE)["grid-template-columns"]).toBe("minmax(0, 1fr)")
    expect(declarationsOf(css, '.c2 .inbox2[data-view="list"] > :not(.c-inbox__list)', MOBILE).display).toBe("none")
    expect(declarationsOf(css, '.c2 .inbox2[data-view="conversation"] > .c-inbox__list', MOBILE).display).toBe("none")
  })

  it("la conversation du volet remplit le bureau sans écraser la hauteur mobile de c13.css", () => {
    const desk = declarationsOf(css, ".c2 .c-inbox__thread > .conv2")
    expect(desk.flex).toBe("1")
    expect(desk.height).toBe("auto")
    const mobile = declarationsOf(css, ".c2 .c-inbox__thread > .conv2", MOBILE)
    expect(mobile.flex).toBe("none")
    expect(mobile.height).toBe("calc(100dvh - var(--s-2))")
  })

  it("sous 1024 px : titre de page masqué à l'œil seulement en conversation", () => {
    const head = declarationsOf(css, '.head2:has(+ .inbox2[data-view="conversation"])', MOBILE)
    expect(head.display).toBeUndefined()
    expect(head.position).toBe("absolute")
    expect(head["clip-path"]).toBe("inset(50%)")
  })
})

describe("ClientInboxView : ligne de date de la page (MC-05)", () => {
  const dateOf = (html) => html.match(/class="head2__date">([^<]*)</)?.[1]

  it("liste : le résumé des conversations", () => {
    expect(dateOf(render({ result: { conversations: LIST } }))).toBe("3 conversations · 2 non lues")
  })

  it("conversation ouverte : l'étudiant et la mission", () => {
    const html = render({ result: { conversations: LIST }, children: <p /> }, { pathname: `/client/messages/${M2}`, search: `studentId=${S3}` })
    expect(dateOf(html)).toBe("Rosine H. · Saisie de fiches")
  })

  it("conversation retenue ouverte sans studentId : l'étudiant retenu", () => {
    const html = render({ result: { conversations: LIST }, children: <p /> }, { pathname: `/client/messages/${M2}` })
    expect(dateOf(html)).toBe("Rosine H. · Saisie de fiches")
  })

  it("mission à deux candidats sans studentId (aucune ligne active) : retombe sur le résumé", () => {
    const html = render({ result: { conversations: LIST }, children: <p /> }, { pathname: `/client/messages/${M1}` })
    expect(dateOf(html)).toBe("3 conversations · 2 non lues")
  })

  it("conversation inconnue de la liste : retombe sur le résumé", () => {
    const html = render({ result: { conversations: LIST }, children: <p /> }, { pathname: "/client/messages/autre" })
    expect(dateOf(html)).toBe("3 conversations · 2 non lues")
  })
})
