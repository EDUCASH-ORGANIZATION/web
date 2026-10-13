import { describe, it, expect } from "vitest"
import { parseDepositReturn, parseRechargeParams, depositAmountError, safePaymentUrl } from "@/lib/client-space/deposit-return"
import { validateWithdraw, withdrawQuickAmounts, formatLocalPhone, maskLocalPhone } from "@/lib/client-space/withdraw-schema"

describe("parseDepositReturn : valeurs hostiles", () => {
  it.each([
    [{ status: "__proto__" }], [{ status: "constructor" }], [{ status: "toString" }], [{ status: "hasOwnProperty" }],
    [{ status: "APPROVED" }], [{ status: " approved" }], [{ status: "approved " }], [{ status: "x".repeat(100000) }],
    [{ status: [] }], [{ status: {} }], [{ status: 1 }], [{ status: null }], [{ recharge: "__proto__" }], [{ recharge: "SUCCES" }],
    [null], [undefined], [{}], [[]], ["status=approved"],
  ])("ignore %j", (p) => {
    expect(parseDepositReturn(p)).toBeNull()
  })
  it("tableau : premier élément", () => {
    expect(parseDepositReturn({ status: ["approved", "failed"] })).toEqual({ kind: "pending" })
    expect(parseDepositReturn({ status: ["bogus", "failed"] })).toBeNull()
  })
  it("approved n'est jamais un succès", () => {
    for (const p of [{ status: "approved" }, { recharge: "succes" }, { status: "approved", recharge: "echec" }]) {
      expect(parseDepositReturn(p).kind).not.toBe("success")
      expect(["pending", "failed"]).toContain(parseDepositReturn(p).kind)
    }
  })
  it("table complète", () => {
    expect(parseDepositReturn({ status: "canceled" }).kind).toBe("cancelled")
    expect(parseDepositReturn({ status: "cancelled" }).kind).toBe("cancelled")
    expect(parseDepositReturn({ status: "declined" }).kind).toBe("failed")
    expect(parseDepositReturn({ status: "failed" }).kind).toBe("failed")
    expect(parseDepositReturn({ recharge: "annulee" }).kind).toBe("cancelled")
    expect(parseDepositReturn({ recharge: "echec" }).kind).toBe("failed")
    expect(parseDepositReturn({ recharge: "attente" }).kind).toBe("pending")
    expect(parseDepositReturn({ status: "bogus", recharge: "echec" }).kind).toBe("failed")
  })
  it("aucun montant lu : la sortie n'a que kind", () => {
    expect(Object.keys(parseDepositReturn({ status: "approved", amount: "99999", montant: "5" }))).toEqual(["kind"])
  })
})

describe("parseRechargeParams", () => {
  it.each([
    [{ montant: "7500" }, 7500], [{ montant: "100" }, 2000], [{ montant: "0" }, null], [{ montant: "-5" }, null],
    [{ montant: "1e5" }, null], [{ montant: "7500.5" }, null], [{ montant: " 7500" }, null], [{ montant: "9999999999" }, null],
    [{ montant: "999999999" }, 999999999], [{ montant: "1000000000" }, null], [{ montant: "٣٠٠٠" }, null], [{ montant: ["7500"] }, 7500],
    [{ montant: "__proto__" }, null], [{ montant: "" }, null], [{ montant: "007500" }, 7500], [{}, null], [null, null],
  ])("montant %j -> %j", (p, expected) => {
    expect(parseRechargeParams(p).suggestion).toBe(expected)
  })
  it("recharger exige exactement 1", () => {
    for (const [p, open] of [[{ recharger: "1" }, true], [{ recharger: "true" }, false], [{ recharger: "01" }, false], [{ recharger: ["1"] }, true], [{ recharger: 1 }, false], [{}, false]]) {
      expect(parseRechargeParams(p).open).toBe(open)
    }
  })
})

describe("depositAmountError", () => {
  it.each([[null], [undefined], [0], [-5], [NaN], [1.5], ["5000"], [1999], [Infinity], [1e21], [1000000000]])("refuse %s", (v) => {
    expect(depositAmountError(v)).toBeTruthy()
  })
  it.each([[2000], [999999999]])("accepte %s", (v) => expect(depositAmountError(v)).toBeNull())
})

describe("safePaymentUrl", () => {
  it.each([["http://pay.example"], ["javascript:alert(1)"], ["data:text/html,x"], [""], [null], [{}], ["//pay.example"], ["pay.example"]])("refuse %j", (u) => {
    expect(safePaymentUrl(u)).toBeNull()
  })
  it("accepte https", () => expect(safePaymentUrl("https://pay.example/x")).toBe("https://pay.example/x"))
})

describe("withdraw-schema", () => {
  const ok = { amount: 5000, phone: "0197452108", operator: "mtn" }
  it("valide", () => expect(validateWithdraw(ok, 10000)).toEqual({ ok: true, value: ok }))
  it("plafond = disponible (inclusif), au-dessus refusé", () => {
    expect(validateWithdraw({ ...ok, amount: 10000 }, 10000).ok).toBe(true)
    expect(validateWithdraw({ ...ok, amount: 10001 }, 10000).errors.amount).toMatch(/dépasse votre disponible/)
  })
  it.each([[1999], [0], [-1], [2000.5], [NaN], [Infinity], ["5000"], [null], [undefined], [1e21], [{}]])("montant %s refusé", (amount) => {
    const r = validateWithdraw({ ...ok, amount }, 10 ** 12)
    expect(r.ok).toBe(false)
    expect(r.errors.amount).toBeTruthy()
  })
  it("disponible hostile : plafond 0", () => {
    for (const a of [NaN, -5, undefined, "abc", null]) expect(validateWithdraw(ok, a).ok).toBe(false)
  })
  it("minimum exact 2000 accepté", () => expect(validateWithdraw({ ...ok, amount: 2000 }, 10000).ok).toBe(true))
  it.each([[""], ["0697452108"], ["01974521"], ["+22901974521089"], ["abc"], ["01 97 45 21 0x"], [null], [undefined], [123], ["<script>"], ["0".repeat(5000)]])("numéro %j refusé", (phone) => {
    const r = validateWithdraw({ ...ok, phone }, 10000)
    expect(r.ok).toBe(false)
    expect(r.errors.phone).toBeTruthy()
  })
  it.each([["01 97 45 21 08"], ["+229 01 97 45 21 08"], ["0197452108"]])("numéro %j accepté et normalisé", (phone) => {
    const r = validateWithdraw({ ...ok, phone }, 10000)
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(r.value.phone).toBe("0197452108")
  })
  it.each([["celtiis"], ["MTN"], [""], [null], [undefined], ["__proto__"], ["constructor"], [1]])("opérateur %j refusé", (operator) => {
    const r = validateWithdraw({ ...ok, operator }, 10000)
    expect(r.ok).toBe(false)
    expect(r.errors.operator).toBeTruthy()
  })
  it("entrées null", () => {
    expect(validateWithdraw(null, 10000).ok).toBe(false)
    expect(validateWithdraw(undefined, 10000).ok).toBe(false)
  })
  it("montants rapides bornés au disponible", () => {
    expect(withdrawQuickAmounts(1999)).toEqual([])
    expect(withdrawQuickAmounts(NaN)).toEqual([])
    expect(withdrawQuickAmounts(12500).at(-1)).toEqual({ value: 12500, all: true })
    expect(withdrawQuickAmounts(12500).every((q) => q.value <= 12500)).toBe(true)
    expect(withdrawQuickAmounts(5000).map((q) => q.value)).toEqual([2000, 5000])
  })
  it("formatLocalPhone / maskLocalPhone", () => {
    expect(formatLocalPhone("0197452108")).toBe("01 97 45 21 08")
    expect(formatLocalPhone("abc")).toBe("")
    expect(formatLocalPhone(null)).toBe("")
    expect(maskLocalPhone("0197452108")).toBe("01 97 •• •• 08")
    expect(maskLocalPhone("x")).toBe("")
  })
})
