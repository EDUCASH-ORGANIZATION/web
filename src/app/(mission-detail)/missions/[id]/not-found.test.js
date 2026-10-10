import { describe, it, expect } from "vitest"
import MissionNotFound from "./not-found"

describe("MissionNotFound", () => {
  it("s'adresse aux étudiants", () => {
    expect(MissionNotFound().props.audience).toBe("etudiants")
  })
})
