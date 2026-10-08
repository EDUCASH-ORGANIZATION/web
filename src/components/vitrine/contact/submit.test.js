import { describe, expect, it, vi } from "vitest"
import { SEND_FAILED_MESSAGE, formatCount, submitContact } from "./submit"

const form = () => new FormData()

describe("submitContact", () => {
  it("renvoie success seulement quand l'action serveur confirme", async () => {
    const send = vi.fn().mockResolvedValue({ status: "success" })
    const data = form()
    expect(await submitContact(data, send)).toEqual({ status: "success" })
    expect(send).toHaveBeenCalledWith(data)
  })

  it("transmet les erreurs de champ du serveur", async () => {
    const send = vi.fn().mockResolvedValue({ status: "invalid", fieldErrors: { email: "Invalide" } })
    expect(await submitContact(form(), send)).toEqual({ status: "invalid", fieldErrors: { email: "Invalide" } })
  })

  it("transmet le message d'erreur du serveur", async () => {
    const send = vi.fn().mockResolvedValue({ status: "error", message: "Echec" })
    expect(await submitContact(form(), send)).toEqual({ status: "error", message: "Echec" })
  })

  it("ramene une exception a un etat error, sans success", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network"))
    expect(await submitContact(form(), send)).toEqual({ status: "error", message: SEND_FAILED_MESSAGE })
  })

  it("ramene une reponse inattendue a un etat error", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    expect((await submitContact(form(), send)).status).toBe("error")
  })
})

describe("formatCount", () => {
  it("formate le compteur avec espace insecable fine", () => {
    expect(formatCount(7, 1000)).toBe("7 / 1 000")
  })
})
