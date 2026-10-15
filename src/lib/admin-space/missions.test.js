import { describe, it, expect } from "vitest"
import { clampPage, parseMissionsParams } from "./missions"

describe("parseMissionsParams", () => {
  it("valeurs par défaut sans paramètres", () => {
    expect(parseMissionsParams(undefined)).toEqual({ statut: "toutes", q: "", ville: "", type: "", page: 1 })
    expect(parseMissionsParams(null)).toEqual({ statut: "toutes", q: "", ville: "", type: "", page: 1 })
  })

  it("accepte les valeurs des listes fermées", () => {
    expect(parseMissionsParams({ statut: "a-confirmer", ville: "Porto-Novo", type: "Babysitting", page: "4" })).toEqual({
      statut: "a-confirmer",
      q: "",
      ville: "Porto-Novo",
      type: "Babysitting",
      page: 4,
    })
  })

  it("ignore les valeurs hors liste et les types inattendus", () => {
    const out = parseMissionsParams({ statut: "pending", ville: ["Cotonou", "x"], type: 5, page: { a: 1 } })
    expect(out).toMatchObject({ statut: "toutes", ville: "Cotonou", type: "", page: 1 })
  })

  it.each([["-3", 1], ["0", 1], ["1e9", 1], ["12abc", 1], ["99999999999", 1], ["100000", 100000]])("page %j donne %i", (page, expected) => {
    expect(parseMissionsParams({ page }).page).toBe(expected)
  })

  it("nettoie la recherche : contrôle, espaces, longueur", () => {
    const out = parseMissionsParams({ q: "  aide\u0000   au\n\tdéménagement " + "z".repeat(200) })
    expect(out.q.startsWith("aide au déménagement")).toBe(true)
    expect(out.q.length).toBeLessThanOrEqual(80)
    expect(out.q).not.toMatch(/[\u0000-\u001f]/)
  })
})

describe("clampPage", () => {
  it("borne à la dernière page et à au moins 1", () => {
    expect(clampPage(9, 30)).toEqual({ page: 2, pageCount: 2 })
    expect(clampPage(1, 0)).toEqual({ page: 1, pageCount: 1 })
    expect(clampPage(0, 100)).toEqual({ page: 1, pageCount: 4 })
    expect(clampPage(3, 50)).toEqual({ page: 2, pageCount: 2 })
  })
})
