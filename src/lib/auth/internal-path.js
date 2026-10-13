// Chemin interne sûr pour une redirection : commence par "/", jamais par "//" ni "/\\", sans schéma,
// sans caractère de contrôle, sans segment "." ou ".." (y compris encodé %2e), 512 caractères au plus.
// Contrairement à safeNextPath, accepte /auth (destination d'un refus).
// Décision : "/%2F/evil.com" est accepté. Le "%2F" reste un caractère de segment (ni navigateur ni routeur
// ne le décodent en séparateur), la redirection reste donc sur l'origine du site.
const MAX_LENGTH = 512

export function isInternalPath(path) {
  if (typeof path !== "string") return false
  if (path.length > MAX_LENGTH) return false
  if (path[0] !== "/") return false
  if (path[1] === "/" || path[1] === "\\") return false
  if (path.includes("\\")) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  const pathname = path.split(/[?#]/, 1)[0]
  const isDotSegment = (segment) => [".", ".."].includes(segment.replace(/%2e/gi, "."))
  if (pathname.split("/").some(isDotSegment)) return false
  return true
}
