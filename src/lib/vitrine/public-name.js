const FALLBACK_STUDENT = "Étudiant EduCash"
const FALLBACK_CLIENT = "Client"

function words(fullName) {
  if (typeof fullName !== "string") return []
  return fullName.trim().split(/\s+/).filter(Boolean)
}

/**
 * Nom affichable publiquement : "Prénom I." par défaut, nom nettoyé avec `full`.
 * @param {string|null|undefined} fullName
 * @param {{ full?: boolean }} [options]
 * @returns {string}
 */
export function publicDisplayName(fullName, { full = false } = {}) {
  const parts = words(fullName)
  if (parts.length === 0) return FALLBACK_STUDENT
  if (full) return parts.join(" ")
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  return `${parts[0]} ${last.charAt(0).toLocaleUpperCase("fr-FR")}.`
}

/**
 * Premier mot du nom, ou `fallback` ("Client" par défaut) si le nom est vide.
 * @param {string|null|undefined} fullName
 * @param {{ fallback?: string }} [options]
 * @returns {string}
 */
export function firstName(fullName, { fallback = FALLBACK_CLIENT } = {}) {
  return words(fullName)[0] ?? fallback
}
