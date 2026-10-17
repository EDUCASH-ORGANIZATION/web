// @ds-screen RD-STUDENT-01
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ notFound: vi.fn() }))
vi.mock("@/lib/actions/message.actions", () => ({
  getStudentConversation: vi.fn(async () => ({ conversation: { missionId: "m" } })),
}))
vi.mock("@/components/student-space/messages/conversation-view", () => ({ StudentConversationView: () => null }))
vi.mock("@/components/app-ui/state-block", () => ({ ErrorState: () => null }))

const { default: Page } = await import("./page")

const R1 = "44444444-4444-4444-8444-444444444441"
const props = async (searchParams) => (await Page({ params: Promise.resolve({ missionId: "m" }), searchParams: Promise.resolve(searchParams) })).props

describe("page de conversation étudiante : drapeaux d'URL d'achats", () => {
  it("?achat=nouveau et ?demande=<uuid> sont transmis à la vue", async () => {
    const p = await props({ achat: "nouveau", demande: R1.toUpperCase() })
    expect(p.initialAction).toBe("new")
    expect(p.focusRequestId).toBe(R1)
  })

  it.each([["oui"], ["true"], ["1"], [["nouveau", "x"]], [undefined]])("valeur d'achat %j ignorée", async (achat) => {
    expect((await props({ achat })).initialAction).toBeNull()
  })

  it.each([["../x"], ["12"], [["a", "b"]], [undefined], ["<script>"]])("demande %j ignorée", async (demande) => {
    expect((await props({ demande })).focusRequestId).toBeNull()
  })

  it("sans paramètres, rien n'est transmis", async () => {
    const p = await props({})
    expect([p.initialAction, p.focusRequestId]).toEqual([null, null])
  })
})
