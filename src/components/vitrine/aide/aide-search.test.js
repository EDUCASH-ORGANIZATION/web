import { describe, expect, it } from "vitest"
import { AIDE_THEMES, ESCROW_STEPS, PAYMENT_WARNING } from "./aide-content"
import { PURCHASE_NO_REFUND_NOTE } from "@/lib/purchases/requests"
import { filterThemes, normalize } from "./aide-search"

const ids = (themes) => themes.flatMap((theme) => theme.items.map((item) => item.id))

describe("normalize", () => {
  it("retire les accents et passe en minuscules", () => {
    expect(normalize("  Vérification Étudiante ")).toBe("verification etudiante")
  })
})

describe("filterThemes", () => {
  it("renvoie tous les thèmes pour une requête vide ou blanche", () => {
    expect(filterThemes(AIDE_THEMES, "")).toBe(AIDE_THEMES)
    expect(filterThemes(AIDE_THEMES, "   ")).toBe(AIDE_THEMES)
  })

  it("ignore les accents et la casse", () => {
    expect(ids(filterThemes(AIDE_THEMES, "VERIFICATION"))).toContain("carte-pourquoi")
    expect(ids(filterThemes(AIDE_THEMES, "etudiante"))).toContain("carte-pourquoi")
  })

  it("trouve la question achats avec « momo »", () => {
    expect(ids(filterThemes(AIDE_THEMES, "momo"))).toContain("achats")
  })

  it("exige tous les mots de la requête", () => {
    const result = ids(filterThemes(AIDE_THEMES, "retirer momo"))
    expect(result).toContain("retrait-momo")
    expect(filterThemes(AIDE_THEMES, "momo zzzz")).toEqual([])
  })

  it("retire les thèmes sans résultat et renvoie une liste vide si rien ne correspond", () => {
    const themes = filterThemes(AIDE_THEMES, "carte")
    expect(themes.every((theme) => theme.items.length > 0)).toBe(true)
    expect(themes.map((theme) => theme.id)).not.toContain("retraits")
    expect(filterThemes(AIDE_THEMES, "zzzz")).toEqual([])
  })
})

describe("contenu de l'aide", () => {
  it("expose les cinq thèmes ancrés et la question achats dans le séquestre", () => {
    expect(AIDE_THEMES.map((theme) => theme.id)).toEqual(["sequestre", "retraits", "verification", "missions", "compte"])
    const sequestre = AIDE_THEMES.find((theme) => theme.id === "sequestre")
    const achats = sequestre.items.find((item) => item.id === "achats")
    expect(achats.notice).toBe(PAYMENT_WARNING)
    expect(PAYMENT_WARNING).toContain("Vérifiez le nom du bénéficiaire affiché par MoMo")
  })

  it("décrit le modèle des achats : paiement direct hors EduCash, carte, capture du SMS, confirmation", () => {
    const sequestre = AIDE_THEMES.find((theme) => theme.id === "sequestre")
    const achats = sequestre.items.find((item) => item.id === "achats")
    const text = [...achats.answer, ...achats.steps.flatMap((s) => [s.title, s.text])].join(" ")
    expect(achats.steps).toHaveLength(3)
    expect(text).toMatch(/directement au vendeur/)
    expect(text).toMatch(/hors EduCash/)
    expect(text).toMatch(/n'avancez jamais d'argent/)
    expect(text).toMatch(/ni partie, ni dépositaire, ni garant/)
    expect(text).toMatch(/numéro à payer/)
    expect(text).toMatch(/photo du numéro marchand ou du panneau/)
    expect(text).toMatch(/photo du ticket/)
    expect(text).toMatch(/capture du SMS/)
    expect(text).toMatch(/confirmez la réception/)
    expect(text).toMatch(/ne bloque aucun fonds et ne porte aucune commission/)
  })

  it("explique le signalement d'un paiement d'achats sans promettre de remboursement", () => {
    const sequestre = AIDE_THEMES.find((theme) => theme.id === "sequestre")
    const probleme = sequestre.items.find((item) => item.id === "achats-probleme")
    expect(probleme.notice).toBe(PURCHASE_NO_REFUND_NOTE)
    expect(probleme.answer.join(" ")).toMatch(/signalée/)
    expect(probleme.answer.join(" ")).toMatch(/ni remboursement ni compensation/)
    expect(ids(filterThemes(AIDE_THEMES, "rembourse signale"))).toContain("achats-probleme")
  })

  it("a des identifiants de question uniques", () => {
    const all = ids(AIDE_THEMES)
    expect(new Set(all).size).toBe(all.length)
  })

  it("ne nomme pas le prestataire de paiement et évite le vocabulaire banni", () => {
    const text = JSON.stringify([AIDE_THEMES, ESCROW_STEPS])
    expect(text).not.toMatch(/fedapay|livraison|coursier|saisie\b|\bcourses?\b/i)
    expect(text).not.toContain('"/clients"')
  })
})
