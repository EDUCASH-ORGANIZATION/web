const BENIN_TZ = "Africa/Porto-Novo"

/**
 * Date du jour au Bénin (UTC+1) au format "AAAA-MM-JJ".
 * @param {Date} [now]
 * @returns {string}
 */
export function todayInBenin(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BENIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type).value
  return `${get("year")}-${get("month")}-${get("day")}`
}

/**
 * Indique si l'échéance est strictement antérieure à aujourd'hui.
 * Une échéance nulle ne compte jamais comme dépassée.
 * @param {string|null|undefined} deadline "AAAA-MM-JJ"
 * @param {string} today "AAAA-MM-JJ"
 * @returns {boolean}
 */
export function isPastDeadline(deadline, today) {
  if (!deadline) return false
  return deadline.slice(0, 10) < today
}
