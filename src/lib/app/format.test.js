import { describe, it, expect } from "vitest"
import { initialsOf } from "./format"

describe("initialsOf", () => {
  it("prend la première lettre du premier et du dernier mot", () => {
    expect(initialsOf("Rosine Houngbédji")).toBe("RH")
    expect(initialsOf("  marie  claire dossou ")).toBe("MD")
    expect(initialsOf("Jean Paul Kouassi")).toBe("JK")
  })

  it("un seul mot : ses deux premières lettres", () => {
    expect(initialsOf("Rosine")).toBe("RO")
    expect(initialsOf("sèna")).toBe("SÈ")
  })

  it("nom vide ou absent : « ? »", () => {
    expect(initialsOf("")).toBe("?")
    expect(initialsOf("  ")).toBe("?")
    expect(initialsOf(null)).toBe("?")
    expect(initialsOf(undefined)).toBe("?")
  })
})
