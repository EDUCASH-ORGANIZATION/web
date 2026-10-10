// Validation pure de la requete de retrait (aucune dependance Deno).
// Importee par index.ts et testee avec Vitest.

export const MIN_WITHDRAWAL_AMOUNT = 2000
export const ALLOWED_OPERATORS = ["mtn", "moov"]
export const ALLOWED_ROLES = ["student", "client"]

export { extractBearerToken, corsOrigin } from "../_shared/auth.js"

// Numero beninois : 10 chiffres commencant par 01 (format actuel), ou 8 chiffres
// (ancien format) auquel on ajoute le prefixe 01.
// Le prefixe pays (+229, 00229, 229) et les espaces / tirets sont toleres.
// Retourne les 10 chiffres nationaux, ou null si le format est invalide.
export function normalizeBeninPhone(raw) {
  if (typeof raw !== "string") return null
  let digits = raw.trim().replace(/[\s.-]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits.startsWith("00229")) digits = digits.slice(5)
  else if (digits.startsWith("229") && digits.length > 10) digits = digits.slice(3)
  if (!/^\d+$/.test(digits)) return null
  if (/^\d{8}$/.test(digits)) return "01" + digits
  if (/^01\d{8}$/.test(digits)) return digits
  return null
}

// Valide le corps de la requete. L'identite n'en fait jamais partie.
// Retourne { ok: true, value: { amount, phone, operator } } ou { ok: false, error }.
export function validateWithdrawalBody(body) {
  const { amount, phone, operator } = body ?? {}

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide" }
  }
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    return { ok: false, error: `Montant minimum ${MIN_WITHDRAWAL_AMOUNT} FCFA` }
  }
  const normalizedPhone = normalizeBeninPhone(phone)
  if (!normalizedPhone) return { ok: false, error: "Numéro de téléphone invalide" }
  if (!ALLOWED_OPERATORS.includes(operator)) {
    return { ok: false, error: "Opérateur invalide" }
  }

  return { ok: true, value: { amount, phone: normalizedPhone, operator } }
}

// Un profil peut retirer s'il existe, n'est pas suspendu et a un role autorise.
export function canWithdraw(profile) {
  if (!profile) return false
  if (profile.is_suspended === true) return false
  return ALLOWED_ROLES.includes(profile.role)
}
