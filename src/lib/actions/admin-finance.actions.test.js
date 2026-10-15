import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const NOW = new Date("2026-10-15T10:00:00Z")

const state = { user: null, sessionProfile: null, tables: {}, failing: new Set(), queries: [] }
const createServiceClient = vi.fn(() => makeService())

// Motif LIKE (avec échappements) vers expression régulière, insensible à la casse.
function likeToRegex(pattern) {
  let out = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "\\") out += (pattern[++i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    else if (c === "%") out += ".*"
    else if (c === "_") out += "."
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${out}$`, "i")
}

const read = (row, col) => (col.includes(".") ? col.split(".").reduce((o, k) => (o == null ? o : o[k]), row) : row[col])

// Faux client service en mémoire : filtres, tri, plages, comptage exact (head), jointure `profiles` portée par la ligne.
function makeService() {
  return {
    from(table) {
      const rows = state.tables[table] ?? []
      const q = { table, cols: null, head: false, filters: [], order: [], range: null }
      state.queries.push(q)
      const cmp = (c, v, test) => q.filters.push((r) => r[c] != null && test(new Date(r[c]), new Date(v)))
      const b = {
        select(cols, opts) {
          q.cols = cols
          q.head = Boolean(opts?.head)
          return b
        },
        eq: (c, v) => (q.filters.push((r) => r[c] === v), b),
        is: (c, v) => (q.filters.push((r) => (v === null ? r[c] == null : r[c] === v)), b),
        not: (c, _op, v) => (q.filters.push((r) => !(v === null ? r[c] == null : r[c] === v)), b),
        in: (c, list) => (q.filters.push((r) => list.includes(r[c])), b),
        gte: (c, v) => (cmp(c, v, (a, x) => a >= x), b),
        lt: (c, v) => (cmp(c, v, (a, x) => a < x), b),
        ilike: (c, pattern) => (q.filters.push((r) => likeToRegex(pattern).test(String(read(r, c) ?? ""))), b),
        order: (c, o) => (q.order.push([c, o?.ascending !== false]), b),
        range: (from, to) => ((q.range = [from, to]), b),
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      }
      function run() {
        if (state.failing.has(table)) return { data: null, count: null, error: { message: "boom secret" } }
        let hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.head) return { data: null, count: hit.length, error: null }
        for (const [c, asc] of [...q.order].reverse()) {
          hit = [...hit].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1))
        }
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        return { data: hit.map((r) => ({ ...r })), count: null, error: null }
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

const { listAdminTransactions, listAdminWithdrawals, getAdminWallets } = await import("./admin-finance.actions")

function tx(n, over = {}) {
  return {
    id: `t-${String(n).padStart(6, "0")}`,
    user_id: uid(1),
    type: "deposit",
    amount: 1000,
    balance_after: 1000,
    mission_id: null,
    note: null,
    fedapay_id: `REF-${n}`,
    reverses_id: null,
    created_at: "2026-10-10T09:00:00+00:00",
    ...over,
  }
}

function wallet(n, balance, reserved, over = {}) {
  return {
    id: n,
    user_id: uid(n),
    balance,
    reserved,
    profiles: { full_name: `Titulaire ${n}`, role: n % 2 ? "client" : "student", phone: "+22997000000" },
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  state.user = { id: ADMIN_ID, user_metadata: { role: "admin" } }
  state.sessionProfile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  state.tables = { profiles: [{ user_id: uid(1), full_name: "Client Un", phone: "+22997000000" }] }
  state.failing = new Set()
  state.queries = []
  createServiceClient.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const ACTIONS = [
  ["listAdminTransactions", () => listAdminTransactions({})],
  ["listAdminWithdrawals", () => listAdminWithdrawals({})],
  ["getAdminWallets", () => getAdminWallets({})],
]

describe("finances admin : refus avant toute lecture", () => {
  for (const [name, call] of ACTIONS) {
    it(`${name} : visiteur, client, étudiant avec metadata admin`, async () => {
      state.user = null
      expect(await call()).toHaveProperty("error")
      state.user = { id: uid(9), user_metadata: { role: "admin" } }
      for (const role of ["client", "student"]) {
        state.sessionProfile = { role, full_name: "X", is_suspended: false }
        expect(await call()).toHaveProperty("error")
      }
      expect(createServiceClient).not.toHaveBeenCalled()
      expect(state.queries).toHaveLength(0)
    })

    it(`${name} : admin suspendu`, async () => {
      state.sessionProfile = { role: "admin", full_name: "Admin", is_suspended: true }
      expect(await call()).toHaveProperty("error")
      expect(createServiceClient).not.toHaveBeenCalled()
    })
  }
})

describe("listAdminTransactions", () => {
  it("indicateurs sur toutes les lignes de la période (plus de 1000 lignes), commissions du grand livre", async () => {
    const deposits = Array.from({ length: 2300 }, (_, i) => tx(i + 1, { amount: 100 }))
    state.tables.wallet_transactions = [
      ...deposits,
      tx(5000, { type: "commission", amount: 120, fedapay_id: null }),
      tx(5001, { type: "commission", amount: 30, fedapay_id: null }),
      tx(5002, { type: "release", amount: 880, fedapay_id: null }),
      tx(5003, { type: "deposit", amount: 777, created_at: "2026-09-30T22:00:00+00:00" }),
    ]
    const result = await listAdminTransactions({ periode: "mois" })
    expect(result.stats.deposits).toMatchObject({ ok: true, total: 230000, count: 2300 })
    expect(result.stats.commissions).toMatchObject({ ok: true, total: 150 })
    expect(result.stats.released).toMatchObject({ ok: true, total: 880 })
    expect(state.queries.every((q) => q.table === "wallet_transactions" || q.table === "profiles")).toBe(true)
    expect(result.total).toBe(2303)
    expect(result.rows).toHaveLength(25)
    expect(result.pageSize).toBe(25)
  })

  it("période : 7 jours exclut un mouvement plus ancien, le mois est calculé au Bénin", async () => {
    state.tables.wallet_transactions = [
      tx(1, { created_at: "2026-10-14T10:00:00+00:00" }),
      tx(2, { created_at: "2026-10-01T10:00:00+00:00" }),
      tx(3, { created_at: "2026-09-30T23:30:00+00:00" }),
    ]
    expect((await listAdminTransactions({ periode: "7j" })).total).toBe(1)
    // 30 septembre 23:30 UTC = 1er octobre 00:30 au Bénin : dans le mois
    expect((await listAdminTransactions({ periode: "mois" })).total).toBe(3)
  })

  it("filtres hors listes ignorés, type valide appliqué, page hors limites ramenée à la dernière", async () => {
    state.tables.wallet_transactions = Array.from({ length: 30 }, (_, i) => tx(i + 1, { type: i < 3 ? "refund" : "deposit" }))
    const hostile = await listAdminTransactions({ type: "deposit' or 1=1", periode: "tout", page: "-4" })
    expect(hostile.type).toBe("")
    expect(hostile.periode).toBe("mois")
    expect(hostile.page).toBe(1)
    expect(hostile.total).toBe(30)
    const refunds = await listAdminTransactions({ type: "refund" })
    expect(refunds.total).toBe(3)
    expect(refunds.rows.every((r) => r.type === "refund")).toBe(true)
    const far = await listAdminTransactions({ page: "999" })
    expect(far.page).toBe(2)
    expect(far.rows).toHaveLength(5)
  })

  it("recherche par référence exacte ; saisie hostile : aucune ligne, aucune erreur", async () => {
    state.tables.wallet_transactions = [tx(1, { fedapay_id: "FDP-8K2M44" }), tx(2, { fedapay_id: "FDP-8K2M45" })]
    const found = await listAdminTransactions({ q: "FDP-8K2M44" })
    expect(found.rows.map((r) => r.reference)).toEqual(["FDP-8K2M44"])
    for (const q of ["%", "a,b)or=(id.eq.1", "' or 1=1 --", "x".repeat(500)]) {
      const result = await listAdminTransactions({ q })
      expect(result.error).toBeUndefined()
      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    }
  })

  it("montants négatifs en valeur absolue dans la liste, types inattendus conservés, décimaux", async () => {
    state.tables.wallet_transactions = [
      tx(1, { type: "withdrawal", amount: -2500, note: "Retrait MTN 0197000000" }),
      tx(2, { type: "adjustment", amount: "1500.5", balance_after: null }),
      tx(3, { type: "deposit", amount: null }),
    ]
    const { rows } = await listAdminTransactions({})
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId["t-000001"]).toMatchObject({ amount: 2500, operator: "MTN MoMo" })
    expect(byId["t-000002"]).toMatchObject({ type: "adjustment", amount: 1500.5, balanceAfter: null, operator: null })
    expect(byId["t-000003"].amount).toBe(0)
  })

  it("aucune donnée personnelle ni note brute dans la réponse ; jamais select(*)", async () => {
    state.tables.wallet_transactions = [tx(1, { type: "withdrawal", note: "Retrait MTN 0197000000", user_id: uid(1) })]
    const result = await listAdminTransactions({})
    const json = JSON.stringify(result)
    expect(json).not.toMatch(/0197000000|22997000000|phone|note/)
    expect(result.rows[0].name).toBe("Client Un")
    expect(state.queries.every((q) => q.cols !== "*" && !String(q.cols).includes("*"))).toBe(true)
  })

  it("erreur de lecture : message neutre sans détail technique", async () => {
    state.tables.wallet_transactions = [tx(1)]
    state.failing.add("profiles")
    const result = await listAdminTransactions({})
    expect(result.error).toMatch(/n'ont pas pu être chargés/)
    expect(JSON.stringify(result)).not.toMatch(/boom|secret/)
  })

  it("aucune écriture", async () => {
    state.tables.wallet_transactions = [tx(1)]
    await listAdminTransactions({})
    expect(state.queries.every((q) => ["profiles", "wallet_transactions"].includes(q.table))).toBe(true)
  })
})

describe("listAdminWithdrawals", () => {
  const H = 60 * 60 * 1000
  const ago = (hours) => new Date(NOW.getTime() - hours * H).toISOString()
  const wd = (n, over = {}) => tx(n, { type: "withdrawal", amount: 15000, fedapay_id: null, ...over })

  it("tête : débités sans référence (plus anciens d'abord), puis recrédités, puis virements créés récents", async () => {
    state.tables.wallet_transactions = [
      wd(1, { created_at: ago(30) }),
      wd(2, { created_at: ago(50) }),
      wd(3, { created_at: ago(2) }),
      wd(4, { created_at: ago(40) }),
      tx(5, { type: "refund", amount: 15000, fedapay_id: null, reverses_id: "t-000004" }),
      wd(6, { fedapay_id: "FDP-1", created_at: ago(100) }),
      wd(7, { fedapay_id: "FDP-2", created_at: ago(10) }),
    ]
    const result = await listAdminWithdrawals({})
    expect(result.rows.map((r) => [r.id, r.status])).toEqual([
      ["t-000002", "stuck"],
      ["t-000001", "stuck"],
      ["t-000003", "pending"],
      ["t-000004", "reversed"],
      ["t-000007", "created"],
      ["t-000006", "created"],
    ])
    expect(result.stats).toMatchObject({
      undebitedTransfer: { open: 3, stuck: 2, amount: 30000, oldestAt: ago(50) },
      reversed: 1,
      created: 2,
    })
    expect(result.total).toBe(6)
  })

  it("une ligne d'annulation n'est pas comptée comme une demande de retrait", async () => {
    state.tables.wallet_transactions = [wd(1, { created_at: ago(30) }), wd(2, { reverses_id: "t-000001", created_at: ago(29) })]
    const result = await listAdminWithdrawals({})
    expect(result.rows.map((r) => [r.id, r.status])).toEqual([["t-000001", "reversed"]])
  })

  it("pagination sur la jonction des deux parties, page hors limites ramenée à la dernière", async () => {
    const stuck = Array.from({ length: 20 }, (_, i) => wd(i + 1, { created_at: ago(30 + i) }))
    const created = Array.from({ length: 12 }, (_, i) => wd(100 + i, { fedapay_id: `FDP-${i}`, created_at: ago(1 + i) }))
    state.tables.wallet_transactions = [...stuck, ...created]
    const p1 = await listAdminWithdrawals({ page: "1" })
    const p2 = await listAdminWithdrawals({ page: "2" })
    expect(p1.rows).toHaveLength(25)
    expect(p1.rows.slice(0, 20).every((r) => r.status === "stuck")).toBe(true)
    expect(p1.rows.slice(20).every((r) => r.status === "created")).toBe(true)
    expect(p2.rows).toHaveLength(7)
    const ids = [...p1.rows, ...p2.rows].map((r) => r.id)
    expect(new Set(ids).size).toBe(32)
    expect((await listAdminWithdrawals({ page: "50" })).page).toBe(2)
  })

  it("opérateur déduit de la note, sinon Mobile Money ; note et téléphone jamais renvoyés", async () => {
    state.tables.wallet_transactions = [
      wd(1, { note: "Retrait Moov 0196000000", fedapay_id: "F1" }),
      wd(2, { note: "celtiis cash", fedapay_id: "F2" }),
      wd(3, { note: null, fedapay_id: "F3" }),
    ]
    const result = await listAdminWithdrawals({})
    expect(Object.fromEntries(result.rows.map((r) => [r.id, r.operator]))).toEqual({
      "t-000001": "Moov Money",
      "t-000002": "Celtiis Cash",
      "t-000003": "Mobile Money",
    })
    expect(JSON.stringify(result)).not.toMatch(/0196000000|Retrait Moov/)
  })

  it("aucun retrait : liste vide et indicateurs à zéro", async () => {
    state.tables.wallet_transactions = []
    const result = await listAdminWithdrawals({})
    expect(result).toMatchObject({ total: 0, rows: [], stats: { created: 0, reversed: 0 } })
  })

  it("erreur de lecture : message neutre sans détail technique", async () => {
    state.failing.add("wallet_transactions")
    const result = await listAdminWithdrawals({})
    expect(result.error).toMatch(/n'ont pas pu être chargés/)
    expect(JSON.stringify(result)).not.toMatch(/boom|secret/)
  })
})

describe("getAdminWallets", () => {
  it("totaux sur tous les portefeuilles au-delà de 20 et de 1000 lignes, avec heure du calcul", async () => {
    state.tables.wallets = Array.from({ length: 2500 }, (_, i) => wallet(i + 1, 1000, 200))
    const result = await getAdminWallets({})
    expect(result.totals).toMatchObject({ ok: true, circulation: 2500000, reserved: 500000, available: 2000000 })
    expect(result.walletCount).toBe(2500)
    expect(result.now).toBe(NOW.toISOString())
    expect(result.rows).toHaveLength(25)
    expect(result.total).toBe(2500)
  })

  it("solde négatif et décimaux : somme signée, disponible = solde moins réservé", async () => {
    state.tables.wallets = [wallet(1, 10000.5, 2000.25), wallet(2, -1500, 0), wallet(3, "abc", null)]
    const result = await getAdminWallets({})
    expect(result.totals.circulation).toBeCloseTo(8500.5)
    expect(result.totals.reserved).toBeCloseTo(2000.25)
    expect(result.totals.available).toBeCloseTo(6500.25)
  })

  it("anomalies : solde négatif en tête, réservé supérieur au solde, nom public seulement", async () => {
    state.tables.wallets = [wallet(1, 5000, 1000), wallet(2, -1500, 0), wallet(3, 100, 900)]
    state.tables.profiles = [
      { user_id: uid(2), full_name: "Boutique Dossa", phone: "+22997111111" },
      { user_id: uid(3), full_name: "Cabinet Agossou", phone: "+22997222222" },
    ]
    const result = await getAdminWallets({})
    expect(result.anomalies.total).toBe(2)
    expect(result.anomalies.items.map((a) => [a.name, a.reason])).toEqual([
      ["Boutique Dossa", "negative-balance"],
      ["Cabinet Agossou", "reserved-over-balance"],
    ])
    const byUser = Object.fromEntries(result.rows.map((r) => [r.userId, r.anomaly]))
    expect(byUser[uid(1)]).toBeNull()
    expect(byUser[uid(2)]).toBe("negative-balance")
    expect(JSON.stringify(result)).not.toMatch(/phone|2299711/)
  })

  it("liste triée par solde décroissant, rôle conservé", async () => {
    state.tables.wallets = [wallet(1, 100, 0), wallet(2, 900, 0), wallet(3, 500, 0)]
    const result = await getAdminWallets({})
    expect(result.rows.map((r) => r.userId)).toEqual([uid(2), uid(3), uid(1)])
    expect(result.rows[0].role).toBe("student")
  })

  it("recherche par nom : correspondance littérale, saisies hostiles sans erreur", async () => {
    state.tables.wallets = [wallet(1, 100, 0, { profiles: { full_name: "Rosine A", role: "student" } }), wallet(2, 50, 0, { profiles: { full_name: "100% Bio", role: "client" } })]
    const found = await getAdminWallets({ q: "rosine" })
    expect(found.rows.map((r) => r.name)).toEqual(["Rosine A"])
    expect(found.total).toBe(1)
    const percent = await getAdminWallets({ q: "%" })
    expect(percent.rows.map((r) => r.name)).toEqual(["100% Bio"])
    for (const q of ["_", "a,b)or=(x.eq.1", "' or 1=1 --", "z".repeat(300)]) {
      const r = await getAdminWallets({ q })
      expect(r.error).toBeUndefined()
    }
  })

  it("page hors limites : dernière page ; aucun portefeuille : liste vide", async () => {
    state.tables.wallets = Array.from({ length: 30 }, (_, i) => wallet(i + 1, 100 + i, 0))
    expect((await getAdminWallets({ page: "40" })).page).toBe(2)
    state.tables.wallets = []
    const empty = await getAdminWallets({})
    expect(empty).toMatchObject({ total: 0, rows: [], walletCount: 0 })
  })

  it("jamais select(*) ; lecture seule", async () => {
    state.tables.wallets = [wallet(1, 100, 0)]
    await getAdminWallets({})
    expect(state.queries.every((q) => !String(q.cols).includes("*"))).toBe(true)
    expect(state.queries.every((q) => ["wallets", "profiles"].includes(q.table))).toBe(true)
  })
})
