// @ds-screen RD-ADMIN-01
// Logique pure de la file de vérification admin (AD02). Aucun accès aux données : le serveur fournit `now`.
import { todayInBenin } from "@/lib/vitrine/dates"

export const VERIFICATION_TABS = ["a-examiner", "incomplets", "refuses", "verifies", "expires"]
export const DEFAULT_VERIFICATION_TAB = "a-examiner"
export const OVERDUE_HOURS = 48
export const QUEUE_PAGE_SIZE = 25
export const MAX_PAGE = 1000
export const MAX_QUERY_LENGTH = 80

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** Date "AAAA-MM-JJ" valide (jour réel du calendrier) ou null. */
function readDay(value) {
  if (typeof value !== "string") return null
  const text = value.trim().slice(0, 10)
  if (!DATE_ONLY.test(text)) return null
  const [y, m, d] = text.split("-").map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  const ok = probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
  return ok ? text : null
}

/** Jour du Bénin d'un horodatage ISO, ou null si illisible. */
function beninDay(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === "") return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : todayInBenin(date)
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== ""
}

/**
 * Onglet d'un dossier étudiant.
 * - refuses : un motif de refus est présent.
 * - verifies : vérifié et badge non échu.
 * - expires : badge échu (vérifié ou non), sauf carte renvoyée après l'échéance.
 * - a-examiner : carte présente, non vérifié, sans motif, jamais échu ou carte renvoyée après l'échéance
 *   (ou renouvellement anticipé : échéance future et badge déjà retiré à l'envoi).
 * - incomplets : le reste (pas de carte).
 * @param {{ isVerified?: boolean, verifiedUntil?: string|null, rejectionReason?: string|null, hasCard?: boolean, submittedAt?: string|null }} dossier
 * @param {string} today "AAAA-MM-JJ" (jour du Bénin)
 * @returns {"a-examiner"|"incomplets"|"refuses"|"verifies"|"expires"}
 */
export function classifyDossier(dossier, today) {
  const { isVerified = false, verifiedUntil = null, rejectionReason = null, hasCard = false, submittedAt = null } = dossier ?? {}
  if (hasText(rejectionReason)) return "refuses"

  const until = readDay(verifiedUntil)
  const day = readDay(today)
  const expired = until !== null && day !== null && until < day

  if (isVerified === true) return expired ? "expires" : "verifies"

  if (expired) {
    const resentAfter = beninDay(submittedAt)
    return hasCard && resentAfter !== null && resentAfter > until ? "a-examiner" : "expires"
  }
  return hasCard ? "a-examiner" : "incomplets"
}

/**
 * Repères d'un dossier pour l'écran admin. `overdue48h` est un repère interne (jamais montré à l'étudiant).
 * @param {{ isVerified?: boolean, verifiedUntil?: string|null, rejectionReason?: string|null, hasCard?: boolean, submittedAt?: string|null, createdAt?: string|null }} dossier
 * @param {Date} now
 * @returns {{ tab: string, kind: "renouvellement"|"premiere"|null, overdue48h: boolean, ageDays: number|null }}
 */
export function dossierHints(dossier, now) {
  const tab = classifyDossier(dossier, todayInBenin(now))
  const since = dossier?.submittedAt ?? dossier?.createdAt ?? null
  const start = since ? new Date(since) : null
  const valid = start && !Number.isNaN(start.getTime())
  const elapsed = valid ? now.getTime() - start.getTime() : null
  const kind = tab === "a-examiner" ? (readDay(dossier?.verifiedUntil) ? "renouvellement" : "premiere") : null
  return {
    tab,
    kind,
    overdue48h: tab === "a-examiner" && elapsed !== null && elapsed > OVERDUE_HOURS * 60 * 60 * 1000,
    ageDays: valid ? ageInDays(now, start) : null,
  }
}

/** Jours de calendrier (Bénin) entre `at` et `now`, jamais négatif. */
function ageInDays(now, at) {
  const a = readDay(todayInBenin(now))
  const b = readDay(todayInBenin(at))
  if (!a || !b) return null
  const diff = Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS)
  return Math.max(0, diff)
}

/** « Aujourd'hui », « Hier », « 3 j » ; vide si la date est illisible. */
export function ageLabel(now, at) {
  if (at === null || at === undefined || at === "") return ""
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ""
  const days = ageInDays(now, date)
  if (days === null) return ""
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return "Hier"
  return `${days} j`
}

/**
 * Plus anciens d'abord (date de dépôt, sinon d'inscription) ; date illisible ou absente en dernier ; stable.
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => string|null|undefined} [getDate]
 * @returns {T[]}
 */
export function sortQueue(rows, getDate = (row) => row.submittedAt ?? row.createdAt) {
  const time = (row) => {
    const t = new Date(getDate(row) ?? "").getTime()
    return Number.isNaN(t) ? Infinity : t
  }
  return rows
    .map((row, index) => ({ row, index, t: time(row) }))
    .sort((x, y) => (x.t === y.t ? x.index - y.index : x.t < y.t ? -1 : 1))
    .map((entry) => entry.row)
}

const ACTIONS = {
  "a-examiner": ["approve", "reject"],
  refuses: ["reset"],
  verifies: ["revoke"],
  expires: [],
  incomplets: [],
}

/** Décisions possibles selon l'onglet ; expirés et incomplets : consultation seulement. */
export function allowedActions(tab) {
  return [...(ACTIONS[tab] ?? [])]
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function cleanText(value) {
  if (typeof value !== "string") return ""
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim()
}

/**
 * Paramètres d'URL de la file : onglet en liste fermée, UUID, page bornée, textes bornés à 80 caractères.
 * @param {Record<string, string|string[]|undefined>} [searchParams]
 */
export function parseVerificationParams(searchParams) {
  const raw = searchParams ?? {}
  const onglet = String(firstValue(raw.onglet) ?? "")
  const id = String(firstValue(raw.id) ?? "")
  const pageText = String(firstValue(raw.page) ?? "")
  const page = /^\d{1,15}$/.test(pageText) ? Number(pageText) : 1
  return {
    onglet: VERIFICATION_TABS.includes(onglet) ? onglet : DEFAULT_VERIFICATION_TAB,
    id: UUID.test(id) ? id.toLowerCase() : null,
    q: cleanText(firstValue(raw.q)),
    ecole: cleanText(firstValue(raw.ecole)),
    page: Math.min(Math.max(page, 1), MAX_PAGE),
  }
}

/** Fin de validité d'un badge : un an après le jour de validation (jour du Bénin), 29 février ramené au 28. */
export function badgeUntil(today = todayInBenin()) {
  const day = readDay(today)
  if (!day) throw new Error("Date de validation illisible.")
  const [y, m, d] = day.split("-").map(Number)
  const targetYear = y + 1
  const lastDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate()
  const pad = (n) => String(n).padStart(2, "0")
  return `${targetYear}-${pad(m)}-${pad(Math.min(d, lastDay))}`
}
