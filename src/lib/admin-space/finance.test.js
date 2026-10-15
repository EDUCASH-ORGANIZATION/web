import { describe, it, expect } from "vitest"
import {
  clampPage,
  cleanSearch,
  elapsedLabel,
  formatDateTime,
  formatTime,
  operatorFromNote,
  parsePage,
  parseTransactionParams,
  parseWalletParams,
  periodStart,
  splitPage,
  totalPages,
  walletAnomaly,
  walletAvailable,
  withdrawalStatus,
} from "./finance"

const NOW = new Date("2026-10-15T10:00:00Z")

describe("paramètres", () => {
  it("page : entier de 1 à 100000, sinon 1", () => {
    expect(parsePage("3")).toBe(3)
    for (const v of [undefined, "", "0", "-2", "2.5", "abc", "1e3", "9999999", ["x"], null, 7]) expect(parsePage(v)).toBe(1)
    expect(parsePage(["4", "5"])).toBe(4)
  })

  it("recherche nettoyée et bornée", () => {
    expect(cleanSearch("  a\u0000b \n c ")).toBe("a b c")
    expect(cleanSearch("x".repeat(500)).length).toBe(60)
    expect(cleanSearch({ toString: () => "x" })).toBe("")
  })

  it("transactions : listes fermées, valeurs hostiles ignorées", () => {
    expect(parseTransactionParams({ type: "commission", periode: "30j", q: "FDP-1", page: "2" })).toEqual({
      type: "commission",
      periode: "30j",
      q: "FDP-1",
      referenceOk: true,
      page: 2,
    })
    const bad = parseTransactionParams({ type: "adjustment", periode: "1an", q: "a b%", page: "-1" })
    expect(bad).toMatchObject({ type: "", periode: "mois", referenceOk: false, page: 1 })
    expect(parseTransactionParams(null)).toMatchObject({ type: "", periode: "mois", q: "", referenceOk: true })
    expect(parseTransactionParams({ q: "x".repeat(400) }).q.length).toBe(64)
  })

  it("portefeuilles : recherche et page", () => {
    expect(parseWalletParams({ q: " Rosine ", page: "3" })).toEqual({ q: "Rosine", page: 3 })
    expect(parseWalletParams(undefined)).toEqual({ q: "", page: 1 })
  })
})

describe("périodes", () => {
  it("7 et 30 jours glissants", () => {
    expect(periodStart("7j", NOW)).toBe("2026-10-08T10:00:00.000Z")
    expect(periodStart("30j", NOW)).toBe("2026-09-15T10:00:00.000Z")
  })

  it("mois au Bénin, y compris juste après minuit UTC la veille du 1er", () => {
    expect(periodStart("mois", NOW)).toBe("2026-10-01T00:00:00+01:00")
    expect(periodStart("mois", new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01T00:00:00+01:00")
    expect(periodStart("inconnue", NOW)).toBe("2026-10-01T00:00:00+01:00")
  })
})

describe("pagination", () => {
  it("nombre de pages et page ramenée dans les limites", () => {
    expect(totalPages(0)).toBe(1)
    expect(totalPages(25)).toBe(1)
    expect(totalPages(26)).toBe(2)
    expect(totalPages("abc")).toBe(1)
    expect(clampPage(9, 30)).toBe(2)
    expect(clampPage(0, 30)).toBe(1)
    expect(clampPage(NaN, 30)).toBe(1)
  })

  it("splitPage : partie en mémoire puis partie lue par plage", () => {
    expect(splitPage(1, 20)).toEqual({ head: [0, 20], tail: [0, 5] })
    expect(splitPage(2, 20)).toEqual({ head: [20, 20], tail: [5, 30] })
    expect(splitPage(1, 40)).toEqual({ head: [0, 25], tail: null })
    expect(splitPage(2, 40)).toEqual({ head: [25, 40], tail: [0, 10] })
    expect(splitPage(1, 0)).toEqual({ head: [0, 0], tail: [0, 25] })
  })
})

describe("portefeuilles", () => {
  it("disponible et anomalies, valeurs illisibles traitées comme 0", () => {
    expect(walletAvailable(10000.5, 2000.25)).toBeCloseTo(8000.25)
    expect(walletAvailable("abc", null)).toBe(0)
    expect(walletAnomaly({ balance: -1, reserved: 0 })).toBe("negative-balance")
    expect(walletAnomaly({ balance: 100, reserved: 101 })).toBe("reserved-over-balance")
    expect(walletAnomaly({ balance: 100, reserved: 100 })).toBeNull()
    expect(walletAnomaly({ balance: null, reserved: null })).toBeNull()
    expect(walletAnomaly()).toBeNull()
  })
})

describe("retraits", () => {
  it("opérateur sans jamais nommer le prestataire", () => {
    expect(operatorFromNote("Retrait MTN")).toBe("MTN MoMo")
    expect(operatorFromNote("MOOV 01")).toBe("Moov Money")
    expect(operatorFromNote("Celtiis")).toBe("Celtiis Cash")
    for (const n of [null, undefined, "", 12, { a: 1 }, "fedapay payout"]) expect(operatorFromNote(n)).toBe("Mobile Money")
  })

  it("statut : recrédité, virement créé, bloqué après 24 h, en cours avant", () => {
    const at = (h) => new Date(NOW.getTime() - h * 3600000).toISOString()
    expect(withdrawalStatus({ reversed: true, reference: "X", createdAt: at(1) }, NOW)).toBe("reversed")
    expect(withdrawalStatus({ reference: "FDP-1", createdAt: at(100) }, NOW)).toBe("created")
    expect(withdrawalStatus({ reference: "  ", createdAt: at(25) }, NOW)).toBe("stuck")
    expect(withdrawalStatus({ reference: null, createdAt: at(24) }, NOW)).toBe("pending")
    expect(withdrawalStatus({ reference: null, createdAt: at(2) }, NOW)).toBe("pending")
    expect(withdrawalStatus({ createdAt: "nope" }, NOW)).toBe("pending")
  })

  it("durée écoulée", () => {
    const at = (h) => new Date(NOW.getTime() - h * 3600000).toISOString()
    expect(elapsedLabel(at(0.2), NOW)).toBe("moins d'une heure")
    expect(elapsedLabel(at(20), NOW)).toBe("20 h")
    expect(elapsedLabel(at(72), NOW)).toBe("3 j")
    expect(elapsedLabel(at(-5), NOW)).toBe("moins d'une heure")
    expect(elapsedLabel("nope", NOW)).toBe("")
  })
})

describe("dates", () => {
  it("heure du Bénin", () => {
    expect(formatDateTime("2026-10-08T12:02:00Z")).toBe("8 oct. 13:02")
    expect(formatDateTime("2026-10-08T23:30:00Z")).toBe("9 oct. 00:30")
    expect(formatDateTime(null)).toBe("")
    expect(formatDateTime("nope")).toBe("")
    expect(formatTime("2026-10-15T13:32:00Z")).toBe("14:32")
    expect(formatTime(undefined)).toBe("")
  })
})
