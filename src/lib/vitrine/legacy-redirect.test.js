import { describe, it, expect } from "vitest"
import { talentPathFromLegacy } from "./legacy-redirect"

const ID = "11111111-1111-4111-8111-111111111111"
const MISSION = "22222222-2222-4222-8222-222222222222"

describe("talentPathFromLegacy", () => {
  it("redirige vers /talents/<id>", () => {
    expect(talentPathFromLegacy(ID, {})).toBe(`/talents/${ID}`)
  })

  it("conserve missionId s'il est un UUID et abandonne le reste", () => {
    expect(talentPathFromLegacy(ID, { missionId: MISSION, x: "1" })).toBe(
      `/talents/${ID}?missionId=${MISSION}`
    )
  })

  it("abandonne un missionId qui n'est pas un UUID", () => {
    expect(talentPathFromLegacy(ID, { missionId: "abc" })).toBe(`/talents/${ID}`)
    expect(talentPathFromLegacy(ID, { missionId: "//evil.tld" })).toBe(
      `/talents/${ID}`
    )
  })

  it("tolère un missionId répété et des paramètres absents", () => {
    expect(talentPathFromLegacy(ID, { missionId: [MISSION, "z"] })).toBe(
      `/talents/${ID}?missionId=${MISSION}`
    )
    expect(talentPathFromLegacy(ID, undefined)).toBe(`/talents/${ID}`)
  })

  it("encode l'identifiant", () => {
    expect(talentPathFromLegacy("a/b", {})).toBe("/talents/a%2Fb")
  })
})
