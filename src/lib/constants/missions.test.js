import { describe, it, expect } from "vitest"
import {
  netAmount,
  COMMISSION_RATE,
  MISSION_TYPES,
  CITIES,
  BUDGET_RANGES,
  SORTS,
  SEARCH_MAX_LENGTH,
  MISSIONS_PAGE_SIZE,
} from "./missions.js"

describe("netAmount", () => {
  it("applique la commission de 12 %", () => {
    expect(COMMISSION_RATE).toBe(0.12)
    expect(netAmount(10000)).toBe(8800)
    expect(netAmount(5000)).toBe(4400)
  })
  it("arrondit au FCFA", () => {
    expect(netAmount(1001)).toBe(Math.round(1001 * 0.88))
    expect(Number.isInteger(netAmount(3333))).toBe(true)
  })
  it("renvoie 0 pour null, undefined et 0", () => {
    expect(netAmount(null)).toBe(0)
    expect(netAmount(undefined)).toBe(0)
    expect(netAmount(0)).toBe(0)
  })
  it("est strictement inférieur au brut pour un budget positif", () => {
    expect(netAmount(100)).toBeLessThan(100)
  })
})

describe("cohérence des listes", () => {
  it("MISSION_TYPES et CITIES sont non vides et sans doublon", () => {
    for (const list of [MISSION_TYPES, CITIES]) {
      expect(list.length).toBeGreaterThan(0)
      expect(new Set(list).size).toBe(list.length)
    }
  })
  it("MISSION_TYPES contient Démarches une seule fois, avant Autre", () => {
    expect(MISSION_TYPES.filter((t) => t === "Démarches")).toHaveLength(1)
    expect(MISSION_TYPES.indexOf("Démarches")).toBe(MISSION_TYPES.indexOf("Autre") - 1)
  })
  it("BUDGET_RANGES : ids uniques, min < max, tranches contiguës, dernière ouverte", () => {
    expect(new Set(BUDGET_RANGES.map((r) => r.id)).size).toBe(BUDGET_RANGES.length)
    BUDGET_RANGES.forEach((r, i) => {
      if (r.max !== undefined) expect(r.min).toBeLessThan(r.max)
      if (i > 0) expect(r.min).toBe(BUDGET_RANGES[i - 1].max)
    })
    expect(BUDGET_RANGES.at(-1).max).toBeUndefined()
    expect(BUDGET_RANGES[0].min).toBe(0)
  })
  it("SORTS : ids uniques, tri par défaut vide présent", () => {
    const ids = SORTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain("")
  })
  it("bornes numériques valides", () => {
    expect(SEARCH_MAX_LENGTH).toBeGreaterThan(0)
    expect(MISSIONS_PAGE_SIZE).toBeGreaterThan(0)
  })
})
