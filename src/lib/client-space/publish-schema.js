// Publication d'une mission (C03) : champs, validation par étape et lecture des paramètres d'URL. Pur.
// Les bornes reprennent celles de `createMission` (mission.actions.js) : le serveur reste l'autorité, cette
// validation n'évite que des allers-retours. Aucune valeur d'URL n'est de confiance : tout est borné et validé.
import { z } from "zod"
import {
  CITIES,
  MIN_MISSION_BUDGET,
  MISSION_TYPES,
  MISSION_URGENCIES,
} from "../supabase/database.constants.js"
import { formatAmount } from "../app/format.js"
import { PURCHASES_ESTIMATE_MAX, purchasesEstimateOf } from "../app/purchases.js"

/** Bornes de texte (celles du serveur). */
export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 3000
/** Longueur minimale de la description : exigence de l'interface, plus stricte que le serveur. */
export const DESCRIPTION_MIN = 50
/** Plafond du budget : 9 chiffres, comme le champ montant. */
export const BUDGET_MAX = 999999999

/** Étapes de l'assistant. */
export const STEPS = [
  { id: 1, label: "Le besoin" },
  { id: 2, label: "Détails" },
  { id: 3, label: "Budget et échéance" },
  { id: 4, label: "Récapitulatif" },
]

/** Champs validés à chaque étape (la quatrième n'en saisit aucun). */
export const STEP_FIELDS = {
  1: ["type", "title"],
  2: ["description", "city", "avecAchats"],
  3: ["budget", "estimationAchats", "urgency", "deadline"],
  4: [],
}

/** Niveaux d'urgence : valeur en base, libellé, courte précision (aucune promesse de délai). */
export const URGENCY_OPTIONS = [
  { value: "low", label: "Standard", sub: "Sans urgence particulière" },
  { value: "medium", label: "Urgent", sub: "À traiter rapidement" },
  { value: "high", label: "Critique", sub: "À traiter en priorité" },
]

// Icônes (sprite) dans l'ordre de MISSION_TYPES : les valeurs en base ne sont jamais réécrites ici.
const TYPE_ICON_BY_INDEX = ["i-baby", "i-bike", "i-keyboard", "i-megaphone", "i-languages", "i-book", "i-file", "i-sparkles"]

/** Icône d'un type de mission, `i-sparkles` pour une valeur inconnue. */
export function typeIcon(type) {
  return TYPE_ICON_BY_INDEX[MISSION_TYPES.indexOf(type)] ?? "i-sparkles"
}

/** Libellé d'une urgence, « Standard » pour une valeur inconnue. */
export function urgencyLabel(value) {
  return (URGENCY_OPTIONS.find((o) => o.value === value) ?? URGENCY_OPTIONS[0]).label
}

/**
 * `avecAchats` : la mission demande des achats (tous les types de mission) ; `estimationAchats` : montant indicatif
 * en FCFA, requis seulement si `avecAchats` est vrai, toujours null sinon.
 * @typedef {{ type: string, title: string, description: string, city: string, budget: number|null, urgency: string, deadline: string,
 *   avecAchats: boolean, estimationAchats: number|null }} PublishValues
 */

/** Valeurs d'une publication vide. @returns {PublishValues} */
export function emptyValues() {
  return { type: "", title: "", description: "", city: "", budget: null, urgency: "low", deadline: "", avecAchats: false, estimationAchats: null }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Date AAAA-MM-JJ réelle (le 30 février est refusé par l'aller-retour ISO).
function isCalendarDate(value) {
  if (!DATE_ONLY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Dernière date acceptée : la fin de l'année qui suit l'année suivante (borne de bon sens). */
export function maxDeadline(today) {
  return `${Number(String(today).slice(0, 4)) + 2}-12-31`
}

/**
 * Schéma complet. `today` est la date du jour au Bénin ("AAAA-MM-JJ", `todayInBenin()`).
 * Une échéance aujourd'hui reste valable (le serveur accepte jusqu'à la fin du jour).
 * @param {string} today
 */
export function makePublishSchema(today) {
  const upper = maxDeadline(today)
  return z.object({
    type: z
      .string({ error: "Choisissez le type de mission." })
      .refine((v) => MISSION_TYPES.includes(v), "Choisissez le type de mission."),
    title: z
      .string({ error: "Indiquez le titre de votre mission." })
      .trim()
      .min(1, "Indiquez le titre de votre mission.")
      .max(TITLE_MAX, `Le titre ne doit pas dépasser ${TITLE_MAX} caractères.`),
    description: z
      .string({ error: "Décrivez votre mission." })
      .trim()
      .min(DESCRIPTION_MIN, `Décrivez votre mission en au moins ${DESCRIPTION_MIN} caractères.`)
      .max(DESCRIPTION_MAX, `La description ne doit pas dépasser ${DESCRIPTION_MAX.toLocaleString("fr-FR")} caractères.`),
    city: z
      .string({ error: "Choisissez la ville de la mission." })
      .refine((v) => CITIES.includes(v), "Choisissez la ville de la mission."),
    budget: z
      .number({ error: "Indiquez le budget de votre mission." })
      .int("Indiquez un budget entier.")
      .min(MIN_MISSION_BUDGET, `Le budget minimum est de ${formatAmount(MIN_MISSION_BUDGET)}.`)
      .max(BUDGET_MAX, "Ce budget est trop élevé."),
    avecAchats: z.boolean({ error: "Indiquez si la mission comporte des achats." }).optional(),
    estimationAchats: z.number({ error: "Indiquez l'estimation des achats." }).nullable().optional(),
    urgency: z
      .string({ error: "Choisissez l'urgence." })
      .refine((v) => MISSION_URGENCIES.includes(v), "Choisissez l'urgence."),
    deadline: z
      .string({ error: "Indiquez la date limite." })
      .min(1, "Indiquez la date limite.")
      .refine(isCalendarDate, "La date limite est invalide.")
      .refine((v) => !isCalendarDate(v) || v >= today, "La date limite ne peut pas être passée.")
      .refine((v) => !isCalendarDate(v) || v <= upper, "La date limite est trop lointaine."),
  }).superRefine((v, ctx) => {
    // L'estimation n'est exigée que si la case « Mission avec achats » est cochée.
    if (v.avecAchats !== true) return
    const n = v.estimationAchats
    let message = null
    if (n === null || n === undefined) message = "Indiquez l'estimation des achats."
    else if (!Number.isInteger(n) || n <= 0) message = "Indiquez une estimation entière, supérieure à zéro."
    else if (n > PURCHASES_ESTIMATE_MAX) message = "Cette estimation est trop élevée."
    if (message) ctx.addIssue({ code: "custom", path: ["estimationAchats"], message })
  })
}

/**
 * Erreurs (une par champ, la première) pour les champs demandés. Objet vide si tout est valide.
 * @param {PublishValues} values
 * @param {string[]} fields
 * @param {string} today
 * @returns {Record<string, string>}
 */
export function validateFields(values, fields, today) {
  const result = makePublishSchema(today).safeParse(values ?? {})
  if (result.success) return {}
  const errors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (fields.includes(field) && !errors[field]) errors[field] = issue.message
  }
  return errors
}

/** Erreurs des champs d'une étape. */
export function validateStep(step, values, today) {
  return validateFields(values, STEP_FIELDS[step] ?? [], today)
}

/**
 * Validation de toute la publication.
 * @returns {{ ok: true, data: ReturnType<typeof toMissionInput> } | { ok: false, errors: Record<string, string>, firstStep: number }}
 */
export function validatePublish(values, today) {
  const all = [1, 2, 3].flatMap((s) => STEP_FIELDS[s])
  const errors = validateFields(values, all, today)
  const firstStep = [1, 2, 3].find((s) => STEP_FIELDS[s].some((f) => errors[f]))
  if (firstStep) return { ok: false, errors, firstStep }
  return { ok: true, data: toMissionInput(values) }
}

/**
 * Charge utile de `createMission` : valeurs nettoyées, sans champ superflu.
 * @param {PublishValues} values
 */
export function toMissionInput(values) {
  const input = {
    title: String(values.title).trim(),
    description: String(values.description).trim(),
    type: values.type,
    city: values.city,
    budget: values.budget,
    urgency: values.urgency,
    deadline: values.deadline,
  }
  // Case décochée : ni drapeau ni estimation ne partent, quelle que soit la valeur restée dans l'état.
  if (values.avecAchats === true) {
    input.with_purchases = true
    input.purchases_estimate = values.estimationAchats
  }
  return input
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Identifiant de mission à dupliquer (`?duplicate=`) : un UUID, sinon "". Une valeur multiple, vide ou
 * d'un autre format est ignorée.
 * @param {unknown} raw
 * @returns {string}
 */
export function parseDuplicateId(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : ""
}

/**
 * Valeurs de départ de l'assistant : préremplissage de l'URL (`besoin`, `ville`, `type`, déjà validé par
 * `parsePublishPrefill`), puis les valeurs d'une mission dupliquée.
 * @param {{ title?: string, city?: string, type?: string }} prefill
 * @param {Partial<PublishValues>|null} [duplicate]
 * @returns {PublishValues}
 */
export function initialValues(prefill, duplicate = null) {
  const base = { ...emptyValues(), title: prefill?.title ?? "", city: prefill?.city ?? "", type: prefill?.type ?? "" }
  if (!duplicate) return base
  return { ...base, ...duplicate }
}

/**
 * Valeurs d'une mission lue en base, nettoyées pour servir de départ à une nouvelle publication.
 * Toute valeur hors bornes est ignorée (champ laissé vide). Aucune échéance n'est reprise.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {Partial<PublishValues>}
 */
export function duplicateValues(row) {
  const r = row ?? {}
  const out = {}
  if (typeof r.title === "string") out.title = Array.from(r.title.trim()).slice(0, TITLE_MAX).join("")
  if (typeof r.description === "string") out.description = Array.from(r.description.trim()).slice(0, DESCRIPTION_MAX).join("")
  if (MISSION_TYPES.includes(r.type)) out.type = r.type
  if (CITIES.includes(r.city)) out.city = r.city
  const budget = Number(r.budget)
  if (Number.isInteger(budget) && budget >= MIN_MISSION_BUDGET && budget <= BUDGET_MAX) out.budget = budget
  if (MISSION_URGENCIES.includes(r.urgency)) out.urgency = r.urgency
  const purchases = purchasesEstimateOf(r.purchases_estimate)
  if (purchases !== null) {
    out.avecAchats = true
    out.estimationAchats = purchases
  }
  return out
}
