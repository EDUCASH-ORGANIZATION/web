import { describe, it, expect } from "vitest"
import { todayInBenin, isPastDeadline } from "./dates"

describe("todayInBenin", () => {
  it("passe au jour suivant après 23h UTC", () => {
    expect(todayInBenin(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-08")
  })
  it("reste le même jour en milieu de journée", () => {
    expect(todayInBenin(new Date("2026-10-08T12:00:00Z"))).toBe("2026-10-08")
  })
  it("renvoie le format AAAA-MM-JJ par défaut", () => {
    expect(todayInBenin()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("isPastDeadline", () => {
  it("est vrai pour hier", () => {
    expect(isPastDeadline("2026-10-07", "2026-10-08")).toBe(true)
  })
  it("est faux pour aujourd'hui", () => {
    expect(isPastDeadline("2026-10-08", "2026-10-08")).toBe(false)
  })
  it("est faux pour demain", () => {
    expect(isPastDeadline("2026-10-09", "2026-10-08")).toBe(false)
  })
  it("ne compte jamais null comme passé", () => {
    expect(isPastDeadline(null, "2026-10-08")).toBe(false)
  })
})
