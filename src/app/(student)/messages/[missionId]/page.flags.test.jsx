// @ds-screen RD-STUDENT-01
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ notFound: vi.fn() }))
vi.mock("@/lib/actions/message.actions", () => ({
  getStudentConversation: vi.fn(async () => ({ conversation: { missionId: "m" } })),
}))
vi.mock("@/components/student-space/messages/conversation-view", () => ({ StudentConversationView: () => null }))
vi.mock("@/components/app-ui/state-block", () => ({ ErrorState: () => null }))

const { default: Page } = await import("./page")
const { PurchasesBlock } = await import("@/components/student-space/mission/followup/purchases-block")

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

  it("le bouton « Demander un paiement d'achats » de E05 ouvre le formulaire dans la conversation", async () => {
    const listing = { available: true, canCreate: true, requests: [], totals: { count: 0 } }
    const html = renderToStaticMarkup(
      <PurchasesBlock purchases={0} clientName="Awa K." missionId="m" missionStatus="in_progress" listing={listing} />,
    )
    const hrefs = [...html.matchAll(/href="([^"]*achat=nouveau[^"]*)"/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      const url = new URL(href, "https://educash.test")
      expect(url.pathname).toBe("/messages/m")
      const p = await props(Object.fromEntries(url.searchParams))
      expect(p.initialAction).toBe("new")
    }
  })
})
