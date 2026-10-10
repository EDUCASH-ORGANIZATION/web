import { z } from "zod"

export const COUNTRY_CODES = [
  { code: "+229", label: "🇧🇯 Bénin (+229)" },
  { code: "+225", label: "🇨🇮 Côte d'Ivoire (+225)" },
  { code: "+233", label: "🇬🇭 Ghana (+233)" },
  { code: "+234", label: "🇳🇬 Nigeria (+234)" },
  { code: "+221", label: "🇸🇳 Sénégal (+221)" },
  { code: "+226", label: "🇧🇫 Burkina Faso (+226)" },
  { code: "+227", label: "🇳🇪 Niger (+227)" },
  { code: "+242", label: "🇨🇬 Congo (+242)" },
  { code: "+241", label: "🇬🇦 Gabon (+241)" },
  { code: "+237", label: "🇨🇲 Cameroun (+237)" },
  { code: "+33", label: "🇫🇷 France (+33)" },
  { code: "+1", label: "🇺🇸 USA/Canada (+1)" },
  { code: "+44", label: "🇬🇧 Royaume-Uni (+44)" },
  { code: "+49", label: "🇩🇪 Allemagne (+49)" },
  { code: "+91", label: "🇮🇳 Inde (+91)" },
  { code: "+86", label: "🇨🇳 Chine (+86)" },
  { code: "+other", label: "Autre indicatif" },
]

export function parsePhone(phone = "") {
  const clean = phone.replace(/\s+/g, "")
  const known = COUNTRY_CODES.filter((c) => c.code !== "+other").find((c) => clean.startsWith(c.code))
  if (known) {
    return { countryCode: known.code, phoneNumber: clean.slice(known.code.length), otherCode: "" }
  }
  if (clean.startsWith("+")) {
    const match = clean.match(/^\+(\d{1,4})(\d*)$/)
    if (match) return { countryCode: "+other", phoneNumber: match[2], otherCode: `+${match[1]}` }
  }
  return { countryCode: "+229", phoneNumber: clean, otherCode: "" }
}

export function formatPhone(countryCode, phoneNumber, otherCode) {
  if (countryCode === "+other") return `${otherCode}${phoneNumber}`.trim()
  const num = phoneNumber.replace(/\s+/g, "")
  return num ? `${countryCode}${num}` : ""
}

export function normalizeBeninPhone(number) {
  const digits = number.replace(/\D/g, "")
  return digits.slice(0, 10)
}

export function validatePhone(countryCode, phoneNumber, otherCode) {
  const finalPhone = formatPhone(countryCode, phoneNumber, otherCode)
  if (!finalPhone) return "Le numéro de téléphone est requis."
  const localNumber = phoneNumber.replace(/\D/g, "")
  if (countryCode === "+229" && localNumber.length !== 10) {
    return "Le numéro béninois doit commencer par 01 et contenir 10 chiffres (ex: 01 00 00 00 00)."
  }
  if (countryCode === "+other" && !/^\+\d{1,4}$/.test(otherCode)) {
    return "Indicatif international invalide (ex: +225)."
  }
  if (localNumber.length < 6) {
    return "Le numéro de téléphone semble trop court."
  }
  return null
}

// ─── Numéros béninois (10 chiffres, commencent par 01) ─────────────────────────

export const BENIN_PREFIX = "+229"

const BENIN_LOCAL_PATTERN = /^01\d{8}$/

/**
 * Analyse un numéro béninois saisi librement.
 * Accepte espaces, points, tirets, parenthèses et les préfixes +229 / 00229.
 * @param {unknown} raw
 * @returns {{ ok: true, local: string, e164: string }
 *   | { ok: false, reason: "empty" | "invalid_chars" | "length" | "prefix" }}
 */
export function parseBeninPhone(raw) {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (!text) return { ok: false, reason: "empty" }

  let compact = text.replace(/[\s.\-()]/g, "")
  if (compact.startsWith("+229")) compact = compact.slice(4)
  else if (compact.startsWith("00229")) compact = compact.slice(5)

  if (!/^\d+$/.test(compact)) return { ok: false, reason: "invalid_chars" }
  if (compact.length !== 10) return { ok: false, reason: "length" }
  if (!BENIN_LOCAL_PATTERN.test(compact)) return { ok: false, reason: "prefix" }
  return { ok: true, local: compact, e164: `${BENIN_PREFIX}${compact}` }
}

/**
 * Numéro au format stocké : +22901XXXXXXXX. Renvoie "" si le numéro est invalide.
 * @param {unknown} raw
 */
export function toBeninE164(raw) {
  const parsed = parseBeninPhone(raw)
  return parsed.ok ? parsed.e164 : ""
}

/**
 * Affichage « 01 97 45 21 08 ». Un numéro invalide est renvoyé tel quel.
 * @param {unknown} raw
 */
export function formatBeninPhone(raw) {
  const parsed = parseBeninPhone(raw)
  if (!parsed.ok) return typeof raw === "string" ? raw : ""
  return parsed.local.replace(/(\d{2})(?=\d)/g, "$1 ")
}

export const BENIN_PHONE_MESSAGES = {
  empty: "Indiquez votre numéro de téléphone.",
  invalid_chars: "Le numéro ne doit contenir que des chiffres. Ex. 01 97 45 21 08",
  length: "Le numéro doit avoir 10 chiffres et commencer par 01. Ex. 01 97 45 21 08",
  prefix: "Le numéro béninois commence par 01. Ex. 01 97 45 21 08",
}

/**
 * Schéma zod d'un numéro béninois ; la valeur validée est au format E.164.
 * @param {Partial<typeof BENIN_PHONE_MESSAGES>} [messages]
 */
export function makeBeninPhoneSchema(messages = {}) {
  const texts = { ...BENIN_PHONE_MESSAGES, ...messages }
  return z
    .string({ error: texts.empty })
    .transform((value, ctx) => {
      const parsed = parseBeninPhone(value)
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: texts[parsed.reason] })
        return z.NEVER
      }
      return parsed.e164
    })
}

/** Schéma avec les messages neutres par défaut. */
export const beninPhoneSchema = makeBeninPhoneSchema()
