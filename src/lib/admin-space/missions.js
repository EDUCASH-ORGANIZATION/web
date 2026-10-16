// @ds-screen RD-ADMIN-01
// Logique pure de la liste des missions admin (AD06) : paramètres d'URL validés, onglets, libellés.
import { CITIES, MISSION_TYPES } from "@/lib/constants/missions"

/** Onglets-filtres : valeurs en base, plus « toutes » et « à confirmer » (en cours avec une fin déclarée par l'étudiant, colonne `completion_declared_at`). */
export const MISSION_TABS = ["toutes", "open", "in_progress", "a-confirmer", "done", "cancelled"]
export const DEFAULT_MISSION_TAB = "toutes"
export const MISSIONS_ADMIN_PAGE_SIZE = 25
export const MISSIONS_SEARCH_MAX = 80
const PAGE_MAX = 100000

export const MISSION_TAB_LABELS = {
  toutes: "Toutes",
  open: "Ouvertes",
  in_progress: "En cours",
  "a-confirmer": "À confirmer",
  done: "Terminées",
  cancelled: "Annulées",
}

function single(value) {
  return Array.isArray(value) ? value[0] : value
}

// Caractères de contrôle retirés, espaces normalisés, borne de longueur.
function cleanText(value, max) {
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

/**
 * Paramètres d'URL de la liste. Toute valeur hors liste fermée est ignorée (valeur par défaut), jamais d'erreur.
 * @param {Record<string, unknown> | null | undefined} searchParams
 * @returns {{ statut: string, q: string, ville: string, type: string, page: number }}
 */
export function parseMissionsParams(searchParams) {
  const raw = searchParams && typeof searchParams === "object" ? searchParams : {}
  const statut = single(raw.statut)
  const ville = single(raw.ville)
  const type = single(raw.type)
  const page = single(raw.page)
  const pageNumber = typeof page === "string" && /^\d{1,6}$/.test(page) ? Number.parseInt(page, 10) : 1
  return {
    statut: MISSION_TABS.includes(statut) ? statut : DEFAULT_MISSION_TAB,
    q: cleanText(single(raw.q), MISSIONS_SEARCH_MAX),
    ville: typeof ville === "string" && CITIES.includes(ville) ? ville : "",
    type: typeof type === "string" && MISSION_TYPES.includes(type) ? type : "",
    page: Math.min(Math.max(pageNumber, 1), PAGE_MAX),
  }
}

/** Numéro de page effectif : borné à la dernière page (au moins 1). */
export function clampPage(page, total, pageSize = MISSIONS_ADMIN_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil((Number(total) || 0) / pageSize))
  return { page: Math.min(Math.max(1, page), pageCount), pageCount }
}
