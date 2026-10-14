import { describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const { StudentInboxView, InboxSkeleton, inboxHref, subtitleOf } = await import("./inbox-view")

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

const render = (props) => renderToStaticMarkup(<StudentInboxView now={NOW} {...props} />)
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
    const html = render({ result: { conversations: LIST }, unreadOnly: true })
    expect(html.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    expect(html).toContain('href="/messages?filtre=non-lues" class="e2-pill is-active" aria-current="page"')
    expect(html).toContain('<input type="hidden" name="filtre" value="non-lues"/>')
  })

  it("dit que tout est lu quand rien n'est non lu, avec un lien de retour", () => {
    const html = render({ result: { conversations: [conv()] }, unreadOnly: true })
    expect(html).toContain("Aucun message non lu")
    expect(html).toContain("Vous avez lu tous vos messages.")
    expect(html).toContain('href="/messages" class="hero2__link">Voir toutes les conversations')
    expect(html).toContain("Tout est lu")
  })
})

describe("StudentInboxView : recherche", () => {
  it("filtre par nom, mission ou aperçu, sans tenir compte des accents ni de la casse", () => {
    const byName = render({ result: { conversations: LIST }, q: "rosine" })
    expect(byName.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
    const byMission = render({ result: { conversations: LIST }, q: "TRADUCTION" })
    expect(byMission).toContain(`href="/messages/${M2}"`)
    expect(byMission.match(/class="e2-06-convo( is-unread)?"/g)).toHaveLength(1)
  })

  it("conserve la recherche dans le champ et dans les liens de filtre", () => {
    const html = render({ result: { conversations: LIST }, q: "marc" })
    expect(html).toContain('value="marc"')
    expect(html).toContain('href="/messages?q=marc&amp;filtre=non-lues"')
  })

  it("affiche un vide dédié, avec la recherche échappée et un lien pour l'effacer", () => {
    const html = render({ result: { conversations: LIST }, q: '<img src=x onerror="alert(1)">' })
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

describe("InboxSkeleton et page", () => {
  it("rend un squelette annoncé avec un seul h1", () => {
    const html = renderToStaticMarkup(<InboxSkeleton />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("Chargement en cours")
    expect(h1Count(html)).toBe(1)
  })

  const root = join(process.cwd(), "src/app/(student)/messages")

  it("n'a aucun loading.js sous messages/ (le 404 de [missionId] resterait un 200)", () => {
    expect(existsSync(join(root, "loading.js"))).toBe(false)
    expect(existsSync(join(root, "[missionId]", "loading.js"))).toBe(false)
  })

  it("la page est mince : marqueur, Suspense, action étudiante, aucun accès direct aux données", () => {
    const page = readFileSync(join(root, "page.js"), "utf8")
    expect(page.startsWith("// @ds-screen RD-STUDENT-01")).toBe(true)
    expect(page).toContain("<Suspense")
    expect(page).toContain("getStudentConversations")
    expect(page).not.toMatch(/@\/lib\/supabase/)
    expect(page).not.toMatch(/supabase|\.from\("/)
  })
})
