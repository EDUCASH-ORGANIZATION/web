import { describe, expect, it } from "vitest"
import { CLOSURE_BLOCKERS, CLOSURE_GRACE_DAYS } from "../account-closure/closure-rules.js"
import {
  blockerPresentation,
  closeAccountHref,
  closeProfileHref,
  graceTimeline,
  parseClosureDeadline,
} from "./closure-screen.js"

const NOW = new Date("2026-10-17T10:00:00Z")

describe("adresses des écrans", () => {
  it("donne la page de fermeture et le profil de chaque espace", () => {
    expect(closeAccountHref("client")).toBe("/client/profile/close")
    expect(closeAccountHref("student")).toBe("/profile/close")
    expect(closeProfileHref("client")).toBe("/client/profile")
    expect(closeProfileHref("student")).toBe("/profile")
  })
})

describe("blockerPresentation", () => {
  it("propose une action interne pour chaque code, dans chaque espace, ou aucune", () => {
    for (const code of Object.keys(CLOSURE_BLOCKERS)) {
      for (const space of ["client", "student"]) {
        const entry = blockerPresentation(code, space)
        expect(entry.title).toBeTruthy()
        expect(entry.icon).toMatch(/^i-/)
        if (entry.action) expect(entry.action.href).toMatch(/^(\/|mailto:)/)
      }
    }
  })

  it("oriente le solde vers le portefeuille de l'espace", () => {
    expect(blockerPresentation("WALLET_NOT_EMPTY", "client").action.href).toBe("/client/wallet")
    expect(blockerPresentation("WALLET_NOT_EMPTY", "student").action.href).toBe("/wallet")
  })

  it("ne propose pas d'action étudiante à un client et inversement", () => {
    expect(blockerPresentation("RECENT_WITHDRAWAL", "client").action).toBeNull()
    expect(blockerPresentation("MISSION_STUDENT_ACTIVE", "client").action).toBeNull()
  })

  it("un code inconnu ou READ_ERROR devient une vérification impossible avec Réessayer", () => {
    for (const code of ["READ_ERROR", "AUTRE", undefined]) {
      const entry = blockerPresentation(code, "student")
      expect(entry.title).toBe("Vérification impossible")
      expect(entry.action).toEqual({ label: "Réessayer", href: "/profile/close" })
    }
  })
})

describe("graceTimeline", () => {
  it("cite les dates de réactivation et d'effacement à partir de l'échéance", () => {
    const rows = graceTimeline("2026-10-31T10:00:00Z")
    expect(rows.map((r) => r.value)).toEqual(["Accès coupé", "Réactivable sur demande", "Données effacées"])
    expect(rows[1].label).toMatch(/^Jusqu'au 31 octobre 2026$/)
    expect(rows[2].label).toMatch(/^À partir du 1(er)? novembre 2026$/)
  })

  it("sans échéance lisible, parle de durée sans date", () => {
    for (const due of [null, undefined, "", "pas une date"]) {
      const rows = graceTimeline(due)
      expect(rows[1].label).toBe(`Pendant ${CLOSURE_GRACE_DAYS} jours`)
      expect(rows.some((r) => /\d{4}/.test(r.label))).toBe(false)
    }
  })
})

describe("parseClosureDeadline", () => {
  it("accepte une date ISO dans la fenêtre du délai de grâce", () => {
    const date = parseClosureDeadline("2026-10-31T10:00:00.000Z", NOW)
    expect(date.toISOString()).toBe("2026-10-31T10:00:00.000Z")
    expect(parseClosureDeadline("2026-10-31", NOW)).toBeInstanceOf(Date)
  })

  it("prend la première valeur d'un paramètre répété", () => {
    expect(parseClosureDeadline(["2026-10-31T10:00:00Z", "2030-01-01"], NOW)).toBeInstanceOf(Date)
  })

  it("refuse une date hors fenêtre, mal formée, sans fuseau ou absente", () => {
    for (const bad of [
      "2030-01-01T00:00:00Z",
      "2020-01-01T00:00:00Z",
      "2026-11-30T10:00:00Z",
      "31 octobre 2026",
      "2026-10-31T10:00:00",
      "2026-13-45",
      "<b>2026-10-31</b>",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(parseClosureDeadline(bad, NOW)).toBeNull()
    }
  })
})
