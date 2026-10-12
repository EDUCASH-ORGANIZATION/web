// Validation des références de fichiers Storage reçues du navigateur.
// Une valeur n'est acceptée que si elle désigne un objet du dossier de l'utilisateur
// (`<userId>/...`) dans le bucket attendu. JS pur, sans dépendance serveur.

const URL_STORAGE_PREFIX = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\//

function isCleanRelativePath(path, userId) {
  if (typeof userId !== "string" || userId === "") return false
  if (!path.startsWith(`${userId}/`)) return false
  const rest = path.slice(userId.length + 1)
  if (rest === "") return false
  if (/[\\%\u0000-\u001f\u007f]/.test(path)) return false
  if (path.split("/").some((s) => s === "" || s === "." || s === "..")) return false
  if (path.includes("..") || path.includes("?") || path.includes("#")) return false
  return !/^[a-z][a-z0-9+.-]*:/i.test(path)
}

function supabaseOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
  } catch {
    return null
  }
}

/**
 * Convertit une valeur (chemin ou URL du projet) en chemin dans `bucket`, sous `<userId>/`.
 * Les deux formats existants sont acceptés : chemin brut et URL publique ou signée.
 * @param {unknown} value
 * @param {string} bucket
 * @param {string} userId
 * @returns {string | null} le chemin, ou null si la valeur est refusée
 */
export function toOwnedStoragePath(value, bucket, userId) {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (raw === "") return null

  let path = raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url
    try {
      url = new URL(raw)
    } catch {
      return null
    }
    const origin = supabaseOrigin()
    if (!origin || url.origin !== origin || !/^https?:$/.test(url.protocol)) return null
    if (!URL_STORAGE_PREFIX.test(url.pathname)) return null
    const marker = `/${bucket}/`
    const afterPrefix = url.pathname.replace(URL_STORAGE_PREFIX, "/")
    if (!afterPrefix.startsWith(marker)) return null
    try {
      path = decodeURIComponent(afterPrefix.slice(marker.length))
    } catch {
      return null
    }
  }

  return isCleanRelativePath(path, userId) ? path : null
}

/**
 * Valide l'URL publique d'un avatar : projet Supabase, bucket `avatars`, dossier de l'utilisateur.
 * @returns {string | null} l'URL sans paramètres, ou null si refusée
 */
export function toOwnedAvatarUrl(value, userId) {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!/^https?:\/\//i.test(raw) || !toOwnedStoragePath(raw, "avatars", userId)) return null
  try {
    const url = new URL(raw)
    if (!url.pathname.startsWith("/storage/v1/object/public/avatars/")) return null
    return `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}
