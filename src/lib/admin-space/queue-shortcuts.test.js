import { describe, it, expect } from "vitest"
import { isOwnKeyTarget, isQueueScope, shortcutAction } from "./queue-shortcuts"

const el = (tagName, { closest = () => null, editable = false } = {}) => ({ tagName, closest, isContentEditable: editable })
const BODY = el("BODY")
const ALLOWED = ["approve", "reject"]
const press = (key, extra = {}) => shortcutAction({ key, target: BODY, body: BODY, allowed: ALLOWED, ...extra })

describe("shortcutAction", () => {
  it("flèches : dossier précédent et suivant depuis la page nue", () => {
    expect(press("ArrowUp")).toBe("prev")
    expect(press("ArrowDown")).toBe("next")
  })

  it("V et R sont acceptés en majuscule comme en minuscule", () => {
    expect(press("v")).toBe("approve")
    expect(press("V")).toBe("approve")
    expect(press("r")).toBe("reject")
    expect(press("R")).toBe("reject")
  })

  it("V et R ne font rien quand la décision n'est pas permise (incomplet, vérifié, refusé, expiré)", () => {
    expect(press("v", { allowed: [] })).toBeNull()
    expect(press("r", { allowed: ["reset"] })).toBeNull()
    expect(press("v", { allowed: ["revoke"] })).toBeNull()
  })

  it("aucune action pendant une saisie, une liste déroulante ou un dialogue", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(press("v", { target: el(tag) })).toBeNull()
      expect(press("ArrowDown", { target: el(tag) })).toBeNull()
    }
    expect(press("r", { target: el("DIV", { editable: true }) })).toBeNull()
    expect(press("ArrowDown", { target: el("BUTTON", { closest: () => ({}) }) })).toBeNull()
    expect(press("v", { dialogOpen: true })).toBeNull()
    expect(press("ArrowUp", { dialogOpen: true })).toBeNull()
  })

  it("aucune action avec Ctrl, Cmd ou Alt (raccourcis du navigateur)", () => {
    expect(press("r", { ctrlKey: true })).toBeNull()
    expect(press("r", { metaKey: true })).toBeNull()
    expect(press("v", { altKey: true })).toBeNull()
  })

  it("touches inconnues ignorées", () => {
    expect(press("Enter")).toBeNull()
    expect(press("x")).toBeNull()
    expect(press(undefined)).toBeNull()
  })

  it("les flèches sont réservées à la page nue et à la liste, V et R valent partout hors saisie", () => {
    const link = el("A", { closest: (sel) => (sel === "[data-queue-scope]" ? {} : null) })
    const elsewhere = el("A")
    expect(press("ArrowDown", { target: link })).toBe("next")
    expect(press("ArrowDown", { target: elsewhere })).toBeNull()
    expect(press("v", { target: elsewhere })).toBe("approve")
  })
})

describe("détecteurs", () => {
  it("isOwnKeyTarget : cible absente ou neutre = faux", () => {
    expect(isOwnKeyTarget(null)).toBe(false)
    expect(isOwnKeyTarget(el("A"))).toBe(false)
    expect(isOwnKeyTarget({ tagName: "A" })).toBe(false)
  })

  it("isQueueScope : cible absente = page nue", () => {
    expect(isQueueScope(null, BODY)).toBe(true)
    expect(isQueueScope(BODY, BODY)).toBe(true)
    expect(isQueueScope(el("A"), BODY)).toBe(false)
    expect(isQueueScope({ tagName: "A" }, BODY)).toBe(false)
  })
})
