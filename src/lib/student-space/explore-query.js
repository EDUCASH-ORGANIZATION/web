// @ds-screen RD-STUDENT-01
// Paramètres de l'explorateur de missions étudiant (E02). Pur : valide les valeurs de l'URL contre les listes
// de la vitrine (V02) et prépare les critères de requête. Toute valeur hors liste est ignorée.
import {
  MISSION_TYPES,
  CITIES,
  BUDGET_RANGES,
  SORTS,
  URGENCY_FILTERS,
  SEARCH_MAX_LENGTH,
  MISSIONS_PAGE_SIZE,
} from "../constants/missions.js"
import { todayInBenin } from "../vitrine/dates.js"

const MAX_PAGE = 100000

// Anciennes valeurs de l'URL étudiant, conservées pour les liens existants.
const LEGACY_SORTS = { budget_asc: "prix", budget_desc: "prix-desc", recent: "" }

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function text(value) {
  const v = first(value)
  return typeof v === "string" ? v : ""
}

function pick(value, allowed) {
  const v = text(value)
  return allowed.includes(v) ? v : ""
}

/**
 * Échappe les caractères spéciaux d'un motif LIKE (\, %, _, *) ainsi que la virgule et les parenthèses,
 * pour une recherche littérale. Le résultat sert de valeur à `.ilike("title", `%${…}%`)`.
 * @param {string} value
 */
export function escapeLike(value) {
  return String(value).replace(/[\\%_*,()]/g, (c) => `\\${c}`)
}

/**
 * Filtre « non expirées » : échéance absente ou aujourd'hui et après (à passer à `.or()`).
 * @param {string} [today] "AAAA-MM-JJ" au Bénin
 */
export function notExpiredFilter(today = todayInBenin()) {
  return `deadline.is.null,deadline.gte.${today}`
}

/**
 * @param {Record<string, string | string[] | undefined> | null | undefined} searchParams
 * @returns {{
 *   q: string, type: string, cities: string[], urgency: string, budget: string, sort: string, page: number,
 *   likePattern: string | null, urgencyValue: string | null,
 *   budgetRange: { min: number, max?: number } | null,
 *   order: { column: "budget" | "created_at", ascending: boolean },
 *   range: { from: number, to: number },
 *   hasFilter: boolean,
 * }}
 */
export function parseExploreParams(searchParams) {
  const sp = searchParams ?? {}
  const q = text(sp.q).trim().slice(0, SEARCH_MAX_LENGTH)
  const type = pick(sp.type, MISSION_TYPES)

  const cities = [...new Set(text(sp.cities).split(",").map((c) => c.trim()))].filter((c) => CITIES.includes(c))

  const rawUrgency = text(sp.urgency)
  const urgencyFilter = URGENCY_FILTERS.find((u) => u.id === rawUrgency || u.value === rawUrgency)
  const urgency = urgencyFilter?.id ?? ""

  const budget = pick(sp.budget, BUDGET_RANGES.map((r) => r.id))
  const rawSort = text(sp.sort)
  const sortId = Object.hasOwn(LEGACY_SORTS, rawSort) ? LEGACY_SORTS[rawSort] : rawSort
  const sort = SORTS.some((s) => s.id === sortId) ? sortId : ""

  const rawPage = Number.parseInt(text(sp.page) || "1", 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, MAX_PAGE) : 1

  const range = BUDGET_RANGES.find((r) => r.id === budget)
  const from = (page - 1) * MISSIONS_PAGE_SIZE

  return {
    q,
    type,
    cities,
    urgency,
    budget,
    sort,
    page,
    likePattern: q ? `%${escapeLike(q)}%` : null,
    urgencyValue: urgencyFilter?.value ?? null,
    budgetRange: range ? { min: range.min, ...(range.max !== undefined ? { max: range.max } : {}) } : null,
    order:
      sort === "prix"
        ? { column: "budget", ascending: true }
        : sort === "prix-desc"
          ? { column: "budget", ascending: false }
          : { column: "created_at", ascending: false },
    range: { from, to: from + MISSIONS_PAGE_SIZE - 1 },
    hasFilter: Boolean(q || type || cities.length || urgency || budget || sort),
  }
}
