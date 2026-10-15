import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))

const { MissionsView, missionsSubtitle } = await import("./missions-view")

const CLIENT = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222222"

const row = (over = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Aide au déménagement",
  type: "Livraison",
  city: "Cotonou",
  budget: 12000,
  status: "in_progress",
  deadline: "2026-10-20",
  createdAt: "2026-10-10T08:00:00Z",
  clientId: CLIENT,
  clientName: "Koffi Client",
  studentId: STUDENT,
  studentName: "Esther Etudiante",
  awaitingConfirm: false,
  ...over,
})

const data = (over = {}) => ({
  statut: "toutes",
  q: "",
  ville: "",
  type: "",
  page: 1,
  pageCount: 1,
  total: 151,
  counts: { toutes: 151, open: 18, in_progress: 9, "a-confirmer": 3, done: 112, cancelled: 7 },
  rows: [row()],
  today: "2026-10-15",
  ...over,
})

const render = (props) => renderToStaticMarkup(<MissionsView {...props} />)

describe("MissionsView : liste", () => {
  const html = render({ data: data({ rows: [row(), row({ id: "44444444-4444-4444-8444-444444444444", status: "open", studentId: null, studentName: "", awaitingConfirm: false, type: "Saisie", deadline: "2026-10-01" }), row({ id: "55555555-5555-4555-8555-555555555555", awaitingConfirm: true }), row({ id: "66666666-6666-4666-8666-666666666666", status: "done" }), row({ id: "77777777-7777-4777-8777-777777777777", status: "cancelled" })] }) })

  it("un seul h1 et un sous-titre avec les fins à confirmer", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("151 missions")
    expect(html).toContain("3 fins à confirmer")
  })

  it("six onglets avec compteurs, l'onglet courant en aria-current, statut dans l'URL", () => {
    for (const label of ["Toutes", "Ouvertes", "En cours", "À confirmer", "Terminées", "Annulées"]) expect(html).toContain(label)
    expect(html).toMatch(/aria-current="page"[^>]*>Toutes/)
    expect(html).toContain('href="/admin/missions?statut=a-confirmer"')
    expect(html).toContain('<span class="count">112</span>')
  })

  it("les statuts réels de la base s'affichent par missionStatusView", () => {
    for (const label of ["En cours", "Ouverte", "Échéance dépassée", "Terminée", "Annulée"]) expect(html).toContain(label)
    expect(html).toContain("Fin à confirmer")
  })

  it("le type passe par missionTypeLabel (Livraison s'affiche « Marché et achats »)", () => {
    expect(html).toContain("Marché et achats")
    expect(html).not.toMatch(/>Livraison</)
    expect(html).not.toContain("Saisie<")
  })

  it("lignes liées au détail et aux fiches utilisateur, étudiant absent explicite", () => {
    expect(html).toContain('href="/admin/missions/33333333-3333-4333-8333-333333333333"')
    expect(html).toContain(`href="/admin/users/${CLIENT}"`)
    expect(html).toContain(`href="/admin/users/${STUDENT}"`)
    expect(html).toContain("Non retenu")
  })

  it("tableau accessible : légende, en-têtes de colonne, libellés pour la liste mobile", () => {
    expect(html).toContain("<caption")
    expect(html).toContain('scope="col"')
    expect(html).toContain('data-label="Budget"')
    expect(html).toContain("a2-tlist")
  })

  it("recherche en GET vers /admin/missions, ville et type en listes fermées", () => {
    expect(html).toContain('action="/admin/missions"')
    expect(html).toContain('method="get"')
    expect(html).toContain('name="q"')
    expect(html).toContain('name="ville"')
    expect(html).toContain('name="type"')
  })

  it("aucune action d'argent, aucun tutoiement, aucun tiret cadratin", () => {
    expect(html).not.toMatch(/Rembourser|Annuler la mission|Libérer|Recréditer/)
    expect(html).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(html).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })
})

describe("MissionsView : états", () => {
  it("erreur distincte de la liste vide", () => {
    const html = render({ data: null, error: "Les missions n'ont pas pu être chargées." })
    expect(html).toContain("role=\"alert\"")
    expect(html).toContain("Les missions n&#x27;ont pas pu être chargées")
    expect(html).not.toContain("Aucune mission")
  })

  it("aucune mission du tout", () => {
    const html = render({ data: data({ rows: [], total: 0, counts: { toutes: 0, open: 0, in_progress: 0, "a-confirmer": 0, done: 0, cancelled: 0 } }) })
    expect(html).toContain("Aucune mission pour le moment.")
    expect(html).toContain("Aucune mission<")
  })

  it("aucun résultat pour une recherche", () => {
    const html = render({ data: data({ rows: [], total: 0, q: "zzz" }) })
    expect(html).toContain("Aucune mission ne correspond à cette recherche.")
  })

  it("onglet vide", () => {
    const html = render({ data: data({ rows: [], total: 0, statut: "done" }) })
    expect(html).toContain("Aucune mission dans cet onglet.")
    expect(html).toContain('name="statut"')
  })

  it("pagination : précédent et suivant conservent les filtres", () => {
    const html = render({ data: data({ statut: "open", q: "ménage", ville: "Cotonou", page: 2, pageCount: 3 }) })
    expect(html).toContain("Page 2 sur 3")
    expect(html).toContain("/admin/missions?q=m%C3%A9nage&amp;statut=open&amp;ville=Cotonou")
    expect(html).toContain("Précédent")
    expect(html).toContain("Suivant")
  })

  it("une seule page : aucune pagination", () => {
    expect(render({ data: data() })).not.toContain("Pagination des missions")
  })
})

describe("missionsSubtitle", () => {
  it("accords et absence de fin à confirmer", () => {
    expect(missionsSubtitle(1, 1)).toEqual({ strong: "1 mission", rest: "1 fin à confirmer" })
    expect(missionsSubtitle(0, 0)).toEqual({ strong: "Aucune mission", rest: "" })
  })
})
