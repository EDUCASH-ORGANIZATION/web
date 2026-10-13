import { describe, it, expect } from "vitest"
import {
  makeWithdrawSchema,
  validateWithdraw,
  withdrawQuickAmounts,
  WITHDRAW_OPERATORS,
  operatorLabel,
  formatLocalPhone,
  maskLocalPhone,
} from "./withdraw-schema"
import { formatAmount } from "../app/format"
import { ALLOWED_OPERATORS, MIN_WITHDRAWAL_AMOUNT } from "../../../supabase/functions/process-withdrawal/validate.js"

const ok = { amount: 10000, phone: "01 97 45 21 08", operator: "mtn" }

describe("validateWithdraw", () => {
  it("accepte un retrait valide et renvoie le numéro national à 10 chiffres", () => {
    expect(validateWithdraw(ok, 12500)).toEqual({ ok: true, value: { amount: 10000, phone: "0197452108", operator: "mtn" } })
  })

  it("accepte le minimum et le disponible exact, jamais plus", () => {
    expect(validateWithdraw({ ...ok, amount: 2000 }, 12500).ok).toBe(true)
    expect(validateWithdraw({ ...ok, amount: 12500 }, 12500).ok).toBe(true)
    const over = validateWithdraw({ ...ok, amount: 12501 }, 12500)
    expect(over.ok).toBe(false)
    expect(over.errors.amount).toBe(`Le montant dépasse votre disponible (${formatAmount(12500)}).`)
  })

  it("refuse un montant sous le minimum, vide, négatif ou décimal", () => {
    expect(validateWithdraw({ ...ok, amount: 1999 }, 12500).errors.amount).toBe(`Le minimum de retrait est de ${formatAmount(2000)}.`)
    expect(validateWithdraw({ ...ok, amount: null }, 12500).errors.amount).toBe("Indiquez le montant à retirer.")
    expect(validateWithdraw({ ...ok, amount: -5 }, 12500).ok).toBe(false)
    expect(validateWithdraw({ ...ok, amount: 2500.5 }, 12500).ok).toBe(false)
  })

  it("ne laisse jamais retirer le séquestre : disponible nul ou sous le minimum, tout est refusé", () => {
    expect(validateWithdraw(ok, 0).ok).toBe(false)
    expect(validateWithdraw({ ...ok, amount: 2000 }, 1999).ok).toBe(false)
    expect(validateWithdraw(ok, Number.NaN).ok).toBe(false)
    expect(validateWithdraw(ok, undefined).ok).toBe(false)
  })

  it("refuse un numéro non béninois ou mal formé", () => {
    for (const phone of ["", "0697452108", "019745210", "01974521088", "01 97 45 21 0a", "+33612345678"]) {
      const r = validateWithdraw({ ...ok, phone }, 12500)
      expect(r.ok).toBe(false)
      expect(r.errors.phone).toBeTruthy()
    }
  })

  it("tolère les préfixes pays, espaces et tirets", () => {
    for (const phone of ["+229 01 97 45 21 08", "00229-01-97-45-21-08", "0197452108", "01.97.45.21.08"]) {
      expect(validateWithdraw({ ...ok, phone }, 12500).value?.phone).toBe("0197452108")
    }
  })

  it("exige un opérateur parmi mtn et moov", () => {
    expect(validateWithdraw({ ...ok, operator: "moov" }, 12500).ok).toBe(true)
    for (const operator of [null, undefined, "", "celtiis", "MTN", "orange"]) {
      expect(validateWithdraw({ ...ok, operator }, 12500).errors.operator).toBe("Choisissez votre opérateur Mobile Money.")
    }
  })

  it("rapporte chaque champ en erreur, un message par champ", () => {
    const r = validateWithdraw({ amount: null, phone: "", operator: null }, 12500)
    expect(Object.keys(r.errors).sort()).toEqual(["amount", "operator", "phone"])
  })

  it("tolère une entrée absente", () => {
    expect(validateWithdraw(undefined, 12500).ok).toBe(false)
  })
})

describe("cohérence avec la fonction de retrait", () => {
  it("les opérateurs proposés sont exactement ceux acceptés par process-withdrawal", () => {
    expect(WITHDRAW_OPERATORS.map((o) => o.value)).toEqual(ALLOWED_OPERATORS)
  })

  it("le minimum est celui de la fonction", () => {
    expect(makeWithdrawSchema(100000).safeParse({ amount: MIN_WITHDRAWAL_AMOUNT - 1, phone: "0197452108", operator: "mtn" }).success).toBe(false)
    expect(makeWithdrawSchema(100000).safeParse({ amount: MIN_WITHDRAWAL_AMOUNT, phone: "0197452108", operator: "mtn" }).success).toBe(true)
  })
})

describe("withdrawQuickAmounts", () => {
  it("propose les paliers inférieurs au disponible puis tout retirer", () => {
    expect(withdrawQuickAmounts(12500)).toEqual([
      { value: 2000, all: false },
      { value: 5000, all: false },
      { value: 10000, all: false },
      { value: 12500, all: true },
    ])
    expect(withdrawQuickAmounts(5000)).toEqual([{ value: 2000, all: false }, { value: 5000, all: true }])
  })

  it("ne propose rien sous le minimum", () => {
    expect(withdrawQuickAmounts(1999)).toEqual([])
    expect(withdrawQuickAmounts(0)).toEqual([])
    expect(withdrawQuickAmounts(undefined)).toEqual([])
  })
})

describe("numéros", () => {
  it("formate et masque", () => {
    expect(formatLocalPhone("+229 0197452108")).toBe("01 97 45 21 08")
    expect(maskLocalPhone("01 97 45 21 08")).toBe("01 97 •• •• 08")
    expect(formatLocalPhone("12")).toBe("")
    expect(maskLocalPhone("12")).toBe("")
    expect(maskLocalPhone(null)).toBe("")
  })

  it("libellé d'opérateur", () => {
    expect(operatorLabel("mtn")).toBe("MTN MoMo")
    expect(operatorLabel("moov")).toBe("Moov Money")
    expect(operatorLabel("celtiis")).toBe("")
  })
})
