import { describe, expect, it } from "vitest"
import { MISSING_COPY, REQUIRED_FIELDS, isFilled, missingFields, runOnce, showsEstimateWarning, validateForm } from "./purchase-form-logic"

const FULL = {
  payeeKind: "merchant",
  payeeNumber: "4521",
  vendorName: "  Poissonnerie   Dossa ",
  items: "",
  amount: 6000,
  payeePhoto: { path: "a/b/payee-abcdefgh.jpg" },
  ticketPhoto: { path: "a/b/ticket-abcdefgh.jpg" },
}

describe("champs obligatoires", () => {
  it("un formulaire vide manque des cinq champs obligatoires, dans l'ordre de la feuille", () => {
    expect(missingFields({})).toEqual(REQUIRED_FIELDS)
    expect(REQUIRED_FIELDS).toEqual(["payeePhoto", "payeeNumber", "vendorName", "amount", "ticketPhoto"])
  })

  it("« Articles » est facultatif et un nom d'espaces seuls compte pour manquant", () => {
    expect(missingFields(FULL)).toEqual([])
    expect(isFilled("vendorName", { vendorName: "   " })).toBe(false)
    expect(isFilled("amount", { amount: null })).toBe(false)
    expect(isFilled("amount", { amount: 0 })).toBe(true)
    expect(isFilled("payeePhoto", { payeePhoto: {} })).toBe(false)
    expect(isFilled("inconnu", FULL)).toBe(false)
  })
})

describe("validateForm", () => {
  it("renvoie la valeur normalisée à envoyer", () => {
    const { errors, data } = validateForm(FULL)
    expect(errors).toEqual({})
    expect(data).toEqual({
      payeeKind: "merchant",
      payeeNumber: "4521",
      payeePhotoPath: "a/b/payee-abcdefgh.jpg",
      vendorName: "Poissonnerie Dossa",
      items: "",
      amount: 6000,
      ticketPhotoPath: "a/b/ticket-abcdefgh.jpg",
    })
  })

  it("normalise un numéro perso en +22901XXXXXXXX", () => {
    const { data } = validateForm({ ...FULL, payeeKind: "personal", payeeNumber: "01 97 12 34 56" })
    expect(data.payeeNumber).toBe("+2290197123456")
  })

  it("signale chaque champ manquant avec son message", () => {
    const { errors, data } = validateForm({ payeeKind: "merchant" })
    expect(data).toBeNull()
    expect(errors).toEqual(MISSING_COPY)
  })

  it("reprend les messages de format du domaine (numéro marchand égal à un téléphone, montant hors bornes)", () => {
    const phone = validateForm({ ...FULL, payeeNumber: "0197123456" })
    expect(phone.errors.payeeNumber).toContain("Numéro perso")
    const low = validateForm({ ...FULL, amount: 50 })
    expect(low.errors.amount).toContain("100")
    const high = validateForm({ ...FULL, amount: 500001 })
    expect(high.errors.amount).toContain("500 000")
  })

  it("refuse un nom trop court ou trop long et des articles trop longs", () => {
    expect(validateForm({ ...FULL, vendorName: "A" }).errors.vendorName).toContain("2 à 80")
    expect(validateForm({ ...FULL, vendorName: "x".repeat(81) }).errors.vendorName).toContain("2 à 80")
    expect(validateForm({ ...FULL, items: "x".repeat(121) }).errors.items).toContain("120")
  })
})

describe("showsEstimateWarning", () => {
  it("avertit au-delà de 1,5 fois l'estimation, jamais sans estimation ni sans montant valide", () => {
    expect(showsEstimateWarning({ amount: 10000, otherRequested: 6000, estimate: 10000 })).toBe(true)
    expect(showsEstimateWarning({ amount: 5000, otherRequested: 0, estimate: 10000 })).toBe(false)
    expect(showsEstimateWarning({ amount: 20000, estimate: null })).toBe(false)
    expect(showsEstimateWarning({ amount: 5, otherRequested: 99999, estimate: 10 })).toBe(false)
  })
})

describe("runOnce", () => {
  it("ignore un second appel tant que le premier n'a pas échoué", async () => {
    const guard = { current: false }
    let release
    const run = () => new Promise((resolve) => (release = resolve))
    const first = runOnce(guard, run, "x")
    expect(await runOnce(guard, run, "x")).toEqual({ skipped: true })
    release({ ok: true })
    expect(await first).toEqual({ ok: true })
    expect(guard.current).toBe(true)
  })

  it("libère le verrou après une erreur ou une exception", async () => {
    const guard = { current: false }
    expect(await runOnce(guard, async () => ({ error: "non" }), "x")).toEqual({ error: "non" })
    expect(guard.current).toBe(false)
    expect(await runOnce(guard, async () => ({ fieldErrors: { amount: "m" } }), "x")).toEqual({ fieldErrors: { amount: "m" } })
    expect(guard.current).toBe(false)
    expect(await runOnce(guard, async () => { throw new Error("réseau") }, "repli")).toEqual({ error: "repli" })
    expect(guard.current).toBe(false)
  })
})
