import { describe, it, expect } from "vitest"
import { completionState, canDeclareCompletion, COMPLETION_COPY } from "./completion"

const DATE = "2026-10-14T09:30:00.000Z"

describe("completionState", () => {
  it("none : mission ouverte, ou en cours sans déclaration", () => {
    expect(completionState({ status: "open", completionDeclaredAt: null })).toBe("none")
    expect(completionState({ status: "in_progress", completionDeclaredAt: null })).toBe("none")
    expect(completionState({ status: "in_progress" })).toBe("none")
    expect(completionState({})).toBe("none")
    expect(completionState()).toBe("none")
  })

  it("declared : en cours avec une date", () => {
    expect(completionState({ status: "in_progress", completionDeclaredAt: DATE })).toBe("declared")
  })

  it("confirmed : terminée, date conservée ou non", () => {
    expect(completionState({ status: "done", completionDeclaredAt: DATE })).toBe("confirmed")
    expect(completionState({ status: "done", completionDeclaredAt: null })).toBe("confirmed")
  })

  it("cancelled : annulée, date conservée ou non", () => {
    expect(completionState({ status: "cancelled", completionDeclaredAt: DATE })).toBe("cancelled")
    expect(completionState({ status: "cancelled" })).toBe("cancelled")
  })

  it("une date sur une mission ouverte n'ouvre pas l'état déclaré", () => {
    expect(completionState({ status: "open", completionDeclaredAt: DATE })).toBe("none")
  })
})

describe("canDeclareCompletion", () => {
  const base = { status: "in_progress", isSelected: true, completionDeclaredAt: null, available: true }

  it("seul l'étudiant retenu d'une mission en cours, sans déclaration, colonne disponible", () => {
    expect(canDeclareCompletion(base)).toBe(true)
  })

  it("refuse chaque autre cas", () => {
    expect(canDeclareCompletion({ ...base, isSelected: false })).toBe(false)
    expect(canDeclareCompletion({ ...base, available: false })).toBe(false)
    expect(canDeclareCompletion({ ...base, completionDeclaredAt: DATE })).toBe(false)
    for (const status of ["open", "done", "cancelled", undefined]) {
      expect(canDeclareCompletion({ ...base, status })).toBe(false)
    }
    expect(canDeclareCompletion()).toBe(false)
  })
})

describe("COMPLETION_COPY", () => {
  it("textes vouvoyés attendus", () => {
    expect(COMPLETION_COPY.action).toBe("J'ai terminé")
    expect(COMPLETION_COPY.confirmTitle).toBe("Vous confirmez avoir terminé ?")
    expect(COMPLETION_COPY.declaredBadge).toBe("Terminé, à confirmer")
    expect(COMPLETION_COPY.unavailable).toBe("Cette fonction n'est pas encore disponible.")
  })

  it("declaredOn : date en français, repli sans date", () => {
    expect(COMPLETION_COPY.declaredOn(DATE)).toMatch(/^Fin déclarée le .*2026/)
    expect(COMPLETION_COPY.declaredOn(null)).toBe("Fin déclarée")
    expect(COMPLETION_COPY.declaredOn("pas une date")).toBe("Fin déclarée")
  })

  it("aucun texte ne promet de délai ni de paiement automatique", () => {
    const all = Object.values(COMPLETION_COPY).filter((v) => typeof v === "string").join(" ")
    expect(all).not.toMatch(/\d+\s?h\b|automatique/i)
    expect(all).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })
})
