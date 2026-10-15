// @ds-screen RD-ADMIN-01
// Logique pure de la file de vérification admin (AD02). Aucun accès aux données : le serveur fournit `now`.
import { todayInBenin } from "@/lib/vitrine/dates"

export const VERIFICATION_TABS = ["a-examiner", "incomplets", "refuses", "verifies", "expires"]
export const DEFAULT_VERIFICATION_TAB = "a-examiner"
export const OVERDUE_HOURS = 48
export const QUEUE_PAGE_SIZE = 25
export const MAX_PAGE = 1000
export const MAX_QUERY_LENGTH = 80
export const DELAY_FILTERS = ["plus-48h", "moins-48h"]

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

/** Jour du Bénin ("AAAA-MM-JJ") d'un horodatage ISO, ou null si illisible. */
export function beninDay(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === "") return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : todayInBenin(date)
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== ""
}

/**
 * Jour de la dernière validation d'après l'échéance du badge : fonction inverse de `badgeUntil` (échéance moins un an,
 * 29 février ramené au 28). Une carte déposée à partir de ce jour est un renouvellement à examiner.
 * @param {string} until "AAAA-MM-JJ" valide
 */
export function renewalSinceDay(until) {
  const [y, m, d] = until.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate()
  const pad = (n) => String(n).padStart(2, "0")
  return `${y - 1}-${pad(m)}-${pad(Math.min(d, lastDay))}`
}

/**
 * Onglet d'un dossier étudiant.
 * - refuses : un motif de refus est présent.
 * - verifies : vérifié et badge non échu.
 * - expires : badge échu (vérifié ou non), sauf carte déposée depuis le début de la dernière validation.
 * - a-examiner : carte présente, non vérifié, sans motif, jamais échu, ou carte déposée depuis le jour de la
 *   dernière validation (échéance moins un an, jour du Bénin) : renouvellement anticipé ou envoi le jour même
 *   de l'échéance compris.
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
    const sentOn = beninDay(submittedAt)
    return hasCard && sentOn !== null && sentOn >= renewalSinceDay(until) ? "a-examiner" : "expires"
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
  const delai = String(firstValue(raw.delai) ?? "")
  const page = /^\d{1,15}$/.test(pageText) ? Number(pageText) : 1
  return {
    onglet: VERIFICATION_TABS.includes(onglet) ? onglet : DEFAULT_VERIFICATION_TAB,
    id: UUID.test(id) ? id.toLowerCase() : null,
    q: cleanText(firstValue(raw.q)),
    ecole: cleanText(firstValue(raw.ecole)),
    delai: DELAY_FILTERS.includes(delai) ? delai : "",
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

/**
 * Filtre Délai de l'onglet « À examiner » : `overdue48h` (plus de 48 h depuis le dépôt) ou non. Filtre vide : tout passe.
 * @param {{ overdue48h?: boolean }} hints repères de `dossierHints`
 * @param {string} delai "", "plus-48h" ou "moins-48h"
 */
export function matchesDelay(hints, delai) {
  if (delai === "plus-48h") return hints?.overdue48h === true
  if (delai === "moins-48h") return hints?.overdue48h !== true
  return true
}

/**
 * Années universitaires attendues sur une carte, au format "AAAA-AAAA". Hypothèse : l'année universitaire change au
 * 1er septembre (jour du Bénin). Les deux années (en cours et précédente) sont acceptées : une carte délivrée à la
 * rentrée précédente reste recevable. Valeur de repère pour l'administrateur, jamais une donnée déclarée.
 * @param {string} today "AAAA-MM-JJ"
 * @returns {{ current: string, previous: string } | null} null si la date est illisible
 */
export function expectedAcademicYears(today) {
  const day = readDay(today)
  if (!day) return null
  const [y, m] = day.split("-").map(Number)
  const start = m >= 9 ? y : y - 1
  return { current: `${start}-${start + 1}`, previous: `${start - 1}-${start}` }
}

function nameWords(value) {
  if (typeof value !== "string") return []
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

/**
 * Compare le nom du profil au nom recopié par l'administrateur (accents, casse, ponctuation et espaces ignorés).
 * Résultat pur d'affichage : le nom recopié ne quitte jamais le navigateur.
 * @param {string} profileName
 * @param {string} typedName
 * @returns {null|"identiques"|"ordre-different"|"differents"} null si l'un des deux est vide
 */
export function compareNames(profileName, typedName) {
  const a = nameWords(profileName)
  const b = nameWords(typedName)
  if (a.length === 0 || b.length === 0) return null
  if (a.join(" ") === b.join(" ")) return "identiques"
  return [...a].sort().join(" ") === [...b].sort().join(" ") ? "ordre-different" : "differents"
}

/**
 * Frise « Historique des décisions » d'un dossier, limitée aux dates réellement connues. La date de validation est
 * déduite de l'échéance du badge (échéance moins un an). Aucune date ni auteur de refus n'est conservé : le motif de
 * refus est affiché sans date.
 * @param {{ tab?: string, createdAt?: string|null, submittedAt?: string|null, verifiedUntil?: string|null, rejectionReason?: string|null }} dossier
 * @returns {{ state: "done"|"current"|"error", title: string, at: string|null, meta: string }[]}
 */
export function historySteps(dossier) {
  const { tab, createdAt, submittedAt, verifiedUntil, rejectionReason } = dossier ?? {}
  const steps = []
  const created = beninDay(createdAt)
  if (created) steps.push({ state: "done", title: "Compte créé", at: created, meta: "" })
  const sent = beninDay(submittedAt)
  if (sent) {
    const meta = tab === "a-examiner" ? (readDay(verifiedUntil) ? "renouvellement du badge" : "première demande") : ""
    steps.push({ state: "done", title: "Carte envoyée", at: sent, meta })
  }
  const until = readDay(verifiedUntil)
  if ((tab === "verifies" || tab === "expires") && until) {
    steps.push({ state: "done", title: "Badge validé", at: renewalSinceDay(until), meta: "" })
  }
  if (tab === "expires" && until) steps.push({ state: "error", title: "Badge expiré", at: until, meta: "" })
  if (tab === "refuses") {
    steps.push({ state: "error", title: "Carte refusée", at: null, meta: hasText(rejectionReason) ? rejectionReason.trim() : "" })
  }
  if (tab === "a-examiner") steps.push({ state: "current", title: "En cours d'examen", at: null, meta: "" })
  return steps
}
