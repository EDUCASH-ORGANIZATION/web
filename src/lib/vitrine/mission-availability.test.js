import { describe, it, expect } from "vitest"
import { missionAvailability, CLOSED_REASON_LABELS } from "./mission-availability"

const TODAY = "2026-10-08"

describe("missionAvailability", () => {
  it("ferme une mission ouverte dont l'échéance est hier", () => {
    expect(missionAvailability({ status: "open", deadline: "2026-10-07" }, TODAY)).toEqual({
      accepting: false,
      reason: "expired",
    })
  })
  it("garde ouverte une mission dont l'échéance est aujourd'hui", () => {
    expect(missionAvailability({ status: "open", deadline: TODAY }, TODAY)).toEqual({
      accepting: true,
      reason: null,
    })
  })
  it("garde ouverte une mission sans échéance", () => {
    expect(missionAvailability({ status: "open", deadline: null }, TODAY)).toEqual({
      accepting: true,
      reason: null,
    })
  })
  it.each(["in_progress", "done", "cancelled"])("ferme le statut %s", (status) => {
    expect(missionAvailability({ status, deadline: null }, TODAY)).toEqual({
      accepting: false,
      reason: status,
    })
  })
  it("expose les libellés", () => {
    expect(CLOSED_REASON_LABELS).toEqual({
      expired: "Échéance dépassée",
      in_progress: "Mission pourvue",
      done: "Terminée",
      cancelled: "Annulée",
    })
  })
})
