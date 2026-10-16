// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { PurchaseReceivedDialog } from "./purchase-received-dialog"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const REQUEST = { vendorName: "Boutique Chez Codjo", amount: 12750 }
const confirmButton = () => screen.getByRole("button", { name: "Oui, reçu par le vendeur" })

function setup(props = {}) {
  const handlers = { onConfirm: vi.fn(async () => ({ ok: true })), onNotReceived: vi.fn(), onClose: vi.fn() }
  const view = render(<PurchaseReceivedDialog request={REQUEST} clientName="Afiavi" {...handlers} {...props} />)
  return { ...view, ...handlers, ...props }
}

describe("feuille « Reçu par le vendeur ? »", () => {
  it("nomme le vendeur et le montant, rappelle de vérifier et que la carte sera verrouillée", () => {
    setup()
    const dialog = screen.getByRole("dialog")
    const text = dialog.textContent.replace(/\s/g, " ")
    expect(screen.getByRole("heading", { name: /Boutique Chez Codjo a bien reçu 12\s750\sFCFA \?/ })).toBeTruthy()
    expect(text).toContain("Vérifiez sur le téléphone du vendeur avant de confirmer.")
    expect(text).toContain("Afiavi, hors EduCash")
    expect(text).toContain("Après confirmation, la carte est verrouillée.")
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it("confirme une seule fois même avec un double clic, puis se ferme", async () => {
    const pending = deferred()
    const onConfirm = vi.fn(() => pending.promise)
    const { onClose } = setup({ onConfirm })
    await act(async () => {
      fireEvent.click(confirmButton())
      fireEvent.click(confirmButton())
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(confirmButton().getAttribute("aria-busy")).toBe("true")
    expect(confirmButton().disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Le vendeur n'a rien reçu" }).disabled).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ ok: true })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("affiche l'erreur et permet de réessayer", async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce({ error: "Cette demande a changé. Rouvrez-la pour continuer." }).mockResolvedValueOnce({ ok: true })
    const { onClose } = setup({ onConfirm })
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("Cette demande a changé")
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("transforme une exception en message vouvoyé", async () => {
    setup({ onConfirm: vi.fn().mockRejectedValue(new Error("réseau")) })
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("Vérifiez votre connexion")
  })

  it("« Le vendeur n'a rien reçu » passe la main au signalement sans confirmer", () => {
    const { onNotReceived, onConfirm } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Le vendeur n'a rien reçu" }))
    expect(onNotReceived).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("se ferme avec Échap et par le bouton de fermeture, sans confirmer", () => {
    const { onClose, onConfirm } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
