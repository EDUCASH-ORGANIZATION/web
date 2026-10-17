// Règles pures de la purge automatique (RD-PURGE-01) : durées, classification de ce qui est purgeable, gardes.
// Module pur : aucun accès aux données, aucune lecture de l'environnement (les valeurs arrivent par paramètres),
// aucun import serveur, Next ou Supabase. Tout est fail-closed : une valeur douteuse (date illisible, drapeau
// inattendu, état inconnu) ne rend jamais une donnée purgeable.
//
// Les dates sont lues et calculées en UTC : le fuseau du serveur n'a aucun effet. Une date sous forme de chaîne
// doit porter son fuseau explicite (Z ou +hh:mm), sinon elle est refusée.

import { toOwnedStoragePath } from "@/lib/storage/owned-paths"

/** Journal de détection (`message_contact_events`) : conservé 180 jours. */
export const JOURNAL_RETENTION_DAYS = 180

/** Signalements clôturés (`reports`) : conservés 12 mois après la clôture. */
export const REPORT_RETENTION_MONTHS = 12

/** Délai de grâce d'un fichier non référencé : jamais purgé avant 7 jours. */
export const ORPHAN_GRACE_DAYS = 7

/**
 * Preuves d'achats encore référencées : supprimées 12 mois après la fin de la mission (D8, décision du 17/10/2026).
 * `null` désactiverait cette catégorie.
 */
export const PROOF_RETENTION_MONTHS = 12

/** Lignes par lot de suppression. */
export const ROW_BATCH = 500

/** Fichiers par appel de suppression. */
export const REMOVE_BATCH = 100

/** Entrées par page de listage Storage. */
export const LIST_PAGE = 1000

/** Aucun nouveau lot n'est lancé après ce délai (ms). */
export const TIME_BUDGET_MS = 40000

/** Disjoncteur : un compartiment est sauté si les candidats dépassent cette part des fichiers examinés... */
export const BREAKER_RATIO = 0.5

/** ... ET ce nombre de fichiers. */
export const BREAKER_MIN_FILES = 25

/** Statuts de signalement considérés comme clôturés. */
export const CLOSED_REPORT_STATUSES = ["resolved", "dismissed"]

/** Statuts de mission qui marquent la fin d'une mission. */
export const ENDED_MISSION_STATUSES = ["done", "cancelled"]

/** Catégories du résumé, dans l'ordre d'exécution (P1, P2, P3, P5, P6, P7, P4). */
export const PURGE_CATEGORIES = [
  "contact_events",
  "closed_reports",
  "proof_orphans",
  "message_media",
  "avatars",
  "student_cards",
  "proof_expired",
]

/** Compteurs de chaque catégorie. */
export const SUMMARY_FIELDS = ["examines", "candidats", "supprimes", "erreurs", "ignores"]

/** Motifs d'arrêt de sécurité journalisables. */
export const STOP_REASONS = ["breaker", "deadline", "error"]

const DAY_MS = 24 * 60 * 60 * 1000

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/i

/**
 * Instant en millisecondes, ou null si la valeur est illisible. Accepte un Date valide, un nombre fini ou une
 * chaîne ISO avec fuseau explicite (les chaînes sans fuseau dépendraient du serveur : refusées).
 * @param {unknown} value
 * @returns {number | null}
 */
export function toTime(value) {
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const m = ISO_PATTERN.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, frac, zone] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const second = s === undefined ? 0 : Number(s)
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null
  const millis = frac === undefined ? 0 : Math.floor(Number(`0.${frac}`) * 1000)
  const base = Date.UTC(year, month - 1, day, hour, minute, second, millis)
  const check = new Date(base)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  if (zone.toUpperCase() === "Z") return base
  const sign = zone[0] === "-" ? -1 : 1
  const digits = zone.slice(1).replace(":", "")
  const offsetH = Number(digits.slice(0, 2))
  const offsetM = digits.length > 2 ? Number(digits.slice(2, 4)) : 0
  if (offsetH > 23 || offsetM > 59) return null
  return base - sign * (offsetH * 60 + offsetM) * 60000
}

function isCount(n) {
  return typeof n === "number" && Number.isInteger(n) && n >= 0
}

/**
 * Date limite : `now` moins N jours (24 h exactes) ou N mois civils UTC (le jour est ramené à la fin du mois
 * d'arrivée si besoin : 31 mars moins 1 mois = 28 ou 29 février). Un objet strictement plus ancien que cette
 * date est expiré. Renvoie null si `now` est illisible ou si la durée n'est pas un entier positif ou nul.
 * @param {unknown} now
 * @param {{ days?: number, months?: number }} duration exactement une des deux clés
 * @returns {Date | null}
 */
export function cutoffDate(now, duration) {
  const t = toTime(now)
  if (t === null || !duration || typeof duration !== "object") return null
  const hasDays = duration.days !== undefined
  const hasMonths = duration.months !== undefined
  if (hasDays === hasMonths) return null
  if (hasDays) {
    if (!isCount(duration.days)) return null
    const r = t - duration.days * DAY_MS
    return Number.isFinite(r) && Math.abs(r) <= 8.64e15 ? new Date(r) : null
  }
  if (!isCount(duration.months)) return null
  const from = new Date(t)
  const total = from.getUTCFullYear() * 12 + from.getUTCMonth() - duration.months
  const year = Math.floor(total / 12)
  const month = total - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(from.getUTCDate(), lastDay)
  const r = new Date(t)
  r.setUTCFullYear(year, month, day)
  return Number.isNaN(r.getTime()) ? null : r
}

function olderThan(value, limit) {
  const t = toTime(value)
  return t !== null && limit !== null && t < limit.getTime()
}

function modeParams(searchParams) {
  if (!searchParams) return []
  try {
    if (typeof searchParams.getAll === "function") return searchParams.getAll("mode")
    if (typeof searchParams.get === "function") return [searchParams.get("mode")]
    if (typeof searchParams === "object") {
      const v = searchParams.mode
      return Array.isArray(v) ? v : [v]
    }
  } catch {
    return ["dry"]
  }
  return []
}

/**
 * Mode d'exécution : "real" seulement si PURGE_ENABLED vaut exactement "true" ET qu'aucun paramètre `mode` ne vaut
 * "dry" (casse et espaces ignorés pour ce paramètre). Toute autre valeur donne "dry".
 * @param {{ env?: Record<string, string | undefined> | null, searchParams?: unknown }} [input]
 * @returns {"dry" | "real"}
 */
export function resolvePurgeMode({ env, searchParams } = {}) {
  if (!env || env.PURGE_ENABLED !== "true") return "dry"
  const forcedDry = modeParams(searchParams).some((v) => typeof v === "string" && v.trim().toLowerCase() === "dry")
  return forcedDry ? "dry" : "real"
}

/**
 * Dérogation au disjoncteur : seulement si PURGE_ALLOW_MASS vaut exactement "true".
 * @param {Record<string, string | undefined> | null | undefined} env
 * @returns {boolean}
 */
export function massAllowed(env) {
  return Boolean(env) && env.PURGE_ALLOW_MASS === "true"
}

/**
 * Un signalement est purgeable s'il est `resolved` ou `dismissed` ET clos depuis plus de 12 mois (date de
 * traitement `handled_at`, à défaut `updated_at`). Une date présente mais illisible n'est jamais remplacée.
 * @param {{ status?: unknown, handled_at?: unknown, updated_at?: unknown } | null | undefined} row
 * @param {unknown} now
 * @returns {boolean}
 */
export function isClosedReportExpired(row, now) {
  if (!row || typeof row !== "object") return false
  if (!CLOSED_REPORT_STATUSES.includes(row.status)) return false
  const closedAt = row.handled_at === null || row.handled_at === undefined ? row.updated_at : row.handled_at
  return olderThan(closedAt, cutoffDate(now, { months: REPORT_RETENTION_MONTHS }))
}

/**
 * Une ligne du journal de détection est purgeable si elle a plus de 180 jours.
 * @param {unknown} createdAt
 * @param {unknown} now
 * @returns {boolean}
 */
export function isJournalEntryExpired(createdAt, now) {
  return olderThan(createdAt, cutoffDate(now, { days: JOURNAL_RETENTION_DAYS }))
}

function hasName(names, name) {
  if (names instanceof Set) return names.has(name)
  return Array.isArray(names) && names.includes(name)
}

function isOldEnough(objectCreatedAt, now) {
  return olderThan(objectCreatedAt, cutoffDate(now, { days: ORPHAN_GRACE_DAYS }))
}

/**
 * Un fichier est un orphelin purgeable si son nom n'est pas dans les références de son propriétaire ET qu'il a
 * plus de 7 jours. Date de création absente ou illisible, nom vide ou liste de références absente (lecture
 * échouée) : jamais candidat.
 * @param {{ objectName?: unknown, objectCreatedAt?: unknown, referencedNames?: Set<string> | string[] | null, now?: unknown }} input
 * @returns {boolean}
 */
export function isOrphanCandidate({ objectName, objectCreatedAt, referencedNames, now } = {}) {
  if (typeof objectName !== "string" || objectName === "") return false
  if (!(referencedNames instanceof Set) && !Array.isArray(referencedNames)) return false
  if (hasName(referencedNames, objectName)) return false
  return isOldEnough(objectCreatedAt, now)
}

/**
 * Classe une preuve d'achat du compartiment `purchase-proofs`.
 * - `request` : null si la demande n'existe plus ; sinon `{ paths, updated_at }` où `paths` (Set ou tableau) est
 *   déjà converti par `referencedPathsOrNull` (jamais null ici : le dossier illisible est ignoré en amont).
 *   `undefined` = inconnu : "keep".
 * - `mission` : `{ status, updated_at }` de la mission de la demande, ou null.
 * - `openReport` : true si un signalement `open` ou `in_progress` porte sur la demande ; doit valoir `false`
 *   exactement pour autoriser "expired".
 * - `lastReportHandledAt` : `handled_at` du dernier signalement de la demande, ou null.
 * Résultats : "orphan" (demande absente), "superseded" (demande présente mais fichier non référencé), tous deux
 * seulement après 7 jours ; "expired" (fichier référencé, mission done/cancelled, aucun signalement ouvert, fin
 * de mission = max(mission, demande, dernier signalement) il y a plus de `retentionMonths` mois) ; sinon "keep".
 * @param {object} input
 * @param {number | null} [input.retentionMonths] durée D8, par défaut PROOF_RETENTION_MONTHS ; null désactive "expired"
 * @returns {"keep" | "orphan" | "superseded" | "expired"}
 */
export function classifyProof({
  path,
  objectCreatedAt,
  request,
  mission,
  openReport,
  lastReportHandledAt,
  now,
  retentionMonths = PROOF_RETENTION_MONTHS,
} = {}) {
  if (typeof path !== "string" || path === "") return "keep"
  if (request === undefined) return "keep"
  if (request === null) return isOldEnough(objectCreatedAt, now) ? "orphan" : "keep"
  if (typeof request !== "object") return "keep"
  const paths = request.paths
  if (!(paths instanceof Set) && !Array.isArray(paths)) return "keep"
  if (!hasName(paths, path)) return isOldEnough(objectCreatedAt, now) ? "superseded" : "keep"

  if (!isCount(retentionMonths)) return "keep"
  if (!mission || typeof mission !== "object" || !ENDED_MISSION_STATUSES.includes(mission.status)) return "keep"
  if (openReport !== false) return "keep"
  const ends = [toTime(mission.updated_at), toTime(request.updated_at)]
  if (lastReportHandledAt !== null && lastReportHandledAt !== undefined) ends.push(toTime(lastReportHandledAt))
  if (ends.some((t) => t === null)) return "keep"
  const endedAt = Math.max(...ends)
  return olderThan(endedAt, cutoffDate(now, { months: retentionMonths })) ? "expired" : "keep"
}

/**
 * Convertit les références brutes d'un propriétaire (colonnes de chemin ou d'URL) en un ensemble de chemins.
 * Les valeurs vides (null, undefined, chaîne blanche) sont ignorées. Renvoie null si UNE valeur non vide n'est pas
 * convertible (URL d'une autre origine, format inconnu, chemin hors du dossier du propriétaire, type inattendu)
 * ou si `values` n'est pas un tableau : tout le dossier du propriétaire doit alors être ignoré.
 * @param {unknown} values
 * @param {string} bucket
 * @param {string} ownerId
 * @returns {Set<string> | null}
 */
export function referencedPathsOrNull(values, bucket, ownerId) {
  if (!Array.isArray(values)) return null
  const paths = new Set()
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value !== "string") return null
    if (value.trim() === "") continue
    const path = toOwnedStoragePath(value, bucket, ownerId)
    if (path === null) return null
    paths.add(path)
  }
  return paths
}

/**
 * Disjoncteur : vrai (compartiment à sauter) si les candidats dépassent 50 % des fichiers examinés ET 25 fichiers,
 * sauf `allowMass === true`. Des nombres invalides font déclencher le disjoncteur (fail-closed).
 * @param {{ examined?: unknown, candidates?: unknown, allowMass?: unknown }} input
 * @returns {boolean}
 */
export function tripsBreaker({ examined, candidates, allowMass } = {}) {
  if (allowMass === true) return false
  if (!isCount(examined) || !isCount(candidates)) return true
  return candidates > BREAKER_MIN_FILES && candidates > examined * BREAKER_RATIO
}

/**
 * Résumé vide d'une exécution : uniquement des compteurs et des motifs d'arrêt, jamais d'identifiant.
 * @param {"dry" | "real"} [mode]
 */
export function emptySummary(mode = "dry") {
  const categories = {}
  for (const category of PURGE_CATEGORIES) {
    categories[category] = Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, 0]))
  }
  return { mode: mode === "real" ? "real" : "dry", categories, arrets: [], duree_ms: 0 }
}

/**
 * Ajoute `n` à un compteur du résumé (modifie et renvoie le résumé). Une catégorie, un compteur ou un nombre
 * inconnus sont une erreur de programmation : exception.
 * @param {ReturnType<typeof emptySummary>} summary
 * @param {string} category
 * @param {string} field
 * @param {number} n
 */
export function addCount(summary, category, field, n) {
  if (!PURGE_CATEGORIES.includes(category)) throw new RangeError("Catégorie de purge inconnue")
  if (!SUMMARY_FIELDS.includes(field)) throw new RangeError("Compteur de purge inconnu")
  if (!isCount(n)) throw new RangeError("Le nombre doit être un entier positif ou nul")
  summary.categories[category][field] += n
  return summary
}

/**
 * Note un arrêt de sécurité (catégorie et motif seulement).
 * @param {ReturnType<typeof emptySummary>} summary
 * @param {string} category
 * @param {"breaker" | "deadline" | "error"} reason
 */
export function addStop(summary, category, reason) {
  if (!PURGE_CATEGORIES.includes(category)) throw new RangeError("Catégorie de purge inconnue")
  if (!STOP_REASONS.includes(reason)) throw new RangeError("Motif d'arrêt inconnu")
  summary.arrets.push({ categorie: category, motif: reason })
  return summary
}

const IDENTIFIER_PATTERNS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /[\\/@]/,
  /\.(?:jpe?g|png|webp|heic|heif|gif|m4a|mp3|webm|ogg|wav|pdf)\b/i,
  /\d{8,}/,
]

/**
 * Vrai si le résumé sérialisé ne contient aucun uuid, chemin, adresse, nom de fichier ni longue suite de chiffres
 * (numéro de téléphone). Un résumé non sérialisable est refusé.
 * @param {unknown} summary
 * @returns {boolean}
 */
export function summaryHasNoIdentifiers(summary) {
  let text
  try {
    text = JSON.stringify(summary)
  } catch {
    return false
  }
  if (typeof text !== "string") return false
  return !IDENTIFIER_PATTERNS.some((p) => p.test(text))
}
