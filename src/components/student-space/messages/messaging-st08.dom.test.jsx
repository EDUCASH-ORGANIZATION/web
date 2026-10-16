// @vitest-environment jsdom
// @ds-screen RD-STUDENT-01
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendStudentMessage: vi.fn(),
  markStudentConversationRead: vi.fn(async () => ({})),
  getStudentMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/lib/actions/message-report.actions", () => ({ reportStudentMessage: vi.fn() }))
const append = vi.fn()
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append, refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { StudentConversationView } = await import("./conversation-view")
const { Bubble } = await import("./bubble")
const { Composer } = await import("./composer")
const { LocationDialog } = await import("./media-dialogs")
const { sendStudentMessage } = await import("@/lib/actions/message.actions")
const { reportStudentMessage } = await import("@/lib/actions/message-report.actions")
const { CONTACT_WARNING_COPY, MASKED_SENDER_NOTE } = await import("@/lib/messaging/contact-copy")
const { OSM_COPYRIGHT_HREF } = await import("@/lib/messaging/map-links")

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const msg = (over) => ({
  id: "m1", mine: false, type: "text", content: "Bonjour", mediaUrl: null, lat: null, lng: null,
  createdAt: "2026-10-13T09:00:00Z", read: false, ...over,
})
const conversation = (over = {}) => ({
  userId: "22222222-2222-4222-8222-222222222221",
  missionId: "11111111-1111-4111-8111-111111111111",
  clientId: "33333333-3333-4333-8333-333333333331",
  client: { id: "c", name: "Rosine H.", avatarUrl: null },
  mission: { title: "Cours de maths", status: "open" },
  state: "in_progress",
  canWrite: true,
  messages: [msg()],
  ...over,
})
const type = (box, value) => fireEvent.change(box, { target: { value } })

describe("composeur étudiant : avertissement", () => {
  it("affiche l'avertissement sous le champ quand le texte contient une coordonnée, sans bloquer l'envoi", () => {
    render(<Composer onSend={vi.fn()} />)
    expect(screen.queryByRole("status")).toBeNull()
    type(screen.getByLabelText("Votre message"), "Appelez-moi au 01 97 12 34 56")
    expect(screen.getByRole("status").textContent).toBe(CONTACT_WARNING_COPY)
    expect(screen.getByLabelText("Envoyer").disabled).toBeFalsy()
  })

  it("rend le focus au champ après l'envoi", () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} />)
    const box = screen.getByLabelText("Votre message")
    type(box, "Bonjour")
    fireEvent.click(screen.getByLabelText("Envoyer"))
    expect(onSend).toHaveBeenCalledWith({ type: "text", content: "Bonjour" })
    expect(document.activeElement).toBe(box)
  })
})

describe("conversation étudiant : mention, note de masquage", () => {
  it("affiche la mention d'analyse une fois, y compris sans message", () => {
    render(<StudentConversationView conversation={conversation({ messages: [] })} now="2026-10-13T12:00:00Z" />)
    expect(screen.getAllByText(/analysés automatiquement/)).toHaveLength(1)
  })

  it("indique que des coordonnées ont été masquées, sans jamais montrer la valeur", async () => {
    sendStudentMessage.mockResolvedValue({
      success: true,
      message: msg({ id: "m2", mine: true, content: "Appelez le ****" }),
      contactMasked: { kinds: ["phone"] },
    })
    render(<StudentConversationView conversation={conversation()} now="2026-10-13T12:00:00Z" />)
    type(screen.getByLabelText("Votre message"), "Appelez le 01 97 12 34 56")
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Envoyer"))
    })
    const notes = screen.getAllByRole("status").filter((n) => n.textContent === MASKED_SENDER_NOTE)
    expect(notes).toHaveLength(1)
    expect(document.body.textContent).not.toContain("97 12 34 56")
  })
})

describe("bouton Signaler", () => {
  it("présent sur un message reçu, absent sur un message envoyé ou en échec", () => {
    const onReport = vi.fn()
    const { rerender } = render(<Bubble message={msg()} senderName="Rosine H." onReport={onReport} />)
    fireEvent.click(screen.getByRole("button", { name: "Signaler ce message de Rosine H." }))
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }))
    rerender(<Bubble message={msg({ mine: true })} senderName="Rosine H." onReport={onReport} />)
    expect(screen.queryByText("Signaler")).toBeNull()
    rerender(<Bubble message={msg({ mine: true })} senderName="Rosine H." status="failed" error="x" onReport={onReport} />)
    expect(screen.queryByText("Signaler")).toBeNull()
  })

  it("ouvre le dialogue et appelle reportStudentMessage au contrat { reason, details }", async () => {
    reportStudentMessage.mockResolvedValue({ success: true, reference: "SIG-0007" })
    render(<StudentConversationView conversation={conversation()} now="2026-10-13T12:00:00Z" />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Signaler ce message de Rosine H." }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("radio")[0])
    await act(async () => {
      fireEvent.click(screen.getByText("Envoyer le signalement"))
    })
    expect(reportStudentMessage).toHaveBeenCalledWith(expect.objectContaining({ messageId: "m1", reason: expect.any(String), details: "" }))
    expect(screen.getByText("SIG-0007")).toBeTruthy()
  })

  it("traite une réponse vide comme un échec (message de repli)", async () => {
    reportStudentMessage.mockResolvedValue({})
    render(<StudentConversationView conversation={conversation()} now="2026-10-13T12:00:00Z" />)
    fireEvent.click(screen.getByRole("button", { name: "Signaler ce message de Rosine H." }))
    fireEvent.click(screen.getAllByRole("radio")[0])
    await act(async () => {
      fireEvent.click(screen.getByText("Envoyer le signalement"))
    })
    expect(screen.getByRole("alert").textContent).toContain("Vérifiez votre connexion")
  })

  it("affiche l'erreur de l'action", async () => {
    reportStudentMessage.mockResolvedValue({ error: "Vous avez déjà signalé ce message." })
    render(<StudentConversationView conversation={conversation()} now="2026-10-13T12:00:00Z" />)
    fireEvent.click(screen.getByRole("button", { name: "Signaler ce message de Rosine H." }))
    fireEvent.click(screen.getAllByRole("radio")[0])
    await act(async () => {
      fireEvent.click(screen.getByText("Envoyer le signalement"))
    })
    expect(screen.getByText(/déjà signalé/)).toBeTruthy()
  })
})

describe("position partagée", () => {
  it("rend les liens Google Maps et jamais OpenStreetMap", () => {
    render(<Bubble message={msg({ type: "location", lat: 6.37, lng: 2.39 })} senderName="Rosine H." />)
    expect(screen.getByText("Ouvrir dans Google Maps").closest("a").getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=6.37,2.39")
    expect(screen.getByText("Itinéraire").closest("a").getAttribute("rel")).toBe("noopener noreferrer")
    expect(document.body.innerHTML).not.toContain("openstreetmap.org")
  })
})

describe("LocationDialog : recherche de lieu", () => {
  const openSearch = () => {
    render(<LocationDialog onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Rechercher un lieu"))
    return screen.getByLabelText("Rechercher un lieu", { selector: "input" })
  }
  const answer = (data) => vi.fn(async () => ({ ok: true, json: async () => data }))

  it("ne lance aucune requête à la frappe, seulement à Entrée ou au bouton, limitée au Bénin", async () => {
    const fetchMock = answer([{ lat: "6.37", lon: "2.39", display_name: "Cotonou" }])
    vi.stubGlobal("fetch", fetchMock)
    const input = openSearch()
    type(input, "Cotonou")
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700))
    })
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain("countrycodes=bj")
    expect(fetchMock.mock.calls[0][0]).toContain("q=Cotonou")
    expect(screen.getByText("Cotonou")).toBeTruthy()
  })

  it("refuse une requête trop courte sans appel réseau", () => {
    const fetchMock = answer([])
    vi.stubGlobal("fetch", fetchMock)
    const input = openSearch()
    type(input, "Co")
    fireEvent.click(screen.getByText("Rechercher", { selector: "button" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("au moins 3")
  })

  it("espace deux recherches d'au moins une seconde", async () => {
    const fetchMock = answer([])
    vi.stubGlobal("fetch", fetchMock)
    const input = openSearch()
    type(input, "Cotonou")
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" })
    })
    vi.useFakeTimers()
    fireEvent.keyDown(input, { key: "Enter" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("affiche la mention OpenStreetMap avec son lien", () => {
    openSearch()
    const link = screen.getByText("contributeurs OpenStreetMap").closest("a")
    expect(link.getAttribute("href")).toBe(OSM_COPYRIGHT_HREF)
  })
})
