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
