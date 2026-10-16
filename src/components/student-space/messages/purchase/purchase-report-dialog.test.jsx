// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { PURCHASE_NO_REFUND_NOTE, PURCHASE_REPORT_REASONS } from "@/lib/purchases/requests"
import { PurchaseReportDialog, reportFieldErrors } from "./purchase-report-dialog"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const REQUEST = { id: "11111111-1111-4111-8111-111111111111", seq: 2, vendorName: "Boutique Chez Codjo", amount: 12750, status: "paid" }
const DETAILS = "Codjo me montre son téléphone : aucun paiement reçu depuis ce matin."
const sendButton = () => screen.getByRole("button", { name: "Envoyer le signalement" })

function setup(props = {}) {
  const handlers = { onSubmit: vi.fn(async () => ({ reference: "SIG-0042" })), onClose: vi.fn() }
  const view = render(<PurchaseReportDialog request={REQUEST} {...handlers} {...props} />)
  return { ...view, ...handlers, ...props }
}

function fill(reasonLabel, details = DETAILS) {
  fireEvent.click(screen.getByRole("radio", { name: reasonLabel }))
  fireEvent.change(screen.getByLabelText(/Ce qui s'est passé/), { target: { value: details } })
}

describe("fenêtre « Signaler cette demande »", () => {
  it("propose les motifs d'achats et « Autre », jamais ceux de la messagerie", () => {
    setup()
    const dialog = screen.getByRole("dialog", { name: "Signaler cette demande" })
    const labels = screen.getAllByRole("radio").map((r) => r.closest("label").textContent)
    expect(labels).toEqual(PURCHASE_REPORT_REASONS.map((r) => r.label))
    expect(labels).toContain("Achats non livrés")
    expect(dialog.textContent).not.toContain("Message inapproprié")
  })

  it("rappelle que le paiement hors EduCash n'est pas remboursé, et résume la demande", () => {
    setup()
    const dialog = screen.getByRole("dialog")
    const text = dialog.textContent.replace(/\s/g, " ")
    expect(text).toContain(PURCHASE_NO_REFUND_NOTE)
    expect(text).toContain("Demande de paiement N° 2")
    expect(text).toContain("Boutique Chez Codjo · 12 750 FCFA · Payé")
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it("refuse l'envoi sans motif, avec une erreur reliée au groupe", async () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByLabelText(/Ce qui s'est passé/), { target: { value: DETAILS } })
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).not.toHaveBeenCalled()
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Choisissez un motif de signalement.")
    expect(screen.getByRole("group", { name: /Motif/ }).getAttribute("aria-describedby")).toBe(alert.id)
  })

  it("refuse une explication trop courte avec le message du serveur", async () => {
    const { onSubmit } = setup()
    fill("Montant différent du ticket", "court")
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("10 à 1000 caractères")
  })

  it("envoie le motif d'achats et l'explication nettoyée, puis donne le numéro de suivi", async () => {
    const { onSubmit } = setup()
    fill("Le vendeur n'a pas reçu l'argent", `  ${DETAILS}  `)
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledWith({ reason: "purchase_vendor_not_paid", details: DETAILS })
    expect(screen.getByRole("dialog", { name: "Signalement envoyé" })).toBeTruthy()
    expect(screen.getByText("SIG-0042")).toBeTruthy()
    expect(screen.getByRole("dialog").textContent).toContain(PURCHASE_NO_REFUND_NOTE)
  })

  it("accepte « Autre » (motif commun avec la messagerie)", async () => {
    const { onSubmit } = setup()
    fill("Autre")
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit.mock.calls[0][0].reason).toBe("other")
  })

  it("verrouille l'envoi : un double clic n'envoie qu'un signalement", async () => {
    const pending = deferred()
    const onSubmit = vi.fn(() => pending.promise)
    const { onClose } = setup({ onSubmit })
    fill("Achats non livrés")
    await act(async () => {
      fireEvent.click(sendButton())
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(sendButton().getAttribute("aria-busy")).toBe("true")
    expect(sendButton().disabled).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ reference: null })
    })
    expect(screen.getByRole("dialog", { name: "Signalement envoyé" })).toBeTruthy()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("garde la saisie après une erreur et permet de réessayer", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce({ error: "Vous avez atteint la limite de signalements." }).mockResolvedValueOnce({ reference: "SIG-1" })
    setup({ onSubmit })
    fill("Achats non livrés")
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("limite de signalements")
    expect(screen.getByLabelText(/Ce qui s'est passé/).value).toBe(DETAILS)
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.getByText("SIG-1")).toBeTruthy()
  })

  it("remplace une exception par le message commun de la messagerie", async () => {
    setup({ onSubmit: vi.fn().mockRejectedValue(new Error("réseau")) })
    fill("Achats non livrés")
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("Vérifiez votre connexion")
  })

  it("se ferme sans envoyer par « Annuler »", () => {
    const { onClose, onSubmit } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("n'a ni style en ligne ni tiret cadratin", () => {
    const { baseElement } = setup()
    expect(baseElement.querySelector("[style]:not(body)")).toBeNull()
    expect(baseElement.textContent).not.toMatch(/[\u2014\u2013]/)
  })
})

describe("reportFieldErrors", () => {
  it("valide avec les règles du serveur", () => {
    const base = { requestId: REQUEST.id, reason: "other", details: DETAILS }
    expect(reportFieldErrors(base)).toEqual({})
    expect(reportFieldErrors({ ...base, reason: "message_abuse" }).reason).toBeTruthy()
    expect(reportFieldErrors({ ...base, details: "x".repeat(1001) }).details).toBeTruthy()
  })
})
