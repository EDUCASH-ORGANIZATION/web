import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { FAQ_ITEMS } from "./etudiants-faq"

describe("FAQ étudiants : avance du marché", () => {
  const item = FAQ_ITEMS.find((entry) => entry.id === "avance")
  const text = renderToStaticMarkup(item.answer)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#x27;|&#160;| /g, " ")
    .replace(/\s+/g, " ")

  it("répond non et décrit le flux de la carte, hors EduCash", () => {
    expect(item.question).toBe("Dois-je avancer l'argent du marché ?")
    expect(text).toMatch(/^Non\./)
    expect(text).toContain("directement au vendeur, par Mobile Money, hors EduCash")
    expect(text).toContain("n’avancez jamais d’argent")
    expect(text).toContain("carte de paiement d’achats")
    expect(text).toContain("capture du SMS")
    expect(text).toContain("vous confirmez que le vendeur a bien reçu")
  })

  it("rappelle qu'EduCash n'est ni partie, ni dépositaire, ni garant, et ne rembourse pas", () => {
    expect(text).toContain("ni partie, ni dépositaire, ni garant")
    expect(text).toContain("ne rembourse pas un paiement fait hors plateforme")
  })

  it("vouvoie", () => {
    expect(text).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })
})
