import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("@/lib/actions/application.actions", () => ({ acceptApplication: vi.fn(), rejectApplication: vi.fn() }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionHeader } = await import("./mission-header")

const student = {
  id: "s1", fullName: "Awa Kouassi", avatarUrl: null, city: "Cotonou", rating: 4, missionsDone: 1,
  isVerified: true, verifiedUntil: "2099-01-01", school: "UAC", level: "L3", skills: [],
}

function detailOf(status, extra = {}) {
  return {
    mission: {
      id: "m1", title: "Cours de maths", description: "Niveau 3e", type: "Livraison", city: "Cotonou", budget: 10000,
      urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-01T08:00:00Z", selectedStudentId: null,
    },
    applications: [{ id: "a1", studentId: "s1", status: "pending", message: "Bonjour", createdAt: "2026-10-02T00:00:00Z", student }],
    selectedStudent: null,
    ledger: [],
    review: null,
    ...extra,
  }
}

describe("MissionHeader", () => {
  const detail = detailOf("open")
  const html = renderToStaticMarkup(<MissionHeader mission={detail.mission} status={{ label: "Ouverte", tone: "neutre" }} />)

  it("porte l'unique h1, le fil d'Ariane vers Mes missions et le statut", () => {
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Cours de maths")
    expect(html).toContain('href="/client/missions"')
    expect(html).toContain("Ouverte")
  })

  it("affiche le type par son libellé, jamais la valeur brute, et le montant en séquestre", () => {
    expect(html).toContain("Marché et achats")
    expect(html).not.toContain("Livraison")
    expect(html).toContain("En séquestre")
    expect(html).toMatch(/10\s000/)
  })

  it("parle de budget quand la mission n'est plus financée", () => {
    const done = detailOf("done")
    const out = renderToStaticMarkup(<MissionHeader mission={done.mission} status={{ label: "Terminée", tone: "succes" }} />)
    expect(out).toContain("Budget")
    expect(out).not.toContain("En séquestre")
  })
})
