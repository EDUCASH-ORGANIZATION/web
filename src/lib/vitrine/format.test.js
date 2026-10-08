import { describe, it, expect } from "vitest"
import { formatFcfa, formatDateFr } from "./format"

const norm = (s) => s.replace(/[  ]/g, " ")

describe("formatFcfa", () => {
  it("formate avec séparateur de milliers", () => {
    expect(norm(formatFcfa(12500))).toBe("12 500 FCFA")
    expect(norm(formatFcfa(0))).toBe("0 FCFA")
    expect(norm(formatFcfa(1000000))).toBe("1 000 000 FCFA")
  })
  it("traite une valeur invalide comme 0", () => {
    expect(norm(formatFcfa(undefined))).toBe("0 FCFA")
  })
})

describe("formatDateFr", () => {
  it("formate une date seule sans décalage", () => {
    expect(formatDateFr("2026-10-08")).toBe("8 octobre 2026")
  })
  it("formate un ISO complet", () => {
    expect(formatDateFr("2026-10-08T10:00:00Z")).toBe("8 octobre 2026")
  })
  it("formate un objet Date au fuseau du Bénin", () => {
    expect(formatDateFr(new Date("2026-10-07T23:30:00Z"))).toBe("8 octobre 2026")
  })
})
