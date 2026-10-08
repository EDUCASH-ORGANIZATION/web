import { afterEach, describe, expect, it, vi } from "vitest"
import { anchorClickAction, consumeNavigation, focusTarget, markNavigation, mountDecision } from "./hash-scroll"

const click = (over = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  target: null,
  download: false,
  ...over,
})
const home = { pathname: "/", hash: "" }
const NONE = { prevent: false, push: false, markNavigation: false }

describe("anchorClickAction", () => {
  it("clic simple vers une ancre de la page, hash différent : prevent + push", () => {
    expect(anchorClickAction(click(), "/#etapes", home, true)).toEqual({ prevent: true, push: true, markNavigation: false })
    expect(anchorClickAction(click(), "#etapes", home, true)).toEqual({ prevent: true, push: true, markNavigation: false })
  })

  it("hash identique : prevent sans push", () => {
    expect(anchorClickAction(click(), "/#etapes", { pathname: "/", hash: "#etapes" }, true)).toEqual({
      prevent: true,
      push: false,
      markNavigation: false,
    })
  })

  it("autre page : pas de prevent, la navigation est marquée", () => {
    expect(anchorClickAction(click(), "/aide#achats", home, true)).toEqual({ ...NONE, markNavigation: true })
  })

  it("cible absente sur la page courante : rien, pas de marqueur", () => {
    expect(anchorClickAction(click(), "/#etapes", home, false)).toEqual(NONE)
  })

  it("lien sans fragment exploitable : rien", () => {
    expect(anchorClickAction(click(), "/aide", home, true)).toEqual(NONE)
    expect(anchorClickAction(click(), "/aide#", home, true)).toEqual(NONE)
  })

  it("clic modifié vers une autre page : pas de marqueur", () => {
    expect(anchorClickAction(click({ ctrlKey: true }), "/aide#achats", home, true)).toEqual(NONE)
  })

  it("clics modifiés ignorés", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      expect(anchorClickAction(click({ [key]: true }), "/#etapes", home, true)).toEqual(NONE)
    }
  })

  it("clic milieu ou droit ignoré", () => {
    expect(anchorClickAction(click({ button: 1 }), "/#etapes", home, true)).toEqual(NONE)
    expect(anchorClickAction(click({ button: 2 }), "/#etapes", home, true)).toEqual(NONE)
  })

  it("évènement déjà annulé ignoré", () => {
    expect(anchorClickAction(click({ defaultPrevented: true }), "/#etapes", home, true)).toEqual(NONE)
  })

  it("target autre que _self ignoré, _self et absent acceptés", () => {
    expect(anchorClickAction(click({ target: "_blank" }), "/#etapes", home, true)).toEqual(NONE)
    expect(anchorClickAction(click({ target: "_self" }), "/#etapes", home, true).prevent).toBe(true)
    expect(anchorClickAction(click({ target: "" }), "/#etapes", home, true).prevent).toBe(true)
  })

  it("attribut download ignoré", () => {
    expect(anchorClickAction(click({ download: true }), "/#etapes", home, true)).toEqual(NONE)
  })
})

describe("focusTarget", () => {
  function fakeElement(attrs = {}) {
    const store = { ...attrs }
    return {
      hasAttribute: (name) => name in store,
      setAttribute: vi.fn((name, value) => {
        store[name] = value
      }),
      focus: vi.fn(),
    }
  }

  it("pose tabindex -1 puis focus sans défilement", () => {
    const el = fakeElement()
    focusTarget(el)
    expect(el.setAttribute).toHaveBeenCalledWith("tabindex", "-1")
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it("garde un tabindex existant", () => {
    const el = fakeElement({ tabindex: "0" })
    focusTarget(el)
    expect(el.setAttribute).not.toHaveBeenCalled()
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})

describe("mountDecision", () => {
  const base = { arrivedByClick: false, scrollY: 0, targetTop: 900, innerHeight: 800 }

  it("page en haut : scroll", () => {
    expect(mountDecision(base)).toBe("scroll")
    expect(mountDecision({ ...base, scrollY: 4 })).toBe("scroll")
  })

  it("arrivée par clic : scroll même si la page porte un défilement", () => {
    expect(mountDecision({ ...base, arrivedByClick: true, scrollY: 1500 })).toBe("scroll")
  })

  it("position restaurée avec la cible en haut de l'écran : focus seulement", () => {
    expect(mountDecision({ ...base, scrollY: 1600, targetTop: 80 })).toBe("focus")
    expect(mountDecision({ ...base, scrollY: 1600, targetTop: 0 })).toBe("focus")
  })

  it("position restaurée ailleurs ou sans cible : none", () => {
    expect(mountDecision({ ...base, scrollY: 1600, targetTop: 400 })).toBe("none")
    expect(mountDecision({ ...base, scrollY: 1600, targetTop: -50 })).toBe("none")
    expect(mountDecision({ ...base, scrollY: 1600, targetTop: null })).toBe("none")
  })
})

describe("marqueur de navigation", () => {
  afterEach(() => {
    vi.useRealTimers()
    consumeNavigation({ pathname: "", hash: "" })
  })

  it("accepté sur le chemin et le fragment du lien cliqué, une seule fois", () => {
    markNavigation("/#etapes")
    expect(consumeNavigation({ pathname: "/", hash: "#etapes" })).toBe(true)
    expect(consumeNavigation({ pathname: "/", hash: "#etapes" })).toBe(false)
  })

  it("refusé si l'adresse d'arrivée diffère", () => {
    markNavigation("/#etapes")
    expect(consumeNavigation({ pathname: "/missions", hash: "#etapes" })).toBe(false)
    markNavigation("/#etapes")
    expect(consumeNavigation({ pathname: "/", hash: "" })).toBe(false)
  })

  it("compare le fragment décodé", () => {
    markNavigation("/aide#caf%C3%A9")
    expect(consumeNavigation({ pathname: "/aide", hash: "#caf%C3%A9" })).toBe(true)
  })

  it("expire après 10 s", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    markNavigation("/#etapes")
    vi.setSystemTime(new Date("2026-01-01T00:00:09Z"))
    expect(consumeNavigation({ pathname: "/", hash: "#etapes" })).toBe(true)
    markNavigation("/#etapes")
    vi.setSystemTime(new Date("2026-01-01T00:00:21Z"))
    expect(consumeNavigation({ pathname: "/", hash: "#etapes" })).toBe(false)
  })
})
