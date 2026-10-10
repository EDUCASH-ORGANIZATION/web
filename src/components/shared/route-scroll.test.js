import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  shouldScrollToTop,
  notePopped,
  consumePopped,
  markPagination,
  consumePagination,
  applyRouteScroll,
  focusMain,
  normalizePath,
} from "./route-scroll"

const base = { previousPath: "/", path: "/aide", hash: "", poppedBack: false }

describe("shouldScrollToTop", () => {
  it("remonte quand le chemin change par un lien", () => {
    expect(shouldScrollToTop(base)).toBe(true)
  })

  it("ne bouge pas au premier affichage (rechargement)", () => {
    expect(shouldScrollToTop({ ...base, previousPath: null })).toBe(false)
  })

  it("ne bouge pas si le chemin et la recherche sont inchangés", () => {
    expect(shouldScrollToTop({ ...base, path: "/" })).toBe(false)
  })

  it("laisse la position restaurée par un retour ou une avance de l'historique", () => {
    expect(shouldScrollToTop({ ...base, poppedBack: true })).toBe(false)
  })

  it("laisse les liens d'ancre à HashScroll", () => {
    expect(shouldScrollToTop({ ...base, path: "/", previousPath: "/aide", hash: "#etapes" })).toBe(false)
    expect(shouldScrollToTop({ ...base, hash: "#sequestre" })).toBe(false)
  })

  it("même chemin, recherche changée : remonte seulement après un clic de pagination", () => {
    const same = { ...base, previousPath: "/missions", path: "/missions", previousSearch: "", search: "page=2" }
    expect(shouldScrollToTop(same)).toBe(false)
    expect(shouldScrollToTop({ ...same, paginated: true })).toBe(true)
    expect(shouldScrollToTop({ ...same, paginated: true, poppedBack: true })).toBe(false)
  })
})

describe("consumePopped", () => {
  beforeEach(() => consumePopped("/"))

  it("popstate puis chemin visé : vrai", () => {
    notePopped("/aide")
    expect(consumePopped("/aide")).toBe(true)
  })

  it("popstate sur le même chemin puis lien vers un autre chemin : faux", () => {
    notePopped("/")
    expect(consumePopped("/aide")).toBe(false)
  })

  it("n'est consommé qu'une fois", () => {
    notePopped("/aide")
    expect(consumePopped("/aide")).toBe(true)
    expect(consumePopped("/aide")).toBe(false)
  })

  it("sans popstate : faux", () => {
    expect(consumePopped("/aide")).toBe(false)
  })

  it("compare les chemins décodés", () => {
    notePopped("/caf%C3%A9")
    expect(consumePopped("/café")).toBe(true)
    expect(normalizePath("/%E0%A4%A")).toBe("/%E0%A4%A")
  })
})

describe("marqueur de pagination", () => {
  it("vaut une fois, dans le délai", () => {
    markPagination(1000)
    expect(consumePagination(2000)).toBe(true)
    expect(consumePagination(2000)).toBe(false)
    markPagination(1000)
    expect(consumePagination(20000)).toBe(false)
  })
})

describe("applyRouteScroll", () => {
  beforeEach(() => {
    consumePopped("/")
    consumePagination()
  })

  it("ne défile jamais au montage, double montage compris", () => {
    const scrollTo = vi.fn()
    const state = { path: null, search: "" }
    const at = { pathname: "/missions", search: "", hash: "" }
    applyRouteScroll(state, at, scrollTo)
    applyRouteScroll(state, at, scrollTo)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("remonte au changement de chemin, pas au retour d'historique", () => {
    const scrollTo = vi.fn()
    const state = { path: "/", search: "" }
    expect(applyRouteScroll(state, { pathname: "/aide", search: "", hash: "" }, scrollTo)).toBe(true)
    notePopped("/")
    expect(applyRouteScroll(state, { pathname: "/", search: "", hash: "" }, scrollTo)).toBe(false)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it("pagination : remonte ; filtre sans marqueur : garde la position", () => {
    const scrollTo = vi.fn()
    const state = { path: "/missions", search: "" }
    expect(applyRouteScroll(state, { pathname: "/missions", search: "type=a", hash: "" }, scrollTo)).toBe(false)
    markPagination()
    expect(applyRouteScroll(state, { pathname: "/missions", search: "type=a&page=2", hash: "" }, scrollTo)).toBe(true)
  })
})

describe("focusMain", () => {
  function doc({ active, main }) {
    return { activeElement: active, getElementById: (id) => (id === "contenu" ? main : null) }
  }
  const makeMain = () => ({ hasAttribute: () => false, setAttribute: vi.fn(), focus: vi.fn() })

  it("clic souris hors pied de page : ne touche pas au focus", () => {
    const main = makeMain()
    expect(focusMain(doc({ active: { closest: () => null }, main }), false)).toBe(false)
    expect(main.focus).not.toHaveBeenCalled()
  })

  it("clavier : focus sur le contenu sans défiler", () => {
    const main = makeMain()
    expect(focusMain(doc({ active: null, main }), true)).toBe(true)
    expect(main.setAttribute).toHaveBeenCalledWith("tabindex", "-1")
    expect(main.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it("focus dans le pied de page : focus sur le contenu", () => {
    const main = makeMain()
    expect(focusMain(doc({ active: { closest: (s) => (s === "footer" ? {} : null) }, main }), false)).toBe(true)
  })

  it("sans #contenu : ne fait rien", () => {
    expect(focusMain(doc({ active: null, main: null }), true)).toBe(false)
  })
})
