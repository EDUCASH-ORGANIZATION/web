import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))

import { sendEmail } from "@/lib/email"
import { closeAccountCore, reopenAccountCore } from "@/lib/actions/account-closure-core"
import { pseudonymizeClosedAccounts } from "@/lib/actions/account-closure-pseudonymize"
import { ACCOUNT_BATCH, ACCOUNT_BREAKER, CLOSED_ACCOUNT_LABEL, CLOSURE_GRACE_DAYS } from "@/lib/account-closure/closure-rules"

// QA RD-CLOSE-01 : cas limites croises entre le coeur de fermeture et la pseudonymisation, sur un faux client
// partage (vrai module auth : aucune moquerie de l'adaptateur, on observe updateUserById).

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-11-20T12:00:00.000Z")
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ADMIN = uid(900)
const iso = (ms) => new Date(ms).toISOString()

const WRITE_OPS = new Set(["update", "insert", "delete"])

function makeDb(seed = {}, { jitter = null } = {}) {
  const tables = {
    profiles: [],
    student_profiles: [],
    wallets: [],
    missions: [],
    purchase_requests: [],
    reports: [],
    transactions: [],
    wallet_transactions: [],
    notifications: [],
    applications: [],
    account_closure_events: [],
    ...structuredClone(seed),
  }
  const writes = []
  const authCalls = []
  const removed = []
  const faults = new Map()
  let clock = 0

  const matchOr = (text) => {
    const parts = text.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".")
      let val = rest.join(".")
      if (val.startsWith('"')) val = JSON.parse(val)
      return (r) => {
        if (op === "eq") return r[col] === val
        if (op === "neq") return r[col] !== null && r[col] !== undefined && r[col] !== val
        if (op === "is") return r[col] === null || r[col] === undefined
        throw new Error(`or non gere : ${op}`)
      }
    })
    return (r) => parts.some((f) => f(r))
  }
  const nul = (v) => v === null || v === undefined

  function from(table) {
    const st = { op: "select", filters: [], payload: null, head: false, count: null, limit: null, order: null, sel: false, single: false }
    const q = {
      select(_c, o = {}) {
        if (st.op === "select") {
          st.head = o.head === true
          st.count = o.count ?? null
        } else st.sel = true
        return q
      },
      update: (p) => ((st.op = "update"), (st.payload = p), q),
      insert: (p) => ((st.op = "insert"), (st.payload = p), q),
      delete: () => ((st.op = "delete"), q),
      eq: (c, v) => (st.filters.push((r) => r[c] === v), q),
      neq: (c, v) => (st.filters.push((r) => r[c] !== v), q),
      in: (c, vs) => (st.filters.push((r) => vs.includes(r[c])), q),
      is: (c, v) => (st.filters.push((r) => (v === null ? nul(r[c]) : r[c] === v)), q),
      not: (c, _o, v) => (st.filters.push((r) => !(v === null ? nul(r[c]) : r[c] === v)), q),
      gte: (c, v) => (st.filters.push((r) => !nul(r[c]) && r[c] >= v), q),
      lte: (c, v) => (st.filters.push((r) => !nul(r[c]) && new Date(r[c]) <= new Date(v)), q),
      or: (t) => (st.filters.push(matchOr(t)), q),
      order: (c, o) => ((st.order = { c, asc: o?.ascending !== false }), q),
      limit: (n) => ((st.limit = n), q),
      maybeSingle: () => ((st.single = true), q),
      then(res, rej) {
        return (async () => {
          if (jitter) for (let i = jitter(); i > 0; i--) await Promise.resolve()
          return run()
        })().then(res, rej)
      },
    }
    function run() {
      const fault = faults.get(`${table}.${st.op}`)
      if (WRITE_OPS.has(st.op)) writes.push({ table, op: st.op, payload: st.payload })
      if (fault) return { data: null, count: null, error: fault }
      const rows = tables[table]
      if (!rows) return { data: null, count: null, error: { code: "42P01" } }
      if (st.op === "insert") {
        if (table === "account_closure_events" && rows.some((r) => r.user_id === st.payload.user_id && r.event === "pseudonymized" && st.payload.event === "pseudonymized")) {
          return { data: null, error: { code: "23505" } }
        }
        rows.push({ ...st.payload, created_at: iso(NOW.getTime() + clock++) })
        return { data: null, error: null }
      }
      const matched = rows.filter((r) => st.filters.every((f) => f(r)))
      if (st.op === "update") {
        for (const r of matched) Object.assign(r, st.payload)
        return { data: st.sel ? matched.map((r) => ({ user_id: r.user_id })) : null, error: null }
      }
      if (st.op === "delete") {
        tables[table] = rows.filter((r) => !matched.includes(r))
        return { data: null, error: null }
      }
      let data = matched
      if (st.order) {
        const { c, asc } = st.order
        data = [...data].sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (asc ? 1 : -1))
      }
      const total = data.length
      if (st.limit !== null) data = data.slice(0, st.limit)
      if (st.head) return { data: null, count: total, error: null }
      const out = data.map((r) => ({ ...r }))
      return { data: st.single ? (out[0] ?? null) : out, count: st.count ? total : null, error: null }
    }
    return q
  }

  const service = {
    from,
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: { email: "x@example.com", banned_until: "2999-01-01T00:00:00Z" } }, error: null })),
        updateUserById: vi.fn(async (id, attrs) => {
          authCalls.push({ id, attrs })
          return { data: {}, error: null }
        }),
        deleteUser: vi.fn(),
      },
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          removed.push(...paths.map((p) => `${bucket}/${p}`))
          return { data: paths.map((name) => ({ name })), error: null }
        },
      }),
    },
  }
  return { service, tables, writes, authCalls, removed, faults }
}

function closedProfile(n, daysAgo, extra = {}) {
  return {
    user_id: uid(n),
    role: "student",
    full_name: `Nom ${n}`,
    avatar_url: `${uid(n)}/a.png`,
    bio: "bio",
    phone: "0100",
    is_suspended: true,
    closure_prev_suspended: false,
    closed_at: iso(NOW.getTime() - daysAgo * DAY),
    pseudonymized_at: null,
    ...extra,
  }
}

const unbanCalls = (db) => db.authCalls.filter((c) => c.attrs?.ban_duration === "none")
const pseudoCalls = (db) => db.authCalls.filter((c) => typeof c.attrs?.email === "string")

let spies
beforeEach(() => {
  vi.clearAllMocks()
  sendEmail.mockResolvedValue({ success: true })
  spies = ["error", "info", "log"].map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
})
afterEach(() => spies.forEach((s) => s.mockRestore()))

describe("course reactivation / pseudonymisation : un seul gagnant, jamais d'etat mixte", () => {
  const seed = () => ({
    profiles: [closedProfile(1, CLOSURE_GRACE_DAYS + 3)],
    student_profiles: [{ user_id: uid(1), school: "S", card_url: `${uid(1)}/c.jpg`, skills: ["x"] }],
    notifications: [{ recipient_id: uid(1) }],
    account_closure_events: [{ user_id: uid(1), event: "closed", created_at: "2026-11-01T00:00:00.000Z" }],
  })

  // Entrelacements pseudo-aleatoires (graine fixe) des requetes des deux acteurs.
  function lcg(seedValue) {
    let s = seedValue
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s % 6
    }
  }

  it.each(Array.from({ length: 60 }, (_, i) => i + 1))("entrelacement %i", async (n) => {
    const db = makeDb(seed(), { jitter: lcg(n * 7919) })
    const cron = pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    const reopen = reopenAccountCore(db.service, {
      userId: uid(1),
      actor: { kind: "admin", id: ADMIN },
      reasonCode: "user_request",
      now: NOW,
    })
    const [cronResult, reopenResult] = await Promise.all([cron, reopen])
    const row = db.tables.profiles[0]
    const reopenWon = reopenResult.success === true
    const cronWon = cronResult.categories.closed_accounts.supprimes === 1

    // Exclusion mutuelle stricte.
    expect(reopenWon && cronWon).toBe(false)
    expect(reopenWon || cronWon).toBe(true)

    if (reopenWon) {
      expect(row.closed_at).toBeNull()
      expect(row.pseudonymized_at).toBeNull()
      expect(row.full_name).toBe("Nom 1")
      expect(row.avatar_url).toBe(`${uid(1)}/a.png`)
      expect(row.is_suspended).toBe(false)
      expect(db.tables.notifications).toHaveLength(1)
      expect(pseudoCalls(db)).toEqual([])
      expect(db.removed).toEqual([])
      expect(db.tables.account_closure_events.filter((e) => e.event === "pseudonymized")).toEqual([])
    } else {
      expect(reopenResult).toMatchObject({ code: "PSEUDONYMIZED" })
      expect(row.full_name).toBe(CLOSED_ACCOUNT_LABEL)
      expect(row.pseudonymized_at).not.toBeNull()
      expect(row.closed_at).not.toBeNull()
      expect(unbanCalls(db)).toEqual([])
      expect(db.tables.account_closure_events.filter((e) => e.event === "reopened")).toEqual([])
      expect(db.tables.account_closure_events.filter((e) => e.event === "pseudonymized")).toHaveLength(1)
    }
    expect(db.service.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("apres le gagnant cron, un second passage du cron et une reactivation restent sans effet", async () => {
    const db = makeDb(seed())
    await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    const before = structuredClone(db.tables.profiles)
    const writesBefore = db.writes.length
    const again = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(again.categories.closed_accounts).toMatchObject({ candidats: 0, supprimes: 0 })
    const r = await reopenAccountCore(db.service, { userId: uid(1), actor: { kind: "admin", id: ADMIN }, reasonCode: "user_request", now: NOW })
    expect(r.code).toBe("PSEUDONYMIZED")
    expect(db.tables.profiles).toEqual(before)
    expect(db.writes.length).toBe(writesBefore)
  })

  it("reactivation interrompue (profil remis actif, bannissement reste) : le coeur reprend, puis le cron ne touche plus le compte", async () => {
    const db = makeDb(seed())
    Object.assign(db.tables.profiles[0], { closed_at: null, is_suspended: false, closure_prev_suspended: null })
    const r = await reopenAccountCore(db.service, { userId: uid(1), actor: { kind: "admin", id: ADMIN }, reasonCode: "user_request", now: NOW })
    expect(r).toMatchObject({ success: true, alreadyActive: true })
    expect(unbanCalls(db)).toHaveLength(1)
    const cron = await pseudonymizeClosedAccounts(db.service, { now: new Date(NOW.getTime() + 60 * DAY), mode: "real" })
    expect(cron.categories.closed_accounts).toMatchObject({ candidats: 0, supprimes: 0 })
  })
})

describe("mode dry : aucune ecriture, aucun appel auth ni Storage", () => {
  it("meme avec coupe-circuit declenche, reprises en cours et blocages", async () => {
    const profiles = []
    for (let i = 1; i <= ACCOUNT_BATCH + 5; i++) profiles.push(closedProfile(i, 30))
    profiles.push(closedProfile(500, 30, { pseudonymized_at: iso(NOW.getTime() - DAY) }))
    const db = makeDb({
      profiles,
      wallets: [{ user_id: uid(1), balance: 100, reserved: 0 }],
      notifications: [{ recipient_id: uid(2) }],
      applications: [{ student_id: uid(2), status: "pending" }],
      student_profiles: [{ user_id: uid(2), card_url: `${uid(2)}/c.jpg`, skills: ["a"] }],
    })
    const snapshot = structuredClone(db.tables)
    for (const mode of ["dry", undefined, "", "DRY", "reel", null]) {
      const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode, allowMass: mode === "dry" ? true : undefined })
      expect(r.categories.closed_accounts.supprimes).toBe(0)
    }
    expect(db.writes).toEqual([])
    expect(db.authCalls).toEqual([])
    expect(db.removed).toEqual([])
    expect(db.tables).toEqual(snapshot)
  })

  it("seul le mode exactement real ecrit", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "Real" })
    await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: true })
    expect(db.writes).toEqual([])
  })

  it("coupe-circuit : plus de ACCOUNT_BREAKER nouveaux candidats, aucune revendication en reel", async () => {
    const profiles = Array.from({ length: ACCOUNT_BREAKER + 1 }, (_, i) => closedProfile(i + 1, 30))
    const db = makeDb({ profiles })
    const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(r.stops).toContain("breaker")
    expect(db.writes).toEqual([])
    expect(db.tables.profiles.every((p) => p.pseudonymized_at === null)).toBe(true)
  })
})

describe("fermeture : admin et soi-meme refuses", () => {
  const profile = (extra = {}) => ({
    user_id: uid(1),
    role: "client",
    full_name: "N",
    is_suspended: false,
    closed_at: null,
    pseudonymized_at: null,
    closure_prev_suspended: null,
    ...extra,
  })
  const base = (extra) => ({ profiles: [profile(extra)], wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }], account_closure_events: [] })
  const run = (db, actor) => closeAccountCore(db.service, { userId: uid(1), actor, reasonCode: "admin_decision", now: NOW })

  it("cible admin : refus ROLE_ADMIN sans ecriture", async () => {
    const db = makeDb(base({ role: "admin" }))
    expect(await run(db, { kind: "admin", id: ADMIN })).toEqual({ blocked: ["ROLE_ADMIN"] })
    expect(db.writes).toEqual([])
    expect(db.authCalls).toEqual([])
  })

  it("acteur admin visant son propre identifiant, casse differente : refus sans ecriture", async () => {
    const db = makeDb(base())
    const r = await run(db, { kind: "admin", id: uid(1).toUpperCase() })
    expect(r.blocked).toContain("ROLE_ADMIN")
    expect(db.writes).toEqual([])
  })

  it("acteur self sur un compte admin : refus", async () => {
    const db = makeDb(base({ role: "admin" }))
    expect(await run(db, { kind: "self" })).toEqual({ blocked: ["ROLE_ADMIN"] })
    expect(db.writes).toEqual([])
  })

  it("acteurs invalides (admin sans id, self avec id, system, absent) : erreur sans ecriture", async () => {
    for (const actor of [{ kind: "admin" }, { kind: "admin", id: "pas-un-uuid" }, { kind: "self", id: ADMIN }, { kind: "system" }, undefined, null]) {
      const db = makeDb(base())
      const r = await run(db, actor)
      expect(r.error).toBeTruthy()
      expect(db.writes).toEqual([])
    }
  })

  it("profil devenu admin entre la lecture et le verrou : jamais ferme", async () => {
    const db = makeDb(base())
    // Un admin ferme : le verrou exclut role admin meme si la lecture initiale disait client.
    db.tables.profiles[0].role = "admin"
    const r = await run(db, { kind: "admin", id: ADMIN })
    expect(db.tables.profiles[0].closed_at).toBeNull()
    expect(r.blocked ?? r.error).toBeTruthy()
  })
})

describe("fermeture : toute lecture douteuse refuse (fail-closed)", () => {
  const seed = () => ({
    profiles: [{ user_id: uid(1), role: "client", full_name: "N", is_suspended: false, closed_at: null, pseudonymized_at: null }],
    wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }],
    account_closure_events: [],
  })
  const run = (db) => closeAccountCore(db.service, { userId: uid(1), actor: { kind: "admin", id: ADMIN }, reasonCode: "admin_decision", now: NOW })

  it.each(["missions", "wallets", "reports", "purchase_requests", "transactions", "wallet_transactions"])(
    "erreur de lecture de %s : READ_ERROR, aucune ecriture",
    async (table) => {
      const db = makeDb(seed())
      db.faults.set(`${table}.select`, { code: "XX000" })
      expect(await run(db)).toEqual({ blocked: ["READ_ERROR"] })
      expect(db.writes).toEqual([])
      expect(db.authCalls).toEqual([])
    },
  )

  it("solde non numerique ou ligne de portefeuille illisible : ne ferme pas un compte avec un solde inconnu", async () => {
    for (const row of [{ user_id: uid(1), balance: 100, reserved: 0 }, { user_id: uid(1), balance: 0, reserved: 1 }, { user_id: uid(1), balance: -5, reserved: 0 }]) {
      const db = makeDb({ ...seed(), wallets: [row] })
      expect(await run(db)).toEqual({ blocked: ["WALLET_NOT_EMPTY"] })
      expect(db.writes).toEqual([])
    }
  })

  it("is_suspended illisible (non booleen) : READ_ERROR sans ecriture", async () => {
    const s = seed()
    s.profiles[0].is_suspended = null
    const db = makeDb(s)
    expect(await run(db)).toEqual({ blocked: ["READ_ERROR"] })
    expect(db.writes).toEqual([])
  })
})

describe("pseudonymisation : blocages en erreur de lecture", () => {
  const seed = () => ({ profiles: [closedProfile(1, 20)], wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }] })

  it.each(["wallets", "purchase_requests", "reports", "transactions"])("erreur de lecture de %s : compte reporte, rien d'ecrit ni efface", async (table) => {
    const db = makeDb(seed())
    db.faults.set(`${table}.select`, { code: "XX000" })
    const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(r.categories.closed_accounts).toMatchObject({ ignores: 1, supprimes: 0 })
    expect(db.writes).toEqual([])
    expect(db.authCalls).toEqual([])
    expect(db.tables.profiles[0].pseudonymized_at).toBeNull()
  })

  it("plusieurs lignes de portefeuille pour un meme compte : lecture douteuse, report", async () => {
    const db = makeDb({ ...seed(), wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }, { user_id: uid(1), balance: 0, reserved: 0 }] })
    const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(r.categories.closed_accounts).toMatchObject({ ignores: 1, supprimes: 0 })
    expect(db.writes).toEqual([])
  })

  it("un signalement depose pendant le delai reporte, puis le compte part une fois le signalement clos", async () => {
    const db = makeDb({ ...seed(), reports: [{ reported_user_id: uid(1), reporter_id: uid(2), status: "open" }] })
    const first = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(first.categories.closed_accounts).toMatchObject({ ignores: 1, supprimes: 0 })
    expect(db.writes).toEqual([])
    db.tables.reports[0].status = "resolved"
    const second = await pseudonymizeClosedAccounts(db.service, { now: new Date(NOW.getTime() + DAY), mode: "real" })
    expect(second.categories.closed_accounts).toMatchObject({ supprimes: 1, ignores: 0 })
  })

  it("lecture des candidats en erreur : aucune ecriture", async () => {
    const db = makeDb(seed())
    db.faults.set("profiles.select", { code: "XX000" })
    const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(r.categories.closed_accounts.erreurs).toBeGreaterThan(0)
    expect(db.writes).toEqual([])
  })
})

describe("reprise apres interruption a chaque ecriture (cycle complet via le vrai module auth)", () => {
  const faultKeys = ["notifications.delete", "applications.delete", "student_profiles.update", "account_closure_events.insert"]
  it.each(faultKeys)("echec a %s puis reprise le lendemain : etat final conforme, une adresse pseudonyme, jamais deleteUser", async (key) => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      student_profiles: [{ user_id: uid(1), school: "S", card_url: `${uid(1)}/c.jpg`, skills: ["x"] }],
      notifications: [{ recipient_id: uid(1) }],
      applications: [{ student_id: uid(1), status: "pending" }, { student_id: uid(1), status: "accepted" }],
      wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }],
    })
    db.faults.set(key, { code: "XX000" })
    await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "real" })
    expect(db.tables.profiles[0].full_name).not.toBe(CLOSED_ACCOUNT_LABEL)
    db.faults.delete(key)
    await pseudonymizeClosedAccounts(db.service, { now: new Date(NOW.getTime() + DAY), mode: "real" })
    expect(db.tables.profiles[0].full_name).toBe(CLOSED_ACCOUNT_LABEL)
    expect(db.tables.applications).toEqual([{ student_id: uid(1), status: "accepted" }])
    expect(db.tables.account_closure_events.filter((e) => e.event === "pseudonymized")).toHaveLength(1)
    expect(db.tables.wallets).toHaveLength(1)
    expect(pseudoCalls(db).every((c) => c.attrs.email === `${uid(1)}@comptes-clotures.invalid`)).toBe(true)
    expect(db.service.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(db.writes.filter((w) => w.op === "delete").every((w) => ["notifications", "applications"].includes(w.table))).toBe(true)
  })
})
