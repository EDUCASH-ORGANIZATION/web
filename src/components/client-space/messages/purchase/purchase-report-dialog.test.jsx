// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { PurchaseReportDialog } from "./purchase-report-dialog"
import { PURCHASE_NO_REFUND_NOTE, PURCHASE_REPORT_REASONS } from "@/lib/purchases/requests"
import { REPORT_REASONS } from "@/lib/messaging/moderation-rules"

const ID = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"
const request = { id: ID, seq: 2, vendorName: "Boutique Sœur Odile" }

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const open = (onSubmit = vi.fn(), onClose = vi.fn()) => {
  render(<PurchaseReportDialog request={request} onSubmit={onSubmit} onClose={onClose} />)
  return { onSubmit, onClose }
}
const send = () => screen.getByRole("button", { name: "Envoyer le signalement" })
const explain = (value) => fireEvent.change(screen.getByRole("textbox"), { target: { value } })

describe("PurchaseReportDialog", () => {
  it("propose les motifs d'achats et aucun motif de messagerie", () => {
    open()
    expect(screen.getByRole("dialog", { name: "Signaler cette demande" })).toBeTruthy()
    for (const r of PURCHASE_REPORT_REASONS) expect(screen.getByRole("radio", { name: r.label })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Montant différent du ticket" })).toBeTruthy()
    for (const r of REPORT_REASONS.filter((x) => x.value !== "other")) expect(screen.queryByRole("radio", { name: r.label })).toBeNull()
    expect(screen.getAllByRole("radio")).toHaveLength(PURCHASE_REPORT_REASONS.length)
  })

  it("rappelle la demande, l'information de l'autre partie et l'absence de remboursement", () => {
    open()
    const dialog = screen.getByRole("dialog")
    expect(dialog.textContent).toContain("demande N° 2 (Boutique Sœur Odile)")
    expect(dialog.textContent).toContain("L'autre partie sera informée du signalement.")
    expect(dialog.textContent).toContain(PURCHASE_NO_REFUND_NOTE)
    expect(dialog.textContent).not.toContain("ne saura pas qui a signalé")
  })

  it("exige un motif : erreur sous la liste, aucun envoi", () => {
    const { onSubmit } = open()
    fireEvent.click(send())
    expect(screen.getByText("Choisissez un motif.")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    expect(screen.queryByText("Choisissez un motif.")).toBeNull()
  })

  it("exige une explication de 10 caractères au moins", () => {
    const { onSubmit } = open()
    fireEvent.click(screen.getByRole("radio", { name: "Achats non livrés" }))
    explain("court")
    fireEvent.click(send())
    expect(onSubmit).not.toHaveBeenCalled()
    explain("Trop")
    fireEvent.click(send())
    expect(screen.getByText(/Expliquez le problème en 10 à 1000 caractères/)).toBeTruthy()
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true")
    expect(onSubmit).not.toHaveBeenCalled()
    explain("Les articles ne sont pas arrivés")
    expect(screen.queryByText(/Expliquez le problème en/)).toBeNull()
  })

  it("limite l'explication à 1000 caractères avec un compteur", () => {
    open()
    const area = screen.getByRole("textbox")
    expect(area.getAttribute("maxlength")).toBe("1000")
    explain("abcde")
    expect(screen.getByText(/5\s*\/\s*1\s?000/)).toBeTruthy()
  })

  it("envoie { reason, details } puis affiche la référence", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ reference: "SIG-0112" })
    const { onClose } = open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Le vendeur n'a pas reçu l'argent" }))
    explain("  Le vendeur dit qu'il n'a rien reçu  ")
    await act(async () => {
      fireEvent.click(send())
    })
    expect(onSubmit).toHaveBeenCalledWith({ reason: "purchase_vendor_not_paid", details: "Le vendeur dit qu'il n'a rien reçu" })
    expect(screen.getByText("SIG-0112")).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Signalement envoyé" })).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1))
    expect(onClose).toHaveBeenCalled()
  })

  it("verrouille le double clic pendant l'envoi", async () => {
    const d = deferred()
    const onSubmit = vi.fn(() => d.promise)
    open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    explain("Explication suffisante")
    await act(async () => {
      fireEvent.click(send())
      fireEvent.click(send())
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(send().getAttribute("aria-busy")).toBe("true")
    expect(send().disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(true)
    await act(async () => d.resolve({ reference: "SIG-0001" }))
    expect(screen.getByText("SIG-0001")).toBeTruthy()
  })

  it("affiche l'erreur, conserve la saisie et permet de réessayer", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce({ error: "Service indisponible." }).mockResolvedValueOnce({ reference: "SIG-0002" })
    open(onSubmit)
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    explain("Explication suffisante")
    await act(async () => {
      fireEvent.click(send())
    })
    expect(screen.getByRole("alert").textContent).toContain("Service indisponible.")
    expect(screen.getByRole("textbox").value).toBe("Explication suffisante")
    await act(async () => {
      fireEvent.click(send())
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.getByText("SIG-0002")).toBeTruthy()
  })

  it("traite une exception comme une erreur", async () => {
    open(vi.fn().mockRejectedValue(new Error("réseau")))
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))
    explain("Explication suffisante")
    await act(async () => {
      fireEvent.click(send())
    })
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("Annuler ferme la fenêtre", () => {
    const { onClose } = open()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClose).toHaveBeenCalled()
  })
})
