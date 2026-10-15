// Chemins des cartes étudiantes déposées depuis l'espace étudiant (module pur, utilisable côté client et serveur).

// L'extension vient du type MIME, jamais du nom du fichier.
export const CARD_TYPES = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }

/**
 * Partie unique du nom d'un fichier renvoyé : `<horodatage ms>-<8 premiers caractères d'un UUID>`.
 * @param {number} [now]
 * @param {string} [uuid]
 */
export function cardUploadUnique(now = Date.now(), uuid = crypto.randomUUID()) {
  return `${now}-${uuid.slice(0, 8)}`
}

/**
 * Chemin d'envoi : dossier de l'utilisateur, nom unique, extension déduite du type MIME.
 * @param {string} userId
 * @param {string} mime
 * @param {string} unique
 */
export function cardStoragePath(userId, mime, unique) {
  return `${userId}/carte-${unique}.${CARD_TYPES[mime]}`
}
