// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, renderHook } from "@testing-library/react"

// Faux canal Supabase : capture le gestionnaire de l'abonnement INSERT pour livrer des lignes à la main.
const channelState = { handler: null, filter: null, removed: 0 }
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const channel = {
        on: (_kind, filter, handler) => {
          channelState.handler = handler
          channelState.filter = filter
          return channel
        },
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: () => {
      channelState.removed += 1
    },
  }),
}))

const { useRealtimeMessages } = await import("./use-realtime-messages")

const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const STRANGER = "33333333-3333-4333-8333-333333333333"
const MISSION = "44444444-4444-4444-8444-444444444444"
const REQ = "55555555-5555-4555-8555-555555555555"

const incomingRow = (over) => ({
  id: "row-1",
  mission_id: MISSION,
  sender_id: OTHER,
  receiver_id: ME,
  content: "Bonjour",
  type: "text",
  purchase_request_id: null,
  media_url: null,
  location_lat: null,
  location_lng: null,
  read: false,
  created_at: "2026-10-17T09:00:00Z",
  ...over,
})

const setup = (extra = {}) =>
  renderHook(() =>
    useRealtimeMessages({ missionId: MISSION, studentId: OTHER, userId: ME, initialMessages: [], ...extra }),
  )

const deliver = async (row) => {
  await act(async () => {
    await channelState.handler({ new: row })
  })
}

beforeEach(() => {
  channelState.handler = null
  channelState.filter = null
  channelState.removed = 0
})

describe("useRealtimeMessages : messages d'achat", () => {
  it("s'abonne aux INSERT de messages de la mission, sans code propre aux types d'achat", () => {
    setup()
    expect(channelState.filter).toEqual({ event: "INSERT", schema: "public", table: "messages", filter: `mission_id=eq.${MISSION}` })
  })

  it("expose une carte reçue en direct avec type, contenu et identifiant de la demande", async () => {
    const onIncoming = vi.fn()
    const onPurchaseMessage = vi.fn()
    const { result } = setup({ onIncoming, onPurchaseMessage })
    await deliver(incomingRow({ id: "card", type: "purchase_request", content: "Demande de paiement d'achats N° 1", purchase_request_id: REQ }))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({
      id: "card",
      type: "purchase_request",
      content: "Demande de paiement d'achats N° 1",
      purchaseRequestId: REQ,
      mine: false,
      mediaUrl: null,
    })
    expect(onIncoming).toHaveBeenCalledTimes(1)
    expect(onPurchaseMessage).toHaveBeenCalledTimes(1)
    expect(onPurchaseMessage.mock.calls[0][0]).toMatchObject({ id: "card", purchaseRequestId: REQ })
  })

  it("signale aussi la ligne système envoyée par soi-même, sans la compter comme message entrant", async () => {
    const onIncoming = vi.fn()
    const onPurchaseMessage = vi.fn()
    const { result } = setup({ onIncoming, onPurchaseMessage })
    await deliver(
      incomingRow({ id: "evt", type: "purchase_event", content: "La demande N° 1 a été annulée.", purchase_request_id: REQ, sender_id: ME, receiver_id: OTHER }),
    )
    expect(result.current.messages[0]).toMatchObject({ type: "purchase_event", purchaseRequestId: REQ, mine: true })
    expect(onIncoming).not.toHaveBeenCalled()
    expect(onPurchaseMessage).toHaveBeenCalledTimes(1)
  })

  it("n'appelle pas onPurchaseMessage pour un message ordinaire", async () => {
    const onPurchaseMessage = vi.fn()
    const { result } = setup({ onPurchaseMessage })
    await deliver(incomingRow())
    expect(result.current.messages[0]).toMatchObject({ type: "text", purchaseRequestId: null })
    expect(onPurchaseMessage).not.toHaveBeenCalled()
  })

  it("ignore une ligne d'achat sans identifiant de demande valide", async () => {
    const onPurchaseMessage = vi.fn()
    const { result } = setup({ onPurchaseMessage })
    await deliver(incomingRow({ id: "bad", type: "purchase_event", purchase_request_id: null }))
    expect(result.current.messages).toEqual([])
    expect(onPurchaseMessage).not.toHaveBeenCalled()
  })

  it("écarte une ligne d'achat d'une autre paire ou d'une autre mission", async () => {
    const onPurchaseMessage = vi.fn()
    const { result } = setup({ onPurchaseMessage })
    await deliver(incomingRow({ id: "x1", type: "purchase_request", purchase_request_id: REQ, sender_id: STRANGER }))
    await deliver(incomingRow({ id: "x2", type: "purchase_request", purchase_request_id: REQ, mission_id: "66666666-6666-4666-8666-666666666666" }))
    expect(result.current.messages).toEqual([])
    expect(onPurchaseMessage).not.toHaveBeenCalled()
  })

  it("ne duplique pas une ligne reçue deux fois", async () => {
    const { result } = setup()
    const row = incomingRow({ id: "card", type: "purchase_request", purchase_request_id: REQ })
    await deliver(row)
    await deliver(row)
    expect(result.current.messages).toHaveLength(1)
  })

  it("ne demande aucune adresse signée pour un message d'achat", async () => {
    const resolveMedia = vi.fn()
    setup({ resolveMedia })
    await deliver(incomingRow({ id: "card", type: "purchase_request", purchase_request_id: REQ }))
    expect(resolveMedia).not.toHaveBeenCalled()
  })
})
