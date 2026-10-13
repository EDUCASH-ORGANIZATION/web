import { describe, expect, it, vi } from "vitest"
import { trapFocus } from "@/hooks/use-modal-focus"
import {
  addToast,
  confirmStepView,
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
