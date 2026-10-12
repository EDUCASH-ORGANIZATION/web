import { describe, it, expect } from "vitest"
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  parseColorTokens,
} from "./contrast"

describe("hexToRgb", () => {
  it("convertit un hexadecimal en triplet", () => {
    expect(hexToRgb("#1028F0")).toEqual([16, 40, 240])
  })
  it("refuse un format invalide", () => {
    expect(() => hexToRgb("bleu")).toThrow()
    expect(() => hexToRgb("#FFF")).toThrow()
  })
})

describe("relativeLuminance", () => {
  it("vaut 0 pour le noir et 1 pour le blanc", () => {
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10)
  })
})

describe("contrastRatio (valeurs de reference de la charte)", () => {
  it("blanc / bleu = 8,13", () => {
    expect(contrastRatio("#FFFFFF", "#1028F0")).toBeCloseTo(8.13, 2)
  })
  it("encre / blanc = 15,97", () => {
    expect(contrastRatio("#17213A", "#FFFFFF")).toBeCloseTo(15.97, 2)
  })
  it("bleu / vert = 6,02", () => {
    expect(contrastRatio("#1028F0", "#C1EE3E")).toBeCloseTo(6.02, 2)
  })
  it("vert / blanc = 1,35 (a 0,01 pres)", () => {
    expect(Math.abs(contrastRatio("#C1EE3E", "#FFFFFF") - 1.35)).toBeLessThanOrEqual(0.01)
  })
  it("est symetrique", () => {
    expect(contrastRatio("#FFFFFF", "#1028F0")).toBe(contrastRatio("#1028F0", "#FFFFFF"))
  })
})

describe("parseColorTokens", () => {
  it("lit les couleurs et resout les alias var()", () => {
    const css = ":root { --c-a: #1028f0; --c-b: var(--c-a); --t-x: 12px; --c-c: var(--c-inconnu); }"
    expect(parseColorTokens(css)).toEqual({ "--c-a": "#1028F0", "--c-b": "#1028F0" })
  })
})
