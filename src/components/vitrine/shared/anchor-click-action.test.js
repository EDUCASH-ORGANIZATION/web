import { describe, expect, it, vi } from "vitest"
import { anchorClickAction, focusTarget } from "./hash-scroll"

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
const NONE = { prevent: false, push: false }

describe("anchorClickAction", () => {
  it("clic simple vers une ancre de la page, hash différent : prevent + push", () => {
    expect(anchorClickAction(click(), "/#etapes", home, true)).toEqual({ prevent: true, push: true })
    expect(anchorClickAction(click(), "#etapes", home, true)).toEqual({ prevent: true, push: true })
  })

  it("hash identique : prevent sans push", () => {
    expect(anchorClickAction(click(), "/#etapes", { pathname: "/", hash: "#etapes" }, true)).toEqual({
      prevent: true,
      push: false,
    })
  })

  it("autre page : rien", () => {
    expect(anchorClickAction(click(), "/aide#achats", home, true)).toEqual(NONE)
  })

  it("cible absente : pas de prevent", () => {
    expect(anchorClickAction(click(), "/#etapes", home, false)).toEqual(NONE)
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
