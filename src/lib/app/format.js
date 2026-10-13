// Formats d'affichage de l'espace connecté. Pur : importable côté client et serveur.
import { formatFcfa, formatDateFr } from "../vitrine/format.js"
import { todayInBenin, isPastDeadline } from "../vitrine/dates.js"

export { formatFcfa, formatDateFr, todayInBenin, isPastDeadline }

const BENIN_TZ = "Africa/Porto-Novo"
const NARROW_NBSP = " "
const NBSP = " "
const MINUS = "−"

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function toDate(value) {
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  return dateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value)
}

/**
 * Date courte avec jour de semaine, ex. "jeu. 8 oct.".
 * @param {string|Date} isoOrDate
 * @returns {string}
 */
export function formatShortDate(isoOrDate) {
  const dateOnly = typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: dateOnly ? "UTC" : BENIN_TZ,
  }).format(toDate(isoOrDate))
}

/**
 * Durée écoulée depuis une date, ex. "il y a 3 j". Une date future donne "dans 3 j".
 * @param {string|Date} isoOrDate
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelative(isoOrDate, now = new Date()) {
  const diff = now.getTime() - toDate(isoOrDate).getTime()
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
 * @param {number} n
 * @param {{ sign?: "debit" | "credit" | "none" }} [options]
 * @returns {string}
 */
export function formatAmount(n, { sign = "none" } = {}) {
  const value = Math.abs(Number(n) || 0)
  const digits = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\s  ]/g, NARROW_NBSP)
  const prefix = sign === "debit" ? MINUS : sign === "credit" ? "+" : ""
  return `${prefix}${digits}${NBSP}FCFA`
}
