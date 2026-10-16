import { describe, it, expect } from "vitest"
import { PAYMENT_WARNING } from "@/lib/purchases/requests"
import { FAQ_ITEMS } from "./home-content"

describe("FAQ de l'accueil : achats", () => {
  const item = FAQ_ITEMS.find((entry) => entry.id === "achats-marche")

  it("décrit le paiement direct hors EduCash et la capture du SMS", () => {
    expect(item.answer).toMatch(/directement au vendeur, par MoMo, hors EduCash/)
    expect(item.answer).toMatch(/carte de paiement d'achats/)
    expect(item.answer).toMatch(/photo du numéro marchand ou du panneau/)
    expect(item.answer).toMatch(/capture du SMS/)
    expect(item.answer).toMatch(/n'avance jamais d'argent/)
    expect(item.answer).toMatch(/ni partie, ni dépositaire, ni garant/)
    expect(item.answer).toMatch(/Seul le service de l'étudiant passe par le séquestre/)
  })

  it("reprend l'avertissement unique de paiement", () => {
    expect(item.warning).toBe(PAYMENT_WARNING)
  })
})
