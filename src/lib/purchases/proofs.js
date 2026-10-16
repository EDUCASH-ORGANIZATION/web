// Preuves des demandes de paiement d'achats (RD-ACHATS-01) : compartiment privé, chemins, formats. Module pur :
// aucune lecture de données, importable côté client (téléversement) comme côté serveur (contrôle avant signature).
//
// Un chemin a toujours la forme <identifiant du déposant>/<identifiant de la demande>/<nature>-<jeton>.<extension> :
// l'étudiant dépose le numéro marchand (payee) et le ticket (ticket), le client dépose la capture du SMS (sms).

/** Compartiment privé des preuves : aucune lecture directe, seulement des URL signées côté serveur. */
export const PROOF_BUCKET = "purchase-proofs"

/** Durée de vie, en secondes, d'une URL signée de preuve. */
export const PROOF_SIGNED_URL_SECONDS = 120

/** Taille maximale d'une preuve : 10 Mo. */
export const PROOF_MAX_BYTES = 10 * 1024 * 1024

/** Extensions acceptées (minuscules). */
export const PROOF_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"]

/** Types MIME acceptés. */
export const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]

/** Nature de chaque preuve et rôle autorisé à la déposer. */
export const PROOF_KINDS = { payee: "student", ticket: "student", sms: "client" }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_PATTERN = /^[a-z0-9]{8,40}$/
const PATH_PATTERN = new RegExp(
  `^([0-9a-f-]{36})/([0-9a-f-]{36})/(${Object.keys(PROOF_KINDS).join("|")})-([a-z0-9]{8,40})\\.(${PROOF_EXTENSIONS.join("|")})$`,
)

/**
 * Un identifiant au format uuid (toute version) ; refuse tout autre type que la chaîne.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

/**
 * Extension d'un nom de fichier, en minuscules, si elle est acceptée ; sinon null.
 * @param {unknown} fileName
 * @returns {string|null}
 */
export function proofExtensionOf(fileName) {
  if (typeof fileName !== "string") return null
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(fileName.trim())
  const ext = match ? match[1].toLowerCase() : ""
  return PROOF_EXTENSIONS.includes(ext) ? ext : null
}

/**
 * Contrôle d'un fichier avant téléversement : taille, extension, type MIME. Un type MIME vide (certains
 * navigateurs pour le HEIC) est toléré quand l'extension est acceptée.
 * @param {{ name?: unknown, type?: unknown, size?: unknown }} file
 * @returns {{ ok: true, extension: string } | { ok: false, error: string }}
 */
export function validateProofFile(file) {
  const size = Number(file?.size)
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "Ce fichier est vide. Choisissez une autre photo." }
  if (size > PROOF_MAX_BYTES) return { ok: false, error: "Cette photo dépasse 10 Mo. Choisissez-en une plus légère." }
  const extension = proofExtensionOf(file?.name)
  if (!extension) return { ok: false, error: "Format non accepté. Utilisez une photo JPEG, PNG, WebP ou HEIC." }
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : ""
  if (type && !PROOF_MIME_TYPES.includes(type)) {
    return { ok: false, error: "Format non accepté. Utilisez une photo JPEG, PNG, WebP ou HEIC." }
  }
  return { ok: true, extension }
}

/**
 * Chemin d'une preuve dans le compartiment, ou null si un élément est invalide. `token` rend le chemin
 * impossible à deviner et empêche l'écrasement d'une preuve (lettres minuscules et chiffres, 8 à 40).
 * @param {{ ownerId: string, requestId: string, kind: "payee"|"ticket"|"sms", extension: string, token: string }} parts
 * @returns {string|null}
 */
export function proofPath({ ownerId, requestId, kind, extension, token } = {}) {
  if (!isUuid(ownerId) || !isUuid(requestId)) return null
  if (!Object.hasOwn(PROOF_KINDS, kind)) return null
  if (typeof extension !== "string" || !PROOF_EXTENSIONS.includes(extension)) return null
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null
  return `${ownerId.toLowerCase()}/${requestId.toLowerCase()}/${kind}-${token}.${extension}`
}

/**
 * Le chemin appartient-il bien à ce déposant et à cette demande, avec une nature autorisée pour son rôle ?
 * Refuse `..`, les barres obliques en trop, les barres inverses, les encodages et toute forme hors modèle.
 * @param {unknown} path
 * @param {{ ownerId: string, requestId: string, kind?: "payee"|"ticket"|"sms" }} expected
 * @returns {boolean}
 */
export function isOwnedProofPath(path, { ownerId, requestId, kind } = {}) {
  if (typeof path !== "string" || !isUuid(ownerId) || !isUuid(requestId)) return false
  const match = PATH_PATTERN.exec(path)
  if (!match) return false
  const [, owner, request, pathKind] = match
  if (owner !== ownerId.toLowerCase() || request !== requestId.toLowerCase()) return false
  return kind === undefined || pathKind === kind
}
