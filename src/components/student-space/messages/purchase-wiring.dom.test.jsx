// @vitest-environment jsdom
// @ds-screen RD-STUDENT-01
// Câblage de l'écran E07 (ST-10) : bouton ticket, cartes et fenêtres de demande de paiement d'achats, relecture.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => router }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendStudentMessage: vi.fn(),
  markStudentConversationRead: vi.fn(async () => ({})),
  getStudentMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/lib/actions/message-report.actions", () => ({ reportStudentMessage: vi.fn() }))
vi.mock("@/lib/actions/purchase-request.actions", () => ({
  createPurchaseRequest: vi.fn(),
  editPurchaseRequest: vi.fn(),
  cancelPurchaseRequest: vi.fn(),
  confirmPurchaseReceived: vi.fn(),
  reportPurchaseRequestAsStudent: vi.fn(),
}))
const realtime = vi.hoisted(() => ({ options: null }))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: (options) => {
    realtime.options = options
    return { messages: options.initialMessages, append: vi.fn(), refreshMedia: vi.fn() }
  },
  useMessageMediaUpload: () => vi.fn(),
}))
const NEW_ID = "99999999-9999-4999-8999-999999999999"
const upload = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-purchase-proof-upload", () => ({ usePurchaseProofUpload: () => upload }))

const { StudentConversationView } = await import("./conversation-view")
const actions = await import("@/lib/actions/purchase-request.actions")
const { purchaseMessageContent } = await import("@/lib/purchases/requests")

const M1 = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222221"
const CLIENT = "33333333-3333-4333-8333-333333333331"
const R1 = "44444444-4444-4444-8444-444444444441"
const NOW = "2026-10-13T12:00:00Z"

const REQUEST = {
  id: R1,
  seq: 2,
  status: "pending",
  version: 1,
  amount: 12750,
  vendorName: "Boutique Chez Codjo",
  items: "Huile 5 L",
  payeeKind: "merchant",
  payeeNumber: "4521",
  payeePhotoUrl: "https://example.supabase.co/sign/payee",
  ticketPhotoUrl: "https://example.supabase.co/sign/ticket",
  smsPhotoUrl: null,
  payeePhotoPath: `${STUDENT}/${R1}/payee-abcdefgh.jpg`,
  ticketPhotoPath: `${STUDENT}/${R1}/ticket-abcdefgh.jpg`,
  sentAt: "2026-10-13T09:41:00Z",
  alreadyReportedByMe: false,
}
const text = (over) => ({
  id: "t1", mine: false, type: "text", content: "Bonjour", mediaUrl: null, lat: null, lng: null,
  createdAt: "2026-10-13T09:00:00Z", read: true, ...over,
})
const cardMessage = (over) => ({
  id: "p1", mine: true, type: "purchase_request", content: purchaseMessageContent("purchase_request", 2),
  mediaUrl: null, lat: null, lng: null, purchaseRequestId: R1, createdAt: "2026-10-13T09:41:00Z", read: true, ...over,
})
const eventMessage = (event, over) => ({
  id: `e-${event}`, mine: false, type: "purchase_event", content: purchaseMessageContent("purchase_event", 2, event),
  mediaUrl: null, lat: null, lng: null, purchaseRequestId: R1, createdAt: "2026-10-13T11:02:00Z", read: true, ...over,
})
const conversation = (over = {}) => ({
  userId: STUDENT,
  missionId: M1,
  clientId: CLIENT,
  client: { id: CLIENT, name: "Afiavi D.", avatarUrl: null },
  mission: { title: "Courses du mois", status: "in_progress", budget: 8000, net: 7040, purchasesEstimate: 7450 },
  state: "in_progress",
  canWrite: true,
  messages: [text(), cardMessage()],
  purchasesAvailable: true,
  purchaseCanCreate: true,
  purchaseRequests: [REQUEST],
  purchaseTotals: { count: 1, requested: 12750, paid: 0, pending: 12750, reported: 0 },
  ...over,
})
const show = (conv, props = {}) => render(<StudentConversationView conversation={conv} now={NOW} {...props} />)

const ticketButton = () => screen.queryByRole("button", { name: "Demander un paiement d'achats" })
const jpg = (name) => new File([new Uint8Array(2048)], name, { type: "image/jpeg" })
const fileInputs = () => [...document.querySelectorAll('input[type="file"]')].filter((i) => i.getAttribute("aria-label")?.startsWith("Photo"))

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function fillCreateForm() {
  await act(async () => {
    fireEvent.change(fileInputs()[0], { target: { files: [jpg("panneau.jpg")] } })
  })
  await act(async () => {
    fireEvent.change(fileInputs()[1], { target: { files: [jpg("ticket.jpg")] } })
  })
  fireEvent.change(screen.getByLabelText(/Numéro à payer/), { target: { value: "4521" } })
  fireEvent.change(screen.getByLabelText(/Nom du vendeur/), { target: { value: "Poissonnerie Dossa" } })
  fireEvent.change(screen.getByLabelText(/Montant total/), { target: { value: "6000" } })
}

beforeEach(() => {
  upload.mockImplementation(async ({ kind }) => ({ path: `${STUDENT}/${NEW_ID}/${kind}-abcdefgh.jpg` }))
  vi.spyOn(crypto, "randomUUID").mockReturnValue(NEW_ID)
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("bouton ticket du composeur", () => {
  it("visible pour l'étudiant retenu d'une mission en cours quand la fonction est disponible", () => {
    show(conversation())
    expect(ticketButton()).toBeTruthy()
    expect(screen.getByRole("button", { name: "Partager une position" })).toBeTruthy()
  })

  it.each([
    ["fonction indisponible", { purchasesAvailable: false }],
    ["création impossible (candidat, mission pas en cours, limite)", { purchaseCanCreate: false }],
    ["champs absents (script 94 non appliqué)", { purchasesAvailable: undefined, purchaseCanCreate: undefined, purchaseRequests: undefined }],
    ["conversation en lecture seule", { canWrite: false, state: "done", mission: { title: "x", status: "done", purchasesEstimate: 7450 } }],
  ])("absent : %s", (_label, over) => {
    show(conversation(over))
    expect(ticketButton()).toBeNull()
  })

  it("sans achats : outils du composeur inchangés (image, position), aucune carte", () => {
    const { container } = show(conversation({ purchasesAvailable: false, purchaseRequests: [], messages: [text()] }))
    const tools = container.querySelector(".composer__tools")
    expect([...tools.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Joindre une image", "Partager une position"])
    expect(tools.innerHTML).not.toContain("i-receipt")
    expect(container.querySelector(".e-achat")).toBeNull()
  })

  it("ouvre le formulaire de création, une seule fois même avec un double clic", () => {
    show(conversation())
    fireEvent.click(ticketButton())
    fireEvent.click(ticketButton())
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    const dialog = screen.getByRole("dialog", { name: "Demander un paiement d'achats" })
    expect(dialog.textContent).toContain("N° 3 · Afiavi D.")
    expect(dialog.closest("form")).toBeNull()
  })
})

describe("création d'une demande", () => {
  it("téléverse les deux photos sous l'identifiant client, puis appelle createPurchaseRequest et relit", async () => {
    actions.createPurchaseRequest.mockResolvedValue({ success: true, request: { id: NEW_ID } })
    show(conversation())
    fireEvent.click(ticketButton())
    await fillCreateForm()
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls[0][0]).toMatchObject({ requestId: NEW_ID, kind: "payee" })
    expect(upload.mock.calls[1][0]).toMatchObject({ requestId: NEW_ID, kind: "ticket" })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
    })
    expect(actions.createPurchaseRequest).toHaveBeenCalledTimes(1)
    expect(actions.createPurchaseRequest).toHaveBeenCalledWith({
      missionId: M1,
      requestId: NEW_ID,
      payeeKind: "merchant",
      payeeNumber: "4521",
      payeePhotoPath: `${STUDENT}/${NEW_ID}/payee-abcdefgh.jpg`,
      vendorName: "Poissonnerie Dossa",
      items: "",
      amount: 6000,
      ticketPhotoPath: `${STUDENT}/${NEW_ID}/ticket-abcdefgh.jpg`,
    })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Votre demande a été envoyée à Afiavi D.").textContent).toBeTruthy()
  })

  it("un téléversement refusé affiche une erreur sous la zone photo et n'appelle pas l'action", async () => {
    upload.mockResolvedValue({ error: "Photo non envoyée. Vérifiez votre connexion et réessayez." })
    show(conversation())
    fireEvent.click(ticketButton())
    await act(async () => {
      fireEvent.change(fileInputs()[0], { target: { files: [jpg("panneau.jpg")] } })
    })
    expect(screen.getByRole("alert").textContent).toContain("Photo non envoyée. Vérifiez votre connexion et réessayez.")
    expect(actions.createPurchaseRequest).not.toHaveBeenCalled()
  })

  it("échec du serveur : la saisie est conservée, aucune relecture de succès, et le renvoi réutilise le même identifiant", async () => {
    actions.createPurchaseRequest
      .mockResolvedValueOnce({ error: "Une erreur est survenue. Veuillez réessayer dans un instant." })
      .mockResolvedValueOnce({ success: true })
    show(conversation())
    fireEvent.click(ticketButton())
    await fillCreateForm()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
    })
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("Une erreur est survenue. Veuillez réessayer dans un instant.")
    expect(screen.getByLabelText(/Nom du vendeur/).value).toBe("Poissonnerie Dossa")
    expect(screen.queryByText(/Votre demande a été envoyée/)).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
    })
    expect(actions.createPurchaseRequest).toHaveBeenCalledTimes(2)
    expect(actions.createPurchaseRequest.mock.calls[1][0].requestId).toBe(NEW_ID)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("un double clic sur « Envoyer la demande » n'appelle l'action qu'une fois", async () => {
    const pending = deferred()
    actions.createPurchaseRequest.mockReturnValue(pending.promise)
    show(conversation())
    fireEvent.click(ticketButton())
    await fillCreateForm()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
    })
    expect(actions.createPurchaseRequest).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Envoyer la demande" }).getAttribute("aria-busy")).toBe("true")
    await act(async () => {
      pending.resolve({ success: true })
    })
    expect(actions.createPurchaseRequest).toHaveBeenCalledTimes(1)
  })

  it("une réponse sans succès explicite est traitée comme une erreur", async () => {
    actions.createPurchaseRequest.mockResolvedValue(undefined)
    show(conversation())
    fireEvent.click(ticketButton())
    await fillCreateForm()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }))
    })
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("L'opération n'a pas abouti. Vérifiez votre connexion et réessayez.")
  })
})

describe("rendu des messages d'achat", () => {
  it("rend la carte de la demande, avec ses actions, sans « Signaler ce message »", () => {
    show(conversation())
    const card = screen.getByRole("group", { name: "Demande de paiement d'achats numéro 2" })
    expect(within(card).getByText("Boutique Chez Codjo")).toBeTruthy()
    for (const name of ["Modifier", "Annuler la demande", "Signaler"]) expect(within(card).getByRole("button", { name })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Signaler ce message de Afiavi D\.$/ })).toBeTruthy()
    expect(within(card).queryByRole("button", { name: /Signaler ce message/ })).toBeNull()
    expect(document.getElementById(`demande-${R1}`).contains(card)).toBe(true)
  })

  it("rend une ligne système pour chaque événement connu", () => {
    show(conversation({ messages: [cardMessage(), eventMessage("paid")], purchaseRequests: [{ ...REQUEST, status: "paid" }] }))
    expect(screen.getByText("La demande N° 2 est marquée « Payé ».")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Signaler ce message/ })).toBeNull()
  })

  it("carte dont la demande est absente : ligne neutre, ni bouton ni détail", () => {
    show(conversation({ purchaseRequests: [], purchasesAvailable: false }))
    expect(screen.getByText("Demande de paiement d'achats : détails momentanément indisponibles.")).toBeTruthy()
    expect(document.querySelector(".e-achat")).toBeNull()
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull()
  })

  it("ligne système dont la demande est absente ou au texte inconnu : ligne neutre, contenu non repris", () => {
    show(
      conversation({
        purchaseRequests: [],
        messages: [eventMessage("paid", { content: "Texte étranger 01 97 12 34 56" })],
      }),
    )
    expect(screen.getByText("Mise à jour d'une demande de paiement")).toBeTruthy()
    expect(document.body.textContent).not.toContain("97 12 34 56")
  })

  it("mission terminée : « Reçu par le vendeur » et « Signaler » restent, plus de modification", () => {
    const paid = { ...REQUEST, status: "paid", paidAt: "2026-10-13T11:02:00Z" }
    show(
      conversation({
        canWrite: false,
        state: "done",
        mission: { title: "Courses du mois", status: "done", purchasesEstimate: 7450 },
        purchaseCanCreate: false,
        purchaseRequests: [paid],
      }),
    )
    expect(ticketButton()).toBeNull()
    expect(screen.getByRole("button", { name: "Reçu par le vendeur" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Signaler" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Annuler la demande" })).toBeNull()
  })

  it("« Signaler » disparaît quand l'étudiant a déjà signalé la demande", () => {
    show(conversation({ purchaseRequests: [{ ...REQUEST, status: "reported", alreadyReportedByMe: true }] }))
    expect(screen.queryByRole("button", { name: "Signaler" })).toBeNull()
  })
})

describe("modification", () => {
  it("rouvre le formulaire en mode edit avec les valeurs actuelles et envoie la version lue", async () => {
    actions.editPurchaseRequest.mockResolvedValue({ success: true })
    show(conversation())
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    const dialog = screen.getByRole("dialog", { name: "Modifier la demande de paiement" })
    expect(dialog.textContent).toContain("N° 2")
    expect(screen.getByLabelText(/Nom du vendeur/).value).toBe("Boutique Chez Codjo")
    expect(screen.getByLabelText(/Articles/).value).toBe("Huile 5 L")
    fireEvent.change(screen.getByLabelText(/Nom du vendeur/), { target: { value: "Chez Codjo" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }))
    })
    expect(actions.editPurchaseRequest).toHaveBeenCalledWith({
      requestId: R1,
      expectedVersion: 1,
      payeeKind: "merchant",
      payeeNumber: "4521",
      payeePhotoPath: REQUEST.payeePhotoPath,
      vendorName: "Chez Codjo",
      items: "Huile 5 L",
      amount: 12750,
      ticketPhotoPath: REQUEST.ticketPhotoPath,
    })
    expect(actions.createPurchaseRequest).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(router.refresh).toHaveBeenCalled()
    expect(screen.getByText("Votre demande a été modifiée.")).toBeTruthy()
  })

  it("une demande devenue périmée : l'erreur du serveur est affichée et la page est relue", async () => {
    actions.editPurchaseRequest.mockResolvedValue({ error: "Cette demande a changé. Rouvrez-la pour continuer.", stale: true })
    show(conversation())
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    fireEvent.change(screen.getByLabelText(/Nom du vendeur/), { target: { value: "Chez Codjo" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }))
    })
    expect(screen.getByRole("alert").textContent).toContain("Cette demande a changé. Rouvrez-la pour continuer.")
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })
})

describe("annulation", () => {
  it("demande une confirmation, « Garder la demande » n'annule rien", () => {
    show(conversation())
    fireEvent.click(screen.getByRole("button", { name: "Annuler la demande" }))
    expect(screen.getByRole("dialog", { name: "Annuler cette demande de paiement ?" })).toBeTruthy()
    expect(actions.cancelPurchaseRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Garder la demande" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(actions.cancelPurchaseRequest).not.toHaveBeenCalled()
  })

  it("confirmer appelle cancelPurchaseRequest une seule fois (double clic), relit et confirme", async () => {
    const pending = deferred()
    actions.cancelPurchaseRequest.mockReturnValue(pending.promise)
    show(conversation())
    fireEvent.click(screen.getByRole("button", { name: "Annuler la demande" }))
    const confirm = () => within(screen.getByRole("dialog")).getByRole("button", { name: /Annuler la demande|Envoi en cours/ })
    await act(async () => {
      fireEvent.click(confirm())
      fireEvent.click(confirm())
    })
    expect(actions.cancelPurchaseRequest).toHaveBeenCalledTimes(1)
    expect(actions.cancelPurchaseRequest).toHaveBeenCalledWith({ requestId: R1, expectedVersion: 1 })
    await act(async () => {
      pending.resolve({ success: true })
    })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Votre demande a été annulée.")).toBeTruthy()
  })

  it("une erreur du serveur reste affichée dans la confirmation", async () => {
    actions.cancelPurchaseRequest.mockResolvedValue({ error: "Cette action n'est plus possible pour cette demande." })
    show(conversation())
    fireEvent.click(screen.getByRole("button", { name: "Annuler la demande" }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Annuler la demande" }))
    })
    expect(screen.getByRole("dialog").textContent).toContain("Cette action n'est plus possible pour cette demande.")
  })
})

describe("réception", () => {
  const paid = { ...REQUEST, status: "paid", paidAt: "2026-10-13T11:02:00Z", version: 2 }

  it("« Reçu par le vendeur » ouvre la confirmation puis appelle confirmPurchaseReceived avec la version", async () => {
    actions.confirmPurchaseReceived.mockResolvedValue({ success: true })
    show(conversation({ purchaseRequests: [paid] }))
    fireEvent.click(screen.getByRole("button", { name: "Reçu par le vendeur" }))
    expect(screen.getByRole("dialog").textContent).toContain("Boutique Chez Codjo a bien reçu")
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Oui, reçu par le vendeur" }))
    })
    expect(actions.confirmPurchaseReceived).toHaveBeenCalledWith({ requestId: R1, expectedVersion: 2 })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it("« Le vendeur n'a rien reçu » remplace la confirmation par le signalement, sans rien confirmer", () => {
    show(conversation({ purchaseRequests: [paid] }))
    fireEvent.click(screen.getByRole("button", { name: "Reçu par le vendeur" }))
    fireEvent.click(screen.getByRole("button", { name: "Le vendeur n'a rien reçu" }))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(screen.getByRole("dialog", { name: "Signaler cette demande" })).toBeTruthy()
    expect(actions.confirmPurchaseReceived).not.toHaveBeenCalled()
  })
})

describe("signalement", () => {
  const DETAILS = "Codjo me montre son téléphone : aucun paiement reçu depuis ce matin."
  const open = () => {
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }))
    fireEvent.click(screen.getByRole("radio", { name: "Achats non livrés" }))
    fireEvent.change(screen.getByLabelText(/Ce qui s'est passé/), { target: { value: DETAILS } })
  }

  it("appelle reportPurchaseRequestAsStudent au contrat { requestId, reason, details } et affiche le suivi", async () => {
    actions.reportPurchaseRequestAsStudent.mockResolvedValue({ success: true, reference: "SIG-0042" })
    show(conversation())
    open()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(actions.reportPurchaseRequestAsStudent).toHaveBeenCalledTimes(1)
    expect(actions.reportPurchaseRequestAsStudent).toHaveBeenCalledWith({
      requestId: R1,
      reason: "purchase_items_not_delivered",
      details: DETAILS,
    })
    expect(screen.getByText("SIG-0042")).toBeTruthy()
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it("un double clic n'envoie qu'un signalement", async () => {
    const pending = deferred()
    actions.reportPurchaseRequestAsStudent.mockReturnValue(pending.promise)
    show(conversation())
    open()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(actions.reportPurchaseRequestAsStudent).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve({ success: true, reference: "SIG-0042" })
    })
  })

  it("une erreur du serveur est affichée, la saisie conservée, sans relecture", async () => {
    actions.reportPurchaseRequestAsStudent.mockResolvedValue({ error: "Votre signalement n'a pas pu être envoyé. Veuillez réessayer." })
    show(conversation())
    open()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    })
    expect(screen.getByRole("dialog").textContent).toContain("Votre signalement n'a pas pu être envoyé. Veuillez réessayer.")
    expect(screen.getByLabelText(/Ce qui s'est passé/).value).toBe(DETAILS)
    expect(router.refresh).not.toHaveBeenCalled()
  })
})

describe("relecture et drapeaux d'URL", () => {
  it("un message d'achat reçu en direct relit la page, les rafales sont regroupées", () => {
    vi.useFakeTimers()
    show(conversation())
    expect(typeof realtime.options.onPurchaseMessage).toBe("function")
    act(() => realtime.options.onPurchaseMessage({ id: "x" }))
    expect(router.refresh).toHaveBeenCalledTimes(1)
    act(() => {
      realtime.options.onPurchaseMessage({ id: "y" })
      realtime.options.onPurchaseMessage({ id: "z" })
    })
    expect(router.refresh).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(500))
    expect(router.refresh).toHaveBeenCalledTimes(2)
    act(() => vi.advanceTimersByTime(1000))
    expect(router.refresh).toHaveBeenCalledTimes(2)
  })

  it("?achat=nouveau ouvre le formulaire sans rien envoyer", () => {
    show(conversation(), { initialAction: "new" })
    expect(screen.getByRole("dialog", { name: "Demander un paiement d'achats" })).toBeTruthy()
    expect(actions.createPurchaseRequest).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it("?achat=nouveau n'ouvre rien quand la création est impossible", () => {
    show(conversation({ purchaseCanCreate: false }), { initialAction: "new" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("?demande=<id> fait défiler jusqu'à la carte, sans action", () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    show(conversation(), { focusRequestId: R1 })
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0].id).toBe(`demande-${R1}`)
    expect(screen.queryByRole("dialog")).toBeNull()
    delete Element.prototype.scrollIntoView
  })

  it("?demande=<id> inconnu : rien ne se passe", () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    show(conversation(), { focusRequestId: "55555555-5555-4555-8555-555555555555" })
    expect(scroll).not.toHaveBeenCalled()
    delete Element.prototype.scrollIntoView
  })
})
