// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { PaidDialog, PAID_FALLBACK_ERROR, submitPaidOnce } from "./paid-dialog"
import { PAYMENT_WARNING, PURCHASE_BENEFICIARY_CHECK_LABEL } from "@/lib/purchases/requests"

const ID = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const baseRequest = (overrides = {}) => ({
  id: ID,
  seq: 2,
  status: "pending",
  version: 3,
  amount: 6200,
  vendorName: "Boutique Sœur Odile",
  payeeKind: "personal",
  payeeNumber: "+2290196421841",
  ...overrides,
})

const photo = (name = "sms-momo.jpg", type = "image/jpeg", size = 212 * 1024) => new File([new Uint8Array(size)], name, { type })

function setup({ onSubmit = vi.fn().mockResolvedValue({}), onClose = vi.fn(), request = baseRequest() } = {}) {
  const view = render(<PaidDialog request={request} studentName="Ulrich" onSubmit={onSubmit} onClose={onClose} />)
  return { ...view, onSubmit, onClose }
}

const confirmButton = () => screen.getByRole("button", { name: /Marquer comme payé/ })
const fileInput = () => screen.getByLabelText(/Capture du SMS de confirmation/)
const attach = (file = photo()) => fireEvent.change(fileInput(), { target: { files: [file] } })
const tick = () => screen.getByRole("checkbox", { name: PURCHASE_BENEFICIARY_CHECK_LABEL })

describe("PaidDialog - contenu", () => {
  it("nomme le vendeur, le montant, le bénéficiaire et rappelle l'avertissement", () => {
    setup()
    const dialog = screen.getByRole("dialog", { name: "Vous avez payé Boutique Sœur Odile ?" })
    expect(dialog.textContent).toMatch(/Demande de paiement d'achats N° 2 · 6.200.FCFA/)
    expect(dialog.textContent).toContain("Montant demandé par Ulrich")
    expect(dialog.textContent.replace(/\s/g, " ")).toContain("Boutique Sœur Odile · +229 01 96 42 18 41")
    expect(dialog.querySelector(".c-payreq__warn").textContent).toBe(PAYMENT_WARNING)
  })

  it("a un champ de capture obligatoire, une référence facultative et une case obligatoire", () => {
    setup()
    expect(fileInput().getAttribute("aria-required")).toBe("true")
    expect(screen.getByLabelText(/Référence de la transaction/).getAttribute("maxlength")).toBe("40")
    expect(screen.getByText("(facultatif)")).toBeTruthy()
    expect(tick().required).toBe(true)
    expect(tick().checked).toBe(false)
  })

  it("le bouton de confirmation est le seul bouton encre de la fenêtre et son libellé est « Marquer comme payé »", () => {
    setup()
    expect(confirmButton().className).toContain("btn--dark")
    expect(screen.queryByText(/Confirmer et payer/)).toBeNull()
  })
})

describe("PaidDialog - accessibilité", () => {
  it("est une boîte modale nommée, avec le focus à l'intérieur", () => {
    setup()
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it("Échap ferme la fenêtre sans rien envoyer", () => {
    const { onSubmit, onClose } = setup()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("relie l'aide de la capture à son champ", () => {
    setup()
    const help = document.getElementById(fileInput().getAttribute("aria-describedby").split(" ")[0])
    expect(help.textContent).toMatch(/SMS de MoMo/)
  })
})

describe("PaidDialog - validations", () => {
  it("reste inactif sans capture, sans case, puis s'active avec les deux", () => {
    setup()
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(tick())
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(tick())
    attach()
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(tick())
    expect(confirmButton().disabled).toBe(false)
  })

  it("montre la capture ajoutée et permet de la retirer", () => {
    setup()
    attach(photo("sms-momo-1122.jpg", "image/jpeg", 212 * 1024))
    expect(screen.getByText("sms-momo-1122.jpg")).toBeTruthy()
    expect(screen.getByText(/Ajoutée · 212 Ko/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retirer la capture" }))
    expect(screen.queryByText("sms-momo-1122.jpg")).toBeNull()
    expect(screen.getByRole("button", { name: /Choisir la capture/ })).toBeTruthy()
  })

  it("refuse un format non accepté avec un message, sans activer l'envoi", () => {
    setup()
    fireEvent.click(tick())
    attach(photo("sms.pdf", "application/pdf"))
    expect(screen.getByRole("alert").textContent).toMatch(/Format non accepté/)
    expect(fileInput().getAttribute("aria-invalid")).toBe("true")
    expect(confirmButton().disabled).toBe(true)
  })

  it("refuse un fichier vide ou trop lourd", () => {
    setup()
    attach(photo("vide.jpg", "image/jpeg", 0))
    expect(screen.getByRole("alert").textContent).toMatch(/vide/)
    attach({ name: "gros.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 })
    expect(screen.getByRole("alert").textContent).toMatch(/10 Mo/)
  })

  it("efface l'erreur de fichier quand une capture valide est choisie", () => {
    setup()
    attach(photo("sms.pdf", "application/pdf"))
    attach()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("refuse une référence invalide, accepte les lettres, chiffres et tirets", () => {
    setup()
    attach()
    fireEvent.click(tick())
    const reference = screen.getByLabelText(/Référence de la transaction/)
    fireEvent.change(reference, { target: { value: "MP 0436/1" } })
    expect(screen.getByRole("alert").textContent).toMatch(/lettres, des chiffres et des tirets/)
    expect(reference.getAttribute("aria-invalid")).toBe("true")
    expect(confirmButton().disabled).toBe(true)
    fireEvent.change(reference, { target: { value: "MP-0436-1" } })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(confirmButton().disabled).toBe(false)
    fireEvent.change(reference, { target: { value: "" } })
    expect(confirmButton().disabled).toBe(false)
  })
})

describe("PaidDialog - envoi", () => {
  it("envoie la version lue, la capture, la référence nettoyée et la case cochée, puis ferme", async () => {
    const file = photo()
    const { onSubmit, onClose } = setup()
    attach(file)
    fireEvent.change(screen.getByLabelText(/Référence de la transaction/), { target: { value: "  2610101122451 " } })
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      requestId: ID,
      expectedVersion: 3,
      smsFile: file,
      paidReference: "2610101122451",
      beneficiaryConfirmed: true,
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("envoie une référence nulle quand elle est vide", async () => {
    const { onSubmit } = setup()
    attach()
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(onSubmit.mock.calls[0][0].paidReference).toBeNull()
  })

  it("verrouille le double clic : une seule écriture, bouton occupé, Annuler inactif", async () => {
    const d = deferred()
    const onSubmit = vi.fn(() => d.promise)
    const { onClose } = setup({ onSubmit })
    attach()
    fireEvent.click(tick())
    const button = confirmButton()
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(confirmButton().getAttribute("aria-busy")).toBe("true")
    expect(confirmButton().disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(true)
    await act(async () => d.resolve({}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("garde la saisie et permet de réessayer après une erreur", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce({ error: "Service indisponible." }).mockResolvedValueOnce({})
    const { onClose } = setup({ onSubmit })
    attach(photo("sms-momo.jpg"))
    fireEvent.change(screen.getByLabelText(/Référence de la transaction/), { target: { value: "ABC-1" } })
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("Service indisponible.")
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText("sms-momo.jpg")).toBeTruthy()
    expect(screen.getByLabelText(/Référence de la transaction/).value).toBe("ABC-1")
    expect(tick().checked).toBe(true)
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("traite une exception comme une erreur vouvoyée et conserve la saisie", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("réseau"))
    setup({ onSubmit })
    attach()
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(screen.getByRole("alert").textContent).toContain(PAID_FALLBACK_ERROR)
    expect(PAID_FALLBACK_ERROR).toMatch(/Vérifiez/)
    expect(PAID_FALLBACK_ERROR).not.toMatch(/saisie/i)
  })

  it("Annuler ferme sans rien envoyer", () => {
    const { onSubmit, onClose } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("PaidDialog - demande modifiée entre-temps", () => {
  const ready = (rerenderArgs) => {
    const view = setup()
    attach()
    fireEvent.click(tick())
    expect(confirmButton().disabled).toBe(false)
    view.rerender(<PaidDialog request={rerenderArgs} studentName="Ulrich" onSubmit={view.onSubmit} onClose={view.onClose} />)
    return view
  }

  it("verrouille l'envoi quand la version change, avec le message de version", () => {
    ready(baseRequest({ version: 4, amount: 6800 }))
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Cette demande a changé. Rouvrez-la pour continuer.")
    expect(confirmButton().disabled).toBe(true)
  })

  it("envoie toujours la version ouverte, jamais une version plus récente", async () => {
    const view = setup()
    attach()
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(view.onSubmit.mock.calls[0][0].expectedVersion).toBe(3)
  })

  it("verrouille l'envoi quand la demande n'est plus en attente (annulée)", () => {
    ready(baseRequest({ status: "cancelled" }))
    expect(screen.getByRole("alert").textContent).toContain("Cette demande a changé")
    expect(confirmButton().disabled).toBe(true)
  })

  it("se verrouille quand le serveur répond que la version est périmée", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: "Cette demande a changé. Rouvrez-la pour continuer.", stale: true })
    setup({ onSubmit })
    attach()
    fireEvent.click(tick())
    await act(async () => {
      fireEvent.click(confirmButton())
    })
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(screen.getByRole("alert").textContent).toContain("Cette demande a changé.")
    expect(confirmButton().disabled).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(false)
  })
})

describe("submitPaidOnce", () => {
  it("ignore un appel quand le verrou est posé", async () => {
    const onSubmit = vi.fn()
    expect(await submitPaidOnce({ current: true }, onSubmit, {})).toEqual({ skipped: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("libère le verrou après une erreur et le garde après un succès", async () => {
    const guard = { current: false }
    expect(await submitPaidOnce(guard, async () => ({ error: "x", stale: true }), {})).toEqual({ error: "x", stale: true })
    expect(guard.current).toBe(false)
    expect(await submitPaidOnce(guard, async () => ({}), {})).toEqual({ done: true })
    expect(guard.current).toBe(true)
  })
})
