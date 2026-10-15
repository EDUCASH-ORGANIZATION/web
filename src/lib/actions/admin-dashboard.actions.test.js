import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { buildQueue, heroItem, nextItems, totalToHandle } from "@/lib/admin-space/dashboard-queue"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const state = {
  user: null,
  sessionProfile: null,
  tables: {},
  failing: new Set(),
  queries: [],
}
const createServiceClient = vi.fn(() => makeService())

function project(row, cols) {
  if (!cols || cols === "*") return { ...row }
  const out = {}
  for (const c of cols.split(",").map((s) => s.trim())) out[c] = row[c]
  return out
}

// Faux client service en mémoire : filtres, tri, pagination par range, comptage exact (head).
function makeService() {
  return {
    from(table) {
      const rows = state.tables[table] ?? []
      const q = { table, cols: null, head: false, filters: [], order: null, range: null, limit: null }
      state.queries.push(q)
      const cmp = (c, v, test) => q.filters.push((r) => r[c] != null && test(String(r[c]), String(v)))
      const b = {
        select(cols, opts) {
          q.cols = cols
          q.head = Boolean(opts?.head)
          return b
        },
        eq(c, v) {
          q.filters.push((r) => r[c] === v)
          return b
        },
        is(c, v) {
          q.filters.push((r) => (v === null ? r[c] == null : r[c] === v))
          return b
        },
        not(c, op, v) {
          q.filters.push((r) => !(v === null ? r[c] == null : r[c] === v))
          return b
        },
        in(c, list) {
          q.filters.push((r) => list.includes(r[c]))
          return b
        },
        gte(c, v) {
          cmp(c, v, (a, x) => new Date(a) >= new Date(x))
          return b
        },
        lt(c, v) {
          cmp(c, v, (a, x) => new Date(a) < new Date(x))
          return b
        },
        order(c, o) {
          q.order = [c, o?.ascending !== false]
          return b
        },
        range(from, to) {
          q.range = [from, to]
          return b
        },
        limit(n) {
          q.limit = n
          return b
        },
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      }
      function run() {
        if (state.failing.has(table)) return { data: null, count: null, error: { message: "boom secret" } }
        let hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.head) return { data: null, count: hit.length, error: null }
        if (q.order) {
          const [c, asc] = q.order
          hit = [...hit].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1))
        }
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        if (q.limit != null) hit = hit.slice(0, q.limit)
        return { data: hit.map((r) => project(r, q.cols)), count: null, error: null }
      }
      return b
    },
  }
}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
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

const NOW = new Date("2026-10-15T10:00:00Z")

function student(n, over = {}) {
  return {
    user_id: uid(n),
    role: "student",
    full_name: `Etudiant ${n}`,
    is_verified: false,
    verified_until: null,
    rejection_reason: null,
    verification_submitted_at: "2026-10-10T09:00:00+00:00",
    created_at: "2026-10-01T08:00:00+00:00",
    phone: "+22997000000",
    fcm_token: "token-secret",
    ...over,
  }
}

function seedQuietPlatform() {
  state.tables = {
    wallets: [{ id: 1, user_id: uid(1), balance: 5000, reserved: 1000 }],
    wallet_transactions: [],
    profiles: [{ user_id: uid(1), role: "client", full_name: "Client Un", created_at: "2026-10-14T00:00:00+00:00" }],
    student_profiles: [],
    missions: [],
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  state.user = { id: ADMIN_ID, user_metadata: { role: "admin" } }
  state.sessionProfile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  state.tables = {}
  state.failing = new Set()
  state.queries = []
  createServiceClient.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("contrôle admin", () => {
  it.each([
    ["profil student avec metadata admin", { role: "student", is_suspended: false }],
    ["profil client", { role: "client", is_suspended: false }],
    ["administrateur suspendu", { role: "admin", is_suspended: true }],
    ["profil introuvable", null],
  ])("refuse sans lecture : %s", async (_n, profile) => {
    state.sessionProfile = profile
    const res = await getAdminDashboard()
    expect(res.error).toMatch(/droits/)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
  })

  it("refuse un visiteur sans lecture", async () => {
    state.user = null
    expect((await getAdminDashboard()).error).toBeTruthy()
    expect(state.queries).toHaveLength(0)
  })
})

describe("getAdminDashboard", () => {
  it("totaux justes avec 2 500 portefeuilles (pagination au-delà de 1000 lignes)", async () => {
    seedQuietPlatform()
    state.tables.wallets = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, user_id: uid(10000 + i), balance: 1000, reserved: 200 }))
    state.tables.wallets[2499].balance = -500 // dernier portefeuille, au-delà de la 2e page
    state.tables.wallets[1999].reserved = 5000 // réservé supérieur au solde, 2e page
    const res = await getAdminDashboard()
    expect(res.escrow).toMatchObject({ ok: true, total: 2498 * 200 + 5000 + 200 })
    expect(res.alerts.ok).toBe(true)
    expect(res.alerts.total).toBe(2)
    expect(res.alerts.items.map((a) => [a.userId, a.reason])).toEqual([
      [uid(10000 + 2499), "negative-balance"],
      [uid(10000 + 1999), "reserved-over-balance"],
    ])
  })

  it("commissions du mois depuis wallet_transactions (type commission), jamais depuis transactions", async () => {
    seedQuietPlatform()
    state.tables.wallet_transactions = [
      { id: 1, user_id: uid(1), type: "commission", amount: 120, created_at: "2026-10-03T10:00:00+00:00" },
      { id: 2, user_id: uid(1), type: "commission", amount: 300, created_at: "2026-10-14T10:00:00+00:00" },
      { id: 3, user_id: uid(1), type: "commission", amount: 999, created_at: "2026-09-30T22:30:00+00:00" }, // 30 sept 23h30 au Bénin
      { id: 4, user_id: uid(1), type: "release", amount: 5000, created_at: "2026-10-05T10:00:00+00:00" },
      { id: 5, user_id: uid(1), type: "commission", amount: 40, created_at: "2026-09-30T23:30:00+00:00" }, // 1er oct 00h30 au Bénin
    ]
    state.tables.transactions = [{ id: 1, commission: 777, status: "paid", created_at: "2026-10-04T00:00:00+00:00" }]
    const res = await getAdminDashboard()
    expect(res.commissions).toEqual({ ok: true, month: "2026-10", total: 120 + 300 + 40 })
    expect(state.queries.some((q) => q.table === "transactions")).toBe(false)
  })

  it("somme les commissions au-delà de 1000 lignes", async () => {
    seedQuietPlatform()
    state.tables.wallet_transactions = Array.from({ length: 2300 }, (_, i) => ({
      id: i + 1,
      user_id: uid(1),
      type: "commission",
      amount: 10,
      created_at: "2026-10-05T10:00:00+00:00",
    }))
    expect((await getAdminDashboard()).commissions.total).toBe(23000)
  })

  it("alerte « retrait débité sans virement créé » : sans fedapay_id et de plus de 24 h seulement", async () => {
    seedQuietPlatform()
    state.tables.wallet_transactions = [
      { id: "w1", user_id: uid(1), type: "withdrawal", amount: -5000, fedapay_id: null, created_at: "2026-10-13T10:00:00+00:00" },
      { id: "w2", user_id: uid(1), type: "withdrawal", amount: -2000, fedapay_id: null, created_at: "2026-10-15T09:00:00+00:00" }, // récent
      { id: "w3", user_id: uid(1), type: "withdrawal", amount: -3000, fedapay_id: "po_1", created_at: "2026-10-01T10:00:00+00:00" }, // virement créé
      { id: "w4", user_id: uid(1), type: "deposit", amount: 1000, fedapay_id: null, created_at: "2026-10-01T10:00:00+00:00" },
    ]
    const res = await getAdminDashboard()
    expect(res.withdrawals).toEqual({
      ok: true,
      total: 1,
      items: [{ id: "w1", userId: uid(1), name: "Client Un", amount: 5000, createdAt: "2026-10-13T10:00:00+00:00" }],
    })
  })

  it("dossiers à examiner : total exact, 10 plus anciens, mêmes règles que le compteur de la coquille", async () => {
    seedQuietPlatform()
    const profiles = []
    const cards = []
    for (let n = 1; n <= 14; n++) {
      profiles.push(student(n, { verification_submitted_at: `2026-10-${String(n).padStart(2, "0")}T09:00:00+00:00` }))
      cards.push({ user_id: uid(n), card_url: `${uid(n)}/c.jpg` })
    }
    profiles.push(student(20, { is_verified: true, verified_until: "2027-01-01" })) // vérifié
    profiles.push(student(21, { rejection_reason: "Photo floue ou illisible" })) // refusé
    profiles.push(student(22, { role: "client" })) // pas un étudiant
    profiles.push(student(23)) // sans carte
    for (const n of [20, 21, 22]) cards.push({ user_id: uid(n), card_url: `${uid(n)}/c.jpg` })
    state.tables.profiles = [...state.tables.profiles, ...profiles]
    state.tables.student_profiles = cards
    const res = await getAdminDashboard()
    expect(res.dossiers.ok).toBe(true)
    expect(res.dossiers.total).toBe(14)
    expect(res.dossiers.dossiers).toHaveLength(10)
    expect(res.dossiers.dossiers.map((d) => d.userId)).toEqual(Array.from({ length: 10 }, (_, i) => uid(i + 1)))
    expect(Object.keys(res.dossiers.dossiers[0]).sort()).toEqual(["createdAt", "name", "submittedAt", "userId"])
    expect(JSON.stringify(res)).not.toMatch(/phone|fcm|token-secret|c\.jpg|@/)
  })

  it("badge échu : à examiner seulement si la carte a été déposée depuis la dernière validation", async () => {
    seedQuietPlatform()
    state.tables.profiles = [
      student(1, { verified_until: "2026-09-01", verification_submitted_at: "2026-10-05T09:00:00+00:00" }), // renvoyée : à examiner
      student(2, { verified_until: "2026-09-01", verification_submitted_at: "2025-08-20T09:00:00+00:00" }), // pas renvoyée : expiré
    ]
    state.tables.student_profiles = [
      { user_id: uid(1), card_url: `${uid(1)}/c.jpg` },
      { user_id: uid(2), card_url: `${uid(2)}/c.jpg` },
    ]
    const res = await getAdminDashboard()
    expect(res.dossiers.dossiers.map((d) => d.userId)).toEqual([uid(1)])
    expect(res.dossiers.total).toBe(1)
  })

  it("séquestre, missions financées et missions publiées sur 7 jours", async () => {
    seedQuietPlatform()
    state.tables.missions = [
      { id: "m1", status: "open", created_at: "2026-10-14T10:00:00+00:00", selected_student_id: null },
      { id: "m2", status: "in_progress", created_at: "2026-10-12T10:00:00+00:00", selected_student_id: uid(5) },
      { id: "m3", status: "done", created_at: "2026-10-10T10:00:00+00:00", selected_student_id: uid(5) },
      { id: "m4", status: "open", created_at: "2026-09-01T10:00:00+00:00", selected_student_id: null },
      { id: "m5", status: "cancelled", created_at: "2026-10-13T10:00:00+00:00", selected_student_id: null },
    ]
    const res = await getAdminDashboard()
    expect(res.escrow).toEqual({ ok: true, total: 1000, fundedMissions: 3 })
    expect(res.missions).toEqual({ ok: true, published: 4, filled: 2 })
  })

  it("un bloc en erreur n'empêche pas les autres, sans détail technique", async () => {
    seedQuietPlatform()
    state.tables.wallet_transactions = [
      { id: 1, user_id: uid(1), type: "commission", amount: 50, created_at: "2026-10-03T10:00:00+00:00" },
    ]
    state.failing.add("wallets")
    const res = await getAdminDashboard()
    expect(res.error).toBeUndefined()
    expect(res.alerts).toEqual({ ok: false })
    expect(res.escrow).toEqual({ ok: false })
    expect(res.commissions).toMatchObject({ ok: true, total: 50 })
    expect(res.withdrawals.ok).toBe(true)
    expect(res.dossiers.ok).toBe(true)
    expect(res.missions.ok).toBe(true)
    expect(JSON.stringify(res)).not.toMatch(/boom|secret/)
    expect(console.error).toHaveBeenCalled()
  })

  it("tous les blocs en erreur : l'écran reçoit des blocs { ok: false }, pas d'exception", async () => {
    seedQuietPlatform()
    for (const t of ["wallets", "wallet_transactions", "profiles", "student_profiles", "missions"]) state.failing.add(t)
    const res = await getAdminDashboard()
    for (const key of ["alerts", "withdrawals", "dossiers", "escrow", "commissions", "missions"]) {
      expect(res[key]).toEqual({ ok: false })
    }
    expect(res.recent).toBeNull()
  })

  it("derniers inscrits lus seulement quand la file est vide", async () => {
    seedQuietPlatform()
    state.tables.profiles = [
      { user_id: uid(1), role: "client", full_name: "A", created_at: "2026-10-01T00:00:00+00:00", phone: "+22997000000" },
      { user_id: uid(2), role: "student", full_name: "B", created_at: "2026-10-02T00:00:00+00:00" },
      { user_id: uid(3), role: "admin", full_name: "Admin", created_at: "2026-10-14T00:00:00+00:00" },
      { user_id: uid(4), role: "client", full_name: "C", created_at: "2026-10-03T00:00:00+00:00" },
      { user_id: uid(5), role: "client", full_name: "D", created_at: "2026-10-04T00:00:00+00:00" },
      { user_id: uid(6), role: "client", full_name: "E", created_at: "2026-10-05T00:00:00+00:00" },
      { user_id: uid(7), role: "client", full_name: "F", created_at: "2026-10-06T00:00:00+00:00" },
    ]
    const empty = await getAdminDashboard()
    expect(empty.recent.ok).toBe(true)
    expect(empty.recent.users.map((u) => u.name)).toEqual(["F", "E", "D", "C", "B"])
    expect(JSON.stringify(empty.recent)).not.toMatch(/phone|\+229/)

    state.tables.wallets = [{ id: 1, user_id: uid(1), balance: -10, reserved: 0 }]
    expect((await getAdminDashboard()).recent).toBeNull()
  })

  it("ne lit jamais select('*') ni de colonne de contact", async () => {
    seedQuietPlatform()
    await getAdminDashboard()
    for (const q of state.queries) {
      expect(q.cols).toBeTruthy()
      expect(q.cols).not.toContain("*")
      expect(q.cols).not.toMatch(/phone|fcm_token|card_url|email/)
    }
  })

  it("renvoie l'heure et le jour du Bénin", async () => {
    seedQuietPlatform()
    const res = await getAdminDashboard()
    expect(res.now).toBe(NOW.toISOString())
    expect(res.today).toBe("2026-10-15")
  })
})

describe("ordre de la file (décision D1) sur des données mêlées", () => {
  it("alertes d'argent, puis dossiers du plus ancien au plus récent, retraits bloqués entre eux", async () => {
    seedQuietPlatform()
    state.tables.wallets = [
      { id: 1, user_id: uid(1), balance: 100, reserved: 400 }, // réservé > solde
      { id: 2, user_id: uid(2), balance: -50, reserved: 0 }, // solde négatif
    ]
    state.tables.profiles = [
      { user_id: uid(1), role: "client", full_name: "Client Un" },
      { user_id: uid(2), role: "client", full_name: "Client Deux" },
      student(3, { verification_submitted_at: "2026-10-12T09:00:00+00:00" }),
      student(4, { verification_submitted_at: "2026-10-02T09:00:00+00:00" }),
    ]
    state.tables.student_profiles = [
      { user_id: uid(3), card_url: `${uid(3)}/c.jpg` },
      { user_id: uid(4), card_url: `${uid(4)}/c.jpg` },
    ]
    state.tables.wallet_transactions = [
      { id: "w1", user_id: uid(1), type: "withdrawal", amount: -5000, fedapay_id: null, created_at: "2026-10-10T10:00:00+00:00" },
    ]
    const res = await getAdminDashboard()
    const queue = buildQueue(
      { moneyAlerts: res.alerts.items, withdrawals: res.withdrawals.items, dossiers: res.dossiers.dossiers },
      new Date(res.now),
    )
    expect(queue.map((i) => i.key)).toEqual([
      `wallet:${uid(2)}`,
      `wallet:${uid(1)}`,
      "withdrawal:w1",
      `dossier:${uid(4)}`,
      `dossier:${uid(3)}`,
    ])
    expect(heroItem(queue)).toMatchObject({ kind: "money", reason: "negative-balance", name: "Client Deux" })
    expect(nextItems(queue, 2).map((i) => i.key)).toEqual([`wallet:${uid(1)}`, "withdrawal:w1"])
    expect(totalToHandle(queue)).toEqual({ total: 5, money: 3, dossiers: 2 })
  })
})
