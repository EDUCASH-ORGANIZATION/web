import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { existsSync } from "node:fs"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { ClientMissionsView, ClientMissionsSkeleton } = await import("./client-missions-view")

const TODAY = "2026-10-13"
const THIN = " "

const mission = (over) => ({
  id: "m1",
  title: "Traduire un flyer en anglais",
  type: "Traduction",
  city: "Cotonou",
  budget: 8000,
  deadline: "2026-10-20",
  status: "open",
  createdAt: "2026-10-01T10:00:00Z",
  overdue: false,
  applicationsCount: 0,
  pendingCount: 0,
  studentId: null,
  reviewed: false,
  ...over,
})

const counts = { open: 0, in_progress: 0, done: 0, cancelled: 0 }

function render(over = {}) {
  const missions = over.missions ?? []
  const result = {
    onglet: "open",
    q: "",
    today: TODAY,
    counts: { ...counts },
    total: 0,
    ...over,
    missions,
  }
  return renderToStaticMarkup(<ClientMissionsView result={result} />)
}

describe("ClientMissionsView : onglets vides", () => {
  const CASES = [
    ["open", "Aucune mission ouverte", "/client/missions/new"],
    ["in_progress", "Aucune mission en cours", "/client/missions"],
    ["done", "Aucune mission terminée", null],
    ["cancelled", "Aucune mission annulée", null],
  ]
  for (const [onglet, title, href] of CASES) {
    it(`onglet ${onglet} : texte vouvoyé honnête${href ? " et lien d'action" : ""}`, () => {
      const html = render({ onglet })
      expect(html).toContain(title)
      expect(html).toContain("empty2__text")
      if (href) expect(html).toContain(`href="${href}`)
      else expect(html).not.toContain("hero2__link")
    })
  }

  it("affiche les quatre onglets avec leurs compteurs et marque l'onglet courant", () => {
    const html = render({ onglet: "done", counts: { open: 2, in_progress: 1, done: 8, cancelled: 0 }, total: 11 })
    expect(html).toContain("Ouvertes")
    expect(html).toContain("En cours")
    expect(html).toContain("Terminées")
    expect(html).toContain("Annulées")
    expect(html).toMatch(/is-active"[^>]*aria-current="page"[^>]*>Terminées<span class="count">8<\/span>/)
    expect(html).toContain('<span class="count">2</span>')
    expect(html).toContain('href="/client/missions?onglet=done"')
    expect(html).toContain('href="/client/missions"')
  })

  it("n'a qu'un seul h1 et aucune carte « À faire cette semaine »", () => {
    const html = render()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).not.toMatch(/faire cette semaine/i)
  })
})

describe("ClientMissionsView : rangées", () => {
  it("met en avant l'échéance dépassée et explique qu'aucune action n'est automatique", () => {
    const html = render({
      counts: { ...counts, open: 1 },
      total: 1,
      missions: [mission({ overdue: true, deadline: "2026-10-03", budget: 6000 })],
    })
    expect(html).toContain("Échéance dépassée")
    expect(html).toContain("badge--erreur")
    expect(html).toContain("dépassée")
    expect(html).toContain("Rien ne se passe automatiquement")
    expect(html).toContain(`6${THIN}000`)
  })

  it("ouverte avec candidatures en attente : Examiner ; sans : Voir ; type par missionTypeLabel", () => {
    const withPending = render({ missions: [mission({ pendingCount: 3, applicationsCount: 3 })], counts: { ...counts, open: 1 }, total: 1 })
    expect(withPending).toContain("Examiner")
    expect(withPending).toContain("3 candidatures à examiner")
    expect(withPending).toContain('href="/client/missions/m1"')
    const without = render({ missions: [mission({ type: "Livraison" })], counts: { ...counts, open: 1 }, total: 1 })
    expect(without).toContain("Voir")
    expect(without).toContain("aucune candidature")
    expect(without).toContain("Marché et achats")
    expect(without).not.toContain(">Livraison")
  })

  it("en cours : Discuter vers la conversation et Confirmer la fin vers ?confirmer=1", () => {
    const html = render({
      onglet: "in_progress",
      counts: { ...counts, in_progress: 1 },
      total: 1,
      missions: [mission({ status: "in_progress", studentId: "s1" })],
    })
    expect(html).toContain("En cours")
    expect(html).toContain("Discuter")
    expect(html).toContain('href="/client/messages/m1?studentId=s1"')
    expect(html).toContain("Confirmer la fin")
    expect(html).toContain('href="/client/missions/m1?confirmer=1"')
  })

  it("en cours sans étudiant retenu : pas de Discuter", () => {
    const html = render({ onglet: "in_progress", counts: { ...counts, in_progress: 1 }, total: 1, missions: [mission({ status: "in_progress" })] })
    expect(html).not.toContain("Discuter")
    expect(html).toContain("Confirmer la fin")
  })

  it("terminée : Noter vers l'avis tant qu'il manque, Republier toujours", () => {
    const todo = render({ onglet: "done", counts: { ...counts, done: 1 }, total: 1, missions: [mission({ status: "done" })] })
    expect(todo).toContain("Noter")
    expect(todo).toContain('href="/review/m1"')
    expect(todo).toContain("Republier")
    expect(todo).toContain("duplicate=m1")
    const rated = render({ onglet: "done", counts: { ...counts, done: 1 }, total: 1, missions: [mission({ status: "done", reviewed: true })] })
    expect(rated).not.toContain("Noter")
    expect(rated).toContain("avis donné")
    expect(rated).toContain("Republier")
  })

  it("annulée : Republier seulement", () => {
    const html = render({ onglet: "cancelled", counts: { ...counts, cancelled: 1 }, total: 1, missions: [mission({ status: "cancelled" })] })
    expect(html).toContain("Annulée")
    expect(html).toContain("Republier")
    expect(html).not.toContain("Noter")
    expect(html).not.toContain("Confirmer la fin")
  })

  it("montants via formatAmount, jamais de couleur ni de classe Tailwind de mise en page", () => {
    const html = render({ missions: [mission({ budget: 12500 })], counts: { ...counts, open: 1 }, total: 1 })
    expect(html).toContain(`12${THIN}500`)
    expect(html).toContain("FCFA")
    expect(html).not.toMatch(/style=|class="[^"]*\b(?:bg-|text-|flex\b|grid\b)/)
  })
})

describe("ClientMissionsView : recherche, erreur, chargement", () => {
  it("préremplit la recherche, garde l'onglet et la recherche dans les liens d'onglet", () => {
    const html = render({ onglet: "done", q: "flyer", missions: [mission({ status: "done" })], counts: { ...counts, done: 1 }, total: 1 })
    expect(html).toContain('name="q"')
    expect(html).toContain('value="flyer"')
    expect(html).toContain('name="onglet" value="done"')
    expect(html).toContain("q=flyer")
    expect(html).toContain("1 résultat")
  })

  it("champ de recherche de la page : mobile seulement (ds-mob-only), la barre du haut sert au bureau", () => {
    const html = render({})
    expect(html).toMatch(/<form[^>]*role="search"[^>]*class="tools2 ds-mob-only"|<form[^>]*class="tools2 ds-mob-only"[^>]*role="search"/)
  })

  it("recherche sans résultat : texte dédié, lien pour effacer, mention des autres onglets", () => {
    const none = render({ q: "peinture" })
    expect(none).toContain("Aucune mission pour « peinture »")
    expect(none).toContain("Effacer la recherche")
    expect(none).not.toContain("Aucune mission ouverte")
    const elsewhere = render({ q: "flyer", counts: { ...counts, done: 2 }, total: 2 })
    expect(elsewhere).toContain("2 missions correspondent dans les autres onglets")
  })

  it("échappe une recherche hostile à l'affichage", () => {
    const html = render({ q: '<img src=x onerror="a()">' })
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
  })

  it("erreur : bloc distinct du vide, en alerte, avec Réessayer, sans fuite du détail", () => {
    const html = renderToStaticMarkup(<ClientMissionsView result={{ error: "relation missions secrète" }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible de charger vos missions")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("secrète")
    expect(html).not.toContain("Aucune mission ouverte")
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it("chargement : titre et squelettes annoncés une seule fois, ni vide ni erreur", () => {
    const html = renderToStaticMarkup(<ClientMissionsSkeleton />)
    expect(html).toContain("Mes missions")
    expect(html).toContain("skel2-row")
    expect(html.match(/role="status"/g)).toHaveLength(1)
    expect(html).not.toContain("Aucune mission")
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})

describe("page missions", () => {
  it("n'a aucun loading.js sous client/missions (le 404 de [id] resterait un 404)", () => {
    expect(existsSync("src/app/(client)/client/missions/loading.js")).toBe(false)
  })
})
