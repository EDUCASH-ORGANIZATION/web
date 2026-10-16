// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(async () => ({})),
  getClientMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/lib/actions/message-report.actions", () => ({ reportClientMessage: vi.fn() }))
const append = vi.fn()
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append, refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { ConversationView } = await import("./conversation-view")
const { LocationDialog } = await import("./location-dialog")
const { sendClientMessage } = await import("@/lib/actions/message.actions")
const { reportClientMessage } = await import("@/lib/actions/message-report.actions")
const { MASKED_SENDER_NOTE, CONTACT_WARNING_COPY } = await import("@/lib/messaging/contact-copy")

const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const RECEIVED = "33333333-3333-4333-8333-333333333331"

const msg = (over) => ({
  id: "m1",
  mine: false,
  type: "text",
  content: "Bonjour",
  mediaUrl: null,
  lat: null,
  lng: null,
  createdAt: "2026-10-13T09:00:00Z",
  read: false,
  ...over,
})

const conversation = (messages) => ({
  userId: "client-1",
  missionId: M1,
  studentId: S1,
  student: { id: S1, name: "Awa K.", avatarUrl: null },
  mission: { id: M1, title: "Courses", amount: 5000 },
  state: "in_progress",
  relation: "selected",
  canWrite: true,
  messages,
})

const view = (messages) => render(<ConversationView conversation={conversation(messages)} now="2026-10-13T12:00:00Z" />)

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe("Conversation client : composeur, mention et signalement", () => {
  it("affiche la mention d'analyse, aussi dans l'état vide", () => {
    view([])
    expect(screen.getByRole("link", { name: "En savoir plus" })).toBeTruthy()
    expect(screen.getByText(/Aucun message pour l'instant/)).toBeTruthy()
  })

  it("avertit à la frappe d'une coordonnée sans bloquer l'envoi", () => {
    view([msg({})])
    const field = screen.getByRole("textbox", { name: "Votre message" })
    fireEvent.change(field, { target: { value: "Appelez-moi au 01 97 12 34 56" } })
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(CONTACT_WARNING_COPY)
    expect(screen.getByRole("button", { name: "Envoyer" }).disabled).toBe(false)
    fireEvent.change(field, { target: { value: "Bonjour" } })
    expect(screen.queryByText(CONTACT_WARNING_COPY)).toBeNull()
  })

  it("affiche la note de masquage sous la bulle envoyée, sans jamais citer la valeur", async () => {
    const sent = msg({ id: "srv-9", mine: true, content: "Appelez-moi [coordonnées masquées]" })
    sendClientMessage.mockResolvedValue({ success: true, message: sent, contactMasked: { kinds: ["phone"] } })
    const { rerender } = view([])
    fireEvent.change(screen.getByRole("textbox", { name: "Votre message" }), { target: { value: "Appelez 01 97 12 34 56" } })
    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox", { name: "Votre message" }).closest("form"))
    })
    expect(append).toHaveBeenCalledWith(sent)
    rerender(<ConversationView conversation={conversation([sent])} now="2026-10-13T12:00:00Z" />)
    expect(screen.getByText(MASKED_SENDER_NOTE)).toBeTruthy()
    expect(document.body.textContent).not.toContain("01 97 12 34 56")
  })

  it("propose Signaler sur un message reçu seulement", () => {
    view([msg({ id: RECEIVED }), msg({ id: "m2", mine: true, content: "Merci" })])
    const buttons = screen.getAllByRole("button", { name: /Signaler ce message/ })
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute("aria-label")).toBe("Signaler ce message de Awa K.")
  })

  it("ouvre la fenêtre de signalement et appelle l'action avec le contrat", async () => {
    reportClientMessage.mockResolvedValue({ success: true, reference: "SIG-0042" })
    view([msg({ id: RECEIVED })])
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Signaler ce message/ }))
    expect(screen.getByRole("dialog", { name: "Signaler un problème" })).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(reportClientMessage).toHaveBeenCalledWith({ messageId: RECEIVED, reason: "other", details: "" })
    expect(screen.getByText("SIG-0042")).toBeTruthy()
  })

  it("transmet l'erreur de l'action à la fenêtre", async () => {
    reportClientMessage.mockResolvedValue({ error: "Limite atteinte." })
    view([msg({ id: RECEIVED })])
    fireEvent.click(screen.getByRole("button", { name: /Signaler ce message/ }))
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(screen.getByRole("alert").textContent).toContain("Limite atteinte.")
  })
})

describe("LocationDialog : recherche de lieu conforme", () => {
  const found = [{ lat: "6.37", lon: "2.39", display_name: "Cotonou, Bénin" }]
  const setup = () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => found }))
    vi.stubGlobal("fetch", fetchMock)
    render(<LocationDialog onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Rechercher un lieu" }))
    return { fetchMock, input: screen.getByRole("searchbox", { name: "Rechercher un lieu" }) }
  }

  it("ne lance aucune requête à la frappe", async () => {
    vi.useFakeTimers()
    const { fetchMock, input } = setup()
    fireEvent.change(input, { target: { value: "Cotonou" } })
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("cherche à la validation, limité au Bénin, avec la mention OpenStreetMap", async () => {
    const { fetchMock, input } = setup()
    fireEvent.change(input, { target: { value: "Cotonou" } })
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain("nominatim.openstreetmap.org/search")
    expect(url).toContain("countrycodes=bj")
    expect(screen.getByRole("button", { name: "Cotonou, Bénin" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "contributeurs OpenStreetMap" }).getAttribute("href")).toBe("https://www.openstreetmap.org/copyright")
  })

  it("le bouton Rechercher est inactif sous 3 caractères et déclenche la recherche", async () => {
    const { fetchMock, input } = setup()
    const button = screen.getByRole("button", { name: "Rechercher" })
    fireEvent.change(input, { target: { value: "Co" } })
    expect(button.disabled).toBe(true)
    fireEvent.change(input, { target: { value: "Cotonou" } })
    await act(async () => {
      fireEvent.click(button)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("espace deux requêtes d'au moins une seconde", async () => {
    vi.useFakeTimers()
    const { fetchMock, input } = setup()
    fireEvent.change(input, { target: { value: "Cotonou" } })
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("annonce un échec de recherche sans planter", async () => {
    const { input } = setup()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    fireEvent.change(input, { target: { value: "Cotonou" } })
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    expect(screen.getByRole("alert").textContent).toContain("Veuillez réessayer")
  })
})
