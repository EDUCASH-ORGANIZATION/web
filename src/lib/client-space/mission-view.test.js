import { describe, it, expect } from "vitest"
import { escrowSplit } from "../app/money.js"
import {
  applicationCounts,
  missionActions,
  receiptFromLedger,
  refundFromLedger,
  reservedAt,
  sortApplications,
  missionView,
} from "./mission-view.js"

const TODAY = "2026-10-13"

function detail(overrides = {}) {
  return {
    mission: { id: "m1", title: "Cours", type: "Cours particuliers", budget: 10000, status: "open", deadline: null },
    applications: [],
    selectedStudent: null,
    ledger: [],
    review: null,
    ...overrides,
  }
}

describe("applicationCounts", () => {
  it("compte par statut et ignore une liste absente", () => {
    expect(applicationCounts([{ status: "pending" }, { status: "pending" }, { status: "accepted" }, { status: "rejected" }])).toEqual({
      total: 4, pending: 2, accepted: 1, rejected: 1,
    })
    expect(applicationCounts(undefined)).toEqual({ total: 0, pending: 0, accepted: 0, rejected: 0 })
  })
})

describe("missionActions", () => {
  it("open : annulation et examen des candidatures, pas de confirmation de fin", () => {
    expect(missionActions("open")).toMatchObject({ cancel: true, reviewApplications: true, confirmEnd: false })
  })
  it("in_progress : jamais d'annulation client (RD-SEC-01), confirmation de fin et médiation", () => {
    expect(missionActions("in_progress")).toMatchObject({
      cancel: false, confirmEnd: true, reportProblem: true, mediationNotice: true, reviewApplications: false,
    })
  })
  it("done : noter seulement sans avis, republier toujours", () => {
    expect(missionActions("done")).toMatchObject({ rate: true, republish: true, cancel: false, confirmEnd: false })
    expect(missionActions("done", { hasReview: true })).toMatchObject({ rate: false, republish: true })
  })
  it("cancelled : dupliquer seulement", () => {
    const a = missionActions("cancelled")
    expect(a.duplicate).toBe(true)
    expect(Object.entries(a).filter(([k, v]) => v && k !== "duplicate")).toEqual([])
  })
})

describe("grand livre", () => {
  const ledger = [
    { type: "reserve", amount: 10000, createdAt: "2026-10-01T09:00:00Z" },
    { type: "release", amount: 10000, createdAt: "2026-10-05T09:00:00Z" },
    { type: "commission", amount: 1200, createdAt: "2026-10-05T09:00:00Z" },
  ]
  it("reçu : release brut du client moins commission = versé à l'étudiant (escrowSplit)", () => {
    const r = receiptFromLedger(ledger)
    expect(r).toEqual({ hasLedger: true, reserved: 10000, commission: 1200, releasedGross: 10000, student: 8800 })
    expect(r.student).toBe(escrowSplit(10000).student)
  })
  it("reçu : mission héritée sans mouvement, grand livre vide", () => {
    expect(receiptFromLedger([])).toEqual({ hasLedger: false, reserved: 0, commission: 0, releasedGross: 0, student: null })
    expect(receiptFromLedger(undefined).hasLedger).toBe(false)
  })
  it("reçu : grand livre incomplet sans commission, aucun versé inventé", () => {
    const r = receiptFromLedger(ledger.filter((m) => m.type !== "commission"))
    expect(r).toMatchObject({ reserved: 10000, commission: 0, releasedGross: 10000, student: null })
    expect(receiptFromLedger(ledger.filter((m) => m.type === "reserve")).student).toBeNull()
  })
  it("reçu : montants en chaîne (numeric PostgREST)", () => {
    const r = receiptFromLedger([
      { type: "reserve", amount: "10000.00" }, { type: "release", amount: "10000.00" }, { type: "commission", amount: "1200.00" },
    ])
    expect(r).toMatchObject({ reserved: 10000, releasedGross: 10000, commission: 1200, student: 8800 })
  })
  it("remboursement : montant et date du dernier mouvement refund, null sans remboursement", () => {
    expect(refundFromLedger([
      { type: "reserve", amount: 5000, createdAt: "2026-10-01T00:00:00Z" },
      { type: "refund", amount: 5000, createdAt: "2026-10-03T00:00:00Z" },
    ])).toEqual({ amount: 5000, date: "2026-10-03T00:00:00Z" })
    expect(refundFromLedger(ledger)).toBeNull()
  })
  it("date de réservation : la plus ancienne", () => {
    expect(reservedAt([...ledger, { type: "reserve", amount: 1, createdAt: "2026-09-01T00:00:00Z" }])).toBe("2026-09-01T00:00:00Z")
    expect(reservedAt([])).toBeNull()
  })
})

describe("sortApplications", () => {
  const apps = [
    { id: "a", createdAt: "2026-10-01T00:00:00Z", student: { rating: 3 } },
    { id: "b", createdAt: "2026-10-03T00:00:00Z", student: { rating: 5 } },
    { id: "c", createdAt: "2026-10-02T00:00:00Z", student: { rating: 5 } },
  ]
  it("récentes d'abord par défaut, mieux notées ensuite, sans toucher à l'original", () => {
    expect(sortApplications(apps).map((a) => a.id)).toEqual(["b", "c", "a"])
    expect(sortApplications(apps, "rated").map((a) => a.id)).toEqual(["b", "c", "a"])
    expect(sortApplications([apps[0], apps[2], apps[1]], "rated").map((a) => a.id)).toEqual(["b", "c", "a"])
    expect(apps.map((a) => a.id)).toEqual(["a", "b", "c"])
  })
})

describe("missionView", () => {
  it("statut, échéance dépassée et répartition escrowSplit", () => {
    const v = missionView(detail({ mission: { ...detail().mission, deadline: "2026-10-01" } }), TODAY)
    expect(v.status.key).toBe("overdue")
    expect(v.overdue).toBe(true)
    expect(v.deadlinePassed).toBe(true)
    expect(v.split).toEqual({ total: 10000, commission: 1200, student: 8800 })
    expect(v.actions.cancel).toBe(true)
  })
  it("sans échéance, ouverte et jamais dépassée", () => {
    const v = missionView(detail(), TODAY)
    expect(v.status.key).toBe("open")
    expect(v.overdue).toBe(false)
  })
  it("une mission en cours dont l'échéance est passée reste en cours", () => {
    const v = missionView(detail({ mission: { ...detail().mission, status: "in_progress", deadline: "2026-01-01" } }), TODAY)
    expect(v.status.key).toBe("in_progress")
    expect(v.actions.cancel).toBe(false)
  })
  it("annulée avec remboursement et terminée avec avis", () => {
    const cancelled = missionView(detail({
      mission: { ...detail().mission, status: "cancelled" },
      ledger: [{ type: "refund", amount: 10000, createdAt: "2026-10-02T00:00:00Z" }],
    }), TODAY)
    expect(cancelled.refund).toEqual({ amount: 10000, date: "2026-10-02T00:00:00Z" })
    const done = missionView(detail({
      mission: { ...detail().mission, status: "done" },
      review: { id: "r", rating: 5, comment: null, createdAt: "x" },
    }), TODAY)
    expect(done.actions.rate).toBe(false)
  })
  it("compte les candidatures", () => {
    const v = missionView(detail({ applications: [{ status: "pending" }, { status: "rejected" }] }), TODAY)
    expect(v.counts).toEqual({ total: 2, pending: 1, accepted: 0, rejected: 1 })
  })
})

describe("missionView : fin déclarée par l'étudiant (RD-DONE-01)", () => {
  const inProgress = { ...detail().mission, status: "in_progress" }
  const withCompletion = (completion, status = "in_progress") =>
    detail({ mission: { ...inProgress, status }, completion })

  it("déclarée : badge « À confirmer » en ton alerte, clé du statut inchangée", () => {
    const v = missionView(withCompletion({ available: true, declaredAt: "2026-10-07T09:00:00Z" }), TODAY)
    expect(v.status).toMatchObject({ key: "in_progress", label: "À confirmer", tone: "alerte" })
    expect(v.completion).toEqual({ state: "declared", declaredAt: "2026-10-07T09:00:00Z", available: true })
  })
  it("non déclarée : « En cours » inchangé", () => {
    const v = missionView(withCompletion({ available: true, declaredAt: null }), TODAY)
    expect(v.status).toMatchObject({ label: "En cours", tone: "bleu" })
    expect(v.completion).toEqual({ state: "none", declaredAt: null, available: true })
  })
  it("colonne absente ou lecture absente : rendu actuel, aucun état, même avec une date parasite", () => {
    for (const completion of [undefined, { available: false, declaredAt: "2026-10-07T09:00:00Z" }]) {
      const v = missionView(withCompletion(completion), TODAY)
      expect(v.status.label).toBe("En cours")
      expect(v.completion).toEqual({ state: "none", declaredAt: null, available: false })
    }
  })
  it("terminée : statut « Terminée » inchangé, date de déclaration conservée", () => {
    const v = missionView(withCompletion({ available: true, declaredAt: "2026-10-07T09:00:00Z" }, "done"), TODAY)
    expect(v.status).toMatchObject({ key: "done", label: "Terminée", tone: "succes" })
    expect(v.completion).toMatchObject({ state: "confirmed", declaredAt: "2026-10-07T09:00:00Z" })
  })
  it("Confirmer la fin reste disponible avec et sans déclaration, et sans colonne", () => {
    for (const completion of [{ available: true, declaredAt: "2026-10-07T09:00:00Z" }, { available: true, declaredAt: null }, undefined]) {
      expect(missionView(withCompletion(completion), TODAY).actions.confirmEnd).toBe(true)
    }
  })
})
