import { describe, it, expect } from "vitest"
import { formAudience } from "./form-audience"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

describe("formAudience", () => {
  it("vouvoiement neutre par défaut", () => {
    expect(formAudience(form({}))).toBe("client")
  })
  it("champ role ou audience explicite", () => {
    expect(formAudience(form({ role: "student" }))).toBe("student")
    expect(formAudience(form({ audience: "student" }))).toBe("student")
    expect(formAudience(form({ role: "client" }))).toBe("client")
  })
  it("next sous /client", () => {
    expect(formAudience(form({ next: "/client/missions/new" }))).toBe("client")
  })
  it("rôle invalide ignoré", () => {
    expect(formAudience(form({ role: "admin" }))).toBe("client")
  })
})
