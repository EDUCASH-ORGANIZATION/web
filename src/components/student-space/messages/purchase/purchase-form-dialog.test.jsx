// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PURCHASE_ESTIMATE_EXCEEDED_NOTE, PURCHASE_STUDENT_FORM_NOTE, PURCHASE_STUDENT_MONEY_NOTE } from "@/lib/purchases/requests"
import { PurchaseFormDialog } from "./purchase-form-dialog"

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const jpg = (name = "photo.jpg", size = 2048) => new File([new Uint8Array(size)], name, { type: "image/jpeg" })

const sendButton = (name = "Envoyer la demande") => screen.getByRole("button", { name })
const fileInputs = () => [...document.querySelectorAll('input[type="file"]')]
const numberInput = () => screen.getByLabelText(/Numéro à payer/)
const vendorInput = () => screen.getByLabelText(/Nom du vendeur/)
const amountInput = () => screen.getByLabelText(/Montant total/)

function setup(props = {}) {
  const handlers = {
    onUploadPhoto: vi.fn(async ({ kind }) => ({ path: `u/r/${kind}-abcdefgh.jpg`, previewUrl: `blob:${kind}` })),
    onSubmit: vi.fn(async () => ({ ok: true })),
    onClose: vi.fn(),
  }
  const view = render(<PurchaseFormDialog seq={3} clientName="Afiavi" {...handlers} {...props} />)
  return { ...view, ...handlers, ...props }
}

async function addPhoto(index, name) {
  await act(async () => {
    fireEvent.change(fileInputs()[index], { target: { files: [jpg(name)] } })
  })
}

async function fillAll({ number = "4521", vendor = "Poissonnerie Dossa", amount = "6000" } = {}) {
  await addPhoto(0, "panneau.jpg")
  await addPhoto(1, "ticket.jpg")
  fireEvent.change(numberInput(), { target: { value: number } })
  fireEvent.change(vendorInput(), { target: { value: vendor } })
  fireEvent.change(amountInput(), { target: { value: amount } })
}

describe("formulaire vide", () => {
  it("est un dialogue nommé, avec l'avertissement du client et le rappel sur l'argent", () => {
    setup()
    const dialog = screen.getByRole("dialog", { name: "Demander un paiement d'achats" })
    expect(dialog.textContent).toContain("N° 3 · Afiavi")
    expect(dialog.textContent).toContain(PURCHASE_STUDENT_FORM_NOTE)
    expect(dialog.textContent).toContain(PURCHASE_STUDENT_MONEY_NOTE)
    expect(dialog.textContent).toContain("EduCash n'intervient pas dans ce paiement")
  })

  it("garde « Envoyer la demande » inactif sans erreur affichée", () => {
    setup()
    expect(sendButton().disabled).toBe(true)
    expect(screen.queryAllByRole("alert")).toHaveLength(0)
  })

  it("propose le numéro marchand par défaut, en deux choix", () => {
    setup()
    expect(screen.getByRole("button", { name: "Numéro marchand" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Numéro perso" }).getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByRole("group", { name: /Type de numéro/ })).toBeTruthy()
  })

  it("rend les deux zones photo et « Articles » facultatif", () => {
    setup()
    expect(screen.getByRole("group", { name: /Photo du numéro marchand MoMo ou du panneau/ })).toBeTruthy()
    expect(screen.getByRole("group", { name: /Photo du ticket ou des articles/ })).toBeTruthy()
    expect(screen.getByLabelText(/Articles/).required).toBe(false)
    expect(screen.getByText("(facultatif)")).toBeTruthy()
  })

  it("donne le focus au dialogue et se ferme avec Échap", () => {
    const { onClose } = setup()
    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("« Annuler » ferme sans envoyer", () => {
    const { onClose, onSubmit } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("formulaire rempli", () => {
  it("s'active quand les cinq champs obligatoires sont renseignés, et envoie la valeur normalisée", async () => {
    const { onSubmit, onClose, onUploadPhoto } = setup()
    await fillAll()
    expect(onUploadPhoto).toHaveBeenCalledTimes(2)
    expect(onUploadPhoto.mock.calls[0][0]).toMatchObject({ kind: "payee", extension: "jpg" })
    expect(onUploadPhoto.mock.calls[1][0]).toMatchObject({ kind: "ticket", extension: "jpg" })
    expect(screen.getByText("panneau.jpg")).toBeTruthy()
    expect(sendButton().disabled).toBe(false)
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      payeeKind: "merchant",
      payeeNumber: "4521",
      payeePhotoPath: "u/r/payee-abcdefgh.jpg",
      vendorName: "Poissonnerie Dossa",
      items: "",
      amount: 6000,
      ticketPhotoPath: "u/r/ticket-abcdefgh.jpg",
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("accepte un numéro perso, normalisé en +22901XXXXXXXX, et les articles", async () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Numéro perso" }))
    await fillAll({ number: "01 97 12 34 56" })
    fireEvent.change(screen.getByLabelText(/Articles/), { target: { value: "Riz 25 kg" } })
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ payeeKind: "personal", payeeNumber: "+2290197123456", items: "Riz 25 kg" })
  })

  it("redevient inactif si un champ obligatoire est vidé", async () => {
    setup()
    await fillAll()
    fireEvent.change(vendorInput(), { target: { value: "   " } })
    expect(sendButton().disabled).toBe(true)
  })
})

describe("erreurs sous les champs", () => {
  it("signale un champ obligatoire vide après l'avoir quitté, relié au champ", () => {
    setup()
    fireEvent.blur(vendorInput())
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Indiquez le nom du vendeur.")
    expect(vendorInput().getAttribute("aria-invalid")).toBe("true")
    expect(vendorInput().getAttribute("aria-describedby")).toContain(alert.id)
  })

  it("reprend les messages du domaine : montant hors bornes, numéro marchand égal à un téléphone", () => {
    setup()
    fireEvent.change(amountInput(), { target: { value: "50" } })
    fireEvent.blur(amountInput())
    expect(screen.getByRole("alert").textContent).toContain("de 100 à 500 000")
    fireEvent.change(numberInput(), { target: { value: "0197123456" } })
    fireEvent.blur(numberInput())
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toContain("choisissez « Numéro perso »")
  })

  it("refuse un fichier trop lourd ou d'un mauvais format sans l'envoyer, sous la zone photo", async () => {
    const { onUploadPhoto } = setup()
    await act(async () => {
      fireEvent.change(fileInputs()[1], { target: { files: [new File(["x"], "ticket.pdf", { type: "application/pdf" })] } })
    })
    expect(onUploadPhoto).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("Format non accepté")
    await act(async () => {
      fireEvent.change(fileInputs()[0], { target: { files: [jpg("grosse.jpg", 11 * 1024 * 1024)] } })
    })
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toContain("dépasse 10 Mo")
    expect(onUploadPhoto).not.toHaveBeenCalled()
  })

  it("garde la saisie et affiche l'erreur d'un envoi de photo qui échoue", async () => {
    const onUploadPhoto = vi.fn(async () => ({ error: "Photo refusée." }))
    setup({ onUploadPhoto })
    fireEvent.change(vendorInput(), { target: { value: "Tantie Awa" } })
    await addPhoto(0)
    expect(screen.getByRole("alert").textContent).toContain("Photo refusée.")
    expect(vendorInput().value).toBe("Tantie Awa")
    expect(sendButton().disabled).toBe(true)
  })

  it("traite une exception de l'envoi de photo comme une erreur", async () => {
    setup({ onUploadPhoto: vi.fn(async () => { throw new Error("réseau") }) })
    await addPhoto(1)
    expect(screen.getByRole("alert").textContent).toContain("Photo non envoyée")
  })
})

describe("envoi en cours", () => {
  it("occupe le bouton, bloque l'annulation et ignore un second clic", async () => {
    const pending = deferred()
    const onSubmit = vi.fn(() => pending.promise)
    const { onClose } = setup({ onSubmit })
    await fillAll()
    await act(async () => {
      fireEvent.click(sendButton())
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const busy = screen.getByRole("button", { name: "Envoyer la demande" })
    expect(busy.getAttribute("aria-busy")).toBe("true")
    expect(busy.disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Annuler" }).disabled).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ ok: true })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("garde la saisie après un refus du serveur, montre le message et permet de réessayer", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ error: "Cette demande a changé. Rouvrez-la pour continuer.", fieldErrors: { amount: "Montant refusé." } })
      .mockResolvedValueOnce({ ok: true })
    const { onClose } = setup({ onSubmit })
    await fillAll()
    await act(async () => {
      fireEvent.click(sendButton())
    })
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent).join(" ")
    expect(alerts).toContain("Cette demande a changé")
    expect(alerts).toContain("Montant refusé.")
    expect(vendorInput().value).toBe("Poissonnerie Dossa")
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.change(amountInput(), { target: { value: "6500" } })
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("transforme une exception en message vouvoyé et libère le verrou", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("réseau")).mockResolvedValueOnce({ ok: true })
    const { onClose } = setup({ onSubmit })
    await fillAll()
    await act(async () => {
      fireEvent.click(sendButton())
    })
    expect(screen.getByRole("alert").textContent).toContain("Vérifiez votre connexion")
    await act(async () => {
      fireEvent.click(sendButton())
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

describe("modification", () => {
  const initialValues = {
    payeeKind: "personal",
    payeeNumber: "+2290197123456",
    vendorName: "Boutique Chez Codjo",
    items: "Huile 5 L",
    amount: 12750,
    payeePhoto: { path: "u/r/payee-abcdefgh.jpg", previewUrl: "https://exemple.test/p.jpg", name: "panneau.jpg" },
    ticketPhoto: { path: "u/r/ticket-abcdefgh.jpg", previewUrl: null, name: "ticket.jpg" },
  }

  it("préremplit les champs et active l'enregistrement", () => {
    setup({ mode: "edit", initialValues })
    expect(screen.getByRole("dialog", { name: "Modifier la demande de paiement" })).toBeTruthy()
    expect(vendorInput().value).toBe("Boutique Chez Codjo")
    expect(numberInput().value.replace(/\s/g, " ")).toBe("+229 01 97 12 34 56")
    expect(screen.getByRole("button", { name: "Numéro perso" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByText("panneau.jpg")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Reprendre : Photo du ticket ou des articles" })).toBeTruthy()
    expect(sendButton("Enregistrer les modifications").disabled).toBe(false)
  })

  it("envoie les chemins actuels des preuves et le numéro normalisé", async () => {
    const { onSubmit } = setup({ mode: "edit", initialValues })
    await act(async () => {
      fireEvent.click(sendButton("Enregistrer les modifications"))
    })
    expect(onSubmit).toHaveBeenCalledWith({
      payeeKind: "personal",
      payeeNumber: "+2290197123456",
      payeePhotoPath: "u/r/payee-abcdefgh.jpg",
      vendorName: "Boutique Chez Codjo",
      items: "Huile 5 L",
      amount: 12750,
      ticketPhotoPath: "u/r/ticket-abcdefgh.jpg",
    })
  })
})

describe("avertissement d'estimation", () => {
  it("s'affiche sans bloquer quand le total dépasse 1,5 fois l'estimation", async () => {
    setup({ estimate: 10000, otherRequested: 10000 })
    expect(screen.queryByText(PURCHASE_ESTIMATE_EXCEEDED_NOTE)).toBeNull()
    await fillAll({ amount: "6000" })
    expect(screen.getByText(PURCHASE_ESTIMATE_EXCEEDED_NOTE)).toBeTruthy()
    expect(sendButton().disabled).toBe(false)
  })
})

describe("textes", () => {
  it("n'a ni style en ligne ni tiret cadratin", () => {
    const { baseElement } = setup()
    expect(baseElement.querySelector("[style]:not(body)")).toBeNull()
    expect(baseElement.textContent).not.toMatch(/[\u2014\u2013]/)
  })
})
