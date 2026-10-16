import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const getStudentApplicationsView = vi.fn()
const getStudentConversations = vi.fn()
vi.mock("@/lib/actions/student-applications.actions", () => ({ getStudentApplicationsView }))
vi.mock("@/lib/actions/message.actions", () => ({ getStudentConversations }))
vi.mock("@/lib/constants/payments", () => ({ paymentsEnabled: () => true }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: vi.fn() }))

const { default: Page } = await import("./page")

const COUNTS = { "en-attente": 1, "en-cours": 0, terminees: 0, "non-retenues": 0 }
const VIEW = {
  data: {
    tab: "en-attente", counts: COUNTS, total: 1, escrow: { total: 0, count: 0 }, highlight: null,
    rows: [{
      id: "a1", missionId: "m1", title: "Cours", type: "Cours particuliers", city: "Cotonou", budget: 25000, net: 22000,
      deadline: "2026-10-30", missionStatus: "open", status: "pending", appliedAt: "2026-10-01T10:00:00Z",
      updatedAt: "2026-10-01T10:00:00Z", clientName: "Rosine H.", clientFirst: "Rosine", review: null,
    }],
  },
}

async function renderPage(sp = {}) {
  const tree = await Page({ searchParams: Promise.resolve(sp) })
  const child = tree.props.children
  const out = await child.type(child.props)
  return renderToStaticMarkup(out)
}

beforeEach(() => {
  getStudentApplicationsView.mockReset().mockResolvedValue(VIEW)
  getStudentConversations.mockReset()
})

describe("page Mes candidatures", () => {
  it("avec un non lu : action « Répondre à Rosine »", async () => {
    getStudentConversations.mockResolvedValue({ conversations: [{ missionId: "m1", unreadCount: 1, lastUnreadAt: "2026-10-08T09:12:00+01:00", state: "candidate" }] })
    expect(await renderPage()).toContain("Répondre à Rosine")
  })

  it("getStudentConversations en erreur : page rendue sans « Répondre », sans exception", async () => {
    getStudentConversations.mockResolvedValue({ error: "boom" })
    const html = await renderPage()
    expect(html).toContain("Mes candidatures")
    expect(html).toContain("Voir la mission")
    expect(html).not.toContain("Répondre")
  })

  it("getStudentConversations qui lève une exception : page rendue sans « Répondre »", async () => {
    getStudentConversations.mockRejectedValue(new Error("réseau"))
    const html = await renderPage()
    expect(html).toContain("Mes candidatures")
    expect(html).not.toContain("Répondre")
  })

  it("getStudentConversations renvoie null ou undefined : même comportement", async () => {
    for (const v of [null, undefined, {}]) {
      getStudentConversations.mockResolvedValue(v)
      expect(await renderPage()).not.toContain("Répondre")
    }
  })

  it("onglet de l'URL transmis tel quel à l'action (valeur inconnue incluse)", async () => {
    getStudentConversations.mockResolvedValue({ conversations: [] })
    await renderPage({ onglet: "terminees" })
    expect(getStudentApplicationsView).toHaveBeenLastCalledWith({ onglet: "terminees" })
    await renderPage({ onglet: "zzz" })
    expect(getStudentApplicationsView).toHaveBeenLastCalledWith({ onglet: "zzz" })
    await renderPage({})
    expect(getStudentApplicationsView).toHaveBeenLastCalledWith({ onglet: undefined })
  })

  it("searchParams absent : pas d'exception", async () => {
    getStudentConversations.mockResolvedValue({ conversations: [] })
    const tree = await Page({ searchParams: undefined })
    expect(tree).toBeTruthy()
  })

  it("l'action de candidatures en erreur : état d'erreur, un seul h1", async () => {
    getStudentApplicationsView.mockResolvedValue({ error: "x" })
    getStudentConversations.mockResolvedValue({ error: "y" })
    const html = await renderPage()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })
})
