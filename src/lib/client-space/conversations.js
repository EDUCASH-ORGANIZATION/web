// Messagerie client : logique pure (aucun accès aux données). Une conversation est une paire
// (mission, étudiant) : la clé est toujours `${missionId}:${studentId}`, jamais la seule mission.
// Importable côté serveur (actions), navigateur (vues, hook temps réel) et tests.

import { toOwnedStoragePath } from "@/lib/storage/owned-paths"

const BENIN_TZ = "Africa/Porto-Novo"

export const MESSAGE_MAX_LENGTH = 2000
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024
export const MESSAGE_TYPES = ["text", "image", "voice", "location"]
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]
export const AUDIO_EXTENSIONS = ["webm", "ogg", "oga", "mp3", "mpeg", "m4a", "mp4", "aac", "wav"]
export const MEDIA_BUCKET = "message-media"
/** Validité d'une adresse signée de média, en secondes (1 h). */
export const MEDIA_SIGNED_URL_TTL = 3600

/** Texte stocké dans `content` pour un message sans texte (la colonne est obligatoire). */
export const MEDIA_CONTENT = {
  image: "Image",
  voice: "Message vocal",
  location: "Position partagée",
}

export function conversationKey(missionId, studentId) {
  return `${missionId}:${studentId}`
}

// ─── Fichiers joints ──────────────────────────────────────────────────────────────────────────

function extensionOf(name) {
  if (typeof name !== "string") return ""
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

/**
 * Nature d'un fichier d'après l'extension de son chemin : "image", "voice" ou null (refusé).
 * @param {unknown} path
 * @returns {"image"|"voice"|null}
 */
export function mediaKindOfPath(path) {
  const ext = extensionOf(path)
  if (IMAGE_EXTENSIONS.includes(ext)) return "image"
  if (AUDIO_EXTENSIONS.includes(ext)) return "voice"
  return null
}

const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
}

/**
 * Extension du chemin de stockage d'une image : déduite du type MIME (un `.jfif` ou un nom sans extension
 * reste accepté), puis du nom si le type est vide ; « jpg » en dernier recours.
 * @param {{ type?: string, name?: string }} file
 * @returns {string} une valeur de IMAGE_EXTENSIONS
 */
export function imageExtensionOf(file) {
  const mime = typeof file?.type === "string" ? file.type.toLowerCase() : ""
  if (IMAGE_MIME_EXTENSIONS[mime]) return IMAGE_MIME_EXTENSIONS[mime]
  const fromName = extensionOf(file?.name)
  return IMAGE_EXTENSIONS.includes(fromName) ? fromName : "jpg"
}

/**
 * Contrôle d'un fichier avant téléversement (navigateur). Les mêmes bornes que le compartiment de stockage.
 * @param {{ size?: number, type?: string, name?: string }} file
 * @param {"image"|"voice"} kind
 * @returns {string|null} message vouvoyé, ou null si le fichier convient
 */
export function fileProblem(file, kind) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) return "Ce fichier est vide."
  if (file.size > MEDIA_MAX_BYTES) {
    return kind === "image" ? "L'image ne doit pas dépasser 10 Mo." : "Le message vocal ne doit pas dépasser 10 Mo."
  }
  const mime = typeof file.type === "string" ? file.type : ""
  if (kind === "image") {
    const okMime = /^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(mime)
    const okName = IMAGE_EXTENSIONS.includes(extensionOf(file.name))
    if (!okMime && !(mime === "" && okName)) return "Choisissez une image JPEG, PNG, WebP, GIF ou HEIC."
  } else if (!/^audio\//i.test(mime)) {
    return "Ce message vocal n'est pas accepté."
  }
  return null
}

/**
 * Chemin d'un média dans `message-media`, sous le dossier de son expéditeur. `media_url` est un identifiant
 * (URL publique canonique écrite à l'envoi), jamais une adresse à afficher : le chemin sert à demander une
 * adresse signée. Accepte une URL publique, signée ou authentifiée du projet ; toute autre valeur donne null.
 * @param {unknown} mediaUrl
 * @param {unknown} senderId
 * @returns {string|null}
 */
export function mediaPathOf(mediaUrl, senderId) {
  return toOwnedStoragePath(mediaUrl, MEDIA_BUCKET, senderId)
}

/**
 * Adresse signée d'un fichier du compartiment de messagerie du projet (query conservée : elle porte le jeton).
 * Toute autre adresse est ignorée : une ligne écrite par un autre compte ne peut pas faire charger une
 * adresse arbitraire au navigateur, ni l'objet brut.
 * @param {unknown} value
 * @returns {string|null}
 */
export function safeSignedMediaUrl(value) {
  if (typeof value !== "string" || value === "") return null
  let origin
  try {
    origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
  } catch {
    return null
  }
  try {
    const url = new URL(value)
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return null
    const prefix = `/storage/v1/object/sign/${MEDIA_BUCKET}/`
    if (!url.pathname.startsWith(prefix) || url.pathname.length === prefix.length) return null
    if (url.pathname.split("/").some((s) => s === "." || s === ".." || /%2e/i.test(s))) return null
    return `${url.origin}${url.pathname}${url.search}`
  } catch {
    return null
  }
}

/**
 * Renouvellement d'une adresse de média expirée : UNE seule nouvelle signature par message. Au second échec de
 * chargement, ou si la signature ne donne rien, l'adresse est déclarée indisponible (null). Pas de boucle.
 * @param {{ fetchUrl: (messageId: string) => Promise<string|null>, onUrl: (messageId: string, url: string|null) => void }} deps
 * @returns {(messageId: string) => Promise<void>}
 */
export function createMediaRefresher({ fetchUrl, onUrl }) {
  const retried = new Set()
  const inFlight = new Set()
  return async function refresh(messageId) {
    if (typeof messageId !== "string" || inFlight.has(messageId)) return
    if (retried.has(messageId)) {
      onUrl(messageId, null)
      return
    }
    retried.add(messageId)
    inFlight.add(messageId)
    try {
      onUrl(messageId, await fetchUrl(messageId))
    } finally {
      inFlight.delete(messageId)
    }
  }
}

export function coordsValid(lat, lng) {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
}

// ─── Messages ─────────────────────────────────────────────────────────────────────────────────

/**
 * Message d'une ligne de la table `messages`, réduit à ce que la vue affiche. `mine` vient de l'identité
 * de la session : la ligne ne livre ni identifiant d'expéditeur ni de destinataire.
 * `mediaPath` est le chemin du média (identifiant à signer) ; `mediaUrl` n'est jamais tirée de `media_url` :
 * c'est l'adresse signée de `signedByPath[mediaPath]`, ou null (texte « indisponible »).
 * @param {object} row
 * @param {string} userId
 * @param {Record<string, string>} [signedByPath] adresses signées par chemin
 * @returns {{ id: string, mine: boolean, type: string, content: string, mediaPath: string|null, mediaUrl: string|null, lat: number|null, lng: number|null, createdAt: string, read: boolean }|null}
 */
export function toMessage(row, userId, signedByPath) {
  if (!row || typeof row.id !== "string" || typeof row.created_at !== "string") return null
  const type = MESSAGE_TYPES.includes(row.type) ? row.type : "text"
  const hasMedia = type === "image" || type === "voice"
  const located = type === "location" && coordsValid(row.location_lat, row.location_lng)
  const mediaPath = hasMedia ? mediaPathOf(row.media_url, row.sender_id) : null
  const signed = mediaPath && signedByPath ? signedByPath[mediaPath] : null
  return {
    id: row.id,
    mine: row.sender_id === userId,
    type,
    content: typeof row.content === "string" ? row.content : "",
    mediaPath,
    mediaUrl: safeSignedMediaUrl(signed),
    lat: located ? row.location_lat : null,
    lng: located ? row.location_lng : null,
    createdAt: row.created_at,
    read: row.read === true,
  }
}

/** Vrai si la ligne est un échange entre `userId` et `studentId` (dans un sens ou dans l'autre). */
export function isPairRow(row, userId, studentId) {
  if (!row) return false
  return (
    (row.sender_id === userId && row.receiver_id === studentId) ||
    (row.sender_id === studentId && row.receiver_id === userId)
  )
}

/** Fusionne deux listes de messages : sans doublon d'identifiant, du plus ancien au plus récent. */
export function mergeMessages(current, incoming) {
  const byId = new Map()
  for (const m of [...current, ...incoming]) if (m && !byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
}

// ─── Droits sur une paire ─────────────────────────────────────────────────────────────────────

/**
 * Lien d'un étudiant avec une mission du client et droit d'écriture.
 * Lecture : l'étudiant est retenu OU a une candidature à cette mission, sinon refus.
 * Écriture : candidature en attente sur une mission ouverte, ou étudiant retenu d'une mission en cours.
 * `state` pilote le bandeau : candidate, in_progress, done, cancelled, rejected, closed.
 * @param {{ mission: { status: string, selectedStudentId: string|null }, application: { status: string }|null, studentId: string }} input
 * @returns {{ allowed: boolean, canWrite: boolean, state: string|null }}
 */
export function conversationAccess({ mission, application, studentId }) {
  const selected = Boolean(mission) && mission.selectedStudentId === studentId
  if (!mission || (!selected && !application)) return { allowed: false, canWrite: false, state: null }
  const status = mission.status
  if (status === "cancelled") return { allowed: true, canWrite: false, state: "cancelled" }
  if (status === "done") return { allowed: true, canWrite: false, state: "done" }
  if (status === "in_progress") {
    return selected
      ? { allowed: true, canWrite: true, state: "in_progress" }
      : { allowed: true, canWrite: false, state: "closed" }
  }
  if (status === "open") {
    return application?.status === "pending"
      ? { allowed: true, canWrite: true, state: "candidate" }
      : { allowed: true, canWrite: false, state: "rejected" }
  }
  return { allowed: true, canWrite: false, state: "closed" }
}

// ─── Boîte de réception ───────────────────────────────────────────────────────────────────────

/**
 * Une conversation par (mission, interlocuteur), du plus récent au plus ancien. `rows` : lignes de `messages`
 * (mission_id, sender_id, receiver_id, content, type, read, created_at) où `userId` est expéditeur ou
 * destinataire ; les autres lignes sont ignorées. Les non lus sont les messages reçus avec read = false.
 * @returns {Array<{ key: string, missionId: string, studentId: string, unreadCount: number, last: { mine: boolean, type: string, content: string, createdAt: string } }>}
 */
export function buildConversations(rows, userId) {
  const byKey = new Map()
  for (const row of rows ?? []) {
    if (!row || typeof row.mission_id !== "string") continue
    const sent = row.sender_id === userId
    const received = row.receiver_id === userId
    if (sent === received) continue
    const other = sent ? row.receiver_id : row.sender_id
    if (typeof other !== "string") continue
    const key = conversationKey(row.mission_id, other)
    let conv = byKey.get(key)
    if (!conv) {
      conv = {
        key,
        missionId: row.mission_id,
        studentId: other,
        unreadCount: 0,
        last: { mine: sent, type: row.type, content: row.content, createdAt: row.created_at },
      }
      byKey.set(key, conv)
    } else if (row.created_at > conv.last.createdAt) {
      conv.last = { mine: sent, type: row.type, content: row.content, createdAt: row.created_at }
    }
    if (received && row.read === false) conv.unreadCount += 1
  }
  return [...byKey.values()].sort((a, b) => (a.last.createdAt < b.last.createdAt ? 1 : a.last.createdAt > b.last.createdAt ? -1 : 0))
}

/** Aperçu d'un dernier message : le texte, ou le nom du média, précédé de « Vous : » pour un message envoyé. */
export function previewOf(last) {
  if (!last) return ""
  const type = MESSAGE_TYPES.includes(last.type) ? last.type : "text"
  const body = type === "text" ? (typeof last.content === "string" ? last.content.trim() : "") : MEDIA_CONTENT[type]
  return last.mine ? `Vous : ${body}` : body
}

export function unreadTotal(conversations) {
  return (conversations ?? []).reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0)
}

const strip = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr-FR")

/**
 * Filtre la liste : non lues seulement et/ou recherche (étudiant, mission, aperçu ; insensible à la casse et aux accents).
 * @param {Array<{ name: string, missionTitle: string, preview: string, unreadCount: number }>} list
 */
export function filterConversations(list, { q = "", unreadOnly = false } = {}) {
  const needle = strip(q).trim()
  return (list ?? []).filter((c) => {
    if (unreadOnly && !(c.unreadCount > 0)) return false
    if (!needle) return true
    return [c.name, c.missionTitle, c.preview].some((field) => strip(field).includes(needle))
  })
}

// ─── Horodatages au fuseau du Bénin ───────────────────────────────────────────────────────────

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dayKey = (date) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: BENIN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

/** Heure du message, ex. « 10:48 », au fuseau du Bénin. */
export function formatClock(value) {
  const date = toDate(value)
  if (!date) return ""
  return new Intl.DateTimeFormat("fr-FR", { timeZone: BENIN_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
}

/** Libellé court de la liste : heure aujourd'hui, « Hier », sinon « 6 oct. ». */
export function formatListTime(value, now = new Date()) {
  const date = toDate(value)
  if (!date) return ""
  if (dayKey(date) === dayKey(now)) return formatClock(date)
  if (dayKey(date) === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Hier"
  return new Intl.DateTimeFormat("fr-FR", { timeZone: BENIN_TZ, day: "numeric", month: "short" }).format(date)
}

/** Séparateur de jour d'une conversation : « Aujourd'hui », « Hier », sinon « jeudi 8 octobre ». */
export function formatDayLabel(value, now = new Date()) {
  const date = toDate(value)
  if (!date) return ""
  if (dayKey(date) === dayKey(now)) return "Aujourd'hui"
  if (dayKey(date) === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Hier"
  return new Intl.DateTimeFormat("fr-FR", { timeZone: BENIN_TZ, weekday: "long", day: "numeric", month: "long" }).format(date)
}

/** Clé de jour (AAAA-MM-JJ, Bénin) pour savoir où placer un séparateur. */
export function dayOf(value) {
  const date = toDate(value)
  return date ? dayKey(date) : ""
}
