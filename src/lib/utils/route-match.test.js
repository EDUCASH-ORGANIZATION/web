import { describe, it, expect } from "vitest"
import { matchesRoutePrefix } from "./route-match"

describe("matchesRoutePrefix", () => {
  it("accepte le préfixe exact", () => {
    expect(matchesRoutePrefix("/client", "/client")).toBe(true)
  })

  it("accepte un sous-chemin", () => {
    expect(matchesRoutePrefix("/client/dashboard", "/client")).toBe(true)
    expect(matchesRoutePrefix("/student/missions/x", "/student")).toBe(true)
  })

  it("refuse un chemin qui partage seulement le début du nom", () => {
    expect(matchesRoutePrefix("/clients", "/client")).toBe(false)
    expect(matchesRoutePrefix('/students/x', "/student")).toBe(false)
    expect(matchesRoutePrefix("/clientele", "/client")).toBe(false)
  })

  it("refuse un chemin sans rapport", () => {
    expect(matchesRoutePrefix("/missions", "/client")).toBe(false)
  })
})
