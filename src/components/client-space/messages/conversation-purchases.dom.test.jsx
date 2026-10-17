// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(async () => ({})),
  getClientMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/lib/actions/message-report.actions", () => ({ reportClientMessage: vi.fn() }))
vi.mock("@/lib/actions/purchase-request.actions", () => ({
  markPurchasePaid: vi.fn(),
  reportPurchaseRequestAsClient: vi.fn(),
  getClientPurchaseRequests: vi.fn(),
}))
const realtime = { onPurchaseMessage: null }
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages, onPurchaseMessage }) => {
    realtime.onPurchaseMessage = onPurchaseMessage
    return { messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }
  },
  useMessageMediaUpload: () => vi.fn(),
}))
const uploadProof = vi.fn()
vi.mock("@/hooks/use-purchase-proof-upload", () => ({ usePurchaseProofUpload: () => uploadProof }))

const { ConversationView } = await import("./conversation-view")
const { markPurchasePaid, reportPurchaseRequestAsClient, getClientPurchaseRequests } = await import("@/lib/actions/purchase-request.actions")
const { PURCHASE_ESTIMATE_EXCEEDED_NOTE, PURCHASE_BENEFICIARY_CHECK_LABEL, PAYMENT_WARNING } = await import("@/lib/purchases/requests")
const { PURCHASE_FALLBACK_TEXT } = await import("./bubble")

const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const R1 = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"
const R2 = "7a2d3b63-9a4f-4d2e-8b66-1e4c7f5b8d21"
const PATH = `client-1/${R1}/sms-abcdef1234567890.jpg`

const msg = (over) => ({
  id: "m1",
  mine: false,
  type: "text",
  content: "Bonjour",
  purchaseRequestId: null,
  mediaUrl: null,
  lat: null,
  lng: null,
  createdAt: "2026-10-13T09:00:00Z",
  read: true,
  ...over,
})
const cardMessage = (requestId, id = `card-${requestId}`) =>
  msg({ id, type: "purchase_request", content: "Demande de paiement", purchaseRequestId: requestId })

const request = (over = {}) => ({
  id: R1,
  seq: 2,
  status: "pending",
  version: 3,
  amount: 6200,
  vendorName: "Boutique Sœur Odile",
  items: "Riz 5 kg, huile",
  payeeKind: "personal",
  payeeNumber: "+2290196421841",
  payeePhotoUrl: "https://signed.example/payee-1.jpg",
  ticketPhotoUrl: "https://signed.example/ticket-1.jpg",
  smsPhotoUrl: null,
  createdAt: "2026-10-13T09:15:00Z",
  editedAt: null,
  paidAt: null,
  receivedAt: null,
  paidReference: null,
  alreadyReportedByMe: false,
  reportReason: null,
  reportReference: null,
  reviewed: false,
  ...over,
})

const conversation = (over = {}) => ({
  userId: "client-1",
  missionId: M1,
  studentId: S1,
  student: { id: S1, name: "Ulrich Z.", avatarUrl: null },
  mission: { title: "Courses", status: "in_progress", budget: 5000, purchasesEstimate: 7450 },
  relation: "selected",
  state: "in_progress",
  canWrite: true,
  completionAvailable: true,
  completionDeclaredAt: null,
  messages: [cardMessage(R1)],
  purchasesAvailable: true,
  purchaseRequests: [request()],
  ...over,
})

const view = (over, props = {}) =>
  render(<ConversationView conversation={conversation(over)} now="2026-10-13T12:00:00Z" paymentsEnabled {...props} />)

const photo = (name = "sms-momo.jpg", type = "image/jpeg", size = 212 * 1024) => new File([new Uint8Array(size)], name, { type })
const openPaid = () => fireEvent.click(screen.getByRole("button", { name: "Marquer comme payé, demande N° 2" }))
const confirmButton = () => screen.getByRole("button", { name: /Marquer comme payé$/ })
const fillPaid = () => {
  fireEvent.change(screen.getByLabelText(/Capture du SMS de confirmation/), { target: { files: [photo()] } })
  fireEvent.click(screen.getByRole("checkbox", { name: PURCHASE_BENEFICIARY_CHECK_LABEL }))
}
const flush = () => act(async () => {})

beforeEach(() => {
  vi.clearAllMocks()
  uploadProof.mockResolvedValue({ path: PATH })
  markPurchasePaid.mockResolvedValue({ success: true })
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {})
})

describe("C13 : rendu des messages d'achats", () => {
  it("rend la carte de la demande trouvée par purchaseRequestId", () => {
    view()
    const card = screen.getByRole("article", { name: /Demande de paiement d'achats N° 2, Boutique Sœur Odile/ })
    expect(card).toBeTruthy()
    expect(within(card).getByRole("button", { name: "Marquer comme payé, demande N° 2" })).toBeTruthy()
    expect(screen.queryByText(PURCHASE_FALLBACK_TEXT)).toBeNull()
  })

  it("rend deux cartes pour deux demandes, chacune avec ses données", () => {
    view({
      messages: [cardMessage(R1), cardMessage(R2)],
      purchaseRequests: [request(), request({ id: R2, seq: 3, vendorName: "Ets Chez Maman", amount: 7450, status: "received", paidAt: "2026-10-13T09:40:00Z", receivedAt: "2026-10-13T09:50:00Z" })],
    })
    expect(screen.getAllByRole("article")).toHaveLength(2)
    expect(screen.getByRole("article", { name: /N° 3, Ets Chez Maman/ })).toBeTruthy()
  })

  it("affiche une ligne neutre quand la demande est absente de la lecture", () => {
    view({ purchaseRequests: [] })
    expect(screen.getByText(PURCHASE_FALLBACK_TEXT)).toBeTruthy()
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.queryByRole("button", { name: /Payé/ })).toBeNull()
  })

  it("affiche une ligne neutre quand la lecture des demandes est indisponible", () => {
    view({ purchasesAvailable: false, purchaseRequests: [] })
    expect(screen.getByText(PURCHASE_FALLBACK_TEXT)).toBeTruthy()
  })

  it("rend la ligne système d'un purchase_event", () => {
    view({
      messages: [msg({ id: "ev", type: "purchase_event", content: "Le client a indiqué avoir payé la demande N° 2.", purchaseRequestId: R1 })],
    })
    expect(screen.getByText("Le client a indiqué avoir payé la demande N° 2.")).toBeTruthy()
  })

  it("sans achats : aucune carte, aucun bouton « Payé », bandeau et fil inchangés", () => {
    view({ messages: [msg({})], purchasesAvailable: false, purchaseRequests: [], mission: { title: "Courses", status: "in_progress", budget: 5000 } })
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.queryByText(/paiement d'achats/)).toBeNull()
    expect(screen.getByRole("link", { name: /Confirmer la fin/ }).className).toContain("btn--dark")
    expect(screen.getByText("Bonjour")).toBeTruthy()
  })

  it("sans le champ purchaseRequests (lecture sans achats) : rendu sans erreur", () => {
    view({ messages: [msg({})], purchasesAvailable: undefined, purchaseRequests: undefined })
    expect(screen.getByText("Bonjour")).toBeTruthy()
  })

  it("l'avertissement « EduCash n'intervient pas » n'est que sur la carte en attente", () => {
    view({
      messages: [cardMessage(R1), cardMessage(R2)],
      purchaseRequests: [request(), request({ id: R2, seq: 3, status: "received", paidAt: "2026-10-13T09:40:00Z", receivedAt: "2026-10-13T09:50:00Z" })],
    })
    const warnings = document.querySelectorAll(".c-payreq__warn")
    expect(warnings).toHaveLength(1)
    expect(warnings[0].textContent).toBe(PAYMENT_WARNING)
  })

  it("signale le dépassement de l'estimation (D2) sans bloquer le bouton", () => {
    view({ mission: { title: "Courses", status: "in_progress", budget: 5000, purchasesEstimate: 3000 } })
    expect(screen.getByText(PURCHASE_ESTIMATE_EXCEEDED_NOTE)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Marquer comme payé, demande N° 2" })).toBeTruthy()
  })

  it("pas d'avertissement de dépassement sous 1,5 fois l'estimation", () => {
    view()
    expect(screen.queryByText(PURCHASE_ESTIMATE_EXCEEDED_NOTE)).toBeNull()
  })

  it("?demande= fait défiler jusqu'à la carte sans rien exécuter", () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    view({}, { focusRequestId: R1 })
    expect(scrollIntoView).toHaveBeenCalled()
    expect(markPurchasePaid).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
    delete Element.prototype.scrollIntoView
  })
})

describe("C13 : bandeau et bouton encre unique", () => {
  it("demande en attente : « Confirmer la fin » passe en contour, « Payé » reste le seul bouton encre", () => {
    view()
    const finish = screen.getByRole("link", { name: /Confirmer la fin/ })
    expect(finish.className).toContain("btn--secondary")
    expect(finish.className).not.toContain("btn--dark")
    const dark = [...document.querySelectorAll(".btn--dark")].map((b) => b.textContent.trim())
    expect(dark).toEqual(["Payé"])
  })

  it("aucune demande en attente : « Confirmer la fin » reste le bouton encre", () => {
    view({ purchaseRequests: [request({ status: "received", paidAt: "2026-10-13T09:40:00Z", receivedAt: "2026-10-13T09:50:00Z" })] })
    expect(screen.getByRole("link", { name: /Confirmer la fin/ }).className).toContain("btn--dark")
  })

  it("demande payée ou reçue : achats payés en direct dans le bandeau, sans l'estimation", () => {
    view({ purchaseRequests: [request({ status: "received", amount: 7450, paidAt: "2026-10-13T09:40:00Z", receivedAt: "2026-10-13T09:50:00Z" })] })
    const text = document.querySelector(".chat-status__text--long").textContent.replace(/\s/g, "")
    expect(text).toContain("5000FCFAenséquestrepourleservice")
    expect(text).toContain("achatspayésendirect:7450FCFA")
    expect(text).not.toContain("achatsestimés")
  })

  it("aucun achat payé : l'estimation reste affichée", () => {
    view()
    const text = document.querySelector(".chat-status__text--long").textContent.replace(/\s/g, "")
    expect(text).toContain("achatsestimés:environ7450FCFA")
    expect(text).not.toContain("payésendirect")
  })

  it("fin déclarée par l'étudiant : le bandeau « À confirmer » reste intact", () => {
    view({ completionDeclaredAt: "2026-10-12T09:30:00+01:00" })
    expect(screen.getByText("À confirmer")).toBeTruthy()
    expect(screen.getByText(/indique avoir terminé le/)).toBeTruthy()
  })

  it("mission terminée : pas de bouton « Confirmer la fin », « Payé » reste possible (D5)", () => {
    view({ state: "done", canWrite: false, mission: { title: "Courses", status: "done", budget: 5000, purchasesEstimate: 7450 } })
    expect(screen.queryByRole("link", { name: /Confirmer la fin/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Marquer comme payé, demande N° 2" })).toBeTruthy()
  })
})

describe("C13 : « Payé »", () => {
  it("ouvre la fenêtre, téléverse la capture puis enregistre le paiement avec la version lue", async () => {
    view()
    openPaid()
    const dialog = screen.getByRole("dialog", { name: "Vous avez payé Boutique Sœur Odile ?" })
    expect(dialog.closest("form, p, .item2")).toBeNull()
    fillPaid()
    fireEvent.change(screen.getByLabelText(/Référence de la transaction/), { target: { value: "MP-0436-1" } })
    fireEvent.click(confirmButton())
    await flush()
    expect(uploadProof).toHaveBeenCalledTimes(1)
    expect(uploadProof.mock.calls[0][0]).toMatchObject({ requestId: R1, kind: "sms" })
    expect(uploadProof.mock.calls[0][0].file.name).toBe("sms-momo.jpg")
    expect(markPurchasePaid).toHaveBeenCalledTimes(1)
    expect(markPurchasePaid).toHaveBeenCalledWith({
      requestId: R1,
      expectedVersion: 3,
      smsPhotoPath: PATH,
      beneficiaryConfirmed: true,
      paidReference: "MP-0436-1",
    })
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("référence vide : envoyée absente (null)", async () => {
    view()
    openPaid()
    fillPaid()
    fireEvent.click(confirmButton())
    await flush()
    expect(markPurchasePaid.mock.calls[0][0].paidReference).toBeNull()
  })

  it("double clic : un seul téléversement et un seul enregistrement", async () => {
    let release
    markPurchasePaid.mockReturnValue(new Promise((resolve) => (release = resolve)))
    view()
    openPaid()
    fillPaid()
    const button = confirmButton()
    fireEvent.click(button)
    fireEvent.click(button)
    await flush()
    expect(uploadProof).toHaveBeenCalledTimes(1)
    expect(markPurchasePaid).toHaveBeenCalledTimes(1)
    await act(async () => release({ success: true }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("version périmée : message de relecture, carte relue, fenêtre verrouillée", async () => {
    markPurchasePaid.mockResolvedValue({ error: "Cette demande a été modifiée. Relisez-la avant de payer.", stale: true })
    view()
    openPaid()
    fillPaid()
    fireEvent.click(confirmButton())
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Relisez la demande")
    expect(alert.textContent).toContain("Cette demande a été modifiée. Relisez-la avant de payer.")
    expect(confirmButton().disabled).toBe(true)
  })

  it("échec du téléversement : message clair, capture conservée, aucun enregistrement", async () => {
    uploadProof.mockResolvedValue({ error: "La photo n'a pas pu être téléversée. Vérifiez votre connexion et réessayez : vos informations sont conservées." })
    view()
    openPaid()
    fillPaid()
    fireEvent.click(confirmButton())
    await flush()
    expect(markPurchasePaid).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("n'a pas pu être téléversée")
    expect(screen.getByText("sms-momo.jpg")).toBeTruthy()
    expect(confirmButton().disabled).toBe(false)
  })

  it("erreur du serveur (non périmée) : message affiché, nouvelle tentative possible", async () => {
    markPurchasePaid.mockResolvedValueOnce({ error: "Cette demande a déjà été annulée." })
    view()
    openPaid()
    fillPaid()
    fireEvent.click(confirmButton())
    await flush()
    expect(screen.getByRole("alert").textContent).toContain("Cette demande a déjà été annulée.")
    expect(refresh).not.toHaveBeenCalled()
    fireEvent.click(confirmButton())
    await flush()
    expect(markPurchasePaid).toHaveBeenCalledTimes(2)
  })

  it("sans capture ou sans case cochée, rien n'est envoyé", () => {
    view()
    openPaid()
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: PURCHASE_BENEFICIARY_CHECK_LABEL }))
    expect(confirmButton().disabled).toBe(true)
    expect(uploadProof).not.toHaveBeenCalled()
  })

  it("« Annuler » ferme sans rien écrire", () => {
    view()
    openPaid()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(markPurchasePaid).not.toHaveBeenCalled()
  })
})

describe("C13 : signalement", () => {
  const openReport = () => fireEvent.click(screen.getByRole("button", { name: "Signaler la demande N° 2" }))

  it("signale la demande avec le motif et l'explication, affiche le numéro de suivi", async () => {
    reportPurchaseRequestAsClient.mockResolvedValue({ success: true, reference: "SIG-0042" })
    view()
    openReport()
    const dialog = screen.getByRole("dialog", { name: "Signaler cette demande" })
    expect(dialog.closest("form, p, .item2")).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Achats non livrés" }))
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Les articles ne sont pas arrivés" } })
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    await flush()
    expect(reportPurchaseRequestAsClient).toHaveBeenCalledWith({
      requestId: R1,
      reason: "purchase_items_not_delivered",
      details: "Les articles ne sont pas arrivés",
    })
    expect(screen.getByText("SIG-0042")).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
  })

  it("erreur du serveur : message affiché, aucun rafraîchissement", async () => {
    reportPurchaseRequestAsClient.mockResolvedValue({ error: "Vous avez déjà signalé cette demande." })
    view()
    openReport()
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Explication suffisante ici" } })
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }))
    await flush()
    expect(screen.getByRole("alert").textContent).toContain("Vous avez déjà signalé cette demande.")
    expect(refresh).not.toHaveBeenCalled()
  })

  it("double clic sur l'envoi : un seul signalement", async () => {
    let release
    reportPurchaseRequestAsClient.mockReturnValue(new Promise((resolve) => (release = resolve)))
    view()
    openReport()
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Explication suffisante ici" } })
    const send = screen.getByRole("button", { name: "Envoyer le signalement" })
    fireEvent.click(send)
    fireEvent.click(send)
    await flush()
    expect(reportPurchaseRequestAsClient).toHaveBeenCalledTimes(1)
    await act(async () => release({ success: true, reference: "SIG-0001" }))
  })

  it("une demande déjà signalée par le client n'offre plus « Signaler »", () => {
    view({ purchaseRequests: [request({ status: "reported", paidAt: "2026-10-13T09:40:00Z", alreadyReportedByMe: true })] })
    expect(screen.queryByRole("button", { name: "Signaler la demande N° 2" })).toBeNull()
  })
})

describe("C13 : temps réel et photos", () => {
  it("un message d'achat reçu relit les demandes (router.refresh)", () => {
    view()
    expect(typeof realtime.onPurchaseMessage).toBe("function")
    act(() => realtime.onPurchaseMessage(cardMessage(R2)))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("une adresse de photo expirée est renouvelée une seule fois par photo", async () => {
    getClientPurchaseRequests.mockResolvedValue({
      available: true,
      requests: [request({ payeePhotoUrl: "https://signed.example/payee-2.jpg" })],
    })
    view()
    const before = document.querySelector('img[src="https://signed.example/payee-1.jpg"]')
    expect(before).toBeTruthy()
    fireEvent.error(before)
    await flush()
    expect(getClientPurchaseRequests).toHaveBeenCalledWith({ missionId: M1 })
    const after = document.querySelector('img[src="https://signed.example/payee-2.jpg"]')
    expect(after).toBeTruthy()
    fireEvent.error(after)
    await flush()
    expect(getClientPurchaseRequests).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Photo indisponible")).toBeTruthy()
  })

  it("renouvellement avec la visionneuse ouverte : elle reste ouverte et affiche la nouvelle image", async () => {
    getClientPurchaseRequests.mockResolvedValue({
      available: true,
      requests: [request({ payeePhotoUrl: "https://signed.example/payee-2.jpg" })],
    })
    view()
    fireEvent.click(screen.getAllByRole("button", { name: /^Agrandir la photo/ })[0])
    const viewerImg = screen.getByRole("dialog").querySelector("img")
    expect(viewerImg.getAttribute("src")).toBe("https://signed.example/payee-1.jpg")
    fireEvent.error(viewerImg)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelector("img").getAttribute("src")).toBe("https://signed.example/payee-2.jpg")
    expect(getClientPurchaseRequests).toHaveBeenCalledTimes(1)
  })

  it("relecture en échec : la photo reste signalée indisponible, sans erreur", async () => {
    getClientPurchaseRequests.mockResolvedValue({ error: "Impossible de charger." })
    view()
    fireEvent.error(document.querySelector('img[src="https://signed.example/ticket-1.jpg"]'))
    await flush()
    expect(screen.getByText("Photo indisponible")).toBeTruthy()
  })

  it("relecture qui lève : aucune erreur non gérée", async () => {
    getClientPurchaseRequests.mockRejectedValue(new Error("réseau"))
    view()
    fireEvent.error(document.querySelector('img[src="https://signed.example/ticket-1.jpg"]'))
    await flush()
    expect(screen.getByText("Photo indisponible")).toBeTruthy()
  })
})

describe("C13 : vocabulaire", () => {
  it("jamais « vous touchez »", () => {
    view()
    const text = document.body.textContent.toLowerCase()
    expect(text).not.toContain("vous touchez")
  })
})
