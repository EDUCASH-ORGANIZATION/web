import { describe, it, expect } from "vitest"
import {
  classifyDossier,
  dossierHints,
  ageLabel,
  sortQueue,
  allowedActions,
  parseVerificationParams,
  badgeUntil,
  VERIFICATION_TABS,
  MAX_PAGE,
} from "./verification-queue"
import { rejectSchema, reasonSchema, uuidSchema, ADMIN_REJECTION_REASONS } from "./decision-schemas"
import { buildQueue, heroItem, nextItems, totalToHandle, moneyAlertsFromWallets } from "./dashboard-queue"
import { shortcutAction } from "./queue-shortcuts"

const UUID = "00000000-0000-4000-8000-000000000001"

describe("QA classifyDossier : minuit au Bénin (UTC+1)", () => {
  it("23:30 UTC le 14 est déjà le 15 au Bénin : un badge au 14 est échu", () => {
    const today = "2026-10-15" // jour du Bénin à 23:30Z le 14
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2026-10-14" }, today)).toBe("expires")
  })
  it("le jour de l'échéance, le badge est encore valide", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2026-10-15" }, "2026-10-15")).toBe("verifies")
  })
  it("carte renvoyée à 23:30 UTC le jour J+0 de l'échéance = J+1 au Bénin : à examiner", () => {
    const d = { isVerified: false, verifiedUntil: "2026-10-14", hasCard: true, submittedAt: "2026-10-14T23:30:00Z" }
    expect(classifyDossier(d, "2026-10-20")).toBe("a-examiner")
  })
  it("carte renvoyée à 22:59 UTC le jour de l'échéance = encore le jour de l'échéance au Bénin : expiré", () => {
    const d = { isVerified: false, verifiedUntil: "2026-10-14", hasCard: true, submittedAt: "2026-10-14T22:59:59Z" }
    expect(classifyDossier(d, "2026-10-20")).toBe("expires")
  })
  it("badgeUntil à 23:30 UTC le 28 février 2027 (1er mars au Bénin) donne le 1er mars 2028", async () => {
    const { todayInBenin } = await import("@/lib/vitrine/dates")
    expect(todayInBenin(new Date("2027-02-28T23:30:00Z"))).toBe("2027-03-01")
    expect(badgeUntil(todayInBenin(new Date("2027-02-28T23:30:00Z")))).toBe("2028-03-01")
  })
  it("badgeUntil : 29 février bissextile ramené au 28, fin d'année, entrées illisibles", () => {
    expect(badgeUntil("2028-02-29")).toBe("2029-02-28")
    expect(badgeUntil("2026-12-31")).toBe("2027-12-31")
    for (const bad of ["", "2026-13-01", "2026-02-30", "15/10/2026", "abc", null]) {
      if (bad === null) continue
      expect(() => badgeUntil(bad)).toThrow()
    }
  })
})

describe("QA classifyDossier : dossiers expirés et cas limites", () => {
  const today = "2026-10-15"
  it("expiré la veille, non vérifié, sans carte renvoyée : expiré, aucune décision", () => {
    const tab = classifyDossier({ isVerified: false, verifiedUntil: "2026-10-14", hasCard: true, submittedAt: "2026-09-01T10:00:00Z" }, today)
    expect(tab).toBe("expires")
    expect(allowedActions(tab)).toEqual([])
  })
  it("expiré puis carte renvoyée après l'échéance : à examiner", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: true, submittedAt: "2026-10-10T10:00:00Z" }, today)).toBe("a-examiner")
  })
  it("expiré, carte renvoyée mais carte supprimée (hasCard faux) : expiré", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: false, submittedAt: "2026-10-10T10:00:00Z" }, today)).toBe("expires")
  })
  it("renouvellement anticipé (échéance future, non vérifié, carte) : à examiner", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-12-01", hasCard: true, submittedAt: "2026-10-10T10:00:00Z" }, today)).toBe("a-examiner")
  })
  it("refus prioritaire sur tout, même vérifié ou expiré", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2020-01-01", rejectionReason: "Flou" }, today)).toBe("refuses")
    expect(classifyDossier({ isVerified: false, hasCard: true, rejectionReason: "x" }, today)).toBe("refuses")
  })
  it("motif d'espaces seulement : pas un refus", () => {
    expect(classifyDossier({ isVerified: false, hasCard: true, rejectionReason: "   " }, today)).toBe("a-examiner")
  })
  it("date d'échéance illisible : jamais expiré, jamais d'exception", () => {
    for (const verifiedUntil of ["pas une date", "2026-02-30", "", 42, {}, "2026-1-1"]) {
      expect(() => classifyDossier({ isVerified: true, verifiedUntil }, today)).not.toThrow()
      expect(classifyDossier({ isVerified: true, verifiedUntil }, today)).toBe("verifies")
    }
  })
  it("today illisible : aucun dossier n'est déclaré expiré à tort", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2020-01-01" }, "n'importe quoi")).toBe("verifies")
  })
  it("entrées nulles ou vides : incomplets", () => {
    expect(classifyDossier(undefined, today)).toBe("incomplets")
    expect(classifyDossier(null, today)).toBe("incomplets")
    expect(classifyDossier({}, today)).toBe("incomplets")
  })
  it("submittedAt illisible sur badge échu : expiré, pas d'exception", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: true, submittedAt: "garbage" }, today)).toBe("expires")
  })
  it("toujours exactement un des cinq onglets (balayage de combinaisons)", () => {
    const bools = [true, false]
    const untils = [null, "2026-10-14", "2026-10-15", "2026-10-16"]
    const reasons = [null, "Flou"]
    const submitted = [null, "2026-10-10T10:00:00Z", "2026-10-15T10:00:00Z"]
    for (const isVerified of bools) for (const verifiedUntil of untils) for (const rejectionReason of reasons)
      for (const hasCard of bools) for (const submittedAt of submitted) {
        expect(VERIFICATION_TABS).toContain(classifyDossier({ isVerified, verifiedUntil, rejectionReason, hasCard, submittedAt }, today))
      }
  })
  it("LIMITE CONNUE (plan) : renouvellement anticipé non traité avant l'échéance devient « expirés », sans décision possible", () => {
    // Carte renvoyée le 5 pour un badge qui expire le 10 : au 15, l'étudiant attend toujours, mais le dossier
    // n'est ni à examiner ni décidable. Voir le rapport QA.
    const d = { isVerified: false, verifiedUntil: "2026-10-10", hasCard: true, submittedAt: "2026-10-05T10:00:00Z" }
    const tab = classifyDossier(d, "2026-10-15")
    expect(tab).toBe("expires")
    expect(allowedActions(tab)).toEqual([])
  })
})

describe("QA dossierHints, ageLabel, sortQueue", () => {
  it("overdue48h : 47 h non, 49 h oui, seulement à examiner", () => {
    const now = new Date("2026-10-15T12:00:00Z")
    const base = { isVerified: false, hasCard: true }
    expect(dossierHints({ ...base, submittedAt: "2026-10-13T13:00:00Z" }, now).overdue48h).toBe(false)
    expect(dossierHints({ ...base, submittedAt: "2026-10-13T10:59:00Z" }, now).overdue48h).toBe(true)
    expect(dossierHints({ isVerified: true, submittedAt: "2020-01-01T00:00:00Z" }, now).overdue48h).toBe(false)
  })
  it("âge en jours : date future = 0, jamais négatif ; minuit au Bénin", () => {
    const now = new Date("2026-10-15T10:00:00Z")
    expect(dossierHints({ hasCard: true, submittedAt: "2026-10-20T00:00:00Z" }, now).ageDays).toBe(0)
    // 23:30 UTC le 14 = 00:30 le 15 au Bénin : « Aujourd'hui » pour now = 15 à 10:00 UTC
    expect(ageLabel(now, "2026-10-14T23:30:00Z")).toBe("Aujourd'hui")
    expect(ageLabel(now, "2026-10-14T22:30:00Z")).toBe("Hier")
    expect(ageLabel(now, "2026-10-12T10:00:00Z")).toBe("3 j")
  })
  it("ageLabel : entrées vides ou illisibles donnent une chaîne vide", () => {
    const now = new Date("2026-10-15T10:00:00Z")
    for (const v of [null, undefined, "", "xx", NaN]) expect(ageLabel(now, v)).toBe("")
  })
  it("kind : renouvellement si échéance connue, sinon première demande ; null hors à examiner", () => {
    const now = new Date("2026-10-15T10:00:00Z")
    expect(dossierHints({ hasCard: true, verifiedUntil: "2026-12-01" }, now).kind).toBe("renouvellement")
    expect(dossierHints({ hasCard: true }, now).kind).toBe("premiere")
    expect(dossierHints({ hasCard: false }, now).kind).toBe(null)
  })
  it("sortQueue : plus ancien d'abord, dates illisibles en dernier, stable, sans muter l'entrée", () => {
    const rows = [
      { id: "d", submittedAt: "bad" },
      { id: "b", submittedAt: "2026-10-02T00:00:00Z" },
      { id: "a", submittedAt: null, createdAt: "2026-10-01T00:00:00Z" },
      { id: "c", submittedAt: "2026-10-02T00:00:00Z" },
      { id: "e" },
    ]
    const copy = [...rows]
    expect(sortQueue(rows).map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"])
    expect(rows).toEqual(copy)
    expect(sortQueue([])).toEqual([])
  })
  it("allowedActions : copie défensive et onglet inconnu sans action", () => {
    allowedActions("a-examiner").push("x")
    expect(allowedActions("a-examiner")).toEqual(["approve", "reject"])
    expect(allowedActions("refuses")).toEqual(["reset"])
    expect(allowedActions("verifies")).toEqual(["revoke"])
    expect(allowedActions("zzz")).toEqual([])
    expect(allowedActions(undefined)).toEqual([])
  })
})

describe("QA parseVerificationParams hostiles", () => {
  it("valeurs par défaut sur entrée absente ou nulle", () => {
    for (const input of [undefined, null, {}]) {
      expect(parseVerificationParams(input)).toEqual({ onglet: "a-examiner", id: null, q: "", ecole: "", page: 1 })
    }
  })
  it("onglet hors liste, prototype pollué, tableau", () => {
    expect(parseVerificationParams({ onglet: "__proto__" }).onglet).toBe("a-examiner")
    expect(parseVerificationParams({ onglet: "constructor" }).onglet).toBe("a-examiner")
    expect(parseVerificationParams({ onglet: ["refuses", "verifies"] }).onglet).toBe("refuses")
    expect(parseVerificationParams({ onglet: "REFUSES" }).onglet).toBe("a-examiner")
  })
  it("id : UUID seulement, normalisé en minuscules, injection refusée", () => {
    expect(parseVerificationParams({ id: UUID.toUpperCase() }).id).toBe(UUID)
    for (const id of ["1 or 1=1", UUID.slice(0, 30), `${UUID}\n`, `${UUID}x`, "", "' OR ''='", "../../etc/passwd"]) {
      expect(parseVerificationParams({ id }).id).toBe(null)
    }
  })
  it("page : bornée, négative, décimale, énorme, texte", () => {
    const page = (p) => parseVerificationParams({ page: p }).page
    expect(page("0")).toBe(1)
    expect(page("-3")).toBe(1)
    expect(page("2.5")).toBe(1)
    expect(page("abc")).toBe(1)
    expect(page("999999999999999999999")).toBe(1)
    expect(page("99999999999")).toBe(MAX_PAGE)
    expect(page("7")).toBe(7)
  })
  it("q et ecole : 80 caractères max, caractères de contrôle retirés, espaces normalisés", () => {
    const out = parseVerificationParams({ q: `  a\u0000b\n\tc   ${"x".repeat(200)}`, ecole: "y".repeat(500) })
    expect(out.q.length).toBeLessThanOrEqual(80)
    expect(out.q).not.toMatch(/[\u0000-\u001f]/)
    expect(out.q.startsWith("a b c")).toBe(true)
    expect(out.ecole.length).toBe(80)
    expect(parseVerificationParams({ q: 123 }).q).toBe("")
    expect(parseVerificationParams({ q: { a: 1 } }).q).toBe("")
  })
})

describe("QA schémas de décision", () => {
  it("rejectSchema : les 6 motifs fermés passent sans message, « Autre motif » exige un texte", () => {
    for (const reason of ADMIN_REJECTION_REASONS.slice(0, -1)) expect(rejectSchema.safeParse({ reason }).success).toBe(true)
    expect(rejectSchema.safeParse({ reason: "Autre motif" }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif", message: "   \n\t " }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif", message: "\u0000\u0007" }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif", message: "Carte illisible" }).success).toBe(true)
  })
  it("rejectSchema : limites 500 / 501, motif hors liste, types invalides", () => {
    const ok = "Photo floue ou illisible"
    expect(rejectSchema.safeParse({ reason: ok, message: "a".repeat(500) }).success).toBe(true)
    expect(rejectSchema.safeParse({ reason: ok, message: "a".repeat(501) }).success).toBe(false)
    for (const reason of ["photo floue ou illisible", "", null, undefined, 3, ["Autre motif"], { toString: () => ok }, "Photo floue ou illisible "]) {
      expect(rejectSchema.safeParse({ reason }).success).toBe(false)
    }
    expect(rejectSchema.safeParse({ reason: ok, message: 42 }).success).toBe(false)
    expect(rejectSchema.safeParse(null).success).toBe(false)
  })
  it("rejectSchema : nettoie contrôle et espaces, ne supprime pas le HTML (échappé à l'affichage)", () => {
    const r = rejectSchema.parse({ reason: "Photo floue ou illisible", message: "  a\u0000b\r\n\tc   <b>x</b> " })
    expect(r.message).toBe("a b c <b>x</b>")
  })
  it("rejectSchema : 501 caractères dont des espaces en trop sont comptés après nettoyage", () => {
    const msg = `${"a".repeat(499)}      `
    expect(rejectSchema.safeParse({ reason: "Photo floue ou illisible", message: msg }).success).toBe(true)
  })
  it("reasonSchema : 4 refusé, 5 accepté, 500 accepté, 501 refusé, espaces non comptés, types invalides", () => {
    expect(reasonSchema.safeParse("abcd").success).toBe(false)
    expect(reasonSchema.safeParse("  abcd  ").success).toBe(false)
    expect(reasonSchema.safeParse("abcde").success).toBe(true)
    expect(reasonSchema.safeParse("a".repeat(500)).success).toBe(true)
    expect(reasonSchema.safeParse("a".repeat(501)).success).toBe(false)
    expect(reasonSchema.safeParse("\u0000\u0001\u0002\u0003\u0004\u0005").success).toBe(false)
    for (const v of [undefined, null, 12345, [], {}]) expect(reasonSchema.safeParse(v).success).toBe(false)
  })
  it("uuidSchema : refus de l'injection, du tronqué, du vide, des types non texte", () => {
    expect(uuidSchema.safeParse(UUID).success).toBe(true)
    for (const v of ["", "1 or 1=1", UUID.slice(0, -1), `${UUID} `, ` ${UUID}`, `${UUID}\n`, undefined, null, 1, [UUID]]) {
      expect(uuidSchema.safeParse(v).success).toBe(false)
    }
  })
})

describe("QA file de l'accueil (D1) et alertes d'argent", () => {
  const now = new Date("2026-10-15T12:00:00Z")
  it("ordre : alertes d'argent, retraits bloqués, puis dossiers du plus ancien au plus récent", () => {
    const q = buildQueue(
      {
        dossiers: [
          { userId: "d2", submittedAt: "2026-10-12T00:00:00Z" },
          { userId: "d1", submittedAt: "2026-10-10T00:00:00Z" },
        ],
        withdrawals: [{ id: "w1", createdAt: "2026-10-14T00:00:00Z", amount: 5000 }],
        moneyAlerts: moneyAlertsFromWallets([{ userId: "m1", balance: -10, reserved: 0 }]),
      },
      now,
    )
    expect(q.map((i) => i.key)).toEqual(["wallet:m1", "withdrawal:w1", "dossier:d1", "dossier:d2"])
    expect(heroItem(q).key).toBe("wallet:m1")
    expect(totalToHandle(q)).toEqual({ total: 4, money: 2, dossiers: 2 })
  })
  it("retrait de 23 h 59 : pas encore bloqué ; 24 h 01 : bloqué ; date illisible : ignoré", () => {
    const mk = (createdAt) => buildQueue({ withdrawals: [{ id: "w", createdAt }] }, now)
    expect(mk("2026-10-14T12:01:00Z")).toHaveLength(0)
    expect(mk("2026-10-14T11:59:00Z")).toHaveLength(1)
    expect(mk("n'importe quoi")).toHaveLength(0)
  })
  it("file vide : héros nul, listes vides, totaux à zéro, entrées indéfinies tolérées", () => {
    expect(buildQueue(undefined, now)).toEqual([])
    expect(heroItem([])).toBe(null)
    expect(heroItem(undefined)).toBe(null)
    expect(nextItems([], 6)).toEqual([])
    expect(nextItems(undefined)).toEqual([])
    expect(totalToHandle(undefined)).toEqual({ total: 0, money: 0, dossiers: 0 })
  })
  it("nextItems : saute le héros, borne la limite, limite négative = vide", () => {
    const q = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}` }))
    expect(nextItems(q, 6).map((i) => i.key)).toEqual(["k1", "k2", "k3", "k4", "k5", "k6"])
    expect(nextItems(q, -2)).toEqual([])
    expect(nextItems(q, 100)).toHaveLength(9)
  })
  it("moneyAlertsFromWallets : solde négatif d'abord, écart décroissant, solde zéro / égal sans alerte, valeurs texte et NaN", () => {
    const alerts = moneyAlertsFromWallets([
      { userId: "a", balance: 100, reserved: 150 },
      { userId: "b", balance: -5, reserved: 0 },
      { userId: "c", balance: 100, reserved: 100 },
      { userId: "d", balance: 0, reserved: 0 },
      { userId: "e", balance: "-200", reserved: "0" },
      { userId: "f", balance: "abc", reserved: "xyz" },
      { userId: "g", balance: 10, reserved: 500 },
    ])
    expect(alerts.map((a) => a.userId)).toEqual(["e", "b", "g", "a"])
    expect(moneyAlertsFromWallets(undefined)).toEqual([])
    expect(moneyAlertsFromWallets([])).toEqual([])
  })
})

describe("QA raccourcis clavier : jamais de décision directe", () => {
  const allowed = ["approve", "reject"]
  const input = { tagName: "INPUT" }
  it("V et R : seulement les actions permises, insensible à la casse", () => {
    expect(shortcutAction({ key: "v", allowed })).toBe("approve")
    expect(shortcutAction({ key: "V", allowed })).toBe("approve")
    expect(shortcutAction({ key: "r", allowed: ["reset"] })).toBe(null)
    expect(shortcutAction({ key: "v", allowed: [] })).toBe(null)
    expect(shortcutAction({ key: "v" })).toBe(null)
  })
  it("inactifs dans un champ, un dialogue ouvert, avec modificateur, ou clé exotique", () => {
    expect(shortcutAction({ key: "v", allowed, target: input })).toBe(null)
    expect(shortcutAction({ key: "r", allowed, target: { tagName: "TEXTAREA" } })).toBe(null)
    expect(shortcutAction({ key: "v", allowed, target: { tagName: "DIV", isContentEditable: true } })).toBe(null)
    expect(shortcutAction({ key: "v", allowed, dialogOpen: true })).toBe(null)
    expect(shortcutAction({ key: "v", allowed, ctrlKey: true })).toBe(null)
    expect(shortcutAction({ key: "r", allowed, metaKey: true })).toBe(null)
    expect(shortcutAction({ key: "v", allowed, altKey: true })).toBe(null)
    for (const key of [undefined, null, "Enter", " ", "Escape", "vv", ""]) expect(shortcutAction({ key, allowed })).toBe(null)
  })
  it("la touche Entrée ou espace ne renvoie jamais approve/reject", () => {
    for (const key of ["Enter", " "]) expect(["approve", "reject"]).not.toContain(shortcutAction({ key, allowed }))
  })
})
