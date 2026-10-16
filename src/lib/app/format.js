// Formats d'affichage de l'espace connecté. Pur : importable côté client et serveur.
import { formatFcfa, formatDateFr } from "../vitrine/format.js"
import { todayInBenin, isPastDeadline } from "../vitrine/dates.js"

export { formatFcfa, formatDateFr, todayInBenin, isPastDeadline }

/**
 * Date en toutes lettres, ou "" si la valeur est absente (null, undefined, "", 0) ou invalide : une date illisible ne
 * fait jamais planter la page (formatDateFr lève RangeError sur une date invalide), et 0 n'affiche pas 1970.
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export function safeDateFr(value) {
  if (!value) return ""
  try {
    return formatDateFr(value)
  } catch {
    return ""
  }
}

const BENIN_TZ = "Africa/Porto-Novo"
const NARROW_NBSP = " "
const NBSP = " "
const MINUS = "−"

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function toDate(value) {
  if (value === null || value === undefined) return new Date(NaN)
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!dateOnly) return new Date(value)
  const date = new Date(`${value}T00:00:00Z`)
  // Contrôle aller-retour : "2026-02-30" déborderait sur mars, la date est refusée.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : new Date(NaN)
}

/**
 * Date courte avec jour de semaine, ex. "jeu. 8 oct.". Renvoie "" pour une date absente ou invalide.
 * @param {string|Date|null|undefined} isoOrDate
 * @returns {string}
 */
export function formatShortDate(isoOrDate) {
  const date = toDate(isoOrDate)
  if (Number.isNaN(date.getTime())) return ""
  const dateOnly = typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: dateOnly ? "UTC" : BENIN_TZ,
  }).format(date)
}

/**
 * Durée écoulée depuis une date, ex. "il y a 3 j". Une date future donne "dans 3 j".
 * Renvoie "" pour une date absente ou invalide.
 * @param {string|Date|null|undefined} isoOrDate
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelative(isoOrDate, now = new Date()) {
  const time = toDate(isoOrDate).getTime()
  if (Number.isNaN(time)) return ""
  const diff = now.getTime() - time
  if (Number.isNaN(diff)) return ""
  const abs = Math.abs(diff)
  if (abs < MIN) return "à l'instant"
  let amount
  let unit
  if (abs < HOUR) {
    amount = Math.floor(abs / MIN)
    unit = "min"
  } else if (abs < DAY) {
    amount = Math.floor(abs / HOUR)
    unit = "h"
  } else {
    amount = Math.floor(abs / DAY)
    unit = "j"
  }
  return diff >= 0 ? `il y a ${amount} ${unit}` : `dans ${amount} ${unit}`
}

/**
 * Montant en FCFA avec espace fine insécable entre les milliers et espace insécable avant l'unité,
 * ex. "12 500 FCFA". `sign` "debit" préfixe le vrai signe moins, "credit" le signe plus.
 * Sans `sign`, la valeur absolue est affichée : `formatAmount(-500)` renvoie "500 FCFA".
 * Une valeur absente, non numérique ou non finie (NaN, Infinity) est traitée comme 0 : "0 FCFA".
 * Le signe n'est jamais affiché devant zéro.
 * @param {number} n
 * @param {{ sign?: "debit" | "credit" | "none" }} [options]
 * @returns {string}
 */
export function formatAmount(n, { sign = "none" } = {}) {
  const num = Number(n)
  const value = Number.isFinite(num) ? Math.abs(num) : 0
  const digits = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\s  ]/g, NARROW_NBSP)
  const rounded = Math.round(value)
  const prefix = rounded === 0 ? "" : sign === "debit" ? MINUS : sign === "credit" ? "+" : ""
  return `${prefix}${digits}${NBSP}FCFA`
}

/**
 * Initiales d'un nom : première lettre du premier mot et du dernier mot ; un seul mot : ses deux premières
 * lettres ; nom vide ou absent : « ? ».
 * @param {unknown} name  seule une chaîne est prise en compte (nombre, objet, null : « ? »)
 * @returns {string}
 */
export function initialsOf(name) {
  const words = (typeof name === "string" ? name : "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[words.length - 1]][0]]
  return letters.join("").toLocaleUpperCase("fr-FR")
}
