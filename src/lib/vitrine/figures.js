export const FIGURE_THRESHOLDS = {
  openMissions: 50,
  verifiedStudents: 100,
  reviewsForRating: 20,
}

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Chiffres de l'accueil : mode "live" si les deux compteurs atteignent leur seuil.
 * Une valeur absente ou en erreur compte comme 0.
 * @param {{ openMissions?: number|null, verifiedStudents?: number|null, reviewsCount?: number|null, ratingAvg?: number|null }} input
 * @returns {{ mode: "live"|"qualitative", openMissions: number, verifiedStudents: number, rating: {avg: number, count: number}|null }}
 */
export function homeFigures({ openMissions, verifiedStudents, reviewsCount, ratingAvg } = {}) {
  const missions = count(openMissions)
  const students = count(verifiedStudents)
  const reviews = count(reviewsCount)
  const live =
    missions >= FIGURE_THRESHOLDS.openMissions && students >= FIGURE_THRESHOLDS.verifiedStudents
  const hasRating = reviews >= FIGURE_THRESHOLDS.reviewsForRating
  return {
    mode: live ? "live" : "qualitative",
    openMissions: missions,
    verifiedStudents: students,
    rating: hasRating ? { avg: Math.round(count(ratingAvg) * 10) / 10, count: reviews } : null,
  }
}
