import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { parseColorTokens, contrastRatio } from "@/lib/design/contrast"

const dir = path.join(import.meta.dirname)
const read = (name) => readFileSync(path.join(dir, name), "utf8")
const tokensCss = read("tokens.css")
const t = parseColorTokens(tokensCss)

describe("palette de la charte EduCash v1.0", () => {
  it("expose les 5 couleurs de la charte et l'alias --c-vert", () => {
    expect(t["--c-bleu"]).toBe("#1028F0")
    expect(t["--c-citron"]).toBe("#C1EE3E")
    expect(t["--c-vert"]).toBe("#C1EE3E")
    expect(t["--c-encre"]).toBe("#17213A")
    expect(t["--c-givre"]).toBe("#F3F5FC")
    expect(t["--c-blanc"]).toBe("#FFFFFF")
  })
})

// [texte, fond, minimum] : texte >= 4,5 ; non-texte >= 3
const TEXTE = [
  ["encre", "blanc"], ["encre", "givre"], ["encre", "citron"],
  ["ardoise", "blanc"], ["ardoise", "givre"],
  ["blanc", "bleu"], ["bleu", "blanc"], ["bleu", "givre"], ["bleu", "bleu-50"],
  ["bleu", "citron"], ["citron", "bleu"], ["citron", "encre"],
  ["brume", "encre"], ["brume", "encre-800"],
  ["bleu-clair", "encre"], ["bleu-100", "bleu"],
  ["succes", "blanc"], ["erreur", "blanc"], ["alerte-txt", "alerte-bg"],
  ["encre", "lavande"], ["encre", "citron-pale"], ["encre", "menthe"],
  ["encre", "rose"], ["encre", "peche"], ["encre", "lavande-600"],
  ["encre", "menthe-600"], ["encre", "bleu-clair-600"],
]
const NON_TEXTE = [
  ["acier", "blanc"], ["acier", "givre"], ["bleu", "blanc"], ["citron", "encre"],
]
// Paires interdites : doivent rester sous 4,5 pour qu'un usage futur soit repere
const INTERDITES = [["citron", "blanc"], ["citron", "givre"], ["bleu", "encre"]]

const ratio = (a, b) => contrastRatio(t[`--c-${a}`], t[`--c-${b}`])

describe("contrastes WCAG AA calcules depuis tokens.css", () => {
  it.each(TEXTE)("texte %s sur %s >= 4,5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(NON_TEXTE)("non-texte %s sur %s >= 3:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3)
  })
  it.each(INTERDITES)("paire interdite %s sur %s reste < 4,5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeLessThan(4.5)
  })
  it("garde les valeurs de reference de la charte", () => {
    expect(ratio("blanc", "bleu")).toBeCloseTo(8.13, 2)
    expect(ratio("citron", "blanc")).toBeCloseTo(1.35, 2)
    expect(ratio("bleu", "encre")).toBeCloseTo(1.96, 2)
  })
})

describe("absence de l'ancienne palette Direction A", () => {
  const OLD = /#2F3BED|#C8F03C|#0E0F1A|#F4F5FA|%230E0F1A|rgba\(\s*14\s*,\s*15\s*,\s*26|rgba\(\s*47\s*,\s*59\s*,\s*237/i
  it.each(["tokens.css", "components.css", "layouts.css", "../globals.css"])("%s", (file) => {
    expect(read(file)).not.toMatch(OLD)
  })
})

describe("tailles de logo de la charte", () => {
  const layouts = read("layouts.css")
  it("logo complet >= 150 px de large, symbole >= 32 px", () => {
    expect(layouts).toMatch(/^\.logo \{[^}]*height: 40px/m)
    expect(layouts).toMatch(/^\.logo--sm \{ height: 37px; \}/m)
    expect(layouts).toMatch(/^\.logo-sym--sm \{ width: 32px; height: 32px; \}/m)
    expect(37 * 4.1225).toBeGreaterThanOrEqual(150)
  })
})

describe("globals.css", () => {
  const globals = read("../globals.css")
  it("declare les alias Tailwind brand et les polices d'origine", () => {
    expect(globals).toContain("--color-brand: var(--c-bleu);")
    expect(globals).toContain("--color-brand-hover: var(--c-bleu-700);")
    expect(globals).toContain("--color-brand-press: var(--c-bleu-800);")
    expect(globals).toContain("--color-brand-soft: var(--c-bleu-50);")
    expect(globals).toContain("--color-ink: var(--c-encre);")
    expect(globals).toContain("--font-sans: var(--font-geist-sans);")
    expect(globals).toContain("font-family: Arial, Helvetica, sans-serif;")
  })
})
