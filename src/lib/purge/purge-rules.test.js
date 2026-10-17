import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  BREAKER_MIN_FILES,
  JOURNAL_RETENTION_DAYS,
  LIST_PAGE,
  ORPHAN_GRACE_DAYS,
  PROOF_RETENTION_MONTHS,
  PURGE_CATEGORIES,
  REMOVE_BATCH,
  REPORT_RETENTION_MONTHS,
  ROW_BATCH,
  SUMMARY_FIELDS,
  TIME_BUDGET_MS,
  addCount,
  addStop,
  classifyProof,
  cutoffDate,
  emptySummary,
  isClosedReportExpired,
  isJournalEntryExpired,
  isOrphanCandidate,
  massAllowed,
  referencedPathsOrNull,
  resolvePurgeMode,
  summaryHasNoIdentifiers,
  toTime,
  tripsBreaker,
} from "./purge-rules"

const NOW = "2026-10-17T03:00:00.000Z"
const OWNER = "11111111-1111-4111-8111-111111111111"
const REQ = "22222222-2222-4222-8222-222222222222"
const ORIGIN = "https://proj.supabase.co"
const PATH_A = `${OWNER}/${REQ}/payee-abcdefgh1.jpg`
const PATH_B = `${OWNER}/${REQ}/ticket-abcdefgh2.jpg`

function iso(ms) {
  return new Date(ms).toISOString()
}
const DAY = 86400000

describe("constantes", () => {
  it("portent les durées annoncées", () => {
    expect(JOURNAL_RETENTION_DAYS).toBe(180)
    expect(REPORT_RETENTION_MONTHS).toBe(12)
    expect(ORPHAN_GRACE_DAYS).toBe(7)
    expect(PROOF_RETENTION_MONTHS).toBe(12)
    expect([ROW_BATCH, REMOVE_BATCH, LIST_PAGE, TIME_BUDGET_MS]).toEqual([500, 100, 1000, 40000])
    expect(BREAKER_MIN_FILES).toBe(25)
  })

  it("ne dépend d'aucun module serveur", () => {
    const source = fs.readFileSync(path.join(__dirname, "purge-rules.js"), "utf8")
    const imports = [...source.matchAll(/^import .* from "(.*)"/gm)].map((m) => m[1])
    expect(imports).toEqual(["@/lib/storage/owned-paths"])
    expect(source).not.toMatch(/process\.env/)
    expect(source).not.toMatch(/["']use server["']/)
  })
})

describe("toTime", () => {
  it("lit les chaînes ISO avec fuseau, quel que soit le fuseau du serveur", () => {
    expect(toTime("2026-10-17T03:00:00Z")).toBe(Date.UTC(2026, 9, 17, 3))
    expect(toTime("2026-10-17T03:00:00.123456+00:00")).toBe(Date.UTC(2026, 9, 17, 3, 0, 0, 123))
    expect(toTime("2026-10-17 03:00:00+00")).toBe(Date.UTC(2026, 9, 17, 3))
    expect(toTime("2026-10-17T04:00:00+01:00")).toBe(Date.UTC(2026, 9, 17, 3))
    expect(toTime("2026-10-17T04:00:00+0100")).toBe(Date.UTC(2026, 9, 17, 3))
    expect(toTime("2026-10-16T22:30:00-04:30")).toBe(Date.UTC(2026, 9, 17, 3))
  })

  it("refuse les chaînes sans fuseau et les dates impossibles", () => {
    for (const bad of [
      "2026-10-17T03:00:00",
      "2026-10-17",
      "2026-13-01T00:00:00Z",
      "2026-02-30T00:00:00Z",
      "2026-10-17T24:00:00Z",
      "2026-10-17T03:60:00Z",
      "2026-10-17T03:00:00+25:00",
      "hier",
      "",
      "   ",
    ]) {
      expect(toTime(bad), bad).toBeNull()
    }
  })

  it("gère Date, nombres et types inattendus", () => {
    expect(toTime(new Date(5))).toBe(5)
    expect(toTime(new Date("nope"))).toBeNull()
    expect(toTime(42)).toBe(42)
    expect(toTime(Number.NaN)).toBeNull()
    expect(toTime(Infinity)).toBeNull()
    for (const v of [null, undefined, {}, [], true]) expect(toTime(v)).toBeNull()
  })
})

describe("cutoffDate", () => {
  it("retire des jours de 24 h exactes", () => {
    expect(cutoffDate(NOW, { days: 180 }).toISOString()).toBe(iso(Date.parse(NOW) - 180 * DAY))
    expect(cutoffDate(NOW, { days: 0 }).toISOString()).toBe(NOW)
  })

  it("retire des mois civils UTC avec repli en fin de mois", () => {
    expect(cutoffDate("2026-10-17T03:00:00Z", { months: 12 }).toISOString()).toBe("2025-10-17T03:00:00.000Z")
    expect(cutoffDate("2026-03-31T10:00:00Z", { months: 1 }).toISOString()).toBe("2026-02-28T10:00:00.000Z")
    expect(cutoffDate("2028-03-31T10:00:00Z", { months: 1 }).toISOString()).toBe("2028-02-29T10:00:00.000Z")
    expect(cutoffDate("2028-02-29T10:00:00Z", { months: 12 }).toISOString()).toBe("2027-02-28T10:00:00.000Z")
    expect(cutoffDate("2026-01-15T00:00:00Z", { months: 1 }).toISOString()).toBe("2025-12-15T00:00:00.000Z")
    expect(cutoffDate("2026-01-15T00:00:00Z", { months: 25 }).toISOString()).toBe("2023-12-15T00:00:00.000Z")
  })

  it("ne dépend pas du fuseau du serveur (passage d'heure d'été comprise)", () => {
    const before = process.env.TZ
    try {
      for (const tz of ["UTC", "Africa/Porto-Novo", "America/Los_Angeles", "Pacific/Kiritimati"]) {
        process.env.TZ = tz
        expect(cutoffDate("2026-03-30T12:00:00Z", { days: 7 }).toISOString()).toBe("2026-03-23T12:00:00.000Z")
        expect(cutoffDate("2026-11-02T01:30:00Z", { days: 2 }).toISOString()).toBe("2026-10-31T01:30:00.000Z")
        expect(cutoffDate("2026-10-17T03:00:00Z", { months: 12 }).toISOString()).toBe("2025-10-17T03:00:00.000Z")
      }
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
  })

  it("renvoie null pour des entrées invalides", () => {
    expect(cutoffDate("nope", { days: 1 })).toBeNull()
    expect(cutoffDate(null, { days: 1 })).toBeNull()
    expect(cutoffDate(NOW, undefined)).toBeNull()
    expect(cutoffDate(NOW, {})).toBeNull()
    expect(cutoffDate(NOW, { days: 1, months: 1 })).toBeNull()
    expect(cutoffDate(NOW, { days: -1 })).toBeNull()
    expect(cutoffDate(NOW, { days: 1.5 })).toBeNull()
    expect(cutoffDate(NOW, { days: "7" })).toBeNull()
    expect(cutoffDate(NOW, { months: Number.NaN })).toBeNull()
    expect(cutoffDate(NOW, { days: 1e12 })).toBeNull()
  })
})

describe("resolvePurgeMode", () => {
  const real = { PURGE_ENABLED: "true" }

  it("réel seulement avec PURGE_ENABLED exactement 'true'", () => {
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams() })).toBe("real")
    expect(resolvePurgeMode({ env: real })).toBe("real")
  })

  it("simulation pour toute autre valeur du drapeau", () => {
    for (const v of ["TRUE", "True", " true", "true ", "1", "yes", "on", "false", "", "truee", "null", "undefined", undefined, null, true, 1]) {
      expect(resolvePurgeMode({ env: { PURGE_ENABLED: v } }), String(v)).toBe("dry")
    }
    expect(resolvePurgeMode({ env: {} })).toBe("dry")
    expect(resolvePurgeMode({ env: null })).toBe("dry")
    expect(resolvePurgeMode({})).toBe("dry")
    expect(resolvePurgeMode()).toBe("dry")
  })

  it("?mode=dry force la simulation, sous toutes ses formes", () => {
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=dry") })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=DRY") })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=%20dry%20") })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=real&mode=dry") })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: { mode: "dry" } })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: { mode: ["real", "dry"] } })).toBe("dry")
    expect(resolvePurgeMode({ env: real, searchParams: { get: () => "dry" } })).toBe("dry")
  })

  it("aucun autre paramètre ne change le mode, et mode ne rend jamais le réel", () => {
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=real") })).toBe("real")
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("mode=") })).toBe("real")
    expect(resolvePurgeMode({ env: real, searchParams: new URLSearchParams("dry=1&force=true") })).toBe("real")
    expect(resolvePurgeMode({ env: { PURGE_ENABLED: "false" }, searchParams: new URLSearchParams("mode=real") })).toBe("dry")
    expect(resolvePurgeMode({ env: {}, searchParams: new URLSearchParams("PURGE_ENABLED=true") })).toBe("dry")
  })

  it("une source de paramètres qui lève donne la simulation", () => {
    const hostile = {
      getAll() {
        throw new Error("boom")
      },
    }
    expect(resolvePurgeMode({ env: real, searchParams: hostile })).toBe("dry")
  })
})

describe("massAllowed", () => {
  it("vrai seulement pour 'true' exact", () => {
    expect(massAllowed({ PURGE_ALLOW_MASS: "true" })).toBe(true)
    for (const v of ["TRUE", "1", "yes", "", " true", undefined, null, true]) {
      expect(massAllowed({ PURGE_ALLOW_MASS: v }), String(v)).toBe(false)
    }
    expect(massAllowed({})).toBe(false)
    expect(massAllowed(null)).toBe(false)
    expect(massAllowed(undefined)).toBe(false)
  })
})

describe("isJournalEntryExpired (180 jours)", () => {
  const limit = Date.parse(NOW) - 180 * DAY
  it("bornes exactes : strictement plus ancien", () => {
    expect(isJournalEntryExpired(iso(limit - 1), NOW)).toBe(true)
    expect(isJournalEntryExpired(iso(limit), NOW)).toBe(false)
    expect(isJournalEntryExpired(iso(limit + 1), NOW)).toBe(false)
    expect(isJournalEntryExpired(iso(Date.parse(NOW)), NOW)).toBe(false)
  })

  it("date future, absente ou illisible : jamais expiré", () => {
    expect(isJournalEntryExpired(iso(Date.parse(NOW) + DAY), NOW)).toBe(false)
    for (const v of [null, undefined, "", "n'importe quoi", "2020-01-01T00:00:00", {}]) {
      expect(isJournalEntryExpired(v, NOW), String(v)).toBe(false)
    }
    expect(isJournalEntryExpired("2020-01-01T00:00:00Z", "invalide")).toBe(false)
  })

  it("lit le fuseau explicite", () => {
    expect(isJournalEntryExpired("2026-04-20T04:00:00+01:00", NOW)).toBe(false)
    expect(isJournalEntryExpired("2026-04-20T03:00:00+01:00", NOW)).toBe(true)
  })
})

describe("isClosedReportExpired (12 mois)", () => {
  const old = "2025-10-17T02:59:59.999Z"
  const exact = "2025-10-17T03:00:00.000Z"
  const recent = "2025-10-17T03:00:00.001Z"

  it("bornes exactes sur handled_at", () => {
    expect(isClosedReportExpired({ status: "resolved", handled_at: old, updated_at: recent }, NOW)).toBe(true)
    expect(isClosedReportExpired({ status: "resolved", handled_at: exact, updated_at: old }, NOW)).toBe(false)
    expect(isClosedReportExpired({ status: "dismissed", handled_at: recent, updated_at: old }, NOW)).toBe(false)
  })

  it("repli sur updated_at quand handled_at est null ou absent", () => {
    expect(isClosedReportExpired({ status: "dismissed", handled_at: null, updated_at: old }, NOW)).toBe(true)
    expect(isClosedReportExpired({ status: "dismissed", updated_at: old }, NOW)).toBe(true)
    expect(isClosedReportExpired({ status: "dismissed", handled_at: null, updated_at: exact }, NOW)).toBe(false)
    expect(isClosedReportExpired({ status: "dismissed", handled_at: null, updated_at: null }, NOW)).toBe(false)
  })

  it("handled_at présent mais illisible : pas de repli, jamais expiré", () => {
    expect(isClosedReportExpired({ status: "resolved", handled_at: "n'importe quoi", updated_at: old }, NOW)).toBe(false)
    expect(isClosedReportExpired({ status: "resolved", handled_at: "", updated_at: old }, NOW)).toBe(false)
  })

  it("jamais un signalement open, in_progress ou de statut inconnu", () => {
    for (const status of ["open", "in_progress", "OPEN", "Resolved", "resolved ", "", null, undefined, 1, "closed"]) {
      expect(isClosedReportExpired({ status, handled_at: old, updated_at: old }, NOW), String(status)).toBe(false)
    }
  })

  it("entrées invalides", () => {
    for (const row of [null, undefined, "x", 3]) expect(isClosedReportExpired(row, NOW)).toBe(false)
    expect(isClosedReportExpired({ status: "resolved", handled_at: old }, "invalide")).toBe(false)
  })

  it("12 mois civils : 29 février", () => {
    expect(isClosedReportExpired({ status: "resolved", handled_at: "2027-02-27T23:59:59Z" }, "2028-02-29T10:00:00Z")).toBe(true)
    expect(isClosedReportExpired({ status: "resolved", handled_at: "2027-02-28T10:00:00Z" }, "2028-02-29T10:00:00Z")).toBe(false)
  })
})

describe("isOrphanCandidate (7 jours)", () => {
  const limit = Date.parse(NOW) - 7 * DAY
  const base = { objectName: "a.jpg", referencedNames: new Set(["b.jpg"]), now: NOW }

  it("bornes exactes : strictement plus ancien que 7 jours", () => {
    expect(isOrphanCandidate({ ...base, objectCreatedAt: iso(limit - 1) })).toBe(true)
    expect(isOrphanCandidate({ ...base, objectCreatedAt: iso(limit) })).toBe(false)
    expect(isOrphanCandidate({ ...base, objectCreatedAt: iso(limit + 1) })).toBe(false)
    expect(isOrphanCandidate({ ...base, objectCreatedAt: NOW })).toBe(false)
  })

  it("date d'objet absente ou illisible : jamais candidat", () => {
    for (const v of [null, undefined, "", "hier", "2020-01-01T00:00:00", {}]) {
      expect(isOrphanCandidate({ ...base, objectCreatedAt: v }), String(v)).toBe(false)
    }
  })

  it("un fichier référencé n'est jamais candidat (Set ou tableau)", () => {
    const created = "2020-01-01T00:00:00Z"
    expect(isOrphanCandidate({ ...base, objectName: "b.jpg", objectCreatedAt: created })).toBe(false)
    expect(isOrphanCandidate({ ...base, objectName: "b.jpg", referencedNames: ["b.jpg"], objectCreatedAt: created })).toBe(false)
    expect(isOrphanCandidate({ ...base, referencedNames: ["b.jpg"], objectCreatedAt: created })).toBe(true)
    expect(isOrphanCandidate({ ...base, referencedNames: new Set(), objectCreatedAt: created })).toBe(true)
  })

  it("références absentes (lecture échouée) ou nom invalide : jamais candidat", () => {
    const created = "2020-01-01T00:00:00Z"
    for (const referencedNames of [null, undefined, "a.jpg", {}]) {
      expect(isOrphanCandidate({ ...base, referencedNames, objectCreatedAt: created })).toBe(false)
    }
    for (const objectName of ["", null, undefined, 5]) {
      expect(isOrphanCandidate({ ...base, objectName, objectCreatedAt: created })).toBe(false)
    }
    expect(isOrphanCandidate()).toBe(false)
  })
})

describe("classifyProof", () => {
  const created = "2026-01-01T00:00:00Z"
  const request = { paths: new Set([PATH_A]), updated_at: "2025-01-01T00:00:00Z" }
  const mission = { status: "done", updated_at: "2025-02-01T00:00:00Z" }
  const base = { path: PATH_A, objectCreatedAt: created, request, mission, openReport: false, lastReportHandledAt: null, now: NOW }

  it("keep : fichier référencé et récent ou mission en cours", () => {
    expect(classifyProof({ ...base, mission: { status: "in_progress", updated_at: "2020-01-01T00:00:00Z" } })).toBe("keep")
    expect(classifyProof({ ...base, mission: { status: "open", updated_at: "2020-01-01T00:00:00Z" } })).toBe("keep")
    expect(classifyProof({ ...base, mission: { status: "done", updated_at: "2026-09-01T00:00:00Z" } })).toBe("keep")
  })

  it("orphan : demande absente, après 7 jours seulement", () => {
    expect(classifyProof({ ...base, request: null })).toBe("orphan")
    expect(classifyProof({ ...base, request: null, objectCreatedAt: iso(Date.parse(NOW) - 7 * DAY) })).toBe("keep")
    expect(classifyProof({ ...base, request: null, objectCreatedAt: iso(Date.parse(NOW) - 7 * DAY - 1) })).toBe("orphan")
    expect(classifyProof({ ...base, request: null, objectCreatedAt: null })).toBe("keep")
    expect(classifyProof({ ...base, request: null, objectCreatedAt: "illisible" })).toBe("keep")
  })

  it("superseded : demande présente, fichier non référencé, après 7 jours seulement", () => {
    expect(classifyProof({ ...base, path: PATH_B })).toBe("superseded")
    expect(classifyProof({ ...base, path: PATH_B, objectCreatedAt: iso(Date.parse(NOW) - 7 * DAY) })).toBe("keep")
    expect(classifyProof({ ...base, path: PATH_B, objectCreatedAt: undefined })).toBe("keep")
    expect(classifyProof({ ...base, path: PATH_B, request: { ...request, paths: [PATH_A] } })).toBe("superseded")
  })

  it("une demande inconnue ou mal formée est gardée", () => {
    for (const r of [undefined, "x", 3, {}, { paths: null }, { paths: "a" }]) {
      expect(classifyProof({ ...base, request: r }), String(r)).toBe("keep")
    }
    expect(classifyProof({ ...base, path: "" })).toBe("keep")
    expect(classifyProof({ ...base, path: null })).toBe("keep")
    expect(classifyProof()).toBe("keep")
  })

  describe("expired (G6)", () => {
    it("fichier référencé, mission done ou cancelled depuis plus de 12 mois, aucun signalement ouvert", () => {
      expect(classifyProof(base)).toBe("expired")
      expect(classifyProof({ ...base, mission: { status: "cancelled", updated_at: "2025-02-01T00:00:00Z" } })).toBe("expired")
      expect(classifyProof({ ...base, request: { ...request, paths: [PATH_A] } })).toBe("expired")
    })

    it("borne exacte des 12 mois sur la fin de mission", () => {
      const at = (updated_at) => classifyProof({ ...base, request: { ...request, updated_at: "2020-01-01T00:00:00Z" }, mission: { status: "done", updated_at } })
      expect(at("2025-10-17T02:59:59.999Z")).toBe("expired")
      expect(at("2025-10-17T03:00:00.000Z")).toBe("keep")
      expect(at("2025-10-17T03:00:00.001Z")).toBe("keep")
    })

    it("la fin de mission est le maximum des trois dates", () => {
      expect(classifyProof({ ...base, request: { ...request, updated_at: "2026-06-01T00:00:00Z" } })).toBe("keep")
      expect(classifyProof({ ...base, lastReportHandledAt: "2026-06-01T00:00:00Z" })).toBe("keep")
      expect(classifyProof({ ...base, lastReportHandledAt: "2025-03-01T00:00:00Z" })).toBe("expired")
    })

    it("jamais avec un signalement ouvert ou un état de signalement inconnu", () => {
      expect(classifyProof({ ...base, openReport: true })).toBe("keep")
      for (const v of [undefined, null, 0, "", "false", "non"]) {
        expect(classifyProof({ ...base, openReport: v }), String(v)).toBe("keep")
      }
    })

    it("jamais si la mission n'est pas done ou cancelled", () => {
      for (const status of ["open", "in_progress", "DONE", "", null, undefined, "completed"]) {
        expect(classifyProof({ ...base, mission: { status, updated_at: "2020-01-01T00:00:00Z" } }), String(status)).toBe("keep")
      }
      expect(classifyProof({ ...base, mission: null })).toBe("keep")
      expect(classifyProof({ ...base, mission: undefined })).toBe("keep")
    })

    it("jamais avec une date de fin illisible", () => {
      expect(classifyProof({ ...base, mission: { status: "done", updated_at: "illisible" } })).toBe("keep")
      expect(classifyProof({ ...base, mission: { status: "done", updated_at: null } })).toBe("keep")
      expect(classifyProof({ ...base, request: { ...request, updated_at: null } })).toBe("keep")
      expect(classifyProof({ ...base, lastReportHandledAt: "illisible" })).toBe("keep")
      expect(classifyProof({ ...base, now: "invalide" })).toBe("keep")
    })

    it("jamais quand la durée est nulle (catégorie désactivée) ou invalide", () => {
      expect(classifyProof({ ...base, retentionMonths: null })).toBe("keep")
      for (const v of [-1, 1.5, "12", Number.NaN]) {
        expect(classifyProof({ ...base, retentionMonths: v }), String(v)).toBe("keep")
      }
      expect(classifyProof({ ...base, retentionMonths: 6, mission: { status: "done", updated_at: "2026-03-01T00:00:00Z" } })).toBe("expired")
    })

    it("n'altère pas orphan et superseded quand la durée est nulle", () => {
      expect(classifyProof({ ...base, retentionMonths: null, request: null })).toBe("orphan")
      expect(classifyProof({ ...base, retentionMonths: null, path: PATH_B })).toBe("superseded")
    })
  })
})

describe("referencedPathsOrNull", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN))
  afterEach(() => vi.unstubAllEnvs())

  const publicUrl = (bucket, p) => `${ORIGIN}/storage/v1/object/public/${bucket}/${p}`

  it("accepte chemins bruts et URL du projet, publiques ou signées", () => {
    const set = referencedPathsOrNull(
      [PATH_A, publicUrl("purchase-proofs", PATH_B), `${ORIGIN}/storage/v1/object/sign/purchase-proofs/${PATH_B}?token=x`],
      "purchase-proofs",
      OWNER,
    )
    expect(set).toBeInstanceOf(Set)
    expect([...set].sort()).toEqual([PATH_A, PATH_B].sort())
  })

  it("ignore les valeurs vides sans les compter comme illisibles", () => {
    expect([...referencedPathsOrNull([null, undefined, "", "   ", PATH_A], "purchase-proofs", OWNER)]).toEqual([PATH_A])
    expect(referencedPathsOrNull([], "purchase-proofs", OWNER).size).toBe(0)
    expect(referencedPathsOrNull([null, ""], "purchase-proofs", OWNER).size).toBe(0)
  })

  it("renvoie null dès qu'une référence non vide est illisible (G3)", () => {
    const bad = [
      "https://autre.example.com/storage/v1/object/public/purchase-proofs/" + PATH_A,
      "http://evil.test/x.jpg",
      publicUrl("avatars", `${OWNER}/avatar.png`),
      "format-inconnu",
      `autre-user/${REQ}/payee-abcdefgh1.jpg`,
      `${OWNER}/../x.jpg`,
      `${OWNER}/`,
      "ftp://proj.supabase.co/x",
      "javascript:alert(1)",
      42,
      {},
      true,
    ]
    for (const value of bad) {
      expect(referencedPathsOrNull([PATH_A, value], "purchase-proofs", OWNER), String(value)).toBeNull()
      expect(referencedPathsOrNull([value], "purchase-proofs", OWNER), String(value)).toBeNull()
    }
  })

  it("renvoie null si l'origine du projet est inconnue", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(referencedPathsOrNull([publicUrl("purchase-proofs", PATH_A)], "purchase-proofs", OWNER)).toBeNull()
    expect([...referencedPathsOrNull([PATH_A], "purchase-proofs", OWNER)]).toEqual([PATH_A])
  })

  it("renvoie null si values n'est pas un tableau", () => {
    for (const v of [null, undefined, "x", new Set([PATH_A]), {}]) {
      expect(referencedPathsOrNull(v, "purchase-proofs", OWNER)).toBeNull()
    }
  })
})

describe("tripsBreaker", () => {
  it("seuils exacts : plus de 50 % ET plus de 25 fichiers", () => {
    expect(tripsBreaker({ examined: 50, candidates: 26, allowMass: false })).toBe(true)
    expect(tripsBreaker({ examined: 50, candidates: 25, allowMass: false })).toBe(false)
    expect(tripsBreaker({ examined: 52, candidates: 26, allowMass: false })).toBe(false)
    expect(tripsBreaker({ examined: 51, candidates: 26, allowMass: false })).toBe(true)
    expect(tripsBreaker({ examined: 26, candidates: 26, allowMass: false })).toBe(true)
    expect(tripsBreaker({ examined: 1000, candidates: 500, allowMass: false })).toBe(false)
    expect(tripsBreaker({ examined: 1000, candidates: 501, allowMass: false })).toBe(true)
    expect(tripsBreaker({ examined: 1000, candidates: 26, allowMass: false })).toBe(false)
  })

  it("petits volumes : pas de déclenchement sous 25 fichiers, même à 100 %", () => {
    expect(tripsBreaker({ examined: 25, candidates: 25, allowMass: false })).toBe(false)
    expect(tripsBreaker({ examined: 3, candidates: 3, allowMass: false })).toBe(false)
    expect(tripsBreaker({ examined: 0, candidates: 0, allowMass: false })).toBe(false)
  })

  it("PURGE_ALLOW_MASS (true exact) lève le disjoncteur", () => {
    expect(tripsBreaker({ examined: 100, candidates: 100, allowMass: true })).toBe(false)
    for (const v of ["true", 1, "yes", undefined, null]) {
      expect(tripsBreaker({ examined: 100, candidates: 100, allowMass: v }), String(v)).toBe(true)
    }
  })

  it("nombres invalides : disjoncteur déclenché", () => {
    for (const [examined, candidates] of [[-1, 0], [10, -1], [1.5, 1], [Number.NaN, 30], ["50", "30"], [null, null], [undefined, 30], [Infinity, 30]]) {
      expect(tripsBreaker({ examined, candidates }), `${examined}/${candidates}`).toBe(true)
    }
    expect(tripsBreaker()).toBe(true)
  })
})

describe("résumé", () => {
  it("emptySummary : toutes les catégories à zéro, dans l'ordre d'exécution", () => {
    const s = emptySummary()
    expect(s.mode).toBe("dry")
    expect(Object.keys(s.categories)).toEqual(PURGE_CATEGORIES)
    expect(PURGE_CATEGORIES).toEqual(["contact_events", "closed_reports", "proof_orphans", "message_media", "avatars", "student_cards", "proof_expired"])
    for (const c of PURGE_CATEGORIES) {
      expect(Object.keys(s.categories[c])).toEqual(SUMMARY_FIELDS)
      expect(Object.values(s.categories[c]).every((v) => v === 0)).toBe(true)
    }
    expect(s.arrets).toEqual([])
    expect(emptySummary("real").mode).toBe("real")
    expect(emptySummary("n'importe quoi").mode).toBe("dry")
  })

  it("emptySummary ne partage aucun état entre appels", () => {
    const a = emptySummary()
    addCount(a, "avatars", "candidats", 3)
    expect(emptySummary().categories.avatars.candidats).toBe(0)
  })

  it("addCount cumule et renvoie le résumé", () => {
    const s = emptySummary("real")
    expect(addCount(s, "avatars", "examines", 4)).toBe(s)
    addCount(s, "avatars", "examines", 6)
    addCount(s, "avatars", "supprimes", 0)
    expect(s.categories.avatars.examines).toBe(10)
    expect(s.categories.avatars.supprimes).toBe(0)
    expect(s.categories.closed_reports.examines).toBe(0)
  })

  it("addCount refuse catégorie, compteur et nombre inconnus", () => {
    const s = emptySummary()
    expect(() => addCount(s, "transactions", "examines", 1)).toThrow(RangeError)
    expect(() => addCount(s, "__proto__", "examines", 1)).toThrow(RangeError)
    expect(() => addCount(s, "avatars", "chemin", 1)).toThrow(RangeError)
    for (const n of [-1, 1.5, Number.NaN, "2", null, undefined, Infinity]) {
      expect(() => addCount(s, "avatars", "examines", n), String(n)).toThrow(RangeError)
    }
    expect(s.categories.avatars.examines).toBe(0)
  })

  it("addStop note catégorie et motif seulement", () => {
    const s = emptySummary()
    addStop(s, "message_media", "breaker")
    expect(s.arrets).toEqual([{ categorie: "message_media", motif: "breaker" }])
    expect(() => addStop(s, "message_media", "chemin/secret.jpg")).toThrow(RangeError)
    expect(() => addStop(s, "inconnue", "error")).toThrow(RangeError)
  })

  it("summaryHasNoIdentifiers accepte un résumé de compteurs", () => {
    const s = emptySummary("real")
    addCount(s, "avatars", "examines", 120)
    addStop(s, "avatars", "deadline")
    s.duree_ms = 38123
    expect(summaryHasNoIdentifiers(s)).toBe(true)
    expect(summaryHasNoIdentifiers(emptySummary())).toBe(true)
  })

  it("summaryHasNoIdentifiers refuse uuid, chemin, nom de fichier, e-mail et numéro", () => {
    const withValue = (value) => ({ ...emptySummary(), note: value })
    for (const value of [
      OWNER,
      PATH_A,
      "photo.JPG",
      "audio.m4a",
      "a/b",
      "a\\b",
      "nom@example.com",
      "22901234567",
      "+22901234567",
    ]) {
      expect(summaryHasNoIdentifiers(withValue(value)), value).toBe(false)
    }
    const key = { ...emptySummary() }
    key[OWNER] = 1
    expect(summaryHasNoIdentifiers(key)).toBe(false)
  })

  it("summaryHasNoIdentifiers refuse un résumé non sérialisable", () => {
    const circular = {}
    circular.self = circular
    expect(summaryHasNoIdentifiers(circular)).toBe(false)
    expect(summaryHasNoIdentifiers(undefined)).toBe(false)
    expect(summaryHasNoIdentifiers(() => 1)).toBe(false)
    expect(summaryHasNoIdentifiers({ n: 10n })).toBe(false)
  })
})
