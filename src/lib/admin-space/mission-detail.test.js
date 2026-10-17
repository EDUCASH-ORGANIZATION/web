import { describe, it, expect } from "vitest"
import {
  applicationStatusLabel,
  buildMissionTimeline,
  moneySummary,
  purchaseReasonLabel,
  purchaseTimeline,
  purchasesSummary,
  reporterLabel,
} from "./mission-detail"

const CLIENT = "c1"
const STUDENT = "s1"
const move = (type, amount, userId, createdAt = "2026-10-12T10:00:00Z") => ({ type, amount, userId, createdAt })

describe("moneySummary", () => {
  it("sépare le séquestre du client, la commission et la part de l'étudiant", () => {
    const m = moneySummary({
      budget: 10000,
      clientId: CLIENT,
      ledger: [move("reserve", 10000, CLIENT), move("release", 10000, CLIENT), move("commission", 1200, CLIENT), move("release", 8800, STUDENT)],
    })
    expect(m).toMatchObject({ reserved: 10000, released: 10000, commission: 1200, studentReceived: 8800, refunded: 0, inEscrow: 0 })
    expect(m.planned).toEqual({ total: 10000, commission: 1200, student: 8800 })
  })

  it("mission en cours : l'argent reste en séquestre", () => {
    const m = moneySummary({ budget: 5000, clientId: CLIENT, ledger: [move("reserve", 5000, CLIENT)] })
    expect(m.inEscrow).toBe(5000)
    expect(m.hasMovements).toBe(true)
  })

  it("remboursement : plus rien en séquestre, montants pris en valeur absolue", () => {
    const m = moneySummary({ budget: 5000, clientId: CLIENT, ledger: [move("reserve", -5000, CLIENT), move("refund", 5000, CLIENT)] })
    expect(m).toMatchObject({ reserved: 5000, refunded: 5000, inEscrow: 0 })
  })

  it("sans mouvement ni liste : zéro, jamais d'erreur", () => {
    expect(moneySummary({ budget: 1000, clientId: CLIENT, ledger: undefined })).toMatchObject({ reserved: 0, inEscrow: 0, hasMovements: false })
  })
})

describe("buildMissionTimeline", () => {
  const base = { id: "m", createdAt: "2026-10-10T08:00:00Z", updatedAt: "2026-10-14T08:00:00Z", selectedStudentId: null }
  const titles = (input) => buildMissionTimeline({ clientId: CLIENT, studentName: "Esther", completion: null, ledger: [], ...input }).map((i) => i.title)

  it("ouverte : publiée puis en attente d'un étudiant", () => {
    expect(titles({ mission: { ...base, status: "open" } })).toEqual(["Mission publiée", "En attente d'un étudiant"])
  })

  it("en cours avec fin déclarée : à confirmer par le client, datée", () => {
    const items = buildMissionTimeline({
      clientId: CLIENT,
      studentName: "Esther",
      mission: { ...base, status: "in_progress", selectedStudentId: STUDENT },
      completion: { declaredAt: "2026-10-13T08:00:00Z", finishedAt: null },
      ledger: [],
    })
    const step = items.find((i) => i.title.startsWith("Fin déclarée"))
    expect(step).toMatchObject({ state: "current", title: "Fin déclarée par l'étudiant, à confirmer par le client", at: "2026-10-13T08:00:00Z" })
  })

  it("en cours avec fin déclarée : étapes dans l'ordre", () => {
    const out = titles({
      mission: { ...base, status: "in_progress", selectedStudentId: STUDENT },
      completion: { declaredAt: "2026-10-13T08:00:00Z", finishedAt: null },
      ledger: [move("reserve", 5000, CLIENT)],
    })
    expect(out).toEqual([
      "Mission publiée",
      "Étudiant retenu : Esther",
      "5 000 FCFA placés en séquestre",
      "Fin déclarée par l'étudiant, à confirmer par le client",
      "Libération du séquestre",
    ])
  })

  it("en cours sans déclaration : mission en cours", () => {
    expect(titles({ mission: { ...base, status: "in_progress", selectedStudentId: STUDENT } })).toContain("Mission en cours")
    expect(titles({ mission: { ...base, status: "in_progress", selectedStudentId: STUDENT }, completion: { declaredAt: null, finishedAt: null } })).toContain("Mission en cours")
  })

  it("terminée : fin et libération datées", () => {
    const items = buildMissionTimeline({
      clientId: CLIENT,
      studentName: "Esther",
      mission: { ...base, status: "done", selectedStudentId: STUDENT },
      completion: { declaredAt: "2026-10-12T08:00:00Z", finishedAt: "2026-10-13T08:00:00Z" },
      ledger: [move("reserve", 5000, CLIENT), move("release", 5000, CLIENT, "2026-10-13T08:01:00Z")],
    })
    const titlesOut = items.map((i) => i.title)
    expect(titlesOut.indexOf("Fin déclarée par l'étudiant")).toBeGreaterThan(-1)
    expect(titlesOut.indexOf("Fin déclarée par l'étudiant")).toBeLessThan(titlesOut.indexOf("Mission terminée"))
    expect(items.find((i) => i.title === "Fin déclarée par l'étudiant").at).toBe("2026-10-12T08:00:00Z")
    expect(items.find((i) => i.title === "Mission terminée").at).toBe("2026-10-13T08:00:00Z")
    expect(items.at(-1).at).toBe("2026-10-13T08:01:00Z")
  })

  it("terminée sans déclaration connue : pas d'étape de déclaration", () => {
    const out = titles({
      mission: { ...base, status: "done", selectedStudentId: STUDENT },
      completion: { declaredAt: null, finishedAt: "2026-10-13T08:00:00Z" },
    })
    expect(out).not.toContain("Fin déclarée par l'étudiant")
    expect(out).toContain("Mission terminée")
  })

  it("annulée : date d'annulation et remboursement", () => {
    const items = buildMissionTimeline({
      clientId: CLIENT,
      studentName: "",
      mission: { ...base, status: "cancelled" },
      completion: null,
      ledger: [move("reserve", 5000, CLIENT), move("refund", 5000, CLIENT, "2026-10-14T09:00:00Z")],
    })
    expect(items.map((i) => i.title)).toEqual(["Mission publiée", "5 000 FCFA placés en séquestre", "Mission annulée", "5 000 FCFA remboursés au client"])
    expect(items[2].at).toBe("2026-10-14T08:00:00Z")
  })
})

describe("applicationStatusLabel", () => {
  it("libellés français et statut inconnu neutre", () => {
    expect(applicationStatusLabel("pending")).toBe("En attente")
    expect(applicationStatusLabel("accepted")).toBe("Retenue")
    expect(applicationStatusLabel("rejected")).toBe("Non retenue")
    expect(applicationStatusLabel("zzz")).toBe("Statut inconnu")
  })
})

describe("purchasesSummary", () => {
  it("regroupe Payé et Reçu, compte les signalées à part, ignore les annulées", () => {
    const totals = purchasesSummary(
      [
        { status: "received", amount: 8750 },
        { status: "paid", amount: 1000 },
        { status: "pending", amount: 7500 },
        { status: "reported", amount: 500 },
        { status: "cancelled", amount: 9999 },
      ],
      15000,
    )
    expect(totals).toEqual({ count: 4, requested: 17750, paid: 9750, pending: 7500, reported: 500, estimate: 15000 })
  })

  it("l'estimation n'est jamais additionnée aux demandes", () => {
    expect(purchasesSummary([{ status: "pending", amount: 100 }], 15000).requested).toBe(100)
    expect(purchasesSummary([], 15000)).toMatchObject({ count: 0, requested: 0, paid: 0, estimate: 15000 })
  })

  it.each([[null], [undefined], [0], [-5], [NaN]])("estimation %j : absente", (estimate) => {
    expect(purchasesSummary([], estimate).estimate).toBeNull()
  })

  it("liste invalide ou lignes invalides : totaux à zéro", () => {
    expect(purchasesSummary(null, null)).toMatchObject({ count: 0, requested: 0 })
    expect(purchasesSummary([{ status: "pending", amount: 12.5 }, { status: "zzz", amount: 100 }, null], null).count).toBe(0)
  })
})

describe("purchaseTimeline", () => {
  it("ne garde que les dates connues, dans l'ordre des événements", () => {
    const steps = purchaseTimeline({
      createdAt: "2026-10-12T12:10:00Z",
      paidAt: "2026-10-12T12:24:00Z",
      receivedAt: "2026-10-12T12:31:00Z",
    })
    expect(steps.map((s) => s.label)).toEqual(["Envoyée", "payée", "reçue par le vendeur"])
    expect(steps[1].at).toBe("2026-10-12T12:24:00Z")
  })

  it("demande signalée ou annulée : l'événement est ajouté", () => {
    expect(purchaseTimeline({ createdAt: "a", reportedAt: "b" }).map((s) => s.label)).toEqual(["Envoyée", "signalée"])
    expect(purchaseTimeline({ createdAt: "a", editedAt: "b", cancelledAt: "c" }).map((s) => s.label)).toEqual([
      "Envoyée",
      "modifiée",
      "annulée",
    ])
  })

  it("entrée absente : aucune étape", () => {
    expect(purchaseTimeline(null)).toEqual([])
  })
})

describe("libellés d'achats", () => {
  it("motifs connus et inconnu neutre", () => {
    expect(purchaseReasonLabel("purchase_vendor_not_paid")).toBe("Le vendeur n'a pas reçu l'argent")
    expect(purchaseReasonLabel("other")).toBe("Autre")
    expect(purchaseReasonLabel("spam")).toBe("Motif inconnu")
  })

  it("auteur d'un signalement", () => {
    expect(reporterLabel("client")).toBe("le client")
    expect(reporterLabel("student")).toBe("l'étudiant")
    expect(reporterLabel(null)).toBe("un participant")
  })
})
