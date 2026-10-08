const MAX_LENGTH = 512

// Prefixes réservés à l'espace étudiant (nouvelles routes et anciennes URL).
const STUDENT_PREFIXES = ["/student", "/dashboard", "/applications", "/messages", "/wallet", "/profile"]

function pathOnly(path) {
  return path.split(/[?#]/)[0]
}

function matchesPrefix(path, prefix) {
  const p = pathOnly(path)
  return p === prefix || p.startsWith(prefix + "/")
}

// Renvoie un chemin interne sûr (anti redirection ouverte) ou null.
export function safeNextPath(raw) {
  if (typeof raw !== "string") return null
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  if (raw[0] !== "/") return null
  if (raw[1] === "/" || raw[1] === "\\") return null
  if (raw.includes("\\")) return null
  if (matchesPrefix(raw, "/auth") || matchesPrefix(raw, "/api")) return null
  return raw
}

// Un chemin sûr est-il accessible au rôle donné ?
export function isNextAllowedForRole(path, role) {
  if (typeof path !== "string") return false
  if (role === "admin") return true
  if (role === "client") {
    if (matchesPrefix(path, "/client")) return true
    return ![...STUDENT_PREFIXES, "/admin"].some((prefix) => matchesPrefix(path, prefix))
  }
  if (role === "student") {
    return !matchesPrefix(path, "/client") && !matchesPrefix(path, "/admin")
  }
  return false
}
