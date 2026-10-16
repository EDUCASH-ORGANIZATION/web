// @vitest-environment jsdom

// Interactions réelles de l'annulation de mission en deux étapes (voir l'exemple documenté dans
// src/components/app-ui/confirm-dialog.dom.test.jsx).
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"

const { CancelDialog } = await import("./cancel-dialog")

const mission = { title: "Peinture salon" }

function setup(onConfirm = vi.fn().mockResolvedValue({})) {
  const onClose = vi.fn()
  render(<CancelDialog open mission={mission} refundAmount={5000} onClose={onClose} onConfirm={onConfirm} />)
  return { onConfirm, onClose }
}

// Fait avancer l'horloge au-delà de la fenêtre qui tient un clic rapproché pour un double clic.
function pastSettleWindow() {
  const now = Date.now()
  vi.spyOn(Date, "now").mockReturnValue(now + 1000)
}

describe("CancelDialog (interactions réelles)", () => {
  it("l'étape 1 n'appelle rien, le focus est sur « Garder la mission »", () => {
    const { onConfirm, onClose } = setup()
    expect(screen.getByRole("heading", { name: "Annuler cette mission ?" })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Garder la mission" }))
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Confirmer l'annulation" })).toBeTruthy()
  })

  it("à l'étape 2 le focus revient sur le choix sûr", () => {
    setup()
    screen.getByRole("button", { name: "Continuer" }).focus()
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Garder la mission" }))
  })

  it("un double clic sur « Continuer » ne confirme pas l'annulation", () => {
    const { onConfirm } = setup()
    vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const next = screen.getByRole("button", { name: "Continuer" })
    fireEvent.click(next)
    const confirm = screen.getByRole("button", { name: /Oui, annuler et rembourser/ })
    fireEvent.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("l'étape 2 appelle l'action une seule fois malgré un double clic, puis ferme", async () => {
    const { onConfirm, onClose } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    pastSettleWindow()
    const confirm = screen.getByRole("button", { name: /Oui, annuler et rembourser/ })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await act(async () => {})
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("un refus s'affiche en role=alert et la boîte reste ouverte", async () => {
    const { onClose } = setup(vi.fn().mockResolvedValue({ error: "La mission a déjà un prestataire." }))
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    pastSettleWindow()
    fireEvent.click(screen.getByRole("button", { name: /Oui, annuler et rembourser/ }))
    expect((await screen.findByRole("alert")).textContent).toContain("La mission a déjà un prestataire.")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("Échap et « Garder la mission » ferment sans appeler l'action", () => {
    const { onConfirm, onClose } = setup()
    fireEvent.keyDown(document, { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: "Garder la mission" }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
