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
  { id: "", label: "Plus récentes", short: "Récentes" },
  { id: "prix", label: "Budget croissant", short: "Petit budget" },
  { id: "prix-desc", label: "Budget décroissant", short: "Gros budget" },
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

/**
 * Libellés d'affichage des types de mission. Les valeurs de MISSION_TYPES (clés)
 * restent celles de la base : seul l'affichage change.
 * @type {Readonly<Record<string, string>>}
 */
export const MISSION_TYPE_LABELS = {
  "Livraison": "Marché et achats",
  "Cours particuliers": "Cours et aide aux devoirs",
  "Babysitting": "Garde d'enfants",
  "Saisie": "Travaux sur ordinateur",
  "Community Management": "Réseaux sociaux",
  "Traduction": "Traduction",
  "Démarches": "Démarches et files d'attente",
  "Autre": "Autre besoin",
}

/** Accroches courtes, seulement pour les types qui en ont une. */
export const MISSION_TYPE_TAGLINES = {
  "Livraison": "Le marché à votre place",
  "Démarches": "La file d'attente à votre place",
}

/** Complément de la phrase « Aucune mission de ... » (page /missions). */
export const MISSION_TYPE_PHRASES = {
  "Livraison": "de marché et d'achats",
  "Cours particuliers": "de cours et d'aide aux devoirs",
  "Babysitting": "de garde d'enfants",
  "Saisie": "de travaux sur ordinateur",
  "Community Management": "de réseaux sociaux",
  "Traduction": "de traduction",
  "Démarches": "de démarches et de files d'attente",
  "Autre": "d'un autre besoin",
}

/**
 * Libellé d'affichage d'une valeur de type. Une valeur inconnue (compétence
 * libre d'un étudiant) est renvoyée telle quelle ; null et undefined donnent "".
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function missionTypeLabel(value) {
  if (value === null || value === undefined) return ""
  return Object.hasOwn(MISSION_TYPE_LABELS, value) ? MISSION_TYPE_LABELS[value] : value
}

/**
 * Options { value, label } dans l'ordre de MISSION_TYPES (value = valeur en base).
 * @type {ReadonlyArray<{ value: string, label: string }>}
 */
export const MISSION_TYPE_OPTIONS = MISSION_TYPES.map((value) => ({
  value,
  label: MISSION_TYPE_LABELS[value],
}))
