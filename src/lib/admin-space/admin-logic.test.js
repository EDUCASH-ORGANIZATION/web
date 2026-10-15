import { describe, expect, it } from "vitest"
import {
  ageLabel,
  allowedActions,
  compareNames,
  DELAY_FILTERS,
  expectedAcademicYears,
  historySteps,
  matchesDelay,
  badgeUntil,
  classifyDossier,
  renewalSinceDay,
  dossierHints,
  parseVerificationParams,
  sortQueue,
} from "./verification-queue"
import { ADMIN_REJECTION_REASONS, rejectSchema, reasonSchema, uuidSchema } from "./decision-schemas"
import { buildQueue, heroItem, moneyAlertsFromWallets, nextItems, totalToHandle } from "./dashboard-queue"
import { accountStatusLabel, roleLabel, transactionTypeLabel } from "./labels"

const TODAY = "2026-10-15"

describe("classifyDossier", () => {
  const card = { hasCard: true }

  it("refusé dès qu'un motif est présent, même avec une carte", () => {
    expect(classifyDossier({ ...card, rejectionReason: "Photo floue" }, TODAY)).toBe("refuses")
    expect(classifyDossier({ rejectionReason: "x", isVerified: true }, TODAY)).toBe("refuses")
  })

  it("un motif blanc ne compte pas comme un refus", () => {
    expect(classifyDossier({ ...card, rejectionReason: "   " }, TODAY)).toBe("a-examiner")
  })

  it("vérifié : sans échéance, le jour même de l'échéance, ou échéance future", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: null }, TODAY)).toBe("verifies")
    expect(classifyDossier({ isVerified: true, verifiedUntil: TODAY }, TODAY)).toBe("verifies")
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2027-01-01" }, TODAY)).toBe("verifies")
  })

  it("expiré la veille : encore vérifié en base mais échu", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2026-10-14" }, TODAY)).toBe("expires")
  })

  it("expiré non vérifié sans carte déposée depuis la dernière validation", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: true, submittedAt: "2025-09-01T10:00:00Z" }, TODAY)).toBe("expires")
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: false }, TODAY)).toBe("expires")
  })

  it("expiré puis carte renvoyée après l'échéance : à examiner", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: true, submittedAt: "2026-10-10T08:00:00Z" }, TODAY)).toBe("a-examiner")
  })

  it("renouvellement anticipé : non vérifié, échéance future, carte renvoyée", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2027-03-01", hasCard: true, submittedAt: "2026-10-14T08:00:00Z" }, TODAY)).toBe("a-examiner")
  })

  it("refus puis renvoi : le motif est effacé, le dossier revient à examiner", () => {
    expect(classifyDossier({ isVerified: false, rejectionReason: null, hasCard: true, submittedAt: "2026-10-14T08:00:00Z" }, TODAY)).toBe("a-examiner")
  })

  it("incomplet : aucune carte, non vérifié", () => {
    expect(classifyDossier({ isVerified: false, hasCard: false }, TODAY)).toBe("incomplets")
    expect(classifyDossier({}, TODAY)).toBe("incomplets")
    expect(classifyDossier(undefined, TODAY)).toBe("incomplets")
  })

  it("date d'échéance illisible : traitée comme absente", () => {
    expect(classifyDossier({ isVerified: true, verifiedUntil: "pas-une-date" }, TODAY)).toBe("verifies")
    expect(classifyDossier({ isVerified: true, verifiedUntil: "2026-02-30" }, TODAY)).toBe("verifies")
    expect(classifyDossier({ isVerified: false, verifiedUntil: "n'importe quoi", hasCard: true }, TODAY)).toBe("a-examiner")
  })

  it("fuseau du Bénin à minuit : 23 h 30 UTC la veille est déjà le jour suivant au Bénin", () => {
    const dossier = { isVerified: false, verifiedUntil: "2026-10-14", hasCard: true }
    // Dernière validation le 14 octobre 2025. 13 octobre 23:30 UTC = 14 octobre 00:30 au Bénin : depuis la validation.
    expect(classifyDossier({ ...dossier, submittedAt: "2025-10-13T23:30:00Z" }, TODAY)).toBe("a-examiner")
    // 13 octobre 22:30 UTC = 13 octobre 23:30 au Bénin : avant la validation.
    expect(classifyDossier({ ...dossier, submittedAt: "2025-10-13T22:30:00Z" }, TODAY)).toBe("expires")
  })

  it("renouvellement anticipé non traité : vu après l'échéance, il reste à examiner", () => {
    const dossier = { isVerified: false, verifiedUntil: "2026-10-14", hasCard: true }
    expect(classifyDossier({ ...dossier, submittedAt: "2026-10-05T10:00:00Z" }, TODAY)).toBe("a-examiner")
    expect(classifyDossier({ ...dossier, submittedAt: "2026-10-14T10:00:00Z" }, "2026-10-15")).toBe("a-examiner")
  })

  it("renewalSinceDay : inverse de badgeUntil, 29 février ramené au 28", () => {
    expect(renewalSinceDay("2026-10-14")).toBe("2025-10-14")
    expect(renewalSinceDay("2029-02-28")).toBe("2028-02-28")
    expect(renewalSinceDay("2025-03-01")).toBe("2024-03-01")
    expect(renewalSinceDay(badgeUntil("2026-03-05"))).toBe("2026-03-05")
  })

  it("horodatage de dépôt illisible : pas de renvoi détecté", () => {
    expect(classifyDossier({ isVerified: false, verifiedUntil: "2026-10-01", hasCard: true, submittedAt: "hier" }, TODAY)).toBe("expires")
  })
})

describe("dossierHints et ageLabel", () => {
  const now = new Date("2026-10-15T09:00:00Z")

  it("première demande, puis renouvellement quand une échéance existe", () => {
    const first = dossierHints({ hasCard: true, submittedAt: "2026-10-14T09:00:00Z" }, now)
    expect(first).toMatchObject({ tab: "a-examiner", kind: "premiere", overdue48h: false, ageDays: 1 })
    const renewal = dossierHints({ hasCard: true, verifiedUntil: "2027-01-01", submittedAt: "2026-10-14T09:00:00Z" }, now)
    expect(renewal.kind).toBe("renouvellement")
  })

  it("repère interne +48 h seulement pour un dossier à examiner", () => {
    expect(dossierHints({ hasCard: true, submittedAt: "2026-10-12T09:00:00Z" }, now).overdue48h).toBe(true)
    expect(dossierHints({ hasCard: true, submittedAt: "2026-10-13T09:00:01Z" }, now).overdue48h).toBe(false)
    expect(dossierHints({ isVerified: true, createdAt: "2026-01-01T00:00:00Z" }, now)).toMatchObject({ tab: "verifies", kind: null, overdue48h: false })
  })

  it("l'âge part de l'inscription quand aucune carte n'a été déposée", () => {
    expect(dossierHints({ createdAt: "2026-10-05T09:00:00Z" }, now)).toMatchObject({ tab: "incomplets", ageDays: 10 })
    expect(dossierHints({}, now).ageDays).toBeNull()
  })

  it("étiquettes d'ancienneté", () => {
    expect(ageLabel(now, "2026-10-15T01:00:00Z")).toBe("Aujourd'hui")
    expect(ageLabel(now, "2026-10-14T20:00:00Z")).toBe("Hier")
    expect(ageLabel(now, "2026-10-12T08:00:00Z")).toBe("3 j")
    expect(ageLabel(now, "2026-10-20T08:00:00Z")).toBe("Aujourd'hui")
    expect(ageLabel(now, null)).toBe("")
    expect(ageLabel(now, "n'importe quoi")).toBe("")
  })
})

describe("sortQueue et allowedActions", () => {
  it("plus anciens d'abord, dates absentes en dernier, ordre stable", () => {
    const rows = [
      { id: "c", submittedAt: "2026-10-03T00:00:00Z" },
      { id: "x", submittedAt: null, createdAt: null },
      { id: "a", submittedAt: "2026-10-01T00:00:00Z" },
      { id: "b", submittedAt: null, createdAt: "2026-10-02T00:00:00Z" },
      { id: "d", submittedAt: "2026-10-03T00:00:00Z" },
    ]
    expect(sortQueue(rows).map((r) => r.id)).toEqual(["a", "b", "c", "d", "x"])
    expect(rows[0].id).toBe("c")
  })

  it("décisions par onglet", () => {
    expect(allowedActions("a-examiner")).toEqual(["approve", "reject"])
    expect(allowedActions("refuses")).toEqual(["reset"])
    expect(allowedActions("verifies")).toEqual(["revoke"])
    expect(allowedActions("expires")).toEqual([])
    expect(allowedActions("incomplets")).toEqual([])
    expect(allowedActions("autre")).toEqual([])
  })
})

describe("parseVerificationParams", () => {
  const ID = "0B8F1C1E-2C1B-4B53-9A52-9D6B6A6F3A10"

  it("valeurs par défaut", () => {
    expect(parseVerificationParams(undefined)).toEqual({ onglet: "a-examiner", id: null, q: "", ecole: "", delai: "", page: 1 })
  })

  it("onglet en liste fermée, UUID validé et mis en minuscules", () => {
    expect(parseVerificationParams({ onglet: "refuses", id: ID }).onglet).toBe("refuses")
    expect(parseVerificationParams({ id: ID }).id).toBe(ID.toLowerCase())
    expect(parseVerificationParams({ onglet: "admin", id: "1 or 1=1" })).toMatchObject({ onglet: "a-examiner", id: null })
    expect(parseVerificationParams({ id: ID.slice(0, 20) }).id).toBeNull()
  })

  it("page bornée", () => {
    for (const [value, expected] of [["-1", 1], ["0", 1], ["abc", 1], ["1e9", 1], ["2", 2], ["99999999", 1000], ["5000", 1000]]) {
      expect(parseVerificationParams({ page: value }).page).toBe(expected)
    }
  })

  it("q et ecole : espaces normalisés, caractères de contrôle retirés, 80 caractères au plus, premier élément d'une liste", () => {
    expect(parseVerificationParams({ q: "  Awa \n\t K " }).q).toBe("Awa K")
    expect(parseVerificationParams({ q: "x".repeat(10000) }).q).toHaveLength(80)
    expect(parseVerificationParams({ ecole: ["UAC", "IFRI"] }).ecole).toBe("UAC")
    expect(parseVerificationParams({ q: "%_,)or=(a)" }).q).toBe("%_,)or=(a)")
  })
})

describe("badgeUntil", () => {
  it("un an à partir du jour de validation", () => {
    expect(badgeUntil("2026-10-15")).toBe("2027-10-15")
    expect(badgeUntil("2026-12-31")).toBe("2027-12-31")
  })

  it("le 29 février est ramené au 28", () => {
    expect(badgeUntil("2024-02-29")).toBe("2025-02-28")
  })

  it("jour du Bénin par défaut et refus d'une date illisible", () => {
    expect(badgeUntil()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(() => badgeUntil("demain")).toThrow()
  })
})

describe("schémas de décision", () => {
  it("la liste des motifs est vouvoyée et finit par Autre motif", () => {
    expect(ADMIN_REJECTION_REASONS).toHaveLength(7)
    expect(ADMIN_REJECTION_REASONS.at(-1)).toBe("Autre motif")
  })

  it("rejectSchema accepte un motif de la liste, sans message", () => {
    expect(rejectSchema.parse({ reason: "Photo floue ou illisible" })).toEqual({ reason: "Photo floue ou illisible", message: "" })
  })

  it("rejectSchema refuse un motif hors liste, un message de 501 caractères, « Autre motif » sans texte", () => {
    expect(rejectSchema.safeParse({ reason: "Parce que" }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Photo floue ou illisible", message: "a".repeat(501) }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif" }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif", message: "   \n " }).success).toBe(false)
    expect(rejectSchema.safeParse({ reason: "Autre motif", message: "Carte coupée" }).success).toBe(true)
    expect(rejectSchema.safeParse({ reason: "Photo floue ou illisible", message: "a".repeat(500) }).success).toBe(true)
  })

  it("rejectSchema nettoie les caractères de contrôle et normalise les espaces", () => {
    const out = rejectSchema.parse({ reason: "Autre motif", message: "  Carte\u0000 \u0007 floue\r\n\tà   droite  " })
    expect(out.message).toBe("Carte floue à droite")
  })

  it("rejectSchema ne laisse pas passer un message non textuel", () => {
    expect(rejectSchema.safeParse({ reason: "Photo floue ou illisible", message: { a: 1 } }).success).toBe(false)
    expect(rejectSchema.safeParse(null).success).toBe(false)
  })

  it("reasonSchema : 5 à 500 caractères après nettoyage", () => {
    expect(reasonSchema.safeParse("Non").success).toBe(false)
    expect(reasonSchema.safeParse("    ab    ").success).toBe(false)
    expect(reasonSchema.safeParse("Carte falsifiée").success).toBe(true)
    expect(reasonSchema.safeParse("a".repeat(501)).success).toBe(false)
    expect(reasonSchema.parse("Carte\u0000  falsifiée")).toBe("Carte falsifiée")
    expect(reasonSchema.safeParse(undefined).success).toBe(false)
  })

  it("uuidSchema refuse la chaîne vide, une injection et un UUID tronqué", () => {
    expect(uuidSchema.safeParse("0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10").success).toBe(true)
    expect(uuidSchema.safeParse("11111111-1111-1111-1111-111111111111").success).toBe(true)
    for (const bad of ["", "1 or 1=1", "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a1", "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10; drop", null, 12]) {
      expect(uuidSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe("file de l'accueil admin", () => {
  const now = new Date("2026-10-15T12:00:00Z")

  it("alertes d'argent : solde négatif d'abord, puis réservé supérieur au solde", () => {
    const alerts = moneyAlertsFromWallets([
      { userId: "ok", name: "Ok", balance: 1000, reserved: 500 },
      { userId: "res", name: "Res", balance: 100, reserved: 900 },
      { userId: "neg", name: "Neg", balance: -50, reserved: 0 },
      { userId: "neg2", name: "Neg2", balance: -400, reserved: 100 },
      { userId: "egal", balance: 200, reserved: 200 },
    ])
    expect(alerts.map((a) => [a.userId, a.reason])).toEqual([
      ["neg2", "negative-balance"],
      ["neg", "negative-balance"],
      ["res", "reserved-over-balance"],
    ])
  })

  it("montants illisibles : traités comme zéro", () => {
    expect(moneyAlertsFromWallets([{ userId: "x", balance: "abc", reserved: null }])).toEqual([])
    expect(moneyAlertsFromWallets(undefined)).toEqual([])
  })

  it("ordre D1 sur données mêlées : argent, retraits bloqués, puis dossiers par ancienneté", () => {
    const queue = buildQueue(
      {
        dossiers: [
          { userId: "d-recent", name: "Récent", submittedAt: "2026-10-14T00:00:00Z" },
          { userId: "d-old", name: "Ancien", submittedAt: "2026-10-01T00:00:00Z" },
        ],
        withdrawals: [
          { id: "w-new", amount: 5000, createdAt: "2026-10-15T08:00:00Z" },
          { id: "w-old", amount: 10000, createdAt: "2026-10-13T08:00:00Z" },
        ],
        moneyAlerts: moneyAlertsFromWallets([{ userId: "neg", balance: -10, reserved: 0 }]),
      },
      now,
    )
    expect(queue.map((i) => i.key)).toEqual(["wallet:neg", "withdrawal:w-old", "dossier:d-old", "dossier:d-recent"])
    expect(heroItem(queue).key).toBe("wallet:neg")
    expect(nextItems(queue, 2).map((i) => i.key)).toEqual(["withdrawal:w-old", "dossier:d-old"])
    expect(totalToHandle(queue)).toEqual({ total: 4, money: 2, dossiers: 2 })
  })

  it("file vide : aucun élément prioritaire", () => {
    const queue = buildQueue({}, now)
    expect(queue).toEqual([])
    expect(heroItem(queue)).toBeNull()
    expect(nextItems(queue)).toEqual([])
    expect(totalToHandle(queue)).toEqual({ total: 0, money: 0, dossiers: 0 })
  })

  it("un dossier sans date de dépôt passe après les autres", () => {
    const queue = buildQueue({ dossiers: [{ userId: "a" }, { userId: "b", submittedAt: "2026-10-10T00:00:00Z" }] }, now)
    expect(queue.map((i) => i.userId)).toEqual(["b", "a"])
  })
})

describe("libellés", () => {
  it("rôles, statut et types de mouvement en français, sans prestataire", () => {
    expect(roleLabel("student")).toBe("Étudiant")
    expect(roleLabel("client")).toBe("Client")
    expect(roleLabel("admin")).toBe("Administrateur")
    expect(roleLabel("autre")).toBe("Compte")
    expect(accountStatusLabel({ isSuspended: true })).toBe("Suspendu")
    expect(accountStatusLabel({ isSuspended: false })).toBe("Actif")
    expect(accountStatusLabel()).toBe("Actif")
    const labels = ["deposit", "reserve", "release", "commission", "refund", "withdrawal"].map(transactionTypeLabel)
    expect(labels).toEqual(["Recharge", "Réservation", "Libération", "Commission", "Remboursement", "Retrait"])
    expect(transactionTypeLabel("inconnu")).toBe("Mouvement")
  })
})

describe("filtre Délai", () => {
  it("liste fermée, valeur hors liste ramenée à vide", () => {
    expect(DELAY_FILTERS).toEqual(["plus-48h", "moins-48h"])
    expect(parseVerificationParams({ delai: "plus-48h" }).delai).toBe("plus-48h")
    expect(parseVerificationParams({ delai: "moins-48h" }).delai).toBe("moins-48h")
    expect(parseVerificationParams({ delai: "tous" }).delai).toBe("")
    expect(parseVerificationParams({ delai: ["moins-48h", "plus-48h"] }).delai).toBe("moins-48h")
  })

  it("matchesDelay s'appuie sur overdue48h", () => {
    expect(matchesDelay({ overdue48h: true }, "plus-48h")).toBe(true)
    expect(matchesDelay({ overdue48h: false }, "plus-48h")).toBe(false)
    expect(matchesDelay({ overdue48h: false }, "moins-48h")).toBe(true)
    expect(matchesDelay({ overdue48h: true }, "moins-48h")).toBe(false)
    expect(matchesDelay({ overdue48h: true }, "")).toBe(true)
  })
})

describe("expectedAcademicYears", () => {
  it("change au 1er septembre", () => {
    expect(expectedAcademicYears("2026-10-08")).toEqual({ current: "2026-2027", previous: "2025-2026" })
    expect(expectedAcademicYears("2026-03-01")).toEqual({ current: "2025-2026", previous: "2024-2025" })
    expect(expectedAcademicYears("2026-08-31")).toEqual({ current: "2025-2026", previous: "2024-2025" })
    expect(expectedAcademicYears("2026-09-01")).toEqual({ current: "2026-2027", previous: "2025-2026" })
  })
  it("29 février valide, date illisible : null", () => {
    expect(expectedAcademicYears("2028-02-29")).toEqual({ current: "2027-2028", previous: "2026-2027" })
    expect(expectedAcademicYears("2027-02-29")).toBeNull()
    expect(expectedAcademicYears("")).toBeNull()
    expect(expectedAcademicYears(undefined)).toBeNull()
  })
})

describe("compareNames", () => {
  it("identiques : casse, accents, espaces et ponctuation ignorés", () => {
    expect(compareNames("Codjo Ahouansou", "codjo ahouansou")).toBe("identiques")
    expect(compareNames("Élodie Agbodjan", "  ELODIE   agbodjan ")).toBe("identiques")
    expect(compareNames("Jean-Pierre Dossou", "Jean Pierre Dossou")).toBe("identiques")
  })
  it("ordre différent", () => {
    expect(compareNames("Codjo Ahouansou", "AHOUANSOU Codjo")).toBe("ordre-different")
  })
  it("différents : mot manquant ou différent", () => {
    expect(compareNames("Codjo Ahouansou", "Codjo")).toBe("differents")
    expect(compareNames("Codjo Ahouansou", "Codjo Ahouansu")).toBe("differents")
  })
  it("saisie ou nom vide : null", () => {
    expect(compareNames("Codjo Ahouansou", "")).toBeNull()
    expect(compareNames("Codjo Ahouansou", "   ")).toBeNull()
    expect(compareNames("", "Codjo")).toBeNull()
    expect(compareNames(null, undefined)).toBeNull()
  })
})

describe("historySteps", () => {
  const base = { createdAt: "2026-09-01T10:00:00+00:00", submittedAt: "2026-10-05T09:12:00+00:00" }
  const titles = (d) => historySteps(d).map((s) => s.title)

  it("à examiner : compte créé, carte envoyée, en cours d'examen", () => {
    const steps = historySteps({ ...base, tab: "a-examiner" })
    expect(steps).toEqual([
      { state: "done", title: "Compte créé", at: "2026-09-01", meta: "" },
      { state: "done", title: "Carte envoyée", at: "2026-10-05", meta: "première demande" },
      { state: "current", title: "En cours d'examen", at: null, meta: "" },
    ])
  })
  it("renouvellement signalé", () => {
    expect(historySteps({ ...base, tab: "a-examiner", verifiedUntil: "2026-11-01" })[1].meta).toBe("renouvellement du badge")
  })
  it("vérifiés : validation déduite de l'échéance", () => {
    const steps = historySteps({ ...base, tab: "verifies", verifiedUntil: "2027-10-06" })
    expect(steps.at(-1)).toEqual({ state: "done", title: "Badge validé", at: "2026-10-06", meta: "" })
  })
  it("expirés : validé puis expiré", () => {
    expect(titles({ ...base, tab: "expires", verifiedUntil: "2026-09-01" })).toEqual([
      "Compte créé",
      "Carte envoyée",
      "Badge validé",
      "Badge expiré",
    ])
  })
  it("refusés : motif sans date", () => {
    const last = historySteps({ ...base, tab: "refuses", rejectionReason: " Photo floue " }).at(-1)
    expect(last).toEqual({ state: "error", title: "Carte refusée", at: null, meta: "Photo floue" })
  })
  it("incomplets sans carte : compte créé seulement ; dates illisibles ignorées", () => {
    expect(titles({ createdAt: base.createdAt, tab: "incomplets" })).toEqual(["Compte créé"])
    expect(historySteps({ createdAt: "pas une date", tab: "incomplets" })).toEqual([])
    expect(historySteps(null)).toEqual([])
  })
})
