// QA indépendante RD-STUDENT-01 vague 1 : verificationView et canApply, 6 statuts, bornes, fuseau du Bénin.
import { describe, it, expect } from "vitest"
import { verificationView, EXPIRING_DAYS } from "@/lib/student-space/verification-status"
import { studentVerifyHref } from "@/lib/app/student-routes"

const TODAY = "2026-10-14"
const plus = (days, from = TODAY) => new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const view = (state, today = TODAY) => verificationView(state, today)

describe("les 6 statuts", () => {
  it("not_submitted : ni badge ni carte ni refus", () => {
    expect(view({})).toMatchObject({ key: "not_submitted", canApply: false, action: { label: "Envoyer ma carte", href: studentVerifyHref() } })
  })
  it("pending : carte envoyée, pas encore vérifié, peut postuler, aucune action", () => {
    expect(view({ hasCard: true })).toMatchObject({ key: "pending", canApply: true, action: null })
  })
  it("verified : badge valide, loin de l'échéance", () => {
    expect(view({ isVerified: true, verifiedUntil: plus(200) })).toMatchObject({ key: "verified", canApply: true, action: null })
  })
  it("expiring : à moins de 30 jours, peut postuler, action de renouvellement", () => {
    expect(view({ isVerified: true, verifiedUntil: plus(10) })).toMatchObject({ key: "expiring", canApply: true, action: { label: "Renouveler mon badge" } })
  })
  it("expired : échéance passée, ne peut plus postuler", () => {
    expect(view({ isVerified: true, verifiedUntil: plus(-1) })).toMatchObject({ key: "expired", canApply: false, action: { label: "Renouveler mon badge" } })
  })
  it("rejected : motif présent, ne peut pas postuler, action de renvoi", () => {
    expect(view({ rejectionReason: "Photo floue" })).toMatchObject({ key: "rejected", canApply: false, action: { label: "Renvoyer ma carte" } })
  })
})

describe("bornes des 30 jours", () => {
  it("le seuil vaut 30", () => expect(EXPIRING_DAYS).toBe(30))
  it.each([
    [-31, "expired"], [-1, "expired"], [0, "expiring"], [1, "expiring"], [29, "expiring"], [30, "expiring"], [31, "verified"], [32, "verified"], [365, "verified"],
  ])("échéance à J%i -> %s", (days, key) => {
    const v = view({ isVerified: true, verifiedUntil: plus(days) })
    expect(v.key).toBe(key)
    expect(v.canApply).toBe(key !== "expired")
    expect(v.daysLeft).toBe(days)
  })
  it("le jour même de l'échéance : encore valable (renouvellement conseillé), pas expiré", () => {
    expect(view({ isVerified: true, verifiedUntil: TODAY })).toMatchObject({ key: "expiring", canApply: true, daysLeft: 0 })
  })
  it("la veille de l'expiration (échéance demain) : expiring avec 1 jour", () => {
    expect(view({ isVerified: true, verifiedUntil: plus(1) })).toMatchObject({ key: "expiring", daysLeft: 1 })
  })
  it("traversée de fin de mois et d'année", () => {
    expect(view({ isVerified: true, verifiedUntil: "2027-01-12" }, "2026-12-13")).toMatchObject({ key: "expiring", daysLeft: 30 })
    expect(view({ isVerified: true, verifiedUntil: "2027-01-13" }, "2026-12-13")).toMatchObject({ key: "verified", daysLeft: 31 })
    expect(view({ isVerified: true, verifiedUntil: "2028-03-01" }, "2028-02-28")).toMatchObject({ key: "expiring", daysLeft: 2 })
  })
})

describe("fuseau du Bénin (UTC+1)", () => {
  it("23:30Z le 13 novembre est le 14 au Bénin (31 jours -> verified)", () => {
    expect(view({ isVerified: true, verifiedUntil: "2026-11-13T23:30:00Z" })).toMatchObject({ key: "verified", daysLeft: 31 })
  })
  it("22:59Z le 13 novembre est encore le 13 au Bénin (30 jours -> expiring)", () => {
    expect(view({ isVerified: true, verifiedUntil: "2026-11-13T22:59:00Z" })).toMatchObject({ key: "expiring", daysLeft: 30 })
  })
  it("échéance horodatée la veille à 23:30Z : déjà aujourd'hui au Bénin, pas expiré", () => {
    expect(view({ isVerified: true, verifiedUntil: "2026-10-13T23:30:00Z" })).toMatchObject({ key: "expiring", daysLeft: 0, canApply: true })
  })
  it("échéance horodatée à 22:59Z la veille : hier au Bénin -> expiré", () => {
    expect(view({ isVerified: true, verifiedUntil: "2026-10-13T22:59:00Z" })).toMatchObject({ key: "expired", daysLeft: -1 })
  })
  it("sans date du jour fournie, la date du jour au Bénin est utilisée", () => {
    expect(verificationView({ isVerified: true, verifiedUntil: "2999-01-01" }).key).toBe("verified")
    expect(verificationView({ isVerified: true, verifiedUntil: "2000-01-01" }).key).toBe("expired")
  })
})

describe("combinaisons et entrées dégradées", () => {
  it("vérifié sans date d'échéance : vérifié sans limite", () => {
    expect(view({ isVerified: true })).toMatchObject({ key: "verified", canApply: true, daysLeft: null })
    expect(view({ isVerified: true, verifiedUntil: null })).toMatchObject({ key: "verified" })
  })
  it("date d'échéance illisible : badge expiré (non vérifié sans fin) ; vide : sans date", () => {
    expect(view({ isVerified: true, verifiedUntil: "pas une date" })).toMatchObject({ key: "expired", canApply: false })
    expect(view({ isVerified: true, verifiedUntil: "" }).key).toBe("verified")
  })
  it("priorité : le motif de refus l'emporte sur la carte envoyée quand non vérifié", () => {
    expect(view({ hasCard: true, rejectionReason: "x" }).key).toBe("rejected")
  })
  it("priorité : vérifié l'emporte sur un ancien motif de refus", () => {
    expect(view({ isVerified: true, verifiedUntil: plus(100), rejectionReason: "ancien" }).key).toBe("verified")
  })
  it("non vérifié mais verifiedUntil dans le futur (incohérence de base) : pas de badge", () => {
    expect(view({ isVerified: false, verifiedUntil: plus(100) }).key).toBe("not_submitted")
    expect(view({ isVerified: false, verifiedUntil: plus(100), hasCard: true }).key).toBe("pending")
  })
  it("motif vide ou nul : traité comme absent", () => {
    expect(view({ rejectionReason: "" }).key).toBe("not_submitted")
    expect(view({ rejectionReason: null }).key).toBe("not_submitted")
  })
  it("appel sans argument : not_submitted", () => {
    expect(verificationView().key).toBe("not_submitted")
    expect(verificationView(undefined, TODAY).canApply).toBe(false)
  })
  it("canApply est un booléen strict pour les 6 statuts et l'action pointe vers /profile/verify", () => {
    const states = [{}, { hasCard: true }, { isVerified: true, verifiedUntil: plus(100) }, { isVerified: true, verifiedUntil: plus(3) }, { isVerified: true, verifiedUntil: plus(-3) }, { rejectionReason: "x" }]
    expect(new Set(states.map((s) => view(s).key)).size).toBe(6)
    for (const s of states) {
      const v = view(s)
      expect(typeof v.canApply).toBe("boolean")
      if (v.action) expect(v.action.href).toBe("/profile/verify")
    }
  })
  it("deux appels ne partagent pas l'objet action (pas de mutation croisée)", () => {
    const a = view({})
    a.action.label = "MUTE"
    expect(view({}).action.label).toBe("Envoyer ma carte")
  })
  it("aucun délai d'examen annoncé dans les libellés", () => {
    for (const s of [{}, { hasCard: true }, { rejectionReason: "x" }]) expect(JSON.stringify(view(s))).not.toMatch(/\b(24|48|72)\s*h|heures|jours ouvr/i)
  })
})
