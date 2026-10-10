import { describe, expect, it } from "vitest"
import { AIDE_THEMES, ESCROW_STEPS, PAYMENT_WARNING } from "./aide-content"
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
