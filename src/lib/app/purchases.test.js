import { describe, it, expect } from "vitest"
import { PURCHASES_ESTIMATE_MAX, purchasesEstimateOf, purchasesLine } from "./purchases.js"

describe("purchasesEstimateOf", () => {
  it("accepte un nombre ou une chaîne numérique positive et bornée", () => {
    expect(purchasesEstimateOf(15000)).toBe(15000)
    expect(purchasesEstimateOf("15000")).toBe(15000)
    expect(purchasesEstimateOf("15000.4")).toBe(15000)
    expect(purchasesEstimateOf(PURCHASES_ESTIMATE_MAX)).toBe(PURCHASES_ESTIMATE_MAX)
  })

  it.each([null, undefined, "", 0, "0", -1, 0.2, 1e12, PURCHASES_ESTIMATE_MAX + 1, Number.NaN, Infinity, "abc", true, {}, []])(
    "refuse %j",
    (raw) => {
      expect(purchasesEstimateOf(raw)).toBeNull()
    },
  )
})

describe("purchasesLine", () => {
  it("dit « environ » et « non bloqués »", () => {
    const line = purchasesLine(15000)
    expect(line).toMatch(/^Achats estimés : environ 15.000.FCFA, non bloqués$/)
  })

  it("ne renvoie rien sans estimation valable", () => {
    expect(purchasesLine(null)).toBeNull()
    expect(purchasesLine(0)).toBeNull()
    expect(purchasesLine("x")).toBeNull()
  })
})
