import { describe, it, expect } from "vitest"
import { formatAmount } from "../app/format"
import {
  parseDepositReturn,
  parseRechargeParams,
  depositAmountError,
  safePaymentUrl,
  QUICK_DEPOSIT_AMOUNTS,
  MAX_DEPOSIT_AMOUNT,
} from "./deposit-return"

describe("parseDepositReturn", () => {
  it("approved donne « en attente de confirmation », jamais un succès", () => {
    expect(parseDepositReturn({ id: "1", status: "approved" })).toEqual({ kind: "pending" })
  })

  it("canceled et cancelled donnent annulée", () => {
    expect(parseDepositReturn({ status: "canceled" })).toEqual({ kind: "cancelled" })
    expect(parseDepositReturn({ status: "cancelled" })).toEqual({ kind: "cancelled" })
  })

  it("declined et failed donnent échec", () => {
    expect(parseDepositReturn({ status: "declined" })).toEqual({ kind: "failed" })
    expect(parseDepositReturn({ status: "failed" })).toEqual({ kind: "failed" })
  })

  it("accepte les alias recharge=succes|attente|annulee|echec", () => {
    expect(parseDepositReturn({ recharge: "succes" })).toEqual({ kind: "pending" })
    expect(parseDepositReturn({ recharge: "attente" })).toEqual({ kind: "pending" })
    expect(parseDepositReturn({ recharge: "annulee" })).toEqual({ kind: "cancelled" })
    expect(parseDepositReturn({ recharge: "echec" })).toEqual({ kind: "failed" })
  })

  it("ignore toute valeur inconnue, vide, répétée ou héritée de l'objet", () => {
    for (const status of ["pending", "transferred", "APPROVED", "", " approved", "toString", "__proto__", "constructor", 1, null, undefined, {}]) {
      expect(parseDepositReturn({ status })).toBeNull()
    }
    expect(parseDepositReturn({ recharge: "constructor" })).toBeNull()
    expect(parseDepositReturn({ recharge: ["inconnu"] })).toBeNull()
  })

  it("status prime, une valeur inconnue laisse passer l'alias", () => {
    expect(parseDepositReturn({ status: "canceled", recharge: "echec" })).toEqual({ kind: "cancelled" })
    expect(parseDepositReturn({ status: "bidon", recharge: "echec" })).toEqual({ kind: "failed" })
  })

  it("lit la première valeur d'un paramètre répété et tolère l'absence de paramètres", () => {
    expect(parseDepositReturn({ status: ["canceled", "approved"] })).toEqual({ kind: "cancelled" })
    expect(parseDepositReturn(null)).toBeNull()
    expect(parseDepositReturn(undefined)).toBeNull()
    expect(parseDepositReturn({})).toBeNull()
  })

  it("ne lit aucun montant : un ?montant= ne change rien au résultat", () => {
    expect(parseDepositReturn({ status: "approved", montant: "999999", amount: "5" })).toEqual({ kind: "pending" })
  })
})

describe("parseRechargeParams", () => {
  it("n'ouvre que sur recharger=1", () => {
    expect(parseRechargeParams({ recharger: "1" }).open).toBe(true)
    for (const v of ["0", "true", "", undefined, "11"]) expect(parseRechargeParams({ recharger: v }).open).toBe(false)
  })

  it("garde un montant suggéré valide", () => {
    expect(parseRechargeParams({ montant: "7500" }).suggestion).toBe(7500)
  })

  it("remonte une suggestion sous le minimum au minimum", () => {
    expect(parseRechargeParams({ montant: "500" }).suggestion).toBe(2000)
  })

  it("ignore tout format douteux ou hors plafond", () => {
    for (const v of ["-5", "0", "12.5", "1e6", "abc", "7 500", "", "99999999999", "0x10", ["7500x"]]) {
      expect(parseRechargeParams({ montant: v }).suggestion).toBeNull()
    }
    expect(parseRechargeParams({ montant: String(MAX_DEPOSIT_AMOUNT) }).suggestion).toBe(MAX_DEPOSIT_AMOUNT)
    expect(parseRechargeParams({ montant: String(MAX_DEPOSIT_AMOUNT + 1) }).suggestion).toBeNull()
  })

  it("tolère l'absence de paramètres", () => {
    expect(parseRechargeParams(null)).toEqual({ open: false, suggestion: null })
  })
})

describe("depositAmountError", () => {
  it("accepte le minimum et au-delà", () => {
    expect(depositAmountError(2000)).toBeNull()
    expect(depositAmountError(25000)).toBeNull()
  })

  it("refuse vide, nul, négatif, décimal et sous le minimum, en vouvoyant", () => {
    expect(depositAmountError(null)).toMatch(/Indiquez/)
    expect(depositAmountError(0)).toMatch(/Indiquez/)
    expect(depositAmountError(-1)).toMatch(/Indiquez/)
    expect(depositAmountError(2500.5)).toMatch(/Indiquez/)
    expect(depositAmountError(1500)).toBe(`Le minimum de recharge est de ${formatAmount(2000)}.`)
    expect(depositAmountError(MAX_DEPOSIT_AMOUNT + 1)).toBe("Ce montant est trop élevé.")
  })

  it("propose des montants rapides au-dessus du minimum", () => {
    for (const n of QUICK_DEPOSIT_AMOUNTS) expect(depositAmountError(n)).toBeNull()
    expect(QUICK_DEPOSIT_AMOUNTS).toEqual([5000, 10000, 25000])
  })
})

describe("safePaymentUrl", () => {
  it("n'accepte que https", () => {
    expect(safePaymentUrl("https://pay.example.com/x?y=1")).toBe("https://pay.example.com/x?y=1")
    for (const u of ["http://pay.example.com", "javascript:alert(1)", "data:text/html,x", "//pay.example.com", "/relatif", "", null, undefined, 5]) {
      expect(safePaymentUrl(u)).toBeNull()
    }
  })
})
