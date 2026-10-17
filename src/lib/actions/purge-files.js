import "server-only"
import {
  PROOF_RETENTION_MONTHS,
  REMOVE_BATCH,
  CLOSED_REPORT_STATUSES,
  SUMMARY_FIELDS,
  classifyProof,
  isOrphanCandidate,
  referencedPathsOrNull,
  toTime,
  tripsBreaker,
} from "@/lib/purge/purge-rules"
import { listFiles, listOwnerFolders, listProofFiles, removePaths } from "@/lib/purge/storage-walk"

// Purge des fichiers de Storage (RD-PURGE-01, P3 à P7) : compartiments purchase-proofs, message-media, avatars et
// student-cards. Le client service role est INJECTÉ par l'appelant (aucune création ici). Suppression uniquement par
// l'API Storage (`removePaths`), jamais de DELETE SQL. Aucune directive d'action serveur : ces fonctions ne doivent
// pas devenir des actions appelables du navigateur. Aucun journal : seuls des compteurs sont renvoyés.
//
// Règles (fail-closed) : un fichier n'est candidat que s'il n'est plus référencé par aucune ligne ET créé depuis
// plus de 7 jours. Les références sont lues par propriétaire, colonnes explicites. Si elles sont illisibles (erreur,
// valeur non convertible en chemin), le dossier entier est ignoré. Un disjoncteur par compartiment saute le
// compartiment quand les candidats sont trop nombreux (levé seulement par `allowMass === true`).
//
// Références connues de chaque compartiment (aucune autre colonne ne désigne un de ces fichiers) :
// - purchase-proofs : purchase_requests.payee_photo_path et ticket_photo_path (dossier de l'étudiant),
//   sms_photo_path (dossier du client) ;
// - message-media : messages.media_url (dossier de l'expéditeur) ;
// - avatars : profiles.avatar_url ; student-cards : student_profiles.card_url.
//
// Résultat de chaque fonction : `{ categories, stops }`. `categories` associe à chaque catégorie purgée de
// PURGE_CATEGORIES les compteurs de SUMMARY_FIELDS (examines, candidats, supprimes, erreurs, ignores) ; `stops`
// liste les motifs d'arrêt de sécurité ("breaker", "deadline", "error"), sans doublon.

const PAGE = 1000
const MAX_PAGES = 1000
const IN_CHUNK = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PROOF_BUCKET = "purchase-proofs"
const MEDIA_BUCKET = "message-media"
const AVATAR_BUCKET = "avatars"
const CARD_BUCKET = "student-cards"

function emptyCounters() {
  return Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, 0]))
}

function expired(deadline) {
  return typeof deadline === "number" && Date.now() >= deadline
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function chunks(values, size) {
  const out = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

/**
 * Lit toutes les lignes d'une requête, page par page (PostgREST plafonne une réponse). Renvoie null à la première
 * erreur ou si le volume dépasse le garde-fou : les références sont alors illisibles.
 * @param {(from: number, to: number) => PromiseLike<{ data: unknown, error: unknown }>} page
 * @returns {Promise<object[] | null>}
 */
async function readAll(page) {
  const rows = []
  try {
    // PostgREST peut plafonner une réponse sous PAGE (max_rows) : l'offset avance du nombre de lignes reçues et seule
    // une page vide termine la lecture.
    for (let i = 0; i < MAX_PAGES; i += 1) {
      const { data, error } = await page(rows.length, rows.length + PAGE - 1)
      if (error || !Array.isArray(data)) return null
      if (data.length === 0) return rows
      for (const row of data) {
        if (!row || typeof row !== "object") return null
        rows.push(row)
      }
    }
  } catch {
    return null
  }
  return null
}

/** Lit toutes les lignes d'une requête filtrée par `in(column, ids)`, par paquets d'identifiants. */
async function readByIds(service, table, columns, column, ids) {
  const rows = []
  for (const chunk of chunks(ids, IN_CHUNK)) {
    const part = await readAll((from, to) =>
      service.from(table).select(columns).in(column, chunk).order("id", { ascending: true }).range(from, to),
    )
    if (part === null) return null
    rows.push(...part)
  }
  return rows
}

/**
 * Parcourt TOUT le compartiment dossier par dossier en cumulant les candidats, applique le disjoncteur une seule
 * fois sur les totaux du compartiment, puis supprime par paquets (`removePaths`). `evaluateOwner(ownerId)` renvoie `{ failed, timedOut, ignored, examined, candidates }` où
 * `candidates` liste `{ path, category }`.
 */
async function purgeBucket({ service, bucket, categories, evaluateOwner, options }) {
  const { now, mode, deadline, allowMass } = options
  const counters = Object.fromEntries(categories.map((c) => [c, emptyCounters()]))
  const result = { categories: counters, stops: [] }
  const stop = (reason) => {
    if (!result.stops.includes(reason)) result.stops.push(reason)
  }
  const dryRun = mode !== "real"
  if (toTime(now) === null) {
    stop("error")
    return result
  }

  let examined = 0
  const pending = []

  const owners = await listOwnerFolders(service, bucket, { deadline })
  if (owners.error) {
    // Compartiment absent ou illisible : rien n'est examiné ni supprimé.
    stop(owners.timedOut ? "deadline" : "error")
    if (!owners.timedOut) for (const c of categories) counters[c].ignores += 1
    return result
  }

  for (const ownerId of owners.folders) {
    if (expired(deadline)) {
      stop("deadline")
      break
    }
    if (!isUuid(ownerId)) {
      for (const c of categories) counters[c].ignores += 1
      continue
    }
    const r = await evaluateOwner(ownerId)
    if (r.timedOut) {
      stop("deadline")
      break
    }
    if (r.failed) {
      for (const c of categories) counters[c].erreurs += 1
      continue
    }
    examined += r.examined
    for (const c of categories) {
      counters[c].examines += r.examined
      counters[c].ignores += r.ignored
    }
    for (const candidate of r.candidates) counters[candidate.category].candidats += 1
    pending.push(...r.candidates)
  }

  // Le disjoncteur porte sur les totaux du compartiment entier, évalués avant toute suppression. Une échéance
  // atteinte pendant le parcours : rien n'est supprimé pour ce compartiment.
  if (result.stops.includes("deadline") || pending.length === 0) return result
  if (tripsBreaker({ examined, candidates: pending.length, allowMass })) {
    stop("breaker")
    return result
  }
  for (const category of categories) {
    const paths = pending.filter((c) => c.category === category).map((c) => c.path)
    if (paths.length === 0) continue
    const r = await removePaths(service, bucket, paths, { dryRun, deadline })
    counters[category].supprimes += r.supprimes
    counters[category].erreurs += r.erreurs
    counters[category].ignores += r.ignores
    if (r.arretBudget) stop("deadline")
  }
  return result
}

/** Compartiment simple : `<userId>/<fichier>`, références lues par `readReferences(ownerId)` (valeurs ou null). */
function simpleEvaluator(service, bucket, category, readReferences, { now, deadline }) {
  return async (ownerId) => {
    const listed = await listFiles(service, bucket, ownerId, { deadline })
    if (listed.error) return { failed: !listed.timedOut, timedOut: Boolean(listed.timedOut) }
    if (listed.files.length === 0) return { examined: 0, ignored: 0, candidates: [] }
    const values = await readReferences(ownerId)
    const referenced = values === null ? null : referencedPathsOrNull(values, bucket, ownerId)
    if (referenced === null) return { examined: 0, ignored: listed.files.length, candidates: [] }
    const candidates = []
    let ignored = 0
    let examined = 0
    for (const file of listed.files) {
      if (toTime(file.createdAt) === null) {
        ignored += 1
        continue
      }
      examined += 1
      if (isOrphanCandidate({ objectName: file.name, objectCreatedAt: file.createdAt, referencedNames: referenced, now })) {
        candidates.push({ path: file.name, category })
      }
    }
    return { examined, ignored, candidates }
  }
}

async function readColumn(service, table, column, filter) {
  const rows = await readAll((from, to) => filter(service.from(table).select(`id, ${column}`)).order("id", { ascending: true }).range(from, to))
  return rows === null ? null : rows.map((row) => row[column])
}

async function purgeSimple(service, options, { bucket, category, read }) {
  const evaluateOwner = simpleEvaluator(service, bucket, category, (ownerId) => read(service, ownerId), options)
  return purgeBucket({ service, bucket, categories: [category], evaluateOwner, options })
}

/**
 * P5 : médias de messagerie non référencés par `messages.media_url` de leur expéditeur, créés il y a plus de 7 jours.
 * @param {object} service client Supabase (service role) injecté
 * @param {{ now: Date | string | number, mode?: "dry" | "real", deadline?: number, allowMass?: boolean }} options
 */
export function purgeMessageMedia(service, options) {
  return purgeSimple(service, options, {
    bucket: MEDIA_BUCKET,
    category: "message_media",
    read: (s, ownerId) => readColumn(s, "messages", "media_url", (q) => q.eq("sender_id", ownerId).not("media_url", "is", null)),
  })
}

/** P6 : photos de profil et logos non référencés par `profiles.avatar_url`, créés il y a plus de 7 jours. */
export function purgeAvatars(service, options) {
  return purgeSimple(service, options, {
    bucket: AVATAR_BUCKET,
    category: "avatars",
    read: (s, ownerId) => readColumn(s, "profiles", "avatar_url", (q) => q.eq("user_id", ownerId)),
  })
}

/** P7 : cartes étudiantes non référencées par `student_profiles.card_url`, créées il y a plus de 7 jours. */
export function purgeStudentCards(service, options) {
  return purgeSimple(service, options, {
    bucket: CARD_BUCKET,
    category: "student_cards",
    read: (s, ownerId) => readColumn(s, "student_profiles", "card_url", (q) => q.eq("user_id", ownerId)),
  })
}

const REQUEST_COLUMNS = "id, mission_id, student_id, client_id, payee_photo_path, ticket_photo_path, sms_photo_path, updated_at"

/** Dernier `handled_at` des signalements (le plus récent ; une date illisible est conservée pour bloquer P4). */
function lastHandledAt(reports) {
  let best = null
  let bestTime = -Infinity
  for (const report of reports) {
    const value = report.handled_at
    if (value === null || value === undefined) continue
    const t = toTime(value)
    if (t === null) return value
    if (t > bestTime) {
      bestTime = t
      best = value
    }
  }
  return best
}

/**
 * Lit les demandes d'un déposant, leurs signalements et, si P4 est active, leurs missions. Renvoie `{ requests }`
 * (Map requestId -> entrée de classification) ou null si une lecture ou une référence est illisible.
 */
async function readProofContext(service, requestIds, retentionMonths) {
  const rows = await readByIds(service, "purchase_requests", REQUEST_COLUMNS, "id", requestIds)
  if (rows === null) return null
  // Les signalements sont toujours lus : un signalement ouvert protège aussi les versions remplacées (P3).
  const reports = await readByIds(service, "reports", "id, purchase_request_id, status, handled_at", "purchase_request_id", rows.map((r) => r.id).filter(isUuid))
  if (reports === null) return null
  let missions = null
  if (retentionMonths !== null) {
    const missionIds = [...new Set(rows.map((r) => r.mission_id).filter(isUuid))]
    missions = await readByIds(service, "missions", "id, status, updated_at", "id", missionIds)
    if (missions === null) return null
  }
  const requests = new Map()
  for (const row of rows) {
    if (!isUuid(row.id)) return null
    // Étudiant : numéro marchand et ticket ; client : capture du SMS. Chacun vit dans le dossier de son déposant.
    const studentPaths = referencedPathsOrNull([row.payee_photo_path, row.ticket_photo_path], PROOF_BUCKET, row.student_id)
    const clientPaths = referencedPathsOrNull([row.sms_photo_path], PROOF_BUCKET, row.client_id)
    if (studentPaths === null || clientPaths === null) return null
    const entry = { request: { paths: new Set([...studentPaths, ...clientPaths]), updated_at: row.updated_at } }
    const own = reports.filter((r) => r.purchase_request_id === row.id)
    entry.openReport = own.some((r) => !CLOSED_REPORT_STATUSES.includes(r.status))
    if (retentionMonths !== null) {
      entry.mission = missions.find((m) => m.id === row.mission_id) ?? null
      entry.lastReportHandledAt = lastHandledAt(own)
    }
    requests.set(row.id, entry)
  }
  return requests
}

function proofEvaluator(service, { now, deadline, retentionMonths }) {
  return async (ownerId) => {
    const listed = await listProofFiles(service, ownerId, { deadline })
    if (listed.error) return { failed: !listed.timedOut, timedOut: Boolean(listed.timedOut) }
    if (listed.files.length === 0) return { examined: 0, ignored: 0, candidates: [] }
    // Un fichier hors d'un dossier de demande conforme n'est jamais touché.
    const files = listed.files.filter((f) => isUuid(f.requestId))
    const stray = listed.files.length - files.length
    if (files.length === 0) return { examined: 0, ignored: stray, candidates: [] }
    const requestIds = [...new Set(files.map((f) => f.requestId))]
    const context = await readProofContext(service, requestIds, retentionMonths)
    if (context === null) return { examined: 0, ignored: listed.files.length, candidates: [] }
    const candidates = []
    let ignored = stray
    let examined = 0
    for (const file of files) {
      if (toTime(file.createdAt) === null) {
        ignored += 1
        continue
      }
      examined += 1
      const entry = context.get(file.requestId)
      const verdict = classifyProof({
        path: file.name,
        objectCreatedAt: file.createdAt,
        request: entry ? entry.request : null,
        mission: entry?.mission,
        openReport: entry?.openReport,
        lastReportHandledAt: entry?.lastReportHandledAt,
        now,
        retentionMonths,
      })
      if (verdict === "superseded" && entry?.openReport !== false) continue
      if (verdict === "orphan" || verdict === "superseded") candidates.push({ path: file.name, category: "proof_orphans" })
      else if (verdict === "expired") candidates.push({ path: file.name, category: "proof_expired" })
    }
    return { examined, ignored, candidates }
  }
}

/**
 * P3 et P4 : preuves d'achats. `proof_orphans` : version remplacée, téléversement abandonné ou demande disparue
 * (créées il y a plus de 7 jours) ; `proof_expired` : preuves encore référencées, 12 mois après la fin d'une mission
 * `done` ou `cancelled`, sans signalement ouvert. Un seul parcours et un seul disjoncteur pour les deux catégories.
 * @param {object} service client Supabase (service role) injecté
 * @param {{ now: Date | string | number, mode?: "dry" | "real", deadline?: number, allowMass?: boolean, retentionMonths?: number | null }} options
 *   `retentionMonths` : durée de P4, par défaut PROOF_RETENTION_MONTHS ; `null` désactive `proof_expired`.
 */
export function purgeProofFiles(service, options) {
  const retentionMonths = options && options.retentionMonths !== undefined ? options.retentionMonths : PROOF_RETENTION_MONTHS
  const settings = { ...options, retentionMonths }
  return purgeBucket({
    service,
    bucket: PROOF_BUCKET,
    categories: ["proof_orphans", "proof_expired"],
    evaluateOwner: proofEvaluator(service, settings),
    options: settings,
  })
}
