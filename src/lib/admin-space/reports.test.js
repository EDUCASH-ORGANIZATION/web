import { describe, it, expect } from "vitest"
import {
  REPORT_TABS,
  REPORT_TAB_LABELS,
  detectionKindLabel,
  detectionRows,
  messageTypeLabel,
  reportActions,
  reportMoment,
  reportSourceLabel,
  reportStatusView,
} from "./reports.js"
import { CONTACT_KINDS, REPORT_STATUSES } from "../messaging/moderation-rules.js"

describe("libellés des signalements", () => {
  it("chaque onglet a un libellé", () => {
    expect(REPORT_TABS.map((t) => REPORT_TAB_LABELS[t])).toEqual(["À traiter", "Résolus", "Classés"])
  })

  it("chaque statut de la base a une vue, un statut inconnu reste neutre", () => {
    for (const status of REPORT_STATUSES) expect(reportStatusView(status).label).not.toBe("Statut inconnu")
    expect(reportStatusView("open")).toEqual({ label: "Ouvert", tone: "erreur" })
    expect(reportStatusView("resolved").tone).toBe("succes")
    expect(reportStatusView("dismissed").tone).toBe("neutre")
    expect(reportStatusView("zzz")).toEqual({ label: "Statut inconnu", tone: "neutre" })
  })

  it("chaque type de détection du filtre a un libellé", () => {
    for (const kind of CONTACT_KINDS) expect(detectionKindLabel(kind)).not.toBe("Autre détection")
    expect(detectionKindLabel("nouveau")).toBe("Autre détection")
  })

  it("origine et type de message", () => {
    expect(reportSourceLabel("auto")).toBe("Alerte automatique")
    expect(reportSourceLabel("user")).toBe("Signalement d'un utilisateur")
    expect(messageTypeLabel("location")).toBe("Position partagée")
    expect(messageTypeLabel("x")).toBe("Message")
  })
})

describe("detectionRows", () => {
  it("tri décroissant, ignore les comptes nuls ou invalides", () => {
    expect(detectionRows({ link: 1, phone: 3, email: 0, social: "x" }).map((r) => [r.kind, r.count])).toEqual([
      ["phone", 3],
      ["link", 1],
    ])
    expect(detectionRows(null)).toEqual([])
  })
})

describe("reportActions", () => {
  it("prise en charge puis clôture, rien une fois clos", () => {
    expect(reportActions("open")).toEqual({ take: true, close: false })
    expect(reportActions("in_progress")).toEqual({ take: false, close: true })
    expect(reportActions("resolved")).toEqual({ take: false, close: false })
    expect(reportActions("dismissed")).toEqual({ take: false, close: false })
  })
})

describe("reportMoment", () => {
  it("heure du Bénin, vide si invalide", () => {
    expect(reportMoment("2026-10-10T08:05:00Z")).toMatch(/10 oct\.? · 09:05/)
    expect(reportMoment("")).toBe("")
    expect(reportMoment("pas une date")).toBe("")
  })
})
