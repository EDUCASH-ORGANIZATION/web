// Retrait du portefeuille client (C16) : schéma de validation. Pur.
// Le montant ne peut jamais dépasser le DISPONIBLE : les fonds en séquestre ne se retirent pas.
// Ce schéma n'est qu'un confort de saisie : `initiateWithdrawal` ne contrôle que le minimum et le disponible ;
// la fonction Edge `process-withdrawal` (validate.js) et le SQL valident le reste (entier, minimum, numéro
// béninois, opérateur mtn ou moov).
import { z } from "zod"
import { MIN_WITHDRAWAL_AMOUNT } from "../supabase/database.constants.js"
import { formatAmount } from "../app/format.js"
import { parseBeninPhone, BENIN_PHONE_MESSAGES } from "../utils/phone.js"

/**
 * Opérateurs acceptés par la fonction `process-withdrawal` (ALLOWED_OPERATORS : "mtn", "moov").
 * Celtiis Cash n'y est pas géré : il n'est pas proposé.
 */
export const WITHDRAW_OPERATORS = [
  { value: "mtn", label: "MTN MoMo" },
  { value: "moov", label: "Moov Money" },
]

const OPERATOR_VALUES = WITHDRAW_OPERATORS.map((o) => o.value)

/** Libellé d'un opérateur, "" si inconnu. */
export function operatorLabel(value) {
  return WITHDRAW_OPERATORS.find((o) => o.value === value)?.label ?? ""
}

/**
 * Montants rapides : les paliers qui tiennent dans le disponible, puis « tout retirer » (le disponible).
 * @param {number} available
 * @returns {Array<{ value: number, all: boolean }>}
 */
export function withdrawQuickAmounts(available) {
  const max = Math.floor(Number(available) || 0)
  if (max < MIN_WITHDRAWAL_AMOUNT) return []
  const steps = [2000, 5000, 10000].filter((n) => n >= MIN_WITHDRAWAL_AMOUNT && n < max)
  return [...steps.map((value) => ({ value, all: false })), { value: max, all: true }]
}

/**
 * Schéma du formulaire de retrait. `phone` est le numéro saisi librement (espaces tolérés) ; la valeur
 * validée est le numéro national à 10 chiffres (« 0197452108 »), accepté tel quel par la fonction de paiement.
 * @param {number} available Disponible du portefeuille (FCFA), séquestre exclu
 */
export function makeWithdrawSchema(available) {
  const max = Math.max(0, Math.floor(Number(available) || 0))
  return z.object({
    amount: z
      .number({ error: "Indiquez le montant à retirer." })
      .int("Indiquez un montant entier.")
      .min(MIN_WITHDRAWAL_AMOUNT, `Le minimum de retrait est de ${formatAmount(MIN_WITHDRAWAL_AMOUNT)}.`)
      .max(max, `Le montant dépasse votre disponible (${formatAmount(max)}).`),
    phone: z.string({ error: BENIN_PHONE_MESSAGES.empty }).transform((value, ctx) => {
      const parsed = parseBeninPhone(value)
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: BENIN_PHONE_MESSAGES[parsed.reason] })
        return z.NEVER
      }
      return parsed.local
    }),
    operator: z.enum(OPERATOR_VALUES, { error: "Choisissez votre opérateur Mobile Money." }),
  })
}

/**
 * @param {{ amount?: number|null, phone?: string, operator?: string|null }} input
 * @param {number} available
 * @returns {{ ok: true, value: { amount: number, phone: string, operator: "mtn"|"moov" } }
 *   | { ok: false, errors: { amount?: string, phone?: string, operator?: string } }}
 */
export function validateWithdraw(input, available) {
  const result = makeWithdrawSchema(available).safeParse({
    amount: input?.amount ?? undefined,
    phone: input?.phone ?? "",
    operator: input?.operator ?? undefined,
  })
  if (result.success) return { ok: true, value: result.data }
  const errors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (typeof field === "string" && !(field in errors)) errors[field] = issue.message
  }
  return { ok: false, errors }
}

/**
 * Numéro national à 10 chiffres affiché « 01 97 45 21 08 », ou "" s'il n'est pas valide.
 * @param {unknown} raw
 */
export function formatLocalPhone(raw) {
  const parsed = parseBeninPhone(raw)
  return parsed.ok ? parsed.local.replace(/(\d{2})(?=\d)/g, "$1 ") : ""
}

/**
 * Numéro partiellement masqué pour le récapitulatif : « 01 97 •• •• 08 ». "" si le numéro est invalide.
 * @param {unknown} raw
 */
export function maskLocalPhone(raw) {
  const parsed = parseBeninPhone(raw)
  if (!parsed.ok) return ""
  const d = parsed.local
  return `${d.slice(0, 2)} ${d.slice(2, 4)} •• •• ${d.slice(8)}`
}
