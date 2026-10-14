// @ds-screen RD-STUDENT-01
// Fabriques d'URL de l'espace étudiant. Pur : paramètres vides omis.
// Routes actuelles conservées (décision D1) : un seul endroit à changer lors du déménagement sous /student/.

function withQuery(path, entries) {
  const query = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === false || value === "") continue
    query.set(key, value === true ? "1" : String(value))
  }
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function hasId(id) {
  return id !== undefined && id !== null && id !== ""
}

export function studentHomeHref() {
  return "/dashboard"
}

/**
 * Clés de l'explorateur : `cities` accepte une liste ou une chaîne séparée par des virgules ; page 1 omise.
 * @param {{ q?: string, type?: string, cities?: string[]|string, urgency?: string, budget?: string, sort?: string, page?: number|string }} [filters]
 */
export function studentMissionsHref({ q, type, cities, urgency, budget, sort, page } = {}) {
  const citiesValue = Array.isArray(cities) ? cities.filter(Boolean).join(",") : cities
  const pageNumber = Number(page)
  return withQuery("/student/missions", [
    ["q", q],
    ["type", type],
    ["cities", citiesValue],
    ["urgency", urgency],
    ["budget", budget],
    ["sort", sort],
    ["page", Number.isFinite(pageNumber) && pageNumber > 1 ? Math.floor(pageNumber) : undefined],
  ])
}

/** @param {string} id @param {{ postuler?: boolean }} [params] `postuler` ouvre la feuille de candidature (mobile). */
export function studentMissionHref(id, { postuler } = {}) {
  if (!hasId(id)) return "/student/missions"
  return withQuery(`/student/missions/${encodeURIComponent(id)}`, [["postuler", postuler]])
}

/** @param {{ onglet?: string }} [params] */
export function studentApplicationsHref({ onglet } = {}) {
  return withQuery("/applications", [["onglet", onglet]])
}

export function studentMessagesHref() {
  return "/messages"
}

export function studentConversationHref(missionId) {
  if (!hasId(missionId)) return "/messages"
  return `/messages/${encodeURIComponent(missionId)}`
}

/** @param {{ filtre?: string, retrait?: boolean }} [params] Le filtre "tout" est le défaut : omis. */
export function studentWalletHref({ filtre, retrait } = {}) {
  return withQuery("/wallet", [
    ["filtre", filtre && filtre !== "tout" ? filtre : undefined],
    ["retrait", retrait],
  ])
}

export function studentProfileHref() {
  return "/profile"
}

export function studentProfileEditHref() {
  return "/profile/edit"
}

export function studentVerifyHref() {
  return "/profile/verify"
}

/** Écran « Noter le client » (E13), dans la coquille étudiante. */
export function studentReviewHref(missionId) {
  if (!hasId(missionId)) return "/applications"
  return `/student/review/${encodeURIComponent(missionId)}`
}

/** Profil public d'un étudiant (vitrine). */
export function publicTalentHref(id) {
  if (!hasId(id)) return "/talents"
  return `/talents/${encodeURIComponent(id)}`
}
