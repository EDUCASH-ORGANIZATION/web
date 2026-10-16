import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))

const { MissionDetailView, momentLabel } = await import("./mission-detail-view")

const CLIENT = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222222"
const MISSION_ID = "33333333-3333-4333-8333-333333333333"

const data = (over = {}, missionOver = {}) => ({
  today: "2026-10-15",
  mission: {
    id: MISSION_ID,
    title: "Aide au déménagement",
    description: "Porter des cartons.",
    type: "Livraison",
    city: "Cotonou",
    budget: 10000,
    urgency: "low",
    deadline: "2026-10-20",
    status: "in_progress",
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-12T08:00:00Z",
    clientId: CLIENT,
    selectedStudentId: STUDENT,
    ...missionOver,
  },
  client: { id: CLIENT, name: "Koffi Client" },
  student: { id: STUDENT, name: "Esther Etudiante" },
  applications: {
    total: 2,
    items: [
      { id: "a1", studentId: STUDENT, name: "Esther Etudiante", status: "accepted", createdAt: "2026-10-11T08:00:00Z", selected: true },
      { id: "a2", studentId: "44444444-4444-4444-8444-444444444444", name: "", status: "rejected", createdAt: "2026-10-11T09:00:00Z", selected: false },
    ],
  },
  completion: { declaredAt: null, finishedAt: null },
  reviews: [],
  ledger: [{ id: "w1", userId: CLIENT, type: "reserve", amount: 10000, createdAt: "2026-10-10T08:01:00Z", party: "client" }],
  ...over,
})

const render = (props) => renderToStaticMarkup(<MissionDetailView {...props} />)

describe("MissionDetailView : en cours", () => {
  const html = render({ data: data() })

  it("un seul h1 avec le titre, retour à la liste, type par missionTypeLabel", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Aide au déménagement")
    expect(html).toContain('href="/admin/missions"')
    expect(html).toContain("Marché et achats")
    expect(html).not.toMatch(/>Livraison</)
    expect(html).toContain("En cours")
  })

  it("parties et candidatures liées aux fiches utilisateur, nom manquant explicite", () => {
    expect(html).toContain(`href="/admin/users/${CLIENT}"`)
    expect(html).toContain(`href="/admin/users/${STUDENT}"`)
    expect(html).toContain("Compte sans nom")
    expect(html).toContain("Retenue")
    expect(html).toContain("Non retenue")
  })

  it("argent : prévu par escrowSplit, séquestre, note sans action ni promesse", () => {
    expect(html).toContain("Budget de la mission")
    expect(html).toContain("Commission prévue")
    expect(html).toContain("1 200 FCFA")
    expect(html).toContain("Encore en séquestre")
    expect(html).toContain("Aucune action d&#x27;argent depuis cet écran. Pour un litige, contactez les parties.")
    expect(html).not.toMatch(/<button/)
    expect(html).not.toMatch(/Rembourser|Libérer maintenant|Annuler la mission|J&#x27;ai terminé|72 ?h/)
  })

  it("frise sans citron ni conversation", () => {
    expect(html).toContain("tl-item is-current")
    expect(html).toContain("Mission en cours")
    expect(html).not.toMatch(/Message|Conversation/)
  })

  it("aucun tutoiement ni tiret cadratin", () => {
    expect(html).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(html).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })
})

describe("MissionDetailView : statuts", () => {
  it("ouverte", () => {
    const html = render({ data: data({ student: null, ledger: [] }, { status: "open", selectedStudentId: null, deadline: "2026-10-30" }) })
    expect(html).toContain("Ouverte")
    expect(html).toContain("En attente d&#x27;un étudiant")
    expect(html).toContain("Aucun étudiant retenu")
    expect(html).toContain("Aucun mouvement d&#x27;argent enregistré pour cette mission.")
  })

  it("échéance dépassée sur une mission ouverte", () => {
    expect(render({ data: data({ ledger: [] }, { status: "open", deadline: "2026-10-01" }) })).toContain("Échéance dépassée")
  })

  it("à confirmer : fin déclarée sur une mission en cours", () => {
    const html = render({ data: data({ completion: { declaredAt: "2026-10-13T08:00:00Z", finishedAt: null } }) })
    expect(html).toContain("Fin à confirmer")
    expect(html).toContain("Fin déclarée par l&#x27;étudiant, à confirmer par le client")
  })

  it("en cours sans déclaration : pas de « Fin à confirmer »", () => {
    expect(render({ data: data() })).not.toContain("Fin à confirmer")
  })

  it("terminée avec avis et libération", () => {
    const html = render({
      data: data(
        {
          completion: { declaredAt: "2026-10-12T08:00:00Z", finishedAt: "2026-10-13T08:00:00Z" },
          reviews: [{ id: "r1", rating: 5, comment: "Parfait", createdAt: "2026-10-14T08:00:00Z", byRole: "client" }],
          ledger: [
            { id: "w1", userId: CLIENT, type: "reserve", amount: 10000, createdAt: "2026-10-10T08:01:00Z", party: "client" },
            { id: "w2", userId: CLIENT, type: "release", amount: 10000, createdAt: "2026-10-13T08:01:00Z", party: "client" },
            { id: "w3", userId: CLIENT, type: "commission", amount: 1200, createdAt: "2026-10-13T08:01:00Z", party: "client" },
            { id: "w4", userId: STUDENT, type: "release", amount: 8800, createdAt: "2026-10-13T08:01:00Z", party: "student" },
          ],
        },
        { status: "done" },
      ),
    })
    expect(html).toContain("Terminée")
    expect(html).toContain("Mission terminée")
    expect(html).toContain("Le client : 5 sur 5")
    expect(html).toContain("Parfait")
    expect(html).toContain("Commission")
    expect(html).toContain("Libération")
  })

  it("annulée avec remboursement", () => {
    const html = render({
      data: data(
        { ledger: [
          { id: "w1", userId: CLIENT, type: "reserve", amount: 10000, createdAt: "2026-10-10T08:01:00Z", party: "client" },
          { id: "w2", userId: CLIENT, type: "refund", amount: 10000, createdAt: "2026-10-11T08:01:00Z", party: "client" },
        ] },
        { status: "cancelled" },
      ),
    })
    expect(html).toContain("Annulée")
    expect(html).toContain("Mission annulée")
    expect(html).toContain("remboursés au client")
  })

  it("erreur de lecture : message annoncé, aucun montant", () => {
    const html = render({ data: null, error: "Cette mission n'a pas pu être chargée." })
    expect(html).toContain('role="alert"')
    expect(html).not.toContain("Budget")
  })
})

describe("momentLabel", () => {
  it("date et heure du Bénin, vide si illisible", () => {
    expect(momentLabel("2026-10-12T09:02:00Z")).toBe("12 oct. · 10:02")
    expect(momentLabel("pas une date")).toBe("")
    expect(momentLabel(null)).toBe("")
  })
})
