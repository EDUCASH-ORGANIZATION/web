// Chemin interne sûr pour une redirection : commence par "/", jamais par "//" ni "/\\", sans schéma,
// sans caractère de contrôle. Contrairement à safeNextPath, accepte /auth (destination d'un refus).
export function isInternalPath(path) {
  if (typeof path !== "string") return false
  if (path[0] !== "/") return false
  if (path[1] === "/" || path[1] === "\\") return false
  if (path.includes("\\")) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  return true
}
