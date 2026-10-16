import { describe, it, expect } from "vitest"
import {
  CONTACT_ALERT_THRESHOLD,
  CONTACT_ALERT_WINDOW_DAYS,
  SPLIT_WINDOW_MINUTES,
  SPLIT_LOOKBACK,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_DETAILS_MAX,
  reportReference,
} from "@/lib/messaging/moderation-rules"

describe("règles de modération", () => {
  it("fixe les seuils des décisions D2 et D9", () => {
    expect(CONTACT_ALERT_THRESHOLD).toBe(3)
    expect(CONTACT_ALERT_WINDOW_DAYS).toBe(30)
    expect(SPLIT_WINDOW_MINUTES).toBe(5)
    expect(SPLIT_LOOKBACK).toBe(2)
    expect(REPORT_DETAILS_MAX).toBe(1000)
  })

  it("liste les statuts d'un signalement", () => {
    expect(REPORT_STATUSES).toEqual(["open", "in_progress", "resolved", "dismissed"])
  })

  it("liste les motifs de signalement exacts du contrat", () => {
    expect(REPORT_REASONS).toEqual([
      { value: "harassment", label: "Harcèlement ou insulte" },
      { value: "scam", label: "Arnaque ou demande d'argent" },
      { value: "contact_details", label: "Coordonnées ou contact hors EduCash" },
      { value: "inappropriate", label: "Contenu inapproprié" },
      { value: "other", label: "Autre" },
    ])
  })

  it("garde des motifs uniques et des libellés vouvoyés, sans tiret cadratin ni mot banni", () => {
    expect(new Set(REPORT_REASONS.map((r) => r.value)).size).toBe(REPORT_REASONS.length)
    for (const { label } of REPORT_REASONS) {
      expect(label).not.toMatch(/\b(?:tu|toi|ton|ta|tes|te)\b/i)
      expect(label).not.toMatch(/saisie|livraison|course|coursier|bient[ôo]t|fedapay/i)
      expect(label).not.toContain(String.fromCharCode(0x2014))
    }
  })
})

describe("reportReference", () => {
  it("formate la référence sur 4 chiffres au minimum", () => {
    expect(reportReference(1)).toBe("SIG-0001")
    expect(reportReference(42)).toBe("SIG-0042")
    expect(reportReference(9999)).toBe("SIG-9999")
    expect(reportReference(12345)).toBe("SIG-12345")
  })

  it("renvoie null pour un numéro invalide", () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, "42", null, undefined]) {
      expect(reportReference(bad)).toBeNull()
    }
  })
})
