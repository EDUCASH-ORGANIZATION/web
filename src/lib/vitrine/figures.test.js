import { describe, it, expect } from "vitest"
import { homeFigures, FIGURE_THRESHOLDS } from "./figures"

describe("homeFigures", () => {
  it("expose les seuils", () => {
    expect(FIGURE_THRESHOLDS).toEqual({ openMissions: 50, verifiedStudents: 100, reviewsForRating: 20 })
  })
  it("passe en live quand les deux seuils sont atteints", () => {
    const r = homeFigures({ openMissions: 50, verifiedStudents: 100, reviewsCount: 0, ratingAvg: null })
    expect(r.mode).toBe("live")
    expect(r.openMissions).toBe(50)
    expect(r.verifiedStudents).toBe(100)
  })
  it("reste qualitatif si un seuil manque", () => {
    expect(homeFigures({ openMissions: 49, verifiedStudents: 500 }).mode).toBe("qualitative")
    expect(homeFigures({ openMissions: 500, verifiedStudents: 99 }).mode).toBe("qualitative")
  })
  it("masque la note sous 20 avis", () => {
    expect(homeFigures({ reviewsCount: 19, ratingAvg: 4.8 }).rating).toBeNull()
  })
  it("affiche la note à 20 avis avec une décimale", () => {
    expect(homeFigures({ reviewsCount: 20, ratingAvg: 4.76 }).rating).toEqual({ avg: 4.8, count: 20 })
  })
  it("traite les valeurs absentes comme 0", () => {
    expect(homeFigures({ openMissions: null, verifiedStudents: undefined, reviewsCount: null, ratingAvg: null })).toEqual({
      mode: "qualitative",
      openMissions: 0,
      verifiedStudents: 0,
      rating: null,
    })
    expect(homeFigures()).toEqual({ mode: "qualitative", openMissions: 0, verifiedStudents: 0, rating: null })
  })
})
