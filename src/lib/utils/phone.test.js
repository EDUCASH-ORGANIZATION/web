import { describe, it, expect } from "vitest"
import {
  BENIN_PREFIX,
  parseBeninPhone,
  toBeninE164,
  formatBeninPhone,
  beninPhoneSchema,
  makeBeninPhoneSchema,
  validatePhone,
  formatPhone,
  parsePhone,
  normalizeBeninPhone,
} from "./phone.js"

describe("parseBeninPhone", () => {
  it.each([
    "01 97 45 21 08",
    "0197452108",
    "01.97.45.21.08",
    "01-97-45-21-08",
    "+229 0197452108",
    "+229 01 97 45 21 08",
    "0022901 97 45 21 08",
    "  0197452108  ",
  ])("accepte %j", (raw) => {
    expect(parseBeninPhone(raw)).toEqual({ ok: true, local: "0197452108", e164: "+2290197452108" })
  })

  it.each([
    ["97452108", "length"],
    ["0297452108", "prefix"],
    ["01974521081", "length"],
    ["019745210", "length"],
    ["01 97 45 21 0a", "invalid_chars"],
    ["abcdefghij", "invalid_chars"],
    ["", "empty"],
    ["   ", "empty"],
    [null, "empty"],
    [undefined, "empty"],
    [197452108, "empty"],
    ["+225 0197452108", "invalid_chars"],
  ])("refuse %j (%s)", (raw, reason) => {
    expect(parseBeninPhone(raw)).toEqual({ ok: false, reason })
  })
})

describe("toBeninE164 et formatBeninPhone", () => {
  it("stocke au format +22901XXXXXXXX", () => {
    expect(BENIN_PREFIX).toBe("+229")
    expect(toBeninE164("01 97 45 21 08")).toBe("+2290197452108")
    expect(toBeninE164("+2290197452108")).toBe("+2290197452108")
    expect(toBeninE164("12")).toBe("")
  })

  it("affiche par paires", () => {
    expect(formatBeninPhone("+2290197452108")).toBe("01 97 45 21 08")
    expect(formatBeninPhone("0197452108")).toBe("01 97 45 21 08")
    expect(formatBeninPhone("97 45")).toBe("97 45")
    expect(formatBeninPhone(undefined)).toBe("")
  })
})

describe("beninPhoneSchema", () => {
  it("renvoie la valeur E.164", () => {
    expect(beninPhoneSchema.parse("01 97 45 21 08")).toBe("+2290197452108")
  })

  it("donne un message précis par cause", () => {
    const message = (value) => beninPhoneSchema.safeParse(value).error.issues[0].message
    expect(message("")).toMatch(/Indiquez/)
    expect(message("0297452108")).toMatch(/commence par 01/)
    expect(message("0197")).toMatch(/10 chiffres/)
    expect(message("01 97 45 21 0x")).toMatch(/chiffres/)
    expect(beninPhoneSchema.safeParse(undefined).success).toBe(false)
  })

  it("accepte des messages personnalisés", () => {
    const schema = makeBeninPhoneSchema({ empty: "Saisis ton numéro." })
    expect(schema.safeParse("").error.issues[0].message).toBe("Saisis ton numéro.")
  })
})

describe("API existante intacte", () => {
  it("validatePhone", () => {
    expect(validatePhone("+229", "0197452108", "")).toBeNull()
    expect(validatePhone("+229", "", "")).toBe("Le numéro de téléphone est requis.")
    expect(validatePhone("+229", "97452108", "")).toMatch(/01/)
    expect(validatePhone("+other", "123456", "+99999")).toMatch(/Indicatif/)
    expect(validatePhone("+225", "123", "")).toMatch(/trop court/)
  })

  it("formatPhone, parsePhone, normalizeBeninPhone", () => {
    expect(formatPhone("+229", "01 97 45 21 08", "")).toBe("+2290197452108")
    expect(formatPhone("+other", "123", "+55")).toBe("+55123")
    expect(parsePhone("+229 0197452108")).toEqual({ countryCode: "+229", phoneNumber: "0197452108", otherCode: "" })
    expect(parsePhone("+5512345")).toEqual({ countryCode: "+other", phoneNumber: "345", otherCode: "+5512" })
    expect(normalizeBeninPhone("01 97 45 21 08 99")).toBe("0197452108")
  })
})
