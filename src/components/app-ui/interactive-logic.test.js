import { describe, expect, it, vi } from "vitest"
import { trapFocus } from "@/hooks/use-modal-focus"
import {
  addToast,
  chipKeyAction,
  confirmStepView,
  createDialogStack,
  createScrimGuard,
  gateDocument,
  formatAmountInput,
  hasMoreToScroll,
  nextRadioIndex,
  nextStarValue,
  parseAmountInput,
  removeToast,
  sanitizeAmountDigits,
  toastDuration,
} from "./interactive-logic"

describe("nextRadioIndex", () => {
  it("avance et recule en bouclant", () => {
    expect(nextRadioIndex(4, 3, "ArrowRight")).toBe(0)
    expect(nextRadioIndex(4, 0, "ArrowLeft")).toBe(3)
    expect(nextRadioIndex(4, 1, "ArrowDown")).toBe(2)
    expect(nextRadioIndex(4, 1, "ArrowUp")).toBe(0)
  })
  it("saute au début et à la fin", () => {
    expect(nextRadioIndex(4, 2, "Home")).toBe(0)
    expect(nextRadioIndex(4, 1, "End")).toBe(3)
  })
  it("ignore les autres touches et les groupes vides", () => {
    expect(nextRadioIndex(4, 1, "a")).toBe(-1)
    expect(nextRadioIndex(0, -1, "ArrowRight")).toBe(-1)
  })
  it("part du premier quand rien n'est actif", () => {
    expect(nextRadioIndex(3, -1, "ArrowRight")).toBe(1)
  })
})

describe("nextStarValue", () => {
  it("est borné entre 1 et 5 sans boucler", () => {
    expect(nextStarValue(5, "ArrowRight")).toBe(5)
    expect(nextStarValue(1, "ArrowLeft")).toBe(1)
    expect(nextStarValue(3, "ArrowUp")).toBe(4)
    expect(nextStarValue(3, "ArrowDown")).toBe(2)
  })
  it("démarre à 1 sans note et gère Début et Fin", () => {
    expect(nextStarValue(0, "ArrowRight")).toBe(1)
    expect(nextStarValue(0, "ArrowLeft")).toBe(1)
    expect(nextStarValue(3, "Home")).toBe(1)
    expect(nextStarValue(3, "End")).toBe(5)
  })
  it("renvoie null pour une touche sans effet", () => {
    expect(nextStarValue(3, "Enter")).toBeNull()
  })
})

describe("montant", () => {
  it("sépare les milliers par une espace fine insécable", () => {
    expect(formatAmountInput("1250000")).toBe("1 250 000")
    expect(formatAmountInput("500")).toBe("500")
    expect(formatAmountInput(12500)).toBe("12 500")
  })
  it("ne garde que les chiffres, sans zéros de tête", () => {
    expect(sanitizeAmountDigits("a1 2,5b")).toBe("125")
    expect(sanitizeAmountDigits("007")).toBe("7")
    expect(sanitizeAmountDigits("0")).toBe("0")
    expect(sanitizeAmountDigits(null)).toBe("")
  })
  it("borne la longueur", () => {
    expect(sanitizeAmountDigits("12345678901234")).toBe("123456789")
  })
  it("analyse l'entier saisi, null si vide", () => {
    expect(parseAmountInput("12 500")).toBe(12500)
    expect(parseAmountInput("")).toBeNull()
    expect(parseAmountInput("abc")).toBeNull()
  })
})

describe("confirmStepView", () => {
  it("n'accorde le rouge qu'en danger, à la dernière étape", () => {
    expect(confirmStepView({ step: 0, totalSteps: 2, tone: "danger" })).toEqual({ isLast: false, danger: false })
    expect(confirmStepView({ step: 1, totalSteps: 2, tone: "danger" })).toEqual({ isLast: true, danger: true })
    expect(confirmStepView({ step: 1, totalSteps: 2, tone: "default" }).danger).toBe(false)
    expect(confirmStepView({ step: 0, totalSteps: 1, tone: "danger" }).danger).toBe(true)
  })
})

describe("hasMoreToScroll", () => {
  it("signale un défilement restant à droite", () => {
    expect(hasMoreToScroll({ scrollWidth: 600, scrollLeft: 0, clientWidth: 390 })).toBe(true)
    expect(hasMoreToScroll({ scrollWidth: 600, scrollLeft: 210, clientWidth: 390 })).toBe(false)
    expect(hasMoreToScroll({ scrollWidth: 390, scrollLeft: 0, clientWidth: 390 })).toBe(false)
  })
})

describe("pile de toasts", () => {
  it("retire les plus anciens au-delà du plafond", () => {
    let list = []
    for (const id of [1, 2, 3, 4]) list = addToast(list, { id })
    expect(list.map((t) => t.id)).toEqual([2, 3, 4])
  })
  it("retire un toast par identifiant", () => {
    expect(removeToast([{ id: 1 }, { id: 2 }], 1)).toEqual([{ id: 2 }])
  })
  it("duration null : toast persistant (null conservé) ; Infinity et NaN retombent sur la durée par défaut", () => {
    expect(toastDuration("success", null)).toBeNull()
    expect(toastDuration("error", null)).toBeNull()
    expect(toastDuration("success", Infinity)).toBe(5000)
    expect(toastDuration("error", NaN)).toBe(8000)
  })
  it("garde une erreur plus longtemps", () => {
    expect(toastDuration("error")).toBeGreaterThan(toastDuration("success"))
    expect(toastDuration("success", 1200)).toBe(1200)
  })
})

// Piège de focus : mêmes garanties pour Modal et Drawer (Tab en boucle, Maj+Tab, Échap, retour du focus).
function fakeDialog(count) {
  const items = Array.from({ length: count }, () => ({
    focus: vi.fn(function focus() {
      doc.activeElement = this
    }),
    getClientRects: () => [1],
    closest: () => null,
  }))
  const container = { querySelectorAll: () => items }
  const listeners = {}
  const doc = {
    body: { style: { overflow: "" } },
    activeElement: null,
    addEventListener: (type, fn) => { listeners[type] = fn },
    removeEventListener: (type) => { delete listeners[type] },
  }
  const press = (key, shiftKey = false) => {
    const event = { key, shiftKey, preventDefault: vi.fn() }
    listeners.keydown(event)
    return event
  }
  return { items, container, doc, press, listeners }
}

describe("trapFocus", () => {
  it("place le focus sur le premier élément et fige le défilement", () => {
    const { items, container, doc } = fakeDialog(3)
    const trigger = { focus: vi.fn() }
    const cleanup = trapFocus({ doc, getContainer: () => container, returnTarget: trigger, onClose: vi.fn() })
    expect(doc.activeElement).toBe(items[0])
    expect(doc.body.style.overflow).toBe("hidden")
    cleanup()
    expect(doc.body.style.overflow).toBe("")
    expect(trigger.focus).toHaveBeenCalled()
  })

  it("boucle avec Tab et Maj+Tab", () => {
    const { items, container, doc, press } = fakeDialog(3)
    trapFocus({ doc, getContainer: () => container, onClose: vi.fn() })
    press("Tab")
    expect(doc.activeElement).toBe(items[1])
    press("Tab")
    press("Tab")
    expect(doc.activeElement).toBe(items[0])
    press("Tab", true)
    expect(doc.activeElement).toBe(items[2])
  })

  it("ferme avec Échap", () => {
    const { container, doc, press } = fakeDialog(2)
    const onClose = vi.fn()
    trapFocus({ doc, getContainer: () => container, onClose })
    press("Escape")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("retire son écouteur au nettoyage", () => {
    const { container, doc, listeners } = fakeDialog(1)
    const cleanup = trapFocus({ doc, getContainer: () => container, onClose: vi.fn() })
    cleanup()
    expect(listeners.keydown).toBeUndefined()
  })
})

describe("chipKeyAction", () => {
  it("mode lien : les flèches déplacent seulement le focus, jamais la sélection", () => {
    expect(chipKeyAction({ key: "ArrowRight", linked: true, count: 4, at: 3 })).toEqual({ type: "focus", index: 0 })
    expect(chipKeyAction({ key: "ArrowLeft", linked: true, count: 4, at: 0 })).toEqual({ type: "focus", index: 3 })
    expect(chipKeyAction({ key: "Home", linked: true, count: 4, at: 2 })).toEqual({ type: "focus", index: 0 })
    expect(chipKeyAction({ key: "End", linked: true, count: 4, at: 1 })).toEqual({ type: "focus", index: 3 })
  })
  it("mode lien : Entrée et Espace activent", () => {
    expect(chipKeyAction({ key: "Enter", linked: true, count: 3, at: 1 })).toEqual({ type: "activate" })
    expect(chipKeyAction({ key: " ", linked: true, count: 3, at: 1 })).toEqual({ type: "activate" })
  })
  it("mode bouton : une flèche sélectionne ; Entrée et Espace gardent le comportement natif", () => {
    expect(chipKeyAction({ key: "ArrowRight", linked: false, count: 3, at: 0 })).toEqual({ type: "select", index: 1 })
    expect(chipKeyAction({ key: "Enter", linked: false, count: 3, at: 0 })).toBeNull()
    expect(chipKeyAction({ key: " ", linked: false, count: 3, at: 0 })).toBeNull()
  })
  it("ignore les autres touches", () => {
    expect(chipKeyAction({ key: "a", linked: true, count: 3, at: 0 })).toBeNull()
    expect(chipKeyAction({ key: "Tab", linked: false, count: 3, at: 0 })).toBeNull()
  })
})

describe("createScrimGuard", () => {
  const scrim = {}
  const inside = {}
  const ev = (target) => ({ target, currentTarget: scrim })
  it("ferme quand l'appui et le clic sont sur le voile", () => {
    const onClose = vi.fn()
    const guard = createScrimGuard(onClose)
    guard.onPointerDown(ev(scrim))
    guard.onClick(ev(scrim))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it("ne ferme pas si l'appui est parti de la boîte (glisser de sélection relâché sur le voile)", () => {
    const onClose = vi.fn()
    const guard = createScrimGuard(onClose)
    guard.onPointerDown(ev(inside))
    guard.onClick(ev(scrim))
    expect(onClose).not.toHaveBeenCalled()
  })
  it("ne ferme pas sans appui préalable ni pour un clic dans la boîte, et l'origine est oubliée après chaque clic", () => {
    const onClose = vi.fn()
    const guard = createScrimGuard(onClose)
    guard.onClick(ev(scrim))
    guard.onPointerDown(ev(scrim))
    guard.onClick(ev(inside))
    guard.onClick(ev(scrim))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// Deux dialogues empilés (Drawer, puis ConfirmDialog au dessus) sur un même document simulé.
function stackedDialogs() {
  const listeners = []
  const doc = {
    body: { style: { overflow: "" } },
    activeElement: null,
    addEventListener: (type, fn) => { if (type === "keydown") listeners.push(fn) },
    removeEventListener: (type, fn) => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
  }
  const makeItems = (n) =>
    Array.from({ length: n }, () => ({
      focus: vi.fn(function focus() { doc.activeElement = this }),
      getClientRects: () => [1],
      closest: () => null,
    }))
  const dialogs = createDialogStack()
  const open = (id, count) => {
    const items = makeItems(count)
    const container = { querySelectorAll: () => items }
    const onClose = vi.fn()
    dialogs.push(id)
    const cleanup = trapFocus({ doc: gateDocument(doc, () => dialogs.isTop(id)), getContainer: () => container, onClose })
    return { items, onClose, close: () => { cleanup(); dialogs.remove(id) } }
  }
  const press = (key, shiftKey = false) => {
    const event = { key, shiftKey, preventDefault: vi.fn() }
    for (const fn of [...listeners]) fn(event)
  }
  return { open, press, dialogs, listeners }
}

describe("pile de dialogues", () => {
  it("createDialogStack : seul le dernier empilé est au dessus, la fermeture rend la main au dessous", () => {
    const stack = createDialogStack()
    expect(stack.isTop("a")).toBe(false)
    stack.push("a")
    stack.push("b")
    expect(stack.isTop("b")).toBe(true)
    expect(stack.isTop("a")).toBe(false)
    stack.remove("b")
    expect(stack.isTop("a")).toBe(true)
    stack.push("a")
    expect(stack.size()).toBe(1)
  })

  it("Drawer + ConfirmDialog : Échap ne ferme que le dialogue du dessus", () => {
    const { open, press } = stackedDialogs()
    const drawer = open("drawer", 2)
    const confirm = open("confirm", 2)
    press("Escape")
    expect(confirm.onClose).toHaveBeenCalledTimes(1)
    expect(drawer.onClose).not.toHaveBeenCalled()
    confirm.close()
    press("Escape")
    expect(drawer.onClose).toHaveBeenCalledTimes(1)
  })

  it("Drawer + ConfirmDialog : Tab boucle dans le dialogue du dessus seulement, puis le dessous reprend", () => {
    const { open, press } = stackedDialogs()
    const drawer = open("drawer", 3)
    const confirm = open("confirm", 2)
    expect(confirm.items[0].focus).toHaveBeenCalled()
    press("Tab")
    press("Tab")
    // Le Tab est traité par le dessus (ConfirmDialog) : le Drawer n'a eu que son focus initial.
    expect(drawer.items.map((el) => el.focus.mock.calls.length)).toEqual([1, 0, 0])
    expect(confirm.items.map((el) => el.focus.mock.calls.length)).toEqual([2, 1])
    confirm.close()
    press("Tab")
    // Le focus n'étant dans aucun élément du Drawer, Tab le place sur le premier : le dessous a repris la main.
    expect(drawer.items.map((el) => el.focus.mock.calls.length)).toEqual([2, 0, 0])
  })

  it("le filtre retire ses écouteurs au nettoyage", () => {
    const { open, listeners } = stackedDialogs()
    const a = open("a", 1)
    const b = open("b", 1)
    expect(listeners).toHaveLength(2)
    b.close()
    a.close()
    expect(listeners).toHaveLength(0)
  })
})
