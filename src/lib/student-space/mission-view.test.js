import { describe, it, expect } from "vitest"
import { pickMissionView, missionActions, receiptFromLedger, buildTimeline, missionDetailView } from "./mission-view"

const mission = (over) => ({
  id: "m1", title: "T", description: "D", type: "Cours particuliers", city: "Cotonou", budget: 20000,
  urgency: "low", deadline: "2999-01-01", status: "open", createdAt: "2026-10-01T08:00:00Z", ...over,
})
const okVerification = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null }
const blocked = { key: "not_submitted", label: "Carte à envoyer", canApply: false, daysLeft: null, action: { label: "Envoyer ma carte", href: "/profile/verify" } }
const app = (over) => ({ id: "a1", status: "pending", message: "Hello", createdAt: "2026-10-02T09:00:00Z", updatedAt: "2026-10-03T09:00:00Z", ...over })
const detail = (over) => ({
  state: "open", mission: mission(), client: { name: "A B." }, application: null, isSelected: false,
  verification: okVerification, ledger: [], review: null, similar: [], ...over,
})
const selected = (status, over) =>
  detail({ state: "selected", mission: mission({ status }), application: app({ status: "accepted" }), isSelected: true, verification: null, ...over })

describe("pickMissionView", () => {
  it("mission ouverte : E03", () => expect(pickMissionView(detail())).toBe("apply"))
  it("étudiant non retenu (plus ouverte) : E03", () => {
    expect(pickMissionView({ state: "closed", mission: { id: "m1" } })).toBe("apply")
  })
  it.each(["in_progress", "done", "cancelled"])("retenu et mission %s : E05", (status) => {
    expect(pickMissionView(selected(status))).toBe("followup")
  })
  it("retenu mais mission encore ouverte : E03", () => {
    expect(pickMissionView(detail({ isSelected: true }))).toBe("apply")
  })
  it("entrée absente ou incohérente : E03", () => {
    expect(pickMissionView(null)).toBe("apply")
    expect(pickMissionView({ state: "selected", isSelected: false, mission: { status: "done" } })).toBe("apply")
  })
})

describe("missionActions", () => {
  it("peut postuler : ouverte, sans candidature, vérification valable", () => {
    expect(missionActions(detail())).toMatchObject({ canApply: true, needsVerification: false, alreadyApplied: false })
  })
  it("vérification bloquante : pas de candidature, demande la vérification", () => {
    expect(missionActions(detail({ verification: blocked }))).toMatchObject({ canApply: false, needsVerification: true })
  })
  it("déjà candidat : plus de candidature", () => {
    expect(missionActions(detail({ application: app() }))).toMatchObject({ canApply: false, alreadyApplied: true, needsVerification: false })
  })
  it("plus ouverte : aucune action", () => {
    expect(Object.values(missionActions({ state: "closed", mission: { id: "m1" } })).every((v) => v === false)).toBe(true)
  })
  it("retenu en cours : écrire et signaler, jamais de bouton J'ai terminé", () => {
    const actions = missionActions(selected("in_progress"))
    expect(actions).toMatchObject({ writeToClient: true, reportProblem: true, rate: false })
    expect(Object.keys(actions)).not.toContain("confirmEnd")
  })
  it("retenu terminé : noter si aucun avis, sinon avis donné", () => {
    expect(missionActions(selected("done"))).toMatchObject({ rate: true, viewReview: false, writeToClient: true })
    expect(missionActions(selected("done", { review: { id: "r1" } }))).toMatchObject({ rate: false, viewReview: true })
  })
  it("retenu annulé : aucune action", () => {
    expect(missionActions(selected("cancelled"))).toMatchObject({
      canApply: false, writeToClient: false, reportProblem: false, rate: false, viewReview: false,
    })
  })
})

describe("receiptFromLedger", () => {
  it("somme des lignes release (le net de l'étudiant) et date la plus récente", () => {
    expect(
      receiptFromLedger([
        { type: "release", amount: 17600, createdAt: "2026-10-20T10:00:00Z" },
        { type: "commission", amount: 2400, createdAt: "2026-10-20T10:00:00Z" },
      ]),
    ).toEqual({ hasLedger: true, net: 17600, date: "2026-10-20T10:00:00Z" })
  })
  it("grand livre vide ou sans release : aucun montant inventé", () => {
    expect(receiptFromLedger([])).toEqual({ hasLedger: false, net: null, date: null })
    expect(receiptFromLedger([{ type: "reserve", amount: 1, createdAt: "x" }]).net).toBeNull()
    expect(receiptFromLedger(undefined).net).toBeNull()
  })
})

describe("buildTimeline", () => {
  const keys = (steps) => steps.map((s) => `${s.key}:${s.state}`)
  it("en cours : candidature et retenue faites, paiement en cours, avis à venir", () => {
    expect(keys(buildTimeline(selected("in_progress")))).toEqual([
      "applied:done", "selected:done", "paid:now", "reviewed:todo",
    ])
  })
  it("terminée non notée : paiement daté par le grand livre, avis à faire", () => {
    const steps = buildTimeline(selected("done", { ledger: [{ type: "release", amount: 17600, createdAt: "2026-10-20T10:00:00Z" }] }))
    expect(keys(steps)).toEqual(["applied:done", "selected:done", "paid:done", "reviewed:now"])
    expect(steps[2].date).toBe("2026-10-20T10:00:00Z")
    expect(steps[0].date).toBe("2026-10-02T09:00:00Z")
    expect(steps[1].date).toBe("2026-10-03T09:00:00Z")
  })
  it("terminée notée : avis fait, daté", () => {
    const steps = buildTimeline(selected("done", { review: { id: "r", rating: 5, comment: null, createdAt: "2026-10-21T00:00:00Z" } }))
    expect(steps[3]).toEqual({ key: "reviewed", state: "done", date: "2026-10-21T00:00:00Z" })
  })
  it("terminée sans ligne de grand livre : date du paiement inconnue, jamais inventée", () => {
    expect(buildTimeline(selected("done"))[2].date).toBeNull()
  })
  it("annulée : candidature et retenue seulement", () => {
    expect(keys(buildTimeline(selected("cancelled")))).toEqual(["applied:done", "selected:done"])
  })
})

describe("missionDetailView", () => {
  it("plus ouverte : { closed: true } sans aucune donnée", () => {
    expect(missionDetailView({ state: "closed", mission: { id: "m1" } })).toEqual({ closed: true })
    expect(missionDetailView(null)).toEqual({ closed: true })
  })
  it("gain net par escrowSplit (jamais 0.88 en dur)", () => {
    expect(missionDetailView(detail(), "2026-10-14").split).toEqual({ total: 20000, commission: 2400, student: 17600 })
  })
  it("mission ouverte : statut, actions, pas de chronologie", () => {
    const view = missionDetailView(detail(), "2026-10-14")
    expect(view.closed).toBe(false)
    expect(view.status.key).toBe("open")
    expect(view.actions.canApply).toBe(true)
    expect(view.timeline).toEqual([])
  })
  it("échéance dépassée détectée au jour donné", () => {
    const view = missionDetailView(detail({ mission: mission({ deadline: "2026-10-01" }) }), "2026-10-14")
    expect(view.deadlinePassed).toBe(true)
    expect(view.status.key).toBe("overdue")
  })
  it("mission suivie : chronologie et reçu", () => {
    const view = missionDetailView(selected("done", { ledger: [{ type: "release", amount: 17600, createdAt: "2026-10-20T10:00:00Z" }] }))
    expect(view.timeline).toHaveLength(4)
    expect(view.receipt.net).toBe(17600)
  })
})
