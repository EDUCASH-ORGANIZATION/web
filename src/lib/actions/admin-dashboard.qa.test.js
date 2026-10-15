import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const state = { user: null, sessionProfile: null, tables: {}, queries: [] }

function makeService() {
  return {
    from(table) {
      const rows = state.tables[table] ?? []
      const q = { table, filters: [], order: null, range: null, limit: null, head: false }
      state.queries.push(q)
      const when = (c, v, t) => q.filters.push((r) => r[c] != null && t(Date.parse(r[c]), Date.parse(v)))
      const b = {
        select: (_c, o) => ((q.head = Boolean(o?.head)), b),
        eq: (c, v) => (q.filters.push((r) => r[c] === v), b),
        is: (c, v) => (q.filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
        not: (c, _o, v) => (q.filters.push((r) => !(v === null ? r[c] == null : r[c] === v)), b),
        in: (c, l) => (q.filters.push((r) => l.includes(r[c])), b),
        gte: (c, v) => (when(c, v, (a, x) => a >= x), b),
        lt: (c, v) => (when(c, v, (a, x) => a < x), b),
        order: (c, o) => ((q.order = [c, o?.ascending !== false]), b),
        range: (f, t) => ((q.range = [f, t]), b),
        limit: (n) => ((q.limit = n), b),
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      }
      function run() {
        let hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.head) return { data: null, count: hit.length, error: null }
        if (q.order) {
          const [c, asc] = q.order
          hit = [...hit].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1))
        }
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        if (q.limit != null) hit = hit.slice(0, q.limit)
        return { data: hit.map((r) => ({ ...r })), count: null, error: null }
      }
      return b
    },
  }
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => makeService() }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.sessionProfile }) }
      return chain
    },
  }),
}))

const { getAdminDashboard } = await import("./admin-dashboard.actions")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"))
  state.user = { id: ADMIN_ID, user_metadata: { role: "admin" } }
  state.sessionProfile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  state.queries = []
  state.tables = { wallets: [], wallet_transactions: [], profiles: [], student_profiles: [], missions: [] }
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("QA getAdminDashboard", () => {
  it("commissions du mois : 00:30 le 1er novembre au Bénin (23:30 UTC le 31 octobre) compte pour novembre", async () => {
    state.tables.wallet_transactions = [
      { id: 1, type: "commission", amount: 100, created_at: "2026-10-31T23:30:00Z" },
      { id: 2, type: "commission", amount: 40, created_at: "2026-10-31T22:59:00Z" },
      { id: 3, type: "deposit", amount: 9999, created_at: "2026-11-02T10:00:00Z" },
    ]
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z"))
    const d = await getAdminDashboard()
    expect(d.commissions).toMatchObject({ ok: true, month: "2026-11", total: 100 })
  })
  it("commissions : seul le type commission est sommé (ni dépôt ni remboursement)", async () => {
    state.tables.wallet_transactions = [
      { id: 1, type: "commission", amount: 10, created_at: "2026-10-05T10:00:00Z" },
      { id: 2, type: "refund", amount: 500, created_at: "2026-10-05T10:00:00Z" },
    ]
    expect((await getAdminDashboard()).commissions.total).toBe(10)
  })
  it("retrait : 23 h 59 pas listé, 24 h 01 listé, avec référence de paiement pas listé", async () => {
    const at = (h) => new Date(Date.parse("2026-10-15T10:00:00Z") - h * 3600e3).toISOString()
    state.tables.wallet_transactions = [
      { id: "a", type: "withdrawal", user_id: uid(1), amount: -5000, fedapay_id: null, created_at: at(23.98) },
      { id: "b", type: "withdrawal", user_id: uid(2), amount: -6000, fedapay_id: null, created_at: at(24.02) },
      { id: "c", type: "withdrawal", user_id: uid(3), amount: -7000, fedapay_id: "ref-1", created_at: at(100) },
    ]
    const d = await getAdminDashboard()
    expect(d.withdrawals.items.map((i) => i.id)).toEqual(["b"])
    expect(d.withdrawals.items[0].amount).toBe(6000)
  })
  it("LIMITE CONNUE : un retrait déjà recrédité (reverses_id) sans référence reste signalé comme bloqué", async () => {
    state.tables.wallet_transactions = [
      { id: "orig", type: "withdrawal", user_id: uid(1), amount: -5000, fedapay_id: null, created_at: "2026-10-01T10:00:00Z" },
      { id: "rev", type: "refund", user_id: uid(1), amount: 5000, reverses_id: "orig", fedapay_id: null, created_at: "2026-10-01T11:00:00Z" },
    ]
    const d = await getAdminDashboard()
    expect(d.withdrawals.items.map((i) => i.id)).toEqual(["orig"])
  })
  it("réponse sans téléphone, e-mail, jeton ni carte", async () => {
    state.tables.wallets = [{ user_id: uid(1), balance: -5, reserved: 0 }]
    state.tables.profiles = [{ user_id: uid(1), role: "client", full_name: "A", phone: "+22997000000", fcm_token: "tok", created_at: "2026-10-01T00:00:00Z" }]
    const text = JSON.stringify(await getAdminDashboard())
    expect(text).not.toMatch(/22997|"tok"|fcm|card_url|@/)
  })
  it("2 001 alertes : total exact, liste bornée à 50", async () => {
    state.tables.wallets = Array.from({ length: 2001 }, (_, i) => ({ user_id: uid(i + 1), balance: -(i + 1), reserved: 0 }))
    const d = await getAdminDashboard()
    expect(d.alerts.total).toBe(2001)
    expect(d.alerts.items).toHaveLength(50)
    expect(d.alerts.items[0].gap).toBe(2001)
  })
  it("refus non admin : aucune lecture", async () => {
    state.sessionProfile = { role: "client", full_name: "A", city: "Cotonou", is_suspended: false }
    expect(await getAdminDashboard()).toHaveProperty("error")
    expect(state.queries).toHaveLength(0)
  })
})
