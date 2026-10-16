import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))

const { ReportsView, reportsSubtitle } = await import("./reports-view")

const R1 = "20000000-0000-4000-8000-000000000001"
const R2 = "20000000-0000-4000-8000-000000000002"
const NOW = new Date("2026-10-16T12:00:00Z")

const item = (over = {}) => ({
  id: R1,
  reference: "SIG-0001",
  source: "user",
  reason: "scam",
  reasonLabel: "Arnaque ou demande d'argent",
  status: "open",
  createdAt: "2026-10-16T09:00:00Z",
  missionId: "10000000-0000-4000-8000-000000000001",
  missionTitle: "Aide au déménagement",
  reporter: { id: "u1", name: "Koffi C." },
  reported: { id: "u2", name: "Esther E." },
  handledBy: null,
  handledAt: null,
  ...over,
})

const data = (over = {}) => ({
  tab: "a-traiter",
  sort: "anciens",
  page: 1,
  pageSize: 20,
  total: 2,
  counts: { "a-traiter": 2, resolus: 5, classes: 1 },
  items: [item(), item({ id: R2, reference: "SIG-0002", source: "auto", reporter: null, status: "in_progress", handledBy: { id: "a1", name: "Awa A." } })],
  ...over,
})

const render = (props) => renderToStaticMarkup(<ReportsView now={NOW} {...props} />)

describe("ReportsView : liste", () => {
  const html = render({ data: data() })

  it("un seul h1, sous-titre et trois indicateurs", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("2 signalements à traiter")
    expect(html).toContain('aria-label="Signalements par état"')
    for (const label of ["À traiter", "Résolus", "Classés"]) expect(html).toContain(label)
    expect(html).toContain(">5<")
  })

  it("onglets en liens avec compteurs, l'onglet courant est marqué", () => {
    expect(html).toContain('href="/admin/reports"')
    expect(html).toContain('href="/admin/reports?statut=resolus"')
    expect(html).toContain('href="/admin/reports?statut=classes"')
    expect(html).toMatch(/class="tab is-active"[^>]*aria-current="page"|aria-current="page"[^>]*class="tab is-active"/)
  })

  it("tableau avec légende, en-têtes de colonne et lignes vers le détail", () => {
    expect(html).toContain("<caption")
    expect(html.match(/<th scope="col"/g)).toHaveLength(7)
    expect(html).toContain(`href="/admin/reports/${R1}"`)
    expect(html).toContain(`href="/admin/reports/${R2}"`)
    expect(html).toContain("SIG-0001")
    expect(html).toContain("Aide au déménagement")
    expect(html).toContain('data-label="Statut"')
  })

  it("origine, auteur du signalement et prise en charge", () => {
    expect(html).toContain("Signalement d&#x27;un utilisateur")
    expect(html).toContain("Alerte automatique")
    expect(html).toContain("Analyse automatique")
    expect(html).toContain("Koffi C.")
    expect(html).toContain("Par Awa A.")
    expect(html).toContain("Ouvert")
    expect(html).toContain("En cours")
  })

  it("ancienneté relative", () => {
    expect(html).toContain("il y a 3 h")
  })

  it("tri : lien vers l'autre ordre, onglet conservé", () => {
    expect(html).toContain('href="/admin/reports?tri=recents"')
    expect(render({ data: data({ tab: "resolus", sort: "recents" }) })).toContain('href="/admin/reports?statut=resolus"')
  })

  it("aucun style en ligne, aucune couleur en dur, vouvoiement et mots bannis absents", () => {
    expect(html).not.toMatch(/style=|#[0-9a-f]{6}\b|rgba?\(/i)
    expect(html).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/i)
    expect(html).not.toMatch(/livraison|coursier|saisie|bientôt|\u2014/i)
  })
})

describe("ReportsView : pagination", () => {
  it("rien quand tout tient sur une page", () => {
    expect(render({ data: data() })).not.toContain("pagination")
  })

  it("liens de page qui conservent l'onglet et le tri", () => {
    const html = render({ data: data({ tab: "resolus", sort: "recents", page: 2, total: 45 }) })
    expect(html).toContain('aria-label="Pagination des signalements"')
    expect(html).toContain('href="/admin/reports?statut=resolus&amp;tri=recents"')
    expect(html).toContain('href="/admin/reports?statut=resolus&amp;tri=recents&amp;page=3"')
    expect(html).toContain('aria-current="page"')
  })
})

describe("ReportsView : états", () => {
  it("vide, onglet à traiter : message rassurant", () => {
    const html = render({ data: data({ items: [], total: 0, counts: { "a-traiter": 0, resolus: 0, classes: 0 } }) })
    expect(html).toContain("Aucun signalement à traiter")
    expect(html).not.toContain("<table")
    expect(html).toContain("Aucun signalement à traiter</b>")
  })

  it("vide, onglets résolus et classés", () => {
    expect(render({ data: data({ tab: "resolus", items: [], total: 0 }) })).toContain("Aucun signalement résolu")
    expect(render({ data: data({ tab: "classes", items: [], total: 0 }) })).toContain("Aucun signalement classé")
  })

  it("indisponible (avant le script 92) : état dédié, message de l'action, ni tableau ni onglets", () => {
    const html = render({ data: { unavailable: true, message: "Les signalements ne sont pas disponibles pour le moment. Réessayez plus tard.", items: [] } })
    expect(html).toContain("Les signalements ne sont pas disponibles pour le moment")
    expect(html).toContain("Réessayez plus tard.")
    expect(html).not.toContain("<table")
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toContain('role="alert"')
  })

  it("erreur : alerte avec le message et bouton Réessayer, jamais une liste vide", () => {
    const html = render({ data: null, error: "Les signalements n'ont pas pu être chargés. Réessayez dans un instant." })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Les signalements n&#x27;ont pas pu être chargés")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("Aucun signalement")
  })

  it("compte sans nom : repli lisible", () => {
    const html = render({ data: data({ items: [item({ reported: { id: "u2", name: "" } })] }) })
    expect(html).toContain("Compte sans nom")
  })
})

describe("reportsSubtitle", () => {
  it("accorde le pluriel", () => {
    expect(reportsSubtitle(0)).toBe("Aucun signalement à traiter")
    expect(reportsSubtitle(1)).toBe("1 signalement à traiter")
    expect(reportsSubtitle(3)).toBe("3 signalements à traiter")
  })
})
