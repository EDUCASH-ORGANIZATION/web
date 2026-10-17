import { describe, it, expect } from "vitest"
import {
  CLOSURE_GRACE_DAYS,
  ACCOUNT_BATCH,
  ACCOUNT_BREAKER,
  RECENT_WITHDRAWAL_DAYS,
  CLOSED_ACCOUNT_LABEL,
  CLOSED_EMAIL_DOMAIN,
  pseudonymousEmail,
  isClosedEmail,
  isReservedDisplayName,
  closureState,
  canReopen,
  closureDueAt,
  isDueForPseudonymization,
  CLOSURE_BLOCKERS,
  blockerMessage,
  closureBlockers,
  pseudonymizationBlockers,
  PROFILE_PSEUDONYM_PATCH,
  STUDENT_PROFILE_PSEUDONYM_PATCH,
  CLOSURE_EVENTS,
  ACTOR_KINDS,
  CLOSURE_REASONS,
  closureAuditEntry,
  auditHasNoPersonalData,
} from "./closure-rules"

const UID = "123e4567-e89b-12d3-a456-426614174000"
const ADMIN = "223e4567-e89b-12d3-a456-426614174000"
const CLOSED_AT = "2026-10-01T10:00:00Z"
const HEALTHY = {
  role: "client",
  activeClientMissions: 0,
  activeStudentMissions: 0,
  walletBalance: 0,
  walletReserved: 0,
  openPurchases: 0,
  openReports: 0,
  recentWithdrawals: 0,
  pendingTransactions: 0,
}

describe("constantes", () => {
  it("garde un délai de grâce entier, positif et sous 30 jours", () => {
    expect(Number.isInteger(CLOSURE_GRACE_DAYS)).toBe(true)
    expect(CLOSURE_GRACE_DAYS).toBeGreaterThan(0)
    expect(CLOSURE_GRACE_DAYS).toBeLessThan(30)
  })
  it("expose les valeurs du plan", () => {
    expect(CLOSURE_GRACE_DAYS).toBe(14)
    expect(ACCOUNT_BATCH).toBe(20)
    expect(ACCOUNT_BREAKER).toBe(10)
    expect(RECENT_WITHDRAWAL_DAYS).toBe(7)
    expect(CLOSED_ACCOUNT_LABEL).toBe("Compte clôturé")
  })
})

describe("adresse pseudonyme", () => {
  it("construit l'adresse depuis l'uuid", () => {
    expect(pseudonymousEmail(UID)).toBe(`${UID}@${CLOSED_EMAIL_DOMAIN}`)
    expect(pseudonymousEmail(UID.toUpperCase())).toBe(`${UID}@comptes-clotures.invalid`)
  })
  it("refuse un identifiant invalide", () => {
    expect(() => pseudonymousEmail("abc")).toThrow()
    expect(() => pseudonymousEmail(null)).toThrow()
    expect(() => pseudonymousEmail(`${UID}@x`)).toThrow()
  })
  it("reconnaît le domaine exact seulement", () => {
    expect(isClosedEmail(pseudonymousEmail(UID))).toBe(true)
    expect(isClosedEmail(`A@COMPTES-CLOTURES.INVALID`)).toBe(true)
    expect(isClosedEmail("a@autre.com")).toBe(false)
    expect(isClosedEmail("a@x.comptes-clotures.invalid")).toBe(false)
    expect(isClosedEmail("a@comptes-clotures.invalid.com")).toBe(false)
    expect(isClosedEmail("@comptes-clotures.invalid")).toBe(false)
    expect(isClosedEmail(null)).toBe(false)
    expect(isClosedEmail(12)).toBe(false)
  })
})

describe("isReservedDisplayName", () => {
  it("détecte le libellé malgré casse, accents et espaces", () => {
    for (const name of [
      "Compte clôturé",
      "compte cloture",
      "COMPTE CLÔTURÉ",
      "  Compte   clôturé  ",
      "Compte clôturé",
      "Compte clôturé",
      "Compte​ clôturé",
    ]) {
      expect(isReservedDisplayName(name)).toBe(true)
    }
  })
  it("laisse passer les autres noms", () => {
    expect(isReservedDisplayName("Compte clôturés")).toBe(false)
    expect(isReservedDisplayName("Compte Kossi")).toBe(false)
    expect(isReservedDisplayName("")).toBe(false)
    expect(isReservedDisplayName(null)).toBe(false)
    expect(isReservedDisplayName(undefined)).toBe(false)
  })
})

describe("closureState et canReopen", () => {
  const cases = [
    [{ closed_at: null, pseudonymized_at: null, full_name: "Awa D." }, "active", false],
    [{ full_name: "Awa D." }, "active", false],
    [{ closed_at: CLOSED_AT, pseudonymized_at: null, full_name: "Awa D." }, "closed", true],
    [{ closed_at: CLOSED_AT, pseudonymized_at: CLOSED_AT, full_name: "Awa D." }, "pseudonymizing", false],
    [{ closed_at: CLOSED_AT, pseudonymized_at: CLOSED_AT, full_name: CLOSED_ACCOUNT_LABEL }, "pseudonymized", false],
    [{ closed_at: CLOSED_AT, pseudonymized_at: CLOSED_AT, full_name: null }, "pseudonymizing", false],
    [{ closed_at: null, pseudonymized_at: CLOSED_AT, full_name: "Awa D." }, "pseudonymizing", false],
  ]
  it.each(cases)("%j -> %s", (profile, state, reopen) => {
    expect(closureState(profile)).toBe(state)
    expect(canReopen(profile)).toBe(reopen)
  })
  it("traite un profil absent comme actif, non réactivable", () => {
    expect(closureState(null)).toBe("active")
    expect(closureState(undefined)).toBe("active")
    expect(canReopen(null)).toBe(false)
  })
})

describe("échéance", () => {
  it("ajoute exactement le délai de grâce", () => {
    expect(closureDueAt("2026-10-01T10:00:00Z").toISOString()).toBe("2026-10-15T10:00:00.000Z")
    expect(closureDueAt(new Date("2026-10-01T10:00:00Z")).toISOString()).toBe("2026-10-15T10:00:00.000Z")
  })
  it("refuse une date absente, illisible ou sans fuseau", () => {
    expect(closureDueAt(null)).toBeNull()
    expect(closureDueAt("n'importe quoi")).toBeNull()
    expect(closureDueAt("2026-10-01T10:00:00")).toBeNull()
    expect(closureDueAt(new Date("x"))).toBeNull()
    expect(closureDueAt({})).toBeNull()
  })
  it("est exact aux bornes", () => {
    const profile = { closed_at: CLOSED_AT, pseudonymized_at: null, full_name: "Awa D." }
    const base = Date.parse(CLOSED_AT)
    const day = 24 * 60 * 60 * 1000
    expect(isDueForPseudonymization(profile, new Date(base + 13 * day + 23 * 3600000 + 59 * 60000))).toBe(false)
    expect(isDueForPseudonymization(profile, new Date(base + 14 * day - 1))).toBe(false)
    expect(isDueForPseudonymization(profile, new Date(base + 14 * day))).toBe(true)
    expect(isDueForPseudonymization(profile, new Date(base + 20 * day))).toBe(true)
    expect(isDueForPseudonymization(profile, "2026-10-15T10:00:00Z")).toBe(true)
  })
  it("n'est jamais échu pour un autre état ou une entrée douteuse", () => {
    const late = new Date("2027-01-01T00:00:00Z")
    expect(isDueForPseudonymization({ closed_at: null }, late)).toBe(false)
    expect(isDueForPseudonymization({ closed_at: CLOSED_AT, pseudonymized_at: CLOSED_AT }, late)).toBe(false)
    expect(isDueForPseudonymization({ closed_at: "illisible" }, late)).toBe(false)
    expect(isDueForPseudonymization({ closed_at: CLOSED_AT }, "illisible")).toBe(false)
    expect(isDueForPseudonymization(null, late)).toBe(false)
  })
})

describe("blocages", () => {
  it("renvoie [] pour un compte sain", () => {
    expect(closureBlockers(HEALTHY)).toEqual([])
    expect(pseudonymizationBlockers(HEALTHY)).toEqual([])
  })
  it.each([
    [{ role: "admin" }, "ROLE_ADMIN"],
    [{ activeClientMissions: 1 }, "MISSION_CLIENT_ACTIVE"],
    [{ activeStudentMissions: 2 }, "MISSION_STUDENT_ACTIVE"],
    [{ walletBalance: 100 }, "WALLET_NOT_EMPTY"],
    [{ walletReserved: 50 }, "WALLET_NOT_EMPTY"],
    [{ walletBalance: -5 }, "WALLET_NOT_EMPTY"],
    [{ openPurchases: 1 }, "PURCHASE_OPEN"],
    [{ openReports: 1 }, "REPORT_OPEN"],
    [{ recentWithdrawals: 1 }, "RECENT_WITHDRAWAL"],
    [{ pendingTransactions: 1 }, "TRANSACTION_PENDING"],
  ])("isole %j", (patch, code) => {
    expect(closureBlockers({ ...HEALTHY, ...patch })).toEqual([code])
  })
  it("combine les blocages dans l'ordre du catalogue", () => {
    const result = closureBlockers({
      ...HEALTHY,
      role: "admin",
      pendingTransactions: 1,
      walletBalance: 10,
      activeClientMissions: 1,
    })
    expect(result).toEqual(["ROLE_ADMIN", "MISSION_CLIENT_ACTIVE", "WALLET_NOT_EMPTY", "TRANSACTION_PENDING"])
  })
  it("renvoie READ_ERROR dès qu'une lecture a échoué", () => {
    expect(closureBlockers({ ...HEALTHY, readError: true })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, readError: true, walletBalance: 5 })).toEqual(["READ_ERROR"])
    expect(closureBlockers(null)).toEqual(["READ_ERROR"])
    expect(closureBlockers(undefined)).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, openReports: undefined })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, openReports: null })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, walletBalance: "0" })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, walletReserved: NaN })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, activeStudentMissions: -1 })).toEqual(["READ_ERROR"])
    expect(closureBlockers({ ...HEALTHY, role: undefined })).toEqual(["READ_ERROR"])
  })
  it("pseudonymizationBlockers ignore missions, rôle et retraits récents", () => {
    const busy = {
      ...HEALTHY,
      role: "admin",
      activeClientMissions: 3,
      activeStudentMissions: 3,
      recentWithdrawals: 2,
    }
    expect(pseudonymizationBlockers(busy)).toEqual([])
    expect(pseudonymizationBlockers({ role: undefined, walletBalance: 0, walletReserved: 0, openPurchases: 0, openReports: 0, pendingTransactions: 0 })).toEqual([])
  })
  it("pseudonymizationBlockers garde les quatre blocages du temps 3", () => {
    expect(pseudonymizationBlockers({ ...HEALTHY, walletReserved: 1 })).toEqual(["WALLET_NOT_EMPTY"])
    expect(pseudonymizationBlockers({ ...HEALTHY, openReports: 1 })).toEqual(["REPORT_OPEN"])
    expect(pseudonymizationBlockers({ ...HEALTHY, openPurchases: 1 })).toEqual(["PURCHASE_OPEN"])
    expect(pseudonymizationBlockers({ ...HEALTHY, pendingTransactions: 1 })).toEqual(["TRANSACTION_PENDING"])
    expect(pseudonymizationBlockers({ ...HEALTHY, readError: true })).toEqual(["READ_ERROR"])
    expect(pseudonymizationBlockers({ ...HEALTHY, openReports: null })).toEqual(["READ_ERROR"])
    expect(pseudonymizationBlockers(null)).toEqual(["READ_ERROR"])
  })
})

describe("blockerMessage", () => {
  it("fournit un message pour chaque code et chaque audience", () => {
    for (const code of Object.values(CLOSURE_BLOCKERS)) {
      for (const audience of ["admin", "self"]) {
        const text = blockerMessage(code, audience)
        expect(text.length).toBeGreaterThan(10)
        expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
        expect(text).not.toMatch(/livraison|course|coursier|saisie|bientôt/i)
      }
    }
  })
  it("vouvoie en libre-service et reste neutre côté admin", () => {
    expect(blockerMessage("WALLET_NOT_EMPTY", "self")).toMatch(/\bvotre\b/i)
    expect(blockerMessage("MISSION_CLIENT_ACTIVE", "self")).toMatch(/\bvous\b/i)
    expect(blockerMessage("WALLET_NOT_EMPTY", "admin")).not.toMatch(/\bvotre\b|\bvous\b/i)
  })
  it("prend l'audience admin par défaut et retombe sur READ_ERROR pour un code inconnu", () => {
    expect(blockerMessage("PURCHASE_OPEN")).toBe(blockerMessage("PURCHASE_OPEN", "admin"))
    expect(blockerMessage("INCONNU", "self")).toBe(blockerMessage("READ_ERROR", "self"))
    expect(blockerMessage("toString", "admin")).toBe(blockerMessage("READ_ERROR", "admin"))
  })
})

describe("patchs de pseudonymisation", () => {
  const FORBIDDEN = [
    "role",
    "user_id",
    "rating",
    "missions_done",
    "closed_at",
    "pseudonymized_at",
    "is_suspended",
    "full_name",
    "city",
  ]
  it("n'incluent aucune colonne protégée", () => {
    for (const key of FORBIDDEN) {
      expect(Object.hasOwn(PROFILE_PSEUDONYM_PATCH, key)).toBe(false)
      expect(Object.hasOwn(STUDENT_PROFILE_PSEUDONYM_PATCH, key)).toBe(false)
    }
  })
  it("effacent les données personnelles prévues", () => {
    expect(PROFILE_PSEUDONYM_PATCH).toEqual({
      avatar_url: null,
      bio: null,
      phone: null,
      fcm_token: null,
      rejection_reason: null,
      verification_submitted_at: null,
      verified_until: null,
      is_verified: false,
    })
    expect(STUDENT_PROFILE_PSEUDONYM_PATCH).toEqual({
      school: null,
      level: null,
      availability: null,
      card_url: null,
      skills: [],
    })
  })
  it("sont figés", () => {
    expect(Object.isFrozen(PROFILE_PSEUDONYM_PATCH)).toBe(true)
    expect(Object.isFrozen(STUDENT_PROFILE_PSEUDONYM_PATCH)).toBe(true)
    expect(Object.isFrozen(STUDENT_PROFILE_PSEUDONYM_PATCH.skills)).toBe(true)
    expect(() => {
      "use strict"
      PROFILE_PSEUDONYM_PATCH.bio = "x"
    }).toThrow()
  })
})

describe("journal", () => {
  it("expose les listes fermées du plan", () => {
    expect(Object.values(CLOSURE_EVENTS)).toEqual(["closed", "reopened", "pseudonymized"])
    expect(Object.values(ACTOR_KINDS)).toEqual(["admin", "self", "system"])
    expect(Object.values(CLOSURE_REASONS)).toEqual(["user_request", "admin_decision"])
  })
  it("construit une entrée admin", () => {
    const entry = closureAuditEntry({
      userId: UID,
      event: "closed",
      actorKind: "admin",
      actorId: ADMIN,
      reasonCode: "admin_decision",
    })
    expect(entry).toEqual({
      user_id: UID,
      event: "closed",
      actor_kind: "admin",
      actor_id: ADMIN,
      reason_code: "admin_decision",
    })
    expect(auditHasNoPersonalData(entry)).toBe(true)
  })
  it("construit des entrées self et system sans acteur", () => {
    const self = closureAuditEntry({ userId: UID, event: "closed", actorKind: "self", reasonCode: "user_request" })
    expect(self.actor_id).toBeNull()
    expect(auditHasNoPersonalData(self)).toBe(true)
    const system = closureAuditEntry({ userId: UID, event: "pseudonymized", actorKind: "system" })
    expect(system.reason_code).toBeNull()
    expect(auditHasNoPersonalData(system)).toBe(true)
  })
  it("refuse les entrées invalides", () => {
    const ok = { userId: UID, event: "closed", actorKind: "system" }
    expect(() => closureAuditEntry({ ...ok, userId: "x" })).toThrow()
    expect(() => closureAuditEntry({ ...ok, event: "deleted" })).toThrow()
    expect(() => closureAuditEntry({ ...ok, actorKind: "robot" })).toThrow()
    expect(() => closureAuditEntry({ ...ok, actorKind: "admin" })).toThrow()
    expect(() => closureAuditEntry({ ...ok, actorKind: "admin", actorId: "x" })).toThrow()
    expect(() => closureAuditEntry({ ...ok, actorId: ADMIN })).toThrow()
    expect(() => closureAuditEntry({ ...ok, reasonCode: "texte libre" })).toThrow()
    expect(() => closureAuditEntry()).toThrow()
  })
  it("détecte les données personnelles", () => {
    const entry = closureAuditEntry({ userId: UID, event: "closed", actorKind: "system" })
    expect(auditHasNoPersonalData({ ...entry, email: "a@b.c" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, note: "Awa" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, user_id: "awa@x.bj" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, reason_code: "Awa a demandé" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, actor_id: "Awa" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, event: "autre" })).toBe(false)
    expect(auditHasNoPersonalData({ ...entry, actor_kind: "Awa" })).toBe(false)
    expect(auditHasNoPersonalData(null)).toBe(false)
    expect(auditHasNoPersonalData([])).toBe(false)
    expect(auditHasNoPersonalData("x")).toBe(false)
  })
})
