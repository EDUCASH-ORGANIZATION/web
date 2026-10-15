// @ds-screen RD-ADMIN-01
// Logique pure des écrans utilisateurs admin (AD03, AD04) : paramètres d'URL, détection de la recherche, pagination.
import { MAX_PAGE, MAX_QUERY_LENGTH } from "@/lib/admin-space/verification-queue"
import { cleanFreeText, uuidSchema } from "@/lib/admin-space/decision-schemas"

export const USERS_PAGE_SIZE = 20
export const USER_ROLES = ["student", "client", "admin"]
export const USER_VERIF_FILTERS = ["verifie", "non-verifie", "refuse", "expire"]
export const USER_STATUS_FILTERS = ["actif", "suspendu"]
export const USER_TABS = ["apercu", "verification", "missions", "portefeuille"]
export const DEFAULT_USER_TAB = "apercu"

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function pick(value, allowed) {
  const text = String(firstValue(value) ?? "")
  return allowed.includes(text) ? text : ""
}

/**
 * Paramètres d'URL de la liste : listes fermées pour le rôle et les filtres, texte borné, page entre 1 et MAX_PAGE.
 * Un filtre de vérification n'a de sens que pour les étudiants : il impose le rôle étudiant.
 * @param {Record<string, string|string[]|undefined>} [searchParams]
 */
export function parseUserParams(searchParams) {
  const raw = searchParams ?? {}
  const q = cleanFreeText(firstValue(raw.q)).slice(0, MAX_QUERY_LENGTH).trim()
  const verif = pick(raw.verif, USER_VERIF_FILTERS)
  const role = verif ? "student" : pick(raw.role, USER_ROLES)
  const pageText = String(firstValue(raw.page) ?? "")
  const page = /^\d{1,15}$/.test(pageText) ? Number(pageText) : 1
  return {
    q,
    role,
    verif,
    statut: pick(raw.statut, USER_STATUS_FILTERS),
    page: Math.min(Math.max(page, 1), MAX_PAGE),
  }
}

/** Onglet de la fiche : liste fermée, « apercu » par défaut. */
export function parseUserTab(value) {
  return pick(value, USER_TABS) || DEFAULT_USER_TAB
}

/** Identifiant de fiche : UUID en minuscules, sinon null. */
export function parseUserId(value) {
  const parsed = uuidSchema.safeParse(value)
  return parsed.success ? parsed.data.toLowerCase() : null
}

/**
 * Téléphone béninois recherché, au format stocké `+22901XXXXXXXX` ; null si la saisie n'en est pas un.
 * Accepte « 01 97 12 34 56 », « 0197123456 », « +229 01 97 12 34 56 », « 22901971234 56 ».
 */
export function normalizeSearchPhone(input) {
  const text = String(input ?? "").trim()
  if (!/^\+?[\d\s.\-()]+$/.test(text)) return null
  const digits = text.replace(/\D/g, "")
  if (digits.length === 10 && digits.startsWith("01")) return `+229${digits}`
  if (digits.length === 13 && digits.startsWith("229")) return `+${digits}`
  return null
}

/**
 * Nature de la recherche : e-mail (contient « @ »), téléphone, sinon nom. Une seule colonne est interrogée à la
 * fois : aucune saisie n'est jamais insérée dans un filtre `.or()`.
 * @returns {{ kind: "none" | "email" | "phone" | "name", value: string }}
 */
export function detectSearch(q) {
  const text = String(q ?? "").trim()
  if (text === "") return { kind: "none", value: "" }
  if (text.includes("@")) return { kind: "email", value: text.toLowerCase() }
  const phone = normalizeSearchPhone(text)
  if (phone) return { kind: "phone", value: phone }
  return { kind: "name", value: text }
}

/** Correspondance d'un e-mail : exacte ou préfixe, sans tenir compte de la casse. */
export function emailMatches(email, wanted) {
  const a = String(email ?? "").toLowerCase()
  const b = String(wanted ?? "").toLowerCase()
  return b !== "" && (a === b || a.startsWith(b))
}

/** Dernière page existante pour un total (au moins 1). */
export function lastPage(total, size = USERS_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(total) || 0) / size))
}

/**
 * Pages numérotées avec points de suspension : première, dernière et voisines de la page courante.
 * @returns {Array<number | "...">}
 */
export function pageWindow(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const wanted = new Set([1, count, page - 1, page, page + 1])
  const sorted = [...wanted].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out = []
  for (const n of sorted) {
    if (out.length > 0 && n - out[out.length - 1] > 1) out.push("...")
    out.push(n)
  }
  return out
}

/** Libellé de la vérification d'un compte étudiant d'après l'onglet de `classifyDossier` ; vide hors étudiant. */
export function verificationLabel(role, tab) {
  if (role !== "student") return ""
  switch (tab) {
    case "verifies":
      return "Vérifié"
    case "a-examiner":
      return "En cours d'examen"
    case "refuses":
      return "Carte refusée"
    case "expires":
      return "Badge expiré"
    default:
      return "Non vérifié"
  }
}
