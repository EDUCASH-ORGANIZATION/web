// Constantes partagées des missions (vitrine). JS pur, sans "use client" :
// importable par les composants serveur (page.js) et client (mission-explorer.jsx).
import { COMMISSION_RATE, MISSION_TYPES, CITIES } from "../supabase/database.constants.js"

export { COMMISSION_RATE, MISSION_TYPES, CITIES }

/**
 * Montant net reçu par l'étudiant après commission EduCash.
 * @param {number|null|undefined} budget Budget brut de la mission en FCFA
 * @returns {number} Montant net arrondi en FCFA
 */
export function netAmount(budget) {
  return Math.round((budget ?? 0) * (1 - COMMISSION_RATE))
}

/**
 * Tranches de budget filtrables. `max` absent : pas de borne haute.
 * @type {ReadonlyArray<{ id: string, label: string, min: number, max?: number }>}
 */
export const BUDGET_RANGES = [
  { id: "0-5000", label: "Moins de 5 000 FCFA", min: 0, max: 5000 },
  { id: "5000-15000", label: "5 000 à 15 000 FCFA", min: 5000, max: 15000 },
  { id: "15000-30000", label: "15 000 à 30 000 FCFA", min: 15000, max: 30000 },
  { id: "30000+", label: "Plus de 30 000 FCFA", min: 30000 },
]

/** Options de tri ("" = plus récentes). */
export const SORTS = [
  { id: "", label: "Plus récentes" },
  { id: "prix", label: "Budget croissant" },
  { id: "prix-desc", label: "Budget décroissant" },
]

/** Longueur maximale de la recherche texte. */
export const SEARCH_MAX_LENGTH = 100

/** Nombre de missions par page. */
export const MISSIONS_PAGE_SIZE = 9


/**
 * Filtre d'urgence (paramètre `urgence`). Seule l'urgence haute existe en base
 * (`urgency = 'high'`) : aucun palier « critique » n'est inventé.
 * @type {ReadonlyArray<{ id: string, label: string, value: string }>}
 */
export const URGENCY_FILTERS = [{ id: "urgent", label: "Urgent", value: "high" }]
