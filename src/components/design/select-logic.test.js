import { describe, expect, it } from "vitest"
import {
  choosePlacement, firstEnabled, initialActive, keyIntent, lastEnabled, moveActive, nextBuffer, typeaheadIndex,
} from "./select-logic"

const options = [
  { value: "", label: "Toutes les villes" },
  { value: "c", label: "Cotonou" },
  { value: "x", label: "Ouidah (bientôt)", disabled: true },
  { value: "p", label: "Porto-Novo" },
  { value: "a", label: "Abomey-Calavi" },
  { value: "co", label: "Come" },
]

describe("navigation", () => {
  it("trouve la première et la dernière option activable", () => {
    expect(firstEnabled(options)).toBe(0)
    expect(lastEnabled(options)).toBe(5)
    expect(firstEnabled([{ value: "a", label: "A", disabled: true }])).toBe(-1)
  })

  it("ouvre sur la valeur choisie, sinon sur la première option", () => {
    expect(initialActive(options, "p")).toBe(3)
    expect(initialActive(options, "inconnu")).toBe(0)
    expect(initialActive(options, "x")).toBe(0)
  })

  it("saute les options désactivées et ne boucle pas", () => {
    expect(moveActive(options, 1, 1)).toBe(3)
    expect(moveActive(options, 3, -1)).toBe(1)
    expect(moveActive(options, 5, 1)).toBe(5)
    expect(moveActive(options, 0, -1)).toBe(0)
    expect(moveActive(options, -1, 1)).toBe(0)
    expect(moveActive(options, -1, -1)).toBe(5)
  })
})

describe("recherche par lettre", () => {
  it("va à la première option qui commence par la lettre", () => {
    expect(typeaheadIndex(options, 0, "p")).toBe(3)
    expect(typeaheadIndex(options, 0, "A")).toBe(4)
  })

  it("répéter la même lettre fait défiler les options", () => {
    expect(typeaheadIndex(options, 1, "cc")).toBe(5)
    expect(typeaheadIndex(options, 5, "cc")).toBe(1)
  })

  it("une saisie de plusieurs lettres cherche le préfixe", () => {
    expect(typeaheadIndex(options, 1, "com")).toBe(5)
    expect(typeaheadIndex(options, 1, "cot")).toBe(1)
  })

  it("ignore les options désactivées et garde l'option active sans résultat", () => {
    expect(typeaheadIndex(options, 3, "o")).toBe(3)
    expect(typeaheadIndex(options, 3, "z")).toBe(3)
  })

  it("remet le tampon à zéro après le délai", () => {
    const first = nextBuffer(null, "c", 1000)
    expect(nextBuffer(first, "o", 1200).text).toBe("co")
    expect(nextBuffer(first, "o", 2000).text).toBe("o")
  })
})

describe("intentions clavier", () => {
  const k = (key, extra = {}) => keyIntent({ key, open: false, ...extra })
  const ko = (key, extra = {}) => keyIntent({ key, open: true, ...extra })

  it("ouvre la liste fermée", () => {
    expect(k("Enter")).toBe("open")
    expect(k(" ")).toBe("open")
    expect(k("ArrowDown", { altKey: true })).toBe("open")
    expect(k("ArrowDown")).toBe("open")
    expect(k("Home")).toBe("open-first")
    expect(k("End")).toBe("open-last")
    expect(k("c")).toBe("open-type")
    expect(k("Tab")).toBe("none")
    expect(k("Escape")).toBe("none")
  })

  it("pilote la liste ouverte", () => {
    expect(ko("ArrowDown")).toBe("next")
    expect(ko("ArrowUp")).toBe("prev")
    expect(ko("ArrowUp", { altKey: true })).toBe("select")
    expect(ko("Home")).toBe("first")
    expect(ko("End")).toBe("last")
    expect(ko("Enter")).toBe("select")
    expect(ko(" ")).toBe("select")
    expect(ko("Escape")).toBe("close")
    expect(ko("Tab")).toBe("tab")
    expect(ko("p")).toBe("type")
  })

  it("traite l'espace comme une lettre pendant une saisie", () => {
    expect(ko(" ", { typing: true })).toBe("type")
    expect(k(" ", { typing: true })).toBe("type")
  })

  it("ignore les raccourcis avec Ctrl ou Meta", () => {
    expect(ko("c", { ctrlKey: true })).toBe("none")
    expect(k("Enter", { metaKey: true })).toBe("none")
  })
})

describe("placement", () => {
  const base = { viewportWidth: 390, viewportHeight: 800, count: 4 }

  it("ouvre vers le bas s'il y a de la place", () => {
    const rect = { left: 16, right: 120, top: 100, bottom: 140 }
    expect(choosePlacement({ ...base, rect })).toEqual({ vertical: "bottom", horizontal: "start", maxHeight: null })
  })

  it("ouvre vers le haut s'il n'y a pas la place en bas", () => {
    const rect = { left: 16, right: 120, top: 700, bottom: 740 }
    expect(choosePlacement({ ...base, rect }).vertical).toBe("top")
  })

  it("reste en bas, plafonnée, quand la place suffit sans contenir toute la liste", () => {
    const rect = { left: 56, right: 160, top: 650, bottom: 688 }
    const placement = choosePlacement({ ...base, viewportWidth: 1440, viewportHeight: 900, count: 5, rect })
    expect(placement.vertical).toBe("bottom")
    expect(placement.maxHeight).toBe(900 - 688 - 8 - 6)
  })

  it("ne plafonne pas la liste quand elle tient en entier", () => {
    const rect = { left: 16, right: 120, top: 100, bottom: 140 }
    expect(choosePlacement({ ...base, rect }).maxHeight).toBeNull()
  })

  it("plafonne la liste au-dessus à la place disponible en haut", () => {
    const rect = { left: 16, right: 120, top: 150, bottom: 190 }
    const placement = choosePlacement({ ...base, viewportHeight: 230, count: 8, rect })
    expect(placement.vertical).toBe("top")
    expect(placement.maxHeight).toBe(150 - 8 - 6)
  })

  it("reste en bas si le haut est encore plus étroit", () => {
    const rect = { left: 16, right: 120, top: 20, bottom: 60 }
    expect(choosePlacement({ ...base, rect, viewportHeight: 100, count: 8 }).vertical).toBe("bottom")
  })

  it("aligne sur la fin quand la liste déborderait à droite", () => {
    const rect = { left: 300, right: 374, top: 100, bottom: 140 }
    expect(choosePlacement({ ...base, rect }).horizontal).toBe("end")
  })

  it("garde le début si l'alignement sur la fin déborderait à gauche", () => {
    const rect = { left: 100, right: 160, top: 100, bottom: 140 }
    expect(choosePlacement({ ...base, rect, viewportWidth: 300 }).horizontal).toBe("start")
  })
})
