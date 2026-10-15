import { describe, it, expect } from "vitest"
import { dedupeFingerprint, FINGERPRINT_PATTERN } from "./fingerprint.js"

const A = "2026-10-10T09:00:00.123456+00:00"
const B = "2026-10-12T15:30:00.654321+00:00"

describe("dedupeFingerprint", () => {
  it("12 caractères hexadécimaux, aucune date lisible", () => {
    const f = dedupeFingerprint("verification_rejected", A)
    expect(f).toMatch(FINGERPRINT_PATTERN)
    expect(f).not.toMatch(/2026|10-10|09:00/)
  })

  it("même dépôt => même empreinte ; deux dépôts distincts => deux empreintes", () => {
    expect(dedupeFingerprint("verification_rejected", A)).toBe(dedupeFingerprint("verification_rejected", A))
    expect(dedupeFingerprint("verification_rejected", A)).not.toBe(dedupeFingerprint("verification_rejected", B))
  })

  it("l'usage fait partie de l'empreinte", () => {
    expect(dedupeFingerprint("verification_rejected", A)).not.toBe(dedupeFingerprint("verification_reset", A))
  })
})
