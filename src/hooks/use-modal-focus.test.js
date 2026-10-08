import { describe, expect, it, vi } from "vitest"
import { FOCUSABLE, focusableIn, nextFocusIndex, trapFocus } from "./use-modal-focus"

// jsdom n'est pas installé (environnement node) : faux DOM minimal. querySelectorAll renvoie les
// éléments que le sélecteur retiendrait ; le filtre de visibilité et le piège sont testés pour de vrai.
function fakeDom(specs) {
  const doc = {
    activeElement: null,
    body: { style: { overflow: "" } },
    listeners: new Set(),
    addEventListener(type, fn) { if (type === "keydown") this.listeners.add(fn) },
    removeEventListener(type, fn) { if (type === "keydown") this.listeners.delete(fn) },
    press(key, shiftKey = false) {
      const e = { key, shiftKey, defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      this.listeners.forEach((fn) => fn(e))
      return e
    },
  }
  const make = ({ name, visible = true, insideHidden = false }) => ({
    name,
    getClientRects: () => (visible ? [{}] : []),
    closest: (sel) => (sel === "[hidden],[inert]" && insideHidden ? {} : null),
    focus: vi.fn(function focus() { doc.activeElement = this }),
  })
  const items = specs.map(make)
  const container = {
    querySelectorAll: (sel) => {
      expect(sel).toBe(FOCUSABLE)
      return items
    },
  }
  const byName = (name) => items.find((el) => el.name === name)
  return { doc, container, byName }
}

describe("sélecteur des éléments focusables", () => {
  it("exclut les champs cachés, les éléments désactivés et tabindex=-1", () => {
    expect(FOCUSABLE).toContain('input:not([disabled]):not([type="hidden"])')
    expect(FOCUSABLE).toContain('[tabindex]:not([tabindex="-1"])')
    expect(FOCUSABLE).toContain("textarea:not([disabled])")
  })

  it("écarte les éléments sans boîte (display:none) ou dans un parent [hidden] ou [inert]", () => {
    const { container } = fakeDom([
      { name: "fermer" },
      { name: "masque", visible: false },
      { name: "dans-hidden", insideHidden: true },
      { name: "lien" },
    ])
    expect(focusableIn(container).map((el) => el.name)).toEqual(["fermer", "lien"])
    expect(focusableIn(null)).toEqual([])
  })
})

describe("index suivant", () => {
  it("boucle dans les deux sens", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1)
    expect(nextFocusIndex(3, 2, false)).toBe(0)
    expect(nextFocusIndex(3, 0, true)).toBe(2)
    expect(nextFocusIndex(3, 1, true)).toBe(0)
  })

  it("part d'un bout quand le focus est hors de la liste", () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0)
    expect(nextFocusIndex(3, -1, true)).toBe(2)
    expect(nextFocusIndex(0, -1, false)).toBe(-1)
  })
})

describe("piège de focus", () => {
  const setup = () => {
    const dom = fakeDom([
      { name: "fermer" },
      { name: "liste-cachee", visible: false },
      { name: "lien" },
      { name: "dans-hidden", insideHidden: true },
      { name: "bouton" },
    ])
    const returnTarget = { focus: vi.fn() }
    const onClose = vi.fn()
    const cleanup = trapFocus({ doc: dom.doc, getContainer: () => dom.container, returnTarget, onClose })
    return { ...dom, returnTarget, onClose, cleanup }
  }

  it("place le focus initial sur le premier élément focusable et bloque le défilement", () => {
    const { doc, byName, cleanup } = setup()
    expect(doc.activeElement).toBe(byName("fermer"))
    expect(doc.body.style.overflow).toBe("hidden")
    cleanup()
    expect(doc.body.style.overflow).toBe("")
  })

  it("Tab boucle en avant en sautant les éléments cachés", () => {
    const { doc, byName } = setup()
    expect(doc.press("Tab").defaultPrevented).toBe(true)
    expect(doc.activeElement).toBe(byName("lien"))
    doc.press("Tab")
    expect(doc.activeElement).toBe(byName("bouton"))
    doc.press("Tab")
    expect(doc.activeElement).toBe(byName("fermer"))
    expect(byName("liste-cachee").focus).not.toHaveBeenCalled()
    expect(byName("dans-hidden").focus).not.toHaveBeenCalled()
  })

  it("Maj+Tab boucle en arrière", () => {
    const { doc, byName } = setup()
    doc.press("Tab", true)
    expect(doc.activeElement).toBe(byName("bouton"))
    doc.press("Tab", true)
    expect(doc.activeElement).toBe(byName("lien"))
  })

  it("Échap ferme, et le nettoyage rend le focus au déclencheur et retire l'écoute", () => {
    const { doc, onClose, returnTarget, cleanup } = setup()
    doc.press("Escape")
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    expect(returnTarget.focus).toHaveBeenCalledTimes(1)
    doc.press("Escape")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("préfère l'élément de focus initial fourni", () => {
    const dom = fakeDom([{ name: "fermer" }])
    const initialFocus = { focus: vi.fn() }
    trapFocus({ doc: dom.doc, getContainer: () => dom.container, initialFocus, onClose: vi.fn() })
    expect(initialFocus.focus).toHaveBeenCalled()
    expect(dom.byName("fermer").focus).not.toHaveBeenCalled()
  })
})
