import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock("@/lib/actions/account-closure-auth", () => ({
  banAuthUser: vi.fn().mockResolvedValue({ ok: true }),
  unbanAuthUser: vi.fn().mockResolvedValue({ ok: true }),
}))

import { sendEmail } from "@/lib/email"
import { banAuthUser, unbanAuthUser } from "@/lib/actions/account-closure-auth"
import { auditHasNoPersonalData, CLOSURE_GRACE_DAYS } from "@/lib/account-closure/closure-rules"
import {
  closeAccountCore,
  reopenAccountCore,
  readClosureSnapshot,
  readClosureHistory,
} from "./account-closure-core"

const USER = "123e4567-e89b-42d3-a456-426614174000"
const ADMIN = "223e4567-e89b-42d3-a456-426614174001"
const NOW = new Date("2026-10-17T10:00:00.000Z")
const NOW_ISO = NOW.toISOString()
const EMAIL = "marie.dupont@example.com"
const NAME = "Marie Dupont"
const ADMIN_ACTOR = { kind: "admin", id: ADMIN }

// Faux client Supabase en mémoire : filtres, comptage, update/insert avec trace des écritures.
function makeDb(seed = {}) {
  const tables = {
    profiles: [
      {
        user_id: USER,
        role: "client",
        full_name: NAME,
        phone: "+22901000000",
        bio: "bio",
        is_suspended: false,
        closed_at: null,
        pseudonymized_at: null,
        closure_prev_suspended: null,
      },
    ],
    missions: [],
    purchase_requests: [],
    reports: [],
    wallet_transactions: [],
    transactions: [],
    wallets: [{ user_id: USER, balance: 0, reserved: 0 }],
    account_closure_events: [],
    ...seed,
  }
  const writes = []
  const faults = {}
  const hooks = {}
  const gets = vi.fn().mockResolvedValue({ data: { user: { id: USER, email: EMAIL, banned_until: null } }, error: null })

  function from(table) {
    const state = { filters: [], op: "select", payload: null, head: false, order: null, max: null, single: false }
    const builder = {
      select(_cols, opts) {
        if (opts?.head) state.head = true
        state.count = Boolean(opts?.count)
        return builder
      },
      update(payload) {
        state.op = "update"
        state.payload = payload
        return builder
      },
      insert(payload) {
        state.op = "insert"
        state.payload = payload
        return builder
      },
      eq: (c, v) => (state.filters.push((r) => r[c] === v), builder),
      neq: (c, v) => (state.filters.push((r) => r[c] !== v), builder),
      in: (c, v) => (state.filters.push((r) => v.includes(r[c])), builder),
      is: (c, v) => (state.filters.push((r) => (r[c] ?? null) === v), builder),
      not: (c, _o, v) => (state.filters.push((r) => (r[c] ?? null) !== v), builder),
      gte: (c, v) => (state.filters.push((r) => r[c] >= v), builder),
      or: (expr) => {
        const parts = expr.split(",").map((p) => p.split(".eq."))
        state.filters.push((r) => parts.some(([c, v]) => r[c] === v))
        return builder
      },
      order: (c, o) => ((state.order = { c, asc: o?.ascending !== false }), builder),
      limit: (n) => ((state.max = n), builder),
      maybeSingle: () => ((state.single = true), builder),
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    function run() {
      if (state.op !== "insert") hooks[`${table}.${state.op}`]?.(tables)
      const fault = faults[`${table}.${state.op}`]
      if (fault) return { data: null, count: null, error: fault }
      if (!tables[table]) return { data: null, count: null, error: { code: "42P01" } }
      if (state.op === "insert") {
        writes.push({ table, op: "insert", payload: state.payload })
        tables[table].push({ ...state.payload, created_at: new Date(Date.now() + tables[table].length).toISOString() })
        return { data: null, error: null }
      }
      let rows = tables[table].filter((r) => state.filters.every((f) => f(r)))
      if (state.op === "update") {
        writes.push({ table, op: "update", payload: state.payload, matched: rows.length })
        for (const r of rows) Object.assign(r, state.payload)
        return { data: rows.map((r) => ({ user_id: r.user_id })), error: null }
      }
      if (state.head) return { data: null, count: rows.length, error: null }
      if (state.order) {
        const { c, asc } = state.order
        rows = [...rows].sort((a, b) => (a[c] < b[c] ? -1 : 1) * (asc ? 1 : -1))
      }
      if (state.max) rows = rows.slice(0, state.max)
      return state.single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null }
    }
    return builder
  }

  const service = { from, auth: { admin: { getUserById: gets, deleteUser: vi.fn() } } }
  return { service, tables, writes, faults, hooks, gets }
}

let infoSpy
let errorSpy
beforeEach(() => {
  vi.clearAllMocks()
  banAuthUser.mockResolvedValue({ ok: true })
  unbanAuthUser.mockResolvedValue({ ok: true })
  sendEmail.mockResolvedValue({ success: true })
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  infoSpy.mockRestore()
  errorSpy.mockRestore()
})

const close = (db, extra = {}) =>
  closeAccountCore(db.service, { userId: USER, actor: ADMIN_ACTOR, reasonCode: "admin_decision", now: NOW, ...extra })
const reopen = (db, extra = {}) =>
  reopenAccountCore(db.service, { userId: USER, actor: ADMIN_ACTOR, reasonCode: "user_request", now: NOW, ...extra })
const profileWrites = (db) => db.writes.filter((w) => w.table === "profiles")
const loggedText = () => [...infoSpy.mock.calls, ...errorSpy.mock.calls].map((c) => c.join(" ")).join("\n")

describe("closeAccountCore : blocages", () => {
  const cases = [
    ["MISSION_CLIENT_ACTIVE", { missions: [{ client_id: USER, status: "open" }] }],
    ["MISSION_CLIENT_ACTIVE", { missions: [{ client_id: USER, status: "in_progress" }] }],
    ["MISSION_STUDENT_ACTIVE", { missions: [{ selected_student_id: USER, status: "in_progress" }] }],
    ["WALLET_NOT_EMPTY", { wallets: [{ user_id: USER, balance: 500, reserved: 0 }] }],
    ["WALLET_NOT_EMPTY", { wallets: [{ user_id: USER, balance: 0, reserved: 100 }] }],
    ["PURCHASE_OPEN", { purchase_requests: [{ student_id: USER, client_id: ADMIN, status: "paid" }] }],
    ["REPORT_OPEN", { reports: [{ reporter_id: ADMIN, reported_user_id: USER, status: "open" }] }],
    ["REPORT_OPEN", { reports: [{ reporter_id: USER, reported_user_id: ADMIN, status: "in_progress" }] }],
    [
      "RECENT_WITHDRAWAL",
      { wallet_transactions: [{ user_id: USER, type: "withdrawal", created_at: "2026-10-12T00:00:00.000Z" }] },
    ],
    ["TRANSACTION_PENDING", { transactions: [{ client_id: ADMIN, student_id: USER, status: "pending" }] }],
  ]
  it.each(cases)("%s refuse sans aucune écriture", async (code, seed) => {
    const db = makeDb(seed)
    const result = await close(db)
    expect(result).toEqual({ blocked: [code] })
    expect(db.writes).toEqual([])
    expect(banAuthUser).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("un ancien retrait (plus de 7 jours) ou une mission terminée ne bloquent pas", async () => {
    const db = makeDb({
      missions: [{ client_id: USER, status: "done" }],
      wallet_transactions: [{ user_id: USER, type: "withdrawal", created_at: "2026-10-01T00:00:00.000Z" }],
    })
    expect((await close(db)).success).toBe(true)
  })

  it("compte administrateur : refus ROLE_ADMIN", async () => {
    const db = makeDb()
    db.tables.profiles[0].role = "admin"
    expect(await close(db)).toEqual({ blocked: ["ROLE_ADMIN"] })
    expect(db.writes).toEqual([])
  })

  it("un admin ne peut pas fermer son propre compte", async () => {
    const db = makeDb()
    const result = await close(db, { actor: { kind: "admin", id: USER } })
    expect(result).toEqual({ blocked: ["ROLE_ADMIN"] })
    expect(db.writes).toEqual([])
  })

  it("erreur de lecture d'un blocage : refus READ_ERROR (fail-closed)", async () => {
    for (const table of ["missions", "wallets", "reports", "purchase_requests", "transactions", "wallet_transactions"]) {
      const db = makeDb()
      db.faults[`${table}.select`] = { code: "XX000" }
      expect(await close(db)).toEqual({ blocked: ["READ_ERROR"] })
      expect(db.writes).toEqual([])
    }
  })

  it("erreur de lecture du profil : refus READ_ERROR", async () => {
    const db = makeDb()
    db.faults["profiles.select"] = { code: "XX000" }
    expect(await close(db)).toEqual({ blocked: ["READ_ERROR"] })
    expect(db.writes).toEqual([])
  })

  it("colonne ou table absente : erreur générique, rien d'écrit", async () => {
    const col = makeDb()
    col.faults["profiles.select"] = { code: "42703" }
    expect(await close(col)).toEqual({ error: expect.any(String) })
    expect(col.writes).toEqual([])
    for (const code of ["42P01", "PGRST205"]) {
      const tbl = makeDb()
      tbl.faults["account_closure_events.select"] = { code }
      expect(await close(tbl)).toEqual({ error: expect.any(String) })
      expect(tbl.writes).toEqual([])
    }
    const missing = makeDb()
    delete missing.tables.account_closure_events
    expect(await close(missing)).toEqual({ error: expect.any(String) })
    expect(missing.writes).toEqual([])
  })

  it("entrées invalides : erreur sans écriture", async () => {
    const db = makeDb()
    expect(await close(db, { userId: "x" })).toHaveProperty("error")
    expect(await close(db, { reasonCode: "autre" })).toHaveProperty("error")
    expect(await close(db, { actor: { kind: "admin", id: "x" } })).toHaveProperty("error")
    expect(await close(db, { actor: { kind: "system" } })).toHaveProperty("error")
    expect(db.writes).toEqual([])
  })

  it("compte introuvable", async () => {
    const db = makeDb()
    db.tables.profiles.length = 0
    expect(await close(db)).toEqual({ error: "Compte introuvable." })
  })
})

describe("closeAccountCore : fermeture", () => {
  it("compte client actif : verrou, bannissement, événement, e-mail, aucune donnée personnelle modifiée", async () => {
    const db = makeDb()
    const result = await close(db)
    const due = new Date(NOW.getTime() + CLOSURE_GRACE_DAYS * 86400000).toISOString()
    expect(result).toEqual({ success: true, alreadyClosed: false, complete: true, dueAt: due })
    const row = db.tables.profiles[0]
    expect(row.closed_at).toBe(NOW_ISO)
    expect(row.is_suspended).toBe(true)
    expect(row.closure_prev_suspended).toBe(false)
    expect(row.full_name).toBe(NAME)
    expect(row.phone).toBe("+22901000000")
    expect(row.bio).toBe("bio")
    const [lock] = profileWrites(db)
    expect(Object.keys(lock.payload).sort()).toEqual(["closed_at", "closure_prev_suspended", "is_suspended"])
    expect(banAuthUser).toHaveBeenCalledWith(db.service, USER)
    expect(db.tables.account_closure_events).toHaveLength(1)
    expect(db.tables.account_closure_events[0]).toMatchObject({
      user_id: USER,
      event: "closed",
      actor_kind: "admin",
      actor_id: ADMIN,
      reason_code: "admin_decision",
    })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith("account-closed", EMAIL, { name: NAME, reactivationDeadline: due })
  })

  it("compte étudiant déjà suspendu : la valeur précédente est mémorisée", async () => {
    const db = makeDb({ wallets: [{ user_id: USER, balance: 0, reserved: 0 }] })
    db.tables.profiles[0].role = "student"
    db.tables.profiles[0].is_suspended = true
    const result = await close(db)
    expect(result.success).toBe(true)
    expect(db.tables.profiles[0].closure_prev_suspended).toBe(true)
    expect(db.tables.profiles[0].is_suspended).toBe(true)
  })

  it("acteur self : événement sans identifiant d'acteur", async () => {
    const db = makeDb()
    await close(db, { actor: { kind: "self" }, reasonCode: "user_request" })
    expect(db.tables.account_closure_events[0]).toMatchObject({ actor_kind: "self", actor_id: null, reason_code: "user_request" })
  })

  it("aucune suppression ni deleteUser, seules des écritures permises", async () => {
    const db = makeDb()
    await close(db)
    expect(db.service.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(db.writes.map((w) => `${w.table}.${w.op}`).sort()).toEqual([
      "account_closure_events.insert",
      "profiles.update",
    ])
  })

  it("journal [account-closure] : uuid et codes seulement", async () => {
    const db = makeDb()
    await close(db)
    const call = infoSpy.mock.calls.find((c) => c[0] === "[account-closure]")
    expect(auditHasNoPersonalData(JSON.parse(call[1]))).toBe(true)
    const text = loggedText()
    expect(text).not.toContain(EMAIL)
    expect(text).not.toContain(NAME)
    expect(text).not.toContain("+22901000000")
  })

  it("verrou : deux fermetures simultanées, une seule écrit", async () => {
    const db = makeDb()
    db.hooks["profiles.update"] = (tables) => {
      // Une autre fermeture passe entre la lecture et le verrou.
      Object.assign(tables.profiles[0], { closed_at: "2026-10-17T09:59:59.000Z", is_suspended: true, closure_prev_suspended: false })
      delete db.hooks["profiles.update"]
    }
    const result = await close(db)
    expect(result).toMatchObject({ success: true, alreadyClosed: true, complete: false })
    expect(db.tables.profiles[0].closed_at).toBe("2026-10-17T09:59:59.000Z")
    expect(db.tables.account_closure_events).toHaveLength(0)
    expect(banAuthUser).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(profileWrites(db)[0].matched).toBe(0)
  })

  it("verrou : le profil devenu admin n'est jamais fermé", async () => {
    const db = makeDb()
    db.hooks["profiles.update"] = (tables) => {
      tables.profiles[0].role = "admin"
    }
    expect(await close(db)).toHaveProperty("error")
    expect(db.tables.profiles[0].closed_at).toBeNull()
  })

  it("blocage apparu après le verrou : verrou annulé, is_suspended restauré, refus", async () => {
    const db = makeDb()
    db.tables.profiles[0].is_suspended = true
    let reads = 0
    const original = db.service.from
    db.service.from = (table) => {
      if (table === "reports" && ++reads === 2) {
        db.tables.reports.push({ reporter_id: ADMIN, reported_user_id: USER, status: "open" })
      }
      return original(table)
    }
    const result = await close(db)
    expect(result).toEqual({ blocked: ["REPORT_OPEN"] })
    const row = db.tables.profiles[0]
    expect(row.closed_at).toBeNull()
    expect(row.is_suspended).toBe(true)
    expect(row.closure_prev_suspended).toBeNull()
    expect(banAuthUser).not.toHaveBeenCalled()
    expect(db.tables.account_closure_events).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("erreur de lecture après le verrou : verrou annulé, refus READ_ERROR", async () => {
    const db = makeDb()
    let reads = 0
    const original = db.service.from
    db.service.from = (table) => {
      if (table === "wallets" && ++reads === 2) db.faults["wallets.select"] = { code: "XX000" }
      return original(table)
    }
    expect(await close(db)).toEqual({ blocked: ["READ_ERROR"] })
    expect(db.tables.profiles[0].closed_at).toBeNull()
    expect(db.tables.profiles[0].is_suspended).toBe(false)
  })

  it("verrou en erreur : erreur générique, ni bannissement ni événement", async () => {
    const db = makeDb()
    db.faults["profiles.update"] = { code: "XX000" }
    expect(await close(db)).toHaveProperty("error")
    expect(banAuthUser).not.toHaveBeenCalled()
    expect(db.tables.account_closure_events).toHaveLength(0)
  })

  it("échec du bannissement : complete false, compte déjà coupé, relance idempotente et e-mail unique", async () => {
    const db = makeDb()
    banAuthUser.mockResolvedValueOnce({ ok: false, code: "500" })
    const first = await close(db)
    expect(first).toMatchObject({ success: true, alreadyClosed: false, complete: false })
    expect(db.tables.profiles[0].is_suspended).toBe(true)
    expect(db.tables.account_closure_events).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)

    const second = await close(db, { now: new Date(NOW.getTime() + 60000) })
    expect(second).toMatchObject({ success: true, alreadyClosed: true, complete: true })
    expect(db.tables.profiles[0].closed_at).toBe(NOW_ISO)
    expect(db.tables.profiles[0].closure_prev_suspended).toBe(false)
    expect(db.tables.account_closure_events).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(banAuthUser).toHaveBeenCalledTimes(2)
  })

  it("événement non écrit : complete false, pas d'e-mail, la relance écrit l'événement puis envoie l'e-mail une fois", async () => {
    const db = makeDb()
    db.faults["account_closure_events.insert"] = { code: "XX000" }
    const first = await close(db)
    expect(first).toMatchObject({ complete: false })
    expect(sendEmail).not.toHaveBeenCalled()
    delete db.faults["account_closure_events.insert"]
    const second = await close(db)
    expect(second).toMatchObject({ alreadyClosed: true, complete: true })
    expect(db.tables.account_closure_events).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("compte déjà fermé : aucun blocage évalué, aucune écriture de profil", async () => {
    const db = makeDb({ missions: [{ client_id: USER, status: "open" }] })
    Object.assign(db.tables.profiles[0], { closed_at: "2026-10-10T00:00:00.000Z", is_suspended: true, closure_prev_suspended: false })
    db.tables.account_closure_events.push({ user_id: USER, event: "closed", created_at: "2026-10-10T00:00:00.000Z" })
    const result = await close(db)
    expect(result).toMatchObject({ success: true, alreadyClosed: true, complete: true })
    expect(result.dueAt).toBe("2026-10-24T00:00:00.000Z")
    expect(profileWrites(db)).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("compte pseudonymisé : réponse sans écriture ni appel auth", async () => {
    const db = makeDb()
    Object.assign(db.tables.profiles[0], {
      closed_at: "2026-09-01T00:00:00.000Z",
      pseudonymized_at: "2026-09-16T00:00:00.000Z",
      full_name: "Compte clôturé",
    })
    expect(await close(db)).toMatchObject({ success: true, alreadyClosed: true, complete: true })
    expect(db.writes).toEqual([])
    expect(banAuthUser).not.toHaveBeenCalled()
  })

  it("échec d'envoi de l'e-mail : n'empêche pas la fermeture", async () => {
    const db = makeDb()
    sendEmail.mockRejectedValueOnce(new Error("boom"))
    expect(await close(db)).toMatchObject({ success: true, complete: true })
  })

  it("adresse illisible : pas d'e-mail", async () => {
    const db = makeDb()
    db.gets.mockResolvedValueOnce({ data: null, error: { message: "x" } })
    expect(await close(db)).toMatchObject({ success: true, complete: true })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe("readClosureSnapshot et readClosureHistory", () => {
  it("instantané sain puis en erreur", async () => {
    const db = makeDb()
    expect(await readClosureSnapshot(db.service, USER, { now: NOW })).toEqual({
      role: "client",
      activeClientMissions: 0,
      activeStudentMissions: 0,
      openPurchases: 0,
      openReports: 0,
      recentWithdrawals: 0,
      pendingTransactions: 0,
      walletBalance: 0,
      walletReserved: 0,
    })
    db.faults["missions.select"] = { code: "XX000" }
    const broken = await readClosureSnapshot(db.service, USER, { now: NOW })
    expect(broken.activeClientMissions).toBeUndefined()
    expect(await readClosureSnapshot(db.service, "x")).toEqual({ readError: true })
  })

  it("historique : colonnes explicites, plus récent d'abord", async () => {
    const db = makeDb()
    db.tables.account_closure_events.push(
      { user_id: USER, event: "closed", actor_kind: "admin", actor_id: ADMIN, reason_code: null, created_at: "2026-10-01T00:00:00.000Z" },
      { user_id: USER, event: "reopened", actor_kind: "admin", actor_id: ADMIN, reason_code: null, created_at: "2026-10-02T00:00:00.000Z" },
    )
    const result = await readClosureHistory(db.service, USER)
    expect(result.events.map((e) => e.event)).toEqual(["reopened", "closed"])
    db.faults["account_closure_events.select"] = { code: "42P01" }
    expect(await readClosureHistory(db.service, USER)).toEqual({ error: expect.any(String) })
  })
})

describe("reopenAccountCore", () => {
  function closedDb(prev) {
    const db = makeDb()
    Object.assign(db.tables.profiles[0], { closed_at: "2026-10-10T00:00:00.000Z", is_suspended: true, closure_prev_suspended: prev })
    db.tables.account_closure_events.push({ user_id: USER, event: "closed", created_at: "2026-10-10T00:00:00.000Z" })
    return db
  }

  it("restaure la valeur précédente (non suspendu avant) et lève le bannissement", async () => {
    const db = closedDb(false)
    expect(await reopen(db)).toEqual({ success: true, complete: true, alreadyActive: false })
    const row = db.tables.profiles[0]
    expect(row.closed_at).toBeNull()
    expect(row.is_suspended).toBe(false)
    expect(row.closure_prev_suspended).toBeNull()
    expect(unbanAuthUser).toHaveBeenCalledWith(db.service, USER)
    expect(db.tables.account_closure_events.at(-1)).toMatchObject({ event: "reopened", actor_kind: "admin", actor_id: ADMIN })
    expect(sendEmail).toHaveBeenCalledWith("account-reopened", EMAIL, { name: NAME })
  })

  it("restaure la suspension d'avant quand le compte était suspendu", async () => {
    const db = closedDb(true)
    await reopen(db)
    expect(db.tables.profiles[0].is_suspended).toBe(true)
    expect(db.tables.profiles[0].closed_at).toBeNull()
  })

  it("valeur mémorisée absente : réactivé non suspendu", async () => {
    const db = closedDb(null)
    await reopen(db)
    expect(db.tables.profiles[0].is_suspended).toBe(false)
  })

  it("refusée si le compte est pseudonymisé, sans écriture", async () => {
    const db = closedDb(false)
    db.tables.profiles[0].pseudonymized_at = "2026-10-11T00:00:00.000Z"
    const result = await reopen(db)
    expect(result).toMatchObject({ code: "PSEUDONYMIZED", error: expect.stringContaining("pseudonymisées") })
    expect(db.writes).toEqual([])
    expect(unbanAuthUser).not.toHaveBeenCalled()
  })

  it("course avec la revendication du cron : le cron gagne, la réactivation est refusée", async () => {
    const db = closedDb(false)
    db.hooks["profiles.update"] = (tables) => {
      tables.profiles[0].pseudonymized_at = "2026-10-17T09:59:59.000Z"
    }
    const result = await reopen(db)
    expect(result).toMatchObject({ code: "PSEUDONYMIZED" })
    expect(db.tables.profiles[0].closed_at).not.toBeNull()
    expect(db.tables.profiles[0].is_suspended).toBe(true)
    expect(unbanAuthUser).not.toHaveBeenCalled()
    expect(db.tables.account_closure_events.filter((e) => e.event === "reopened")).toHaveLength(0)
  })

  it("refus de la garde en base (erreur) après pseudonymisation : réactivation impossible", async () => {
    const db = closedDb(false)
    db.hooks["profiles.update"] = (tables) => {
      tables.profiles[0].pseudonymized_at = "2026-10-17T09:59:59.000Z"
      db.faults["profiles.update"] = { code: "P0001" }
    }
    expect(await reopen(db)).toMatchObject({ code: "PSEUDONYMIZED" })
    expect(unbanAuthUser).not.toHaveBeenCalled()
  })

  it("la mise à jour exige pseudonymized_at nul sur la même ligne", async () => {
    const db = closedDb(false)
    await reopen(db)
    expect(profileWrites(db)).toHaveLength(1)
    expect(Object.keys(profileWrites(db)[0].payload).sort()).toEqual(["closed_at", "closure_prev_suspended", "is_suspended"])
  })

  it("compte actif sans bannissement : refus NOT_CLOSED", async () => {
    const db = makeDb()
    expect(await reopen(db)).toMatchObject({ code: "NOT_CLOSED" })
    expect(db.writes).toEqual([])
    expect(unbanAuthUser).not.toHaveBeenCalled()
  })

  it("compte actif mais encore banni (reprise) : bannissement levé sans nouvel événement", async () => {
    const db = makeDb()
    db.gets.mockResolvedValue({ data: { user: { id: USER, email: EMAIL, banned_until: "2126-01-01T00:00:00Z" } }, error: null })
    db.tables.account_closure_events.push({ user_id: USER, event: "reopened", created_at: "2026-10-10T00:00:00.000Z" })
    expect(await reopen(db)).toEqual({ success: true, complete: true, alreadyActive: true })
    expect(unbanAuthUser).toHaveBeenCalledTimes(1)
    expect(db.writes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("échec du déblocage auth : complete false, la relance lève le bannissement sans doubler l'événement ni l'e-mail", async () => {
    const db = closedDb(false)
    unbanAuthUser.mockResolvedValueOnce({ ok: false, code: "500" })
    expect(await reopen(db)).toMatchObject({ success: true, complete: false })
    expect(db.tables.profiles[0].closed_at).toBeNull()
    db.gets.mockResolvedValue({ data: { user: { id: USER, email: EMAIL, banned_until: "2126-01-01T00:00:00Z" } }, error: null })
    expect(await reopen(db)).toMatchObject({ success: true, complete: true, alreadyActive: true })
    expect(db.tables.account_closure_events.filter((e) => e.event === "reopened")).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("acteur non admin, entrées invalides, objets absents : erreur sans écriture", async () => {
    const db = closedDb(false)
    expect(await reopen(db, { actor: { kind: "self" } })).toHaveProperty("error")
    expect(await reopen(db, { userId: "x" })).toHaveProperty("error")
    db.faults["account_closure_events.select"] = { code: "42P01" }
    expect(await reopen(db)).toHaveProperty("error")
    expect(db.writes).toEqual([])
  })

  it("journal sans donnée personnelle", async () => {
    const db = closedDb(false)
    await reopen(db)
    const call = infoSpy.mock.calls.find((c) => c[0] === "[account-closure]")
    expect(auditHasNoPersonalData(JSON.parse(call[1]))).toBe(true)
    expect(loggedText()).not.toContain(EMAIL)
    expect(db.service.auth.admin.deleteUser).not.toHaveBeenCalled()
  })
})
