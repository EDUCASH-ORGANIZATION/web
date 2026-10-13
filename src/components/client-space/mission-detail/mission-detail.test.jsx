import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("@/lib/actions/application.actions", () => ({ acceptApplication: vi.fn(), rejectApplication: vi.fn() }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { Toaster } = await import("@/components/shared/toaster")
const { MissionHeader } = await import("./mission-header")
const { MissionOpenView } = await import("./open-view")
const { MissionFollowupView } = await import("./followup-view")

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

const FLAGS = { confirmer: false, publiee: false, paymentsEnabled: false }

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

describe("bouchons des vues (parité fonctionnelle)", () => {
  it("MissionOpenView affiche l'en-tête et la candidature avec Accepter et Refuser", () => {
    const html = renderToStaticMarkup(<Toaster><MissionOpenView detail={detailOf("open")} candidate={null} flags={FLAGS} /></Toaster>)
    expect(html).toContain("Cours de maths")
    expect(html).toContain("Awa Kouassi")
    expect(html).toContain("Accepter")
    expect(html).toContain("Refuser")
  })

  it.each(["in_progress", "done", "cancelled"])("MissionFollowupView rend le statut %s", (status) => {
    const html = renderToStaticMarkup(<Toaster><MissionFollowupView detail={detailOf(status)} flags={FLAGS} /></Toaster>)
    expect(html).toContain("Cours de maths")
  })
})
