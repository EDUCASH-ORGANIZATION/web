// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { PAYMENT_WARNING, PURCHASE_NO_REFUND_NOTE, PURCHASE_REVIEWED_LABEL, formatPurchaseAmount } from "@/lib/purchases/requests"
import { PurchaseCard } from "./purchase-card"
import { PurchaseEventLine } from "./purchase-event-line"

// Les vignettes de preuve sont des boutons « Agrandir la photo ... » : les assertions sur les actions les écartent.
const actionButtons = () => screen.queryAllByRole("button").filter((b) => !/^Agrandir/.test(b.getAttribute("aria-label") ?? ""))

const BASE = {
  id: "11111111-1111-4111-8111-111111111111",
  seq: 3,
  status: "pending",
  vendorName: "Poissonnerie Dossa",
  items: "Poisson fumé, crevettes",
  amount: 6000,
  payeeKind: "merchant",
  payeeNumber: "4521",
  payeePhotoUrl: null,
  ticketPhotoUrl: null,
  smsPhotoUrl: null,
  sentAt: "2026-10-08T10:05:00Z",
}

function setup(request = {}, props = {}) {
  const handlers = { onEdit: vi.fn(), onCancel: vi.fn(), onConfirmReceived: vi.fn(), onReport: vi.fn() }
  const view = render(<PurchaseCard request={{ ...BASE, ...request }} clientName="Afiavi" {...handlers} {...props} />)
  return { ...view, ...handlers }
}

// Les espaces insécables des montants et des numéros sont normalisés par Testing Library.
const plain = (text) => text.replace(/\s/g, " ")
const button = (name) => screen.queryByRole("button", { name })

describe("carte En attente de paiement", () => {
  it("affiche le statut, le numéro, le vendeur, le montant formaté et le numéro à payer", () => {
    setup()
    const card = screen.getByRole("group", { name: "Demande de paiement d'achats numéro 3" })
    expect(within(card).getByText("En attente de paiement")).toBeTruthy()
    expect(within(card).getByText("N° 3")).toBeTruthy()
    expect(within(card).getByText("Poissonnerie Dossa")).toBeTruthy()
    expect(within(card).getByText("Poisson fumé, crevettes")).toBeTruthy()
    expect(within(card).getByText(plain(formatPurchaseAmount(6000)))).toBeTruthy()
    expect(within(card).getByText("4521")).toBeTruthy()
    expect(within(card).getByText("Afiavi, hors EduCash")).toBeTruthy()
    expect(within(card).getByText("Numéro marchand MoMo")).toBeTruthy()
    expect(within(card).queryByText("Capture du SMS")).toBeNull()
  })

  it("montre l'avertissement du paiement, modifiable et annulable", () => {
    const { onEdit, onCancel, onReport } = setup()
    expect(screen.getByText(PAYMENT_WARNING)).toBeTruthy()
    fireEvent.click(button("Modifier"))
    fireEvent.click(button("Annuler la demande"))
    fireEvent.click(button("Signaler"))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: BASE.id }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onReport).toHaveBeenCalledTimes(1)
    expect(button("Reçu par le vendeur")).toBeNull()
  })

  it("affiche la photo quand son adresse est fournie, l'icône sinon", () => {
    const { container } = setup({ payeePhotoUrl: "https://exemple.test/p.jpg" })
    expect(container.querySelectorAll("img.e2-07-pic")).toHaveLength(1)
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0)
  })

  it("n'est plus modifiable une fois la mission terminée (Signaler reste possible)", () => {
    setup({}, { missionStatus: "done" })
    expect(button("Modifier")).toBeNull()
    expect(button("Annuler la demande")).toBeNull()
    expect(button("Signaler")).not.toBeNull()
  })

  it("désactive les actions pendant une opération", () => {
    setup({}, { busy: true })
    expect(button("Modifier").disabled).toBe(true)
    expect(button("Annuler la demande").disabled).toBe(true)
  })
})

describe("carte Payé", () => {
  const paid = { status: "paid", paidAt: "2026-10-08T10:02:00Z", smsPhotoUrl: "https://exemple.test/sms.jpg", paidReference: "MP2610-AB12" }

  it("joint la capture du SMS, la référence et propose « Reçu par le vendeur »", () => {
    const { onConfirmReceived, container } = setup(paid)
    expect(screen.getByText("Payé")).toBeTruthy()
    expect(screen.getByText("Capture du SMS")).toBeTruthy()
    expect(screen.getByText("MP2610-AB12")).toBeTruthy()
    expect(container.querySelectorAll("img.e2-07-pic")).toHaveLength(1)
    expect(screen.getByText(/Afiavi a marqué « Payé » à 11:02 avec la capture du SMS/)).toBeTruthy()
    expect(screen.queryByText(PAYMENT_WARNING)).toBeNull()
    expect(button("Modifier")).toBeNull()
    expect(button("Annuler la demande")).toBeNull()
    fireEvent.click(button("Reçu par le vendeur"))
    expect(onConfirmReceived).toHaveBeenCalledTimes(1)
  })

  it("garde la place de la capture même si son adresse manque", () => {
    setup({ ...paid, smsPhotoUrl: null })
    expect(screen.getByText("Capture du SMS")).toBeTruthy()
  })
})

describe("carte Reçu par le vendeur", () => {
  it("est verrouillée : seul « Signaler » reste", () => {
    const { onReport } = setup({ status: "received", receivedAt: "2026-10-08T10:09:00Z", smsPhotoUrl: "https://exemple.test/sms.jpg" })
    expect(screen.getByText("Reçu par le vendeur")).toBeTruthy()
    expect(screen.getByText(/Vous avez confirmé à 11:09 que le vendeur a reçu le paiement/)).toBeTruthy()
    const actions = actionButtons().map((b) => b.textContent)
    expect(actions).toEqual(["Signaler"])
    fireEvent.click(button("Signaler"))
    expect(onReport).toHaveBeenCalledTimes(1)
  })

  it("masque « Signaler » à qui a déjà signalé", () => {
    setup({ status: "received" }, { alreadyReportedByMe: true })
    expect(actionButtons()).toHaveLength(0)
  })
})

describe("carte Signalé", () => {
  const reported = { status: "reported", paidAt: "2026-10-08T10:02:00Z", smsPhotoUrl: "https://exemple.test/sms.jpg", reportReason: "purchase_vendor_not_paid" }

  it("rappelle le motif, l'absence de remboursement et que l'équipe examine", () => {
    setup(reported, { alreadyReportedByMe: true })
    expect(screen.getByText("Signalé")).toBeTruthy()
    const note = screen.getByText(/Vous avez signalé cette demande/)
    expect(note.textContent).toContain("Le vendeur n'a pas reçu l'argent")
    expect(note.textContent).toContain("L'équipe EduCash examine le signalement.")
    expect(note.textContent).toContain(PURCHASE_NO_REFUND_NOTE)
  })

  it("affiche « Examiné par l'équipe EduCash » une fois clos, sans lien mort", () => {
    setup({ ...reported, reviewed: true }, { alreadyReportedByMe: true })
    expect(screen.getByText(new RegExp(PURCHASE_REVIEWED_LABEL))).toBeTruthy()
    expect(button("Voir le signalement")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(button("Signaler")).toBeNull()
  })

  it("propose « Voir le signalement » seulement si le callback est fourni", () => {
    const onViewReport = vi.fn()
    setup(reported, { alreadyReportedByMe: true, onViewReport })
    fireEvent.click(button("Voir le signalement"))
    expect(onViewReport).toHaveBeenCalledTimes(1)
  })

  it("laisse signaler à qui n'a pas encore signalé quand l'autre partie l'a fait", () => {
    setup({ ...reported, reportReason: null })
    expect(screen.getByText(/Cette demande a été signalée/)).toBeTruthy()
    expect(button("Signaler")).not.toBeNull()
  })
})

describe("carte Annulée", () => {
  it("n'a aucune action", () => {
    setup({ status: "cancelled" })
    expect(screen.getByText("Annulée")).toBeTruthy()
    expect(screen.getByText("Cette demande a été annulée.")).toBeTruthy()
    expect(actionButtons()).toHaveLength(0)
  })
})

describe("textes et marquage", () => {
  it("n'utilise ni style en ligne ni tiret cadratin, et le numéro perso est formaté", () => {
    const { container } = setup({ payeeKind: "personal", payeeNumber: "+2290197123456" })
    expect(container.querySelector("[style]")).toBeNull()
    expect(container.textContent).not.toMatch(/[\u2014\u2013]/)
    expect(plain(container.textContent)).toContain("+229 01 97 12 34 56")
    expect(screen.getByText("Numéro MoMo personnel")).toBeTruthy()
  })

  it("sans nom de client, nomme « Le client »", () => {
    render(<PurchaseCard request={BASE} />)
    expect(screen.getByText("Le client, hors EduCash")).toBeTruthy()
  })
})

describe("ligne d'événement", () => {
  it("reprend le texte fixe du serveur, sans nom ni montant", () => {
    render(<PurchaseEventLine event="paid" seq={2} />)
    expect(screen.getByText("La demande N° 2 est marquée « Payé ».")).toBeTruthy()
  })

  it("ne rend rien pour un événement ou un numéro invalide", () => {
    const { container, rerender } = render(<PurchaseEventLine event="inconnu" seq={2} />)
    expect(container.innerHTML).toBe("")
    rerender(<PurchaseEventLine event="paid" seq={0} />)
    expect(container.innerHTML).toBe("")
  })
})
