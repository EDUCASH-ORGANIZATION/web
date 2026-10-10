import { describe, it, expect } from "vitest"
import {
  extractBearerToken,
  normalizeBeninPhone,
  validateWithdrawalBody,
  canWithdraw,
  corsOrigin,
} from "../../supabase/functions/process-withdrawal/validate.js"

describe("extractBearerToken", () => {
  it("extrait le jeton", () => expect(extractBearerToken("Bearer abc.def")).toBe("abc.def"))
  it("refuse l'absence ou un format invalide", () => {
    expect(extractBearerToken(null)).toBeNull()
    expect(extractBearerToken("")).toBeNull()
    expect(extractBearerToken("Basic abc")).toBeNull()
    expect(extractBearerToken("Bearer")).toBeNull()
  })
})

describe("normalizeBeninPhone", () => {
  it("accepte 8 chiffres et 10 chiffres en 01", () => {
    expect(normalizeBeninPhone("97000000")).toBe("97000000")
    expect(normalizeBeninPhone("0197000000")).toBe("0197000000")
  })
  it("tolere prefixe pays et separateurs", () => {
    expect(normalizeBeninPhone("+229 97 00 00 00")).toBe("97000000")
    expect(normalizeBeninPhone("00229-97000000")).toBe("97000000")
    expect(normalizeBeninPhone("2290197000000")).toBe("0197000000")
  })
  it("refuse les formats invalides", () => {
    for (const bad of ["", "1234", "9700000a", "0297000000", "+33612345678", "970000000", null, 97000000]) {
      expect(normalizeBeninPhone(bad)).toBeNull()
    }
  })
})

describe("validateWithdrawalBody", () => {
  const ok = { amount: 5000, phone: "97000000", operator: "moov" }
  it("accepte un corps valide", () => {
    expect(validateWithdrawalBody(ok)).toEqual({ ok: true, value: ok })
  })
  it("ignore un userId fourni dans le corps", () => {
    const res = validateWithdrawalBody({ ...ok, userId: "victim" })
    expect(res.ok).toBe(true)
    expect(res.value).not.toHaveProperty("userId")
  })
  it("refuse les montants invalides", () => {
    for (const amount of [0, -5, 1999, 2500.5, "5000", null, undefined, NaN]) {
      expect(validateWithdrawalBody({ ...ok, amount }).ok).toBe(false)
    }
  })
  it("refuse operateur et telephone invalides", () => {
    expect(validateWithdrawalBody({ ...ok, operator: "orange" }).ok).toBe(false)
    expect(validateWithdrawalBody({ ...ok, phone: "abc" }).ok).toBe(false)
    expect(validateWithdrawalBody(null).ok).toBe(false)
  })
  it("ne nomme pas le prestataire dans les erreurs", () => {
    expect(JSON.stringify(validateWithdrawalBody({}))).not.toMatch(/feda/i)
  })
})

describe("canWithdraw", () => {
  it("autorise student et client non suspendus", () => {
    expect(canWithdraw({ role: "student", is_suspended: false })).toBe(true)
    expect(canWithdraw({ role: "client", is_suspended: null })).toBe(true)
  })
  it("refuse suspendu, admin, role inconnu, profil absent", () => {
    expect(canWithdraw({ role: "student", is_suspended: true })).toBe(false)
    expect(canWithdraw({ role: "admin", is_suspended: false })).toBe(false)
    expect(canWithdraw({ role: undefined })).toBe(false)
    expect(canWithdraw(null)).toBe(false)
  })
})

describe("corsOrigin", () => {
  it("restreint a l'origine de l'app", () => {
    expect(corsOrigin("https://educash.bj/")).toBe("https://educash.bj")
    expect(corsOrigin(undefined)).toBe("null")
    expect(corsOrigin("pas une url")).toBe("null")
  })
})
