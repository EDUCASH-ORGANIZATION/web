import { describe, it, expect } from "vitest"
import { shouldScrollToTop } from "./route-scroll"

const base = { previousPath: "/", path: "/aide", hash: "", poppedBack: false }

describe("shouldScrollToTop", () => {
  it("remonte quand le chemin change par un lien", () => {
    expect(shouldScrollToTop(base)).toBe(true)
  })

  it("ne bouge pas au premier affichage (rechargement)", () => {
    expect(shouldScrollToTop({ ...base, previousPath: null })).toBe(false)
  })

  it("ne bouge pas si le chemin est inchangé", () => {
    expect(shouldScrollToTop({ ...base, path: "/" })).toBe(false)
  })

  it("laisse la position restaurée par un retour ou une avance de l'historique", () => {
    expect(shouldScrollToTop({ ...base, poppedBack: true })).toBe(false)
  })

  it("laisse les liens d'ancre à HashScroll", () => {
    expect(shouldScrollToTop({ ...base, path: "/", previousPath: "/aide", hash: "#etapes" })).toBe(false)
    expect(shouldScrollToTop({ ...base, hash: "#sequestre" })).toBe(false)
  })
})
