import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const OTHER_ADMIN = "00000000-0000-4000-8000-0000000000ab"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const state = {
  user: null,
  sessionProfile: null,
  tables: {},
  authUsers: [],
  queries: [],
  updateError: null,
  readError: null,
  listUsersCalls: [],
}
const createServiceClient = vi.fn(() => makeService())
const notifyInApp = vi.fn()
const revalidatePath = vi.fn()
const closeAccountCore = vi.fn()
const reopenAccountCore = vi.fn()
const readClosureSnapshot = vi.fn()
const readClosureHistory = vi.fn()

function project(row, cols) {
  if (!cols || cols === "*") return { ...row }
  const out = {}
  for (const c of cols.split(",").map((s) => s.trim())) out[c] = row[c]
  return out
}

function likeToRegExp(pattern) {
  let source = ""
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === "\\") source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    else if (ch === "%") source += ".*"
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${source}$`, "i")
}

const isNull = (v) => v === null || v === undefined

// Faux client service en mémoire : filtres, comptage, tri, pagination et écriture conditionnelle.
function makeService() {
  return {
    from(table) {
      const rows = state.tables[table] ?? []
      const q = { table, op: "select", cols: null, values: null, filters: [], ilike: [], or: [], range: null, head: false, limit: null }
      state.queries.push(q)
      const b = {
        select(cols, opts) {
          q.cols = cols
          q.head = Boolean(opts?.head)
          q.count = opts?.count ?? null
          return b
        },
        update(values) {
          q.op = "update"
          q.values = values
          return b
        },
        eq(c, v) {
          q.filters.push((r) => r[c] === v)
          return b
        },
        neq(c, v) {
          q.filters.push((r) => r[c] !== v)
          return b
        },
        is(c, v) {
          q.filters.push((r) => (v === null ? isNull(r[c]) : r[c] === v))
          return b
        },
        not(c, op, v) {
          q.filters.push((r) => !(v === null ? isNull(r[c]) : r[c] === v))
          return b
        },
        lt(c, v) {
          q.filters.push((r) => !isNull(r[c]) && r[c] < v)
          return b
        },
        in(c, list) {
          q.filters.push((r) => list.includes(r[c]))
          return b
        },
        ilike(c, pattern) {
          q.ilike.push([c, pattern])
          q.filters.push((r) => likeToRegExp(pattern).test(String(r[c] ?? "")))
          return b
        },
        or(expr) {
          q.or.push(expr)
          const m = /^verified_until\.is\.null,verified_until\.gte\.(\d{4}-\d{2}-\d{2})$/.exec(expr)
          if (!m) throw new Error(`filtre or inattendu : ${expr}`)
          q.filters.push((r) => isNull(r.verified_until) || r.verified_until >= m[1])
          return b
        },
        order() {
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
        maybeSingle: () => Promise.resolve(run(true)),
        then: (res, rej) => Promise.resolve(run(false)).then(res, rej),
      }
      function run(single) {
        if (q.op === "update") {
          if (state.updateError) return { data: null, error: state.updateError }
          const hit = rows.filter((r) => q.filters.every((f) => f(r)))
          for (const r of hit) Object.assign(r, q.values)
          return { data: hit.map((r) => project(r, q.cols)), error: null }
        }
        if (state.readError) return { data: null, error: state.readError, count: null }
        const all = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.head) return { data: null, error: null, count: all.length }
        let hit = all
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        if (q.limit !== null) hit = hit.slice(0, q.limit)
        const data = hit.map((r) => project(r, q.cols))
        return single ? { data: data[0] ?? null, error: null } : { data, error: null, count: all.length }
      }
      return b
    },
    auth: {
      admin: {
        getUserById: async (id) => {
          const user = state.authUsers.find((u) => u.id === id)
          return { data: { user: user ?? null }, error: null }
        },
        listUsers: async ({ page, perPage }) => {
          state.listUsersCalls.push({ page, perPage })
          const from = (page - 1) * perPage
          return { data: { users: state.authUsers.slice(from, from + perPage) }, error: null }
        },
      },
    },
  }
}

vi.mock("./account-closure-core", () => ({
  closeAccountCore: (...a) => closeAccountCore(...a),
  reopenAccountCore: (...a) => reopenAccountCore(...a),
  readClosureSnapshot: (...a) => readClosureSnapshot(...a),
  readClosureHistory: (...a) => readClosureHistory(...a),
}))
vi.mock("next/cache", () => ({ revalidatePath: (...a) => revalidatePath(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/notifications/notify", () => ({ notify: (...a) => notifyInApp(...a) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.sessionProfile }) }
      return chain
    },
  }),
}))

const { listAdminUsers, getAdminUserDetail, suspendAccount, reactivateAccount, closeAccount, reopenAccount } = await import("./admin-users.actions")

function addProfile(n, over = {}) {
  const id = uid(n)
  state.tables.profiles.push({
    user_id: id,
    full_name: `Utilisateur ${n}`,
    role: "student",
    city: "Cotonou",
    phone: `+22901970000${String(n).padStart(2, "0")}`,
    fcm_token: "jeton-secret",
    avatar_url: null,
    is_verified: false,
    verified_until: null,
    rejection_reason: null,
    verification_submitted_at: null,
    is_suspended: false,
    missions_done: 0,
    rating: 0,
    created_at: `2026-09-${String(10 + (n % 15)).padStart(2, "0")}T08:00:00+00:00`,
    ...over,
  })
  state.authUsers.push({ id, email: `user${n}@exemple.bj` })
  state.tables.wallets.push({ user_id: id, balance: 1000 * n, reserved: 0 })
  return id
}

const HEALTHY_SNAPSHOT = {
  role: "student",
  activeClientMissions: 0,
  activeStudentMissions: 0,
  walletBalance: 0,
  walletReserved: 0,
  openPurchases: 0,
  openReports: 0,
  recentWithdrawals: 0,
  pendingTransactions: 0,
}

const profileOf = (id) => state.tables.profiles.find((p) => p.user_id === id)
const updates = () => state.queries.filter((q) => q.op === "update")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"))
  state.user = { id: ADMIN_ID, user_metadata: { role: "admin" } }
  state.sessionProfile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  state.tables = { profiles: [], student_profiles: [], wallets: [], wallet_transactions: [], missions: [], applications: [] }
  state.authUsers = []
  state.queries = []
  state.updateError = null
  state.readError = null
  state.listUsersCalls = []
  createServiceClient.mockClear()
  notifyInApp.mockReset()
  notifyInApp.mockResolvedValue({ ok: true })
  revalidatePath.mockClear()
  for (const fn of [closeAccountCore, reopenAccountCore, readClosureSnapshot, readClosureHistory]) fn.mockReset()
  readClosureSnapshot.mockResolvedValue(HEALTHY_SNAPSHOT)
  readClosureHistory.mockResolvedValue({ events: [] })
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const CALLS = {
  listAdminUsers: () => listAdminUsers({}),
  getAdminUserDetail: (id) => getAdminUserDetail(id, {}),
  suspendAccount: (id) => suspendAccount(id, { reason: "Comportement répété" }),
  reactivateAccount: (id) => reactivateAccount(id, { reason: "Situation réglée" }),
  closeAccount: (id) => closeAccount(id, { reasonCode: "admin_decision", confirmation: "FERMER" }),
  reopenAccount: (id) => reopenAccount(id, { reasonCode: "admin_decision" }),
}

describe("contrôle admin de chaque action", () => {
  it.each(Object.keys(CALLS))("%s : refuse un étudiant avec un metadata admin, sans lecture", async (name) => {
    const id = addProfile(1)
    state.sessionProfile = { role: "student", full_name: "A", city: "Cotonou", is_suspended: false }
    expect((await CALLS[name](id)).error).toMatch(/droits/)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
  })

  it.each(Object.keys(CALLS))("%s : refuse sans profil, un client, un admin suspendu et un visiteur", async (name) => {
    const id = addProfile(1)
    for (const profile of [null, { role: "client", is_suspended: false }, { role: "admin", is_suspended: true }]) {
      state.sessionProfile = profile
      expect((await CALLS[name](id)).error).toMatch(/droits/)
    }
    state.user = null
    expect((await CALLS[name](id)).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
  })
})

describe("listAdminUsers", () => {
  it("liste 20 comptes par page avec les totaux par rôle, sans donnée privée", async () => {
    for (let n = 1; n <= 25; n++) addProfile(n, n > 20 ? { role: "client" } : {})
    addProfile(30, { role: "admin" })
    const res = await listAdminUsers({})
    expect(res.rows).toHaveLength(20)
    expect(res.total).toBe(26)
    expect(res.pageCount).toBe(2)
    expect(res.totals).toEqual({ students: 20, clients: 5, admins: 1, all: 26 })
    const serialized = JSON.stringify(res)
    expect(serialized).not.toMatch(/jeton-secret|fcm_token|2290197|phone/)
    expect(res.rows[0]).toEqual(
      expect.objectContaining({ userId: expect.any(String), name: expect.any(String), email: expect.stringMatching(/@exemple\.bj$/) }),
    )
  })

  it("n'utilise que des colonnes listées et jamais select(*)", async () => {
    addProfile(1)
    await listAdminUsers({})
    for (const q of state.queries.filter((x) => x.op === "select")) {
      expect(q.cols).not.toBe("*")
      expect(q.cols ?? "").not.toMatch(/fcm_token|phone|avatar_url|card_url/)
    }
  })

  it("filtre par rôle, statut et vérification, sans admin ni portefeuille pour les admins", async () => {
    addProfile(1, { is_verified: true, verified_until: "2027-01-01" })
    addProfile(2, { is_suspended: true })
    addProfile(3, { role: "client" })
    addProfile(4, { role: "admin" })
    const verified = await listAdminUsers({ verif: "verifie" })
    expect(verified.rows.map((r) => r.userId)).toEqual([uid(1)])
    expect(verified.rows[0].verification).toBe("Vérifié")
    const suspended = await listAdminUsers({ statut: "suspendu" })
    expect(suspended.rows.map((r) => r.userId)).toEqual([uid(2)])
    const clients = await listAdminUsers({ role: "client" })
    expect(clients.rows.map((r) => r.userId)).toEqual([uid(3)])
    const admins = await listAdminUsers({ role: "admin" })
    expect(admins.rows[0]).toMatchObject({ balance: null, missions: null, verification: "" })
  })

  it("classe expiré et refusé, et déduit « en cours d'examen » de la carte", async () => {
    addProfile(1, { is_verified: true, verified_until: "2026-09-01" })
    addProfile(2, { rejection_reason: "Photo floue" })
    addProfile(3, { verification_submitted_at: "2026-10-10T08:00:00+00:00" })
    state.tables.student_profiles.push({ user_id: uid(3), card_url: `${uid(3)}/c.jpg` })
    const res = await listAdminUsers({})
    const label = (n) => res.rows.find((r) => r.userId === uid(n)).verification
    expect(label(1)).toBe("Badge expiré")
    expect(label(2)).toBe("Carte refusée")
    expect(label(3)).toBe("En cours d'examen")
    expect(JSON.stringify(res)).not.toMatch(/carte\.jpg|c\.jpg|Photo floue/)
    expect((await listAdminUsers({ verif: "expire" })).rows.map((r) => r.userId)).toEqual([uid(1)])
    expect((await listAdminUsers({ verif: "refuse" })).rows.map((r) => r.userId)).toEqual([uid(2)])
  })

  it("renvoie la dernière page quand la page est hors limites", async () => {
    for (let n = 1; n <= 45; n++) addProfile(n)
    const res = await listAdminUsers({ page: "40" })
    expect(res.pageClamped).toBe(true)
    expect(res.params.page).toBe(3)
    expect(res.rows).toHaveLength(5)
    expect(res.total).toBe(45)
  })

  it("borne la page à 1000 et ignore les valeurs absurdes", async () => {
    addProfile(1)
    expect((await listAdminUsers({ page: "1e9" })).params.page).toBe(1)
    const big = await listAdminUsers({ page: "99999999999" })
    expect(big.params.page).toBe(1)
    expect(big.rows).toHaveLength(1)
    const ranges = state.queries.filter((q) => q.range).map((q) => q.range[0])
    expect(Math.max(...ranges)).toBeLessThanOrEqual(19980)
  })

  it("recherche par nom avec un motif échappé, sans filtre or injecté", async () => {
    addProfile(1, { full_name: "Sèna Agossou" })
    addProfile(2, { full_name: "100% Pur_Test" })
    const res = await listAdminUsers({ q: "sèna" })
    expect(res.rows.map((r) => r.userId)).toEqual([uid(1)])
    const hostile = ["%", "_", "a,b", "x)", "or=(role.eq.admin)", "a".repeat(200), "'; drop table profiles;--"]
    for (const q of hostile) {
      const out = await listAdminUsers({ q })
      expect(out.error).toBeUndefined()
    }
    expect((await listAdminUsers({ q: "%" })).rows).toHaveLength(1)
    for (const query of state.queries) {
      expect(query.or.every((expr) => /^verified_until\.is\.null,verified_until\.gte\.\d{4}-\d{2}-\d{2}$/.test(expr))).toBe(true)
    }
    const patterns = state.queries.flatMap((q) => q.ilike.map((i) => i[1]))
    expect(patterns).toContain("%\\%%")
    expect(Math.max(...patterns.map((p) => p.length))).toBeLessThanOrEqual(90)
  })

  it("recherche par téléphone normalisé (égalité)", async () => {
    addProfile(1, { phone: "+2290197123456" })
    addProfile(2)
    const res = await listAdminUsers({ q: "01 97 12 34 56" })
    expect(res.rows.map((r) => r.userId)).toEqual([uid(1)])
  })

  it("recherche par e-mail : exacte ou préfixe, parcours des comptes paginé et plafonné", async () => {
    addProfile(1)
    addProfile(2)
    const exact = await listAdminUsers({ q: "user2@exemple.bj" })
    expect(exact.rows.map((r) => r.userId)).toEqual([uid(2)])
    const prefix = await listAdminUsers({ q: "user1@" })
    expect(prefix.rows.map((r) => r.userId)).toEqual([uid(1)])
    const none = await listAdminUsers({ q: "inconnu@exemple.bj" })
    expect(none.rows).toEqual([])
    expect(none.total).toBe(0)
    state.listUsersCalls = []
    state.authUsers = Array.from({ length: 30000 }, (_, i) => ({ id: uid(900000 + i), email: `zz${i}@x.bj` }))
    await listAdminUsers({ q: "absent@x.bj" })
    expect(state.listUsersCalls.length).toBeLessThanOrEqual(20)
  })

  it("marque le compte de l'administrateur connecté", async () => {
    state.tables.profiles.push({ ...addAdminSelf() })
    const res = await listAdminUsers({})
    expect(res.rows.find((r) => r.userId === ADMIN_ID).isSelf).toBe(true)
  })

  it("renvoie une erreur neutre si la lecture échoue", async () => {
    addProfile(1)
    state.readError = { message: 'relation "profiles" does not exist' }
    const res = await listAdminUsers({})
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/relation|profiles/)
    expect(console.error).toHaveBeenCalled()
  })
})

function addAdminSelf() {
  return { user_id: ADMIN_ID, full_name: "Admin", role: "admin", city: "Cotonou", is_suspended: false, created_at: "2026-01-01T00:00:00+00:00" }
}

describe("getAdminUserDetail", () => {
  it("renvoie la fiche d'un étudiant avec téléphone et e-mail, sans jeton ni adresse de carte", async () => {
    const id = addProfile(1, { missions_done: 3, rating: 4.5, verification_submitted_at: "2026-10-10T08:00:00+00:00" })
    state.tables.student_profiles.push({ user_id: id, school: "IFRI", level: "L2", card_url: `${id}/c.jpg` })
    state.tables.missions.push({ id: uid(500), title: "Cours", type: "cours", status: "in_progress", budget: 5000, city: "Cotonou", deadline: null, created_at: "2026-10-01", selected_student_id: id })
    state.tables.wallet_transactions.push({ id: uid(600), user_id: id, type: "release", amount: 4400, created_at: "2026-10-02", mission_id: uid(500), fedapay_id: "ref-secrete" })
    const res = await getAdminUserDetail(id, { onglet: "portefeuille" })
    expect(res.onglet).toBe("portefeuille")
    expect(res.user).toMatchObject({ name: "Utilisateur 1", email: "user1@exemple.bj", phone: "+2290197000001", role: "student", school: "IFRI" })
    expect(res.verification).toMatchObject({ tab: "a-examiner", label: "En cours d'examen", hasCard: true })
    expect(res.missions.rows).toHaveLength(1)
    expect(res.wallet).toMatchObject({ balance: 1000, reserved: 0 })
    expect(res.wallet.transactions).toHaveLength(1)
    const serialized = JSON.stringify(res)
    expect(serialized).not.toMatch(/jeton-secret|fcm|c\.jpg|ref-secrete|fedapay/)
    for (const q of state.queries) expect(q.cols).not.toBe("*")
  })

  it("répond notFound pour un identifiant invalide ou inconnu, sans lecture pour l'invalide", async () => {
    for (const bad of ["abc", "", "1 or 1=1", uid(1).slice(0, 20), null, undefined, 42]) {
      expect(await getAdminUserDetail(bad, {})).toEqual({ notFound: true })
    }
    expect(state.queries).toHaveLength(0)
    expect(await getAdminUserDetail(uid(99), {})).toEqual({ notFound: true })
  })

  it("liste les missions publiées d'un client et n'affiche pas de vérification", async () => {
    const id = addProfile(1, { role: "client" })
    state.tables.missions.push({ id: uid(500), title: "Marché", type: "livraison", status: "open", budget: 3000, city: "Cotonou", deadline: null, created_at: "2026-10-01", client_id: id })
    const res = await getAdminUserDetail(id, {})
    expect(res.verification).toBeNull()
    expect(res.missions.rows).toHaveLength(1)
    expect(res.missions.role).toBe("client")
  })

  it("fiche d'un administrateur : ni portefeuille ni missions", async () => {
    state.tables.profiles.push(addAdminSelf())
    const res = await getAdminUserDetail(ADMIN_ID, {})
    expect(res.user).toMatchObject({ role: "admin", isSelf: true })
    expect(res.wallet).toBeNull()
    expect(res.missions.rows).toEqual([])
  })

  it("onglet hors liste : aperçu", async () => {
    const id = addProfile(1)
    expect((await getAdminUserDetail(id, { onglet: "../../x" })).onglet).toBe("apercu")
  })

  it("erreur de lecture neutre", async () => {
    const id = addProfile(1)
    state.readError = { message: "boom secret" }
    const res = await getAdminUserDetail(id, {})
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/boom|secret/)
  })
})

describe("suspendAccount", () => {
  it("suspend un compte : écriture conditionnelle, journal avec le motif, revalidation, aucun e-mail", async () => {
    const id = addProfile(1, { role: "client" })
    const res = await suspendAccount(id, { reason: "  Comportement\u0000 envers un client  " })
    expect(res).toEqual({ success: true })
    expect(profileOf(id).is_suspended).toBe(true)
    expect(updates()).toHaveLength(1)
    expect(updates()[0].values).toEqual({ is_suspended: true })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users")
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${id}`)
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    const entry = JSON.parse(line)
    expect(entry).toMatchObject({ adminId: ADMIN_ID, action: "user.suspend", targetId: id, reason: "Comportement envers un client" })
    expect(line).not.toMatch(/exemple\.bj|\+229/)
  })

  it("refuse l'auto-suspension sans écriture", async () => {
    state.tables.profiles.push(addAdminSelf())
    const res = await suspendAccount(ADMIN_ID, { reason: "Motif valable" })
    expect(res.error).toMatch(/votre propre compte/)
    expect(updates()).toHaveLength(0)
  })

  it("refuse la suspension d'un autre administrateur", async () => {
    state.tables.profiles.push({ ...addAdminSelf(), user_id: OTHER_ADMIN })
    const res = await suspendAccount(OTHER_ADMIN, { reason: "Motif valable" })
    expect(res.error).toMatch(/administrateur/)
    expect(updates()).toHaveLength(0)
    expect(profileOf(OTHER_ADMIN).is_suspended).toBe(false)
  })

  it("refuse un compte déjà suspendu (double action)", async () => {
    const id = addProfile(1, { is_suspended: true })
    const res = await suspendAccount(id, { reason: "Motif valable" })
    expect(res.error).toMatch(/déjà suspendu/)
    expect(updates()).toHaveLength(0)
  })

  it("double action concurrente : une seule écriture réussit", async () => {
    const id = addProfile(1)
    const [a, b] = await Promise.all([
      suspendAccount(id, { reason: "Motif valable" }),
      suspendAccount(id, { reason: "Motif valable" }),
    ])
    expect([a.success, b.success].filter(Boolean)).toHaveLength(1)
    expect([a.error, b.error].filter(Boolean)).toHaveLength(1)
  })

  it("refuse un identifiant non UUID ou une cible inconnue, sans écriture", async () => {
    for (const bad of ["", "abc", "1 or 1=1", null, undefined, {}, [uid(1)]]) {
      expect((await suspendAccount(bad, { reason: "Motif valable" })).error).toBeTruthy()
    }
    expect((await suspendAccount(uid(77), { reason: "Motif valable" })).error).toMatch(/introuvable/)
    expect(updates()).toHaveLength(0)
  })

  it.each([
    ["vide", ""],
    ["espaces", "      "],
    ["trop court", "abc"],
    ["trop long", "x".repeat(501)],
    ["absent", undefined],
    ["nombre", 12345],
    ["objet", { $ne: 1 }],
  ])("refuse un motif %s sans écriture", async (_n, reason) => {
    const id = addProfile(1)
    const res = await suspendAccount(id, { reason })
    expect(res.error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    expect(profileOf(id).is_suspended).toBe(false)
  })

  it("nettoie un motif hostile (HTML, contrôle) avant le journal", async () => {
    const id = addProfile(1)
    const res = await suspendAccount(id, { reason: "<script>alert(1)</script>\n\r\tabus" })
    expect(res.success).toBe(true)
    const entry = JSON.parse(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1])
    expect(entry.reason).not.toMatch(/[\n\r\t]/)
  })

  it("erreur d'écriture neutre, sans fuite", async () => {
    const id = addProfile(1)
    state.updateError = { message: 'new row violates row-level security policy for table "profiles"' }
    const res = await suspendAccount(id, { reason: "Motif valable" })
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/row-level|profiles/)
    expect(console.error).toHaveBeenCalled()
  })

  it("n'écrit rien quand l'écriture ne touche aucune ligne", async () => {
    const id = addProfile(1)
    const service = makeService()
    createServiceClient.mockReturnValueOnce({
      ...service,
      from(table) {
        const builder = service.from(table)
        if (table !== "profiles") return builder
        const original = builder.update
        builder.update = (values) => {
          const out = original(values)
          out.eq = () => out
          out.neq = () => out
          out.select = async () => ({ data: [], error: null })
          return out
        }
        return builder
      },
    })
    const res = await suspendAccount(id, { reason: "Motif valable" })
    expect(res.error).toBeTruthy()
    expect(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")).toBeUndefined()
  })
})

describe("reactivateAccount", () => {
  it("réactive un compte suspendu avec un motif", async () => {
    const id = addProfile(1, { is_suspended: true })
    const res = await reactivateAccount(id, { reason: "Situation réglée avec le client" })
    expect(res).toEqual({ success: true })
    expect(profileOf(id).is_suspended).toBe(false)
    const entry = JSON.parse(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1])
    expect(entry).toMatchObject({ action: "user.reactivate", targetId: id, reason: "Situation réglée avec le client" })
  })

  it("refuse un compte actif, sans écriture", async () => {
    const id = addProfile(1)
    const res = await reactivateAccount(id, { reason: "Motif valable" })
    expect(res.error).toMatch(/pas suspendu/)
    expect(updates()).toHaveLength(0)
  })

  it("refuse le motif manquant, soi-même et un identifiant invalide", async () => {
    const id = addProfile(1, { is_suspended: true })
    expect((await reactivateAccount(id, {})).error).toBeTruthy()
    expect((await reactivateAccount("abc", { reason: "Motif valable" })).error).toBeTruthy()
    state.tables.profiles.push(addAdminSelf())
    expect((await reactivateAccount(ADMIN_ID, { reason: "Motif valable" })).error).toMatch(/votre propre compte/)
    expect(updates()).toHaveLength(0)
  })

  it("refuse un compte administrateur", async () => {
    state.tables.profiles.push({ ...addAdminSelf(), user_id: OTHER_ADMIN, is_suspended: true })
    expect((await reactivateAccount(OTHER_ADMIN, { reason: "Motif valable" })).error).toMatch(/administrateur/)
    expect(updates()).toHaveLength(0)
  })
})

describe("notifications in-app (RD-NOTIF-01)", () => {
  it("réactivation : notifie le compte réactivé, une seule fois", async () => {
    const id = addProfile(1, { is_suspended: true })
    expect(await reactivateAccount(id, { reason: "Situation réglée avec le client" })).toEqual({ success: true })
    expect(notifyInApp).toHaveBeenCalledTimes(1)
    expect(notifyInApp.mock.calls[0][0]).toMatchObject({
      recipientId: id,
      type: "account_reactivated",
      title: "Votre compte est réactivé",
      body: "Vous pouvez de nouveau utiliser EduCash.",
    })
    expect(notifyInApp.mock.calls[0][0].dedupeKey).toMatch(/^account_reactivated:\d+$/)
  })

  it("suspension : aucune notification (un compte suspendu ne peut plus se connecter)", async () => {
    const id = addProfile(1)
    expect(await suspendAccount(id, { reason: "Comportement répété" })).toEqual({ success: true })
    expect(notifyInApp).not.toHaveBeenCalled()
  })

  it("aucune notification quand la réactivation est refusée", async () => {
    const id = addProfile(1)
    expect((await reactivateAccount(id, { reason: "Motif valable" })).error).toBeTruthy()
    const suspended = addProfile(2, { is_suspended: true })
    state.updateError = { message: "boom" }
    expect((await reactivateAccount(suspended, { reason: "Motif valable" })).error).toBeTruthy()
    expect(notifyInApp).not.toHaveBeenCalled()
  })

  it("même résultat si notify échoue ou lève", async () => {
    const id = addProfile(1, { is_suspended: true })
    notifyInApp.mockRejectedValueOnce(new Error("boom"))
    expect(await reactivateAccount(id, { reason: "Situation réglée" })).toEqual({ success: true })
    const id2 = addProfile(2, { is_suspended: true })
    notifyInApp.mockResolvedValueOnce({ ok: false })
    expect(await reactivateAccount(id2, { reason: "Situation réglée" })).toEqual({ success: true })
  })
})

describe("suspension et compte fermé", () => {
  it("suspendAccount et reactivateAccount refusent un compte fermé, sans écriture", async () => {
    const id = addProfile(1, { closed_at: "2026-10-10T08:00:00+00:00", is_suspended: true })
    expect((await suspendAccount(id, { reason: "Comportement répété" })).error).toMatch(/fermé/)
    expect((await reactivateAccount(id, { reason: "Situation réglée" })).error).toMatch(/fermé/)
    expect(updates()).toHaveLength(0)
  })
})

describe("closeAccount", () => {
  const ok = { success: true, alreadyClosed: false, complete: true, dueAt: "2026-10-29T08:00:00.000Z" }
  const valid = { reasonCode: "admin_decision", confirmation: "FERMER" }

  it("refuse sans appel au coeur : uuid invalide, soi-même, cible admin, confirmation inexacte, motif hors liste", async () => {
    const id = addProfile(1)
    const admin = addProfile(2, { role: "admin" })
    state.tables.profiles.push({ user_id: ADMIN_ID, role: "admin", full_name: "Admin" })
    expect((await closeAccount("pas-un-uuid", valid)).error).toBeTruthy()
    expect((await closeAccount(ADMIN_ID, valid)).error).toMatch(/propre compte/)
    expect((await closeAccount(admin, valid)).error).toMatch(/administrateur/)
    for (const confirmation of ["fermer", "FERMER ", "", undefined]) {
      expect((await closeAccount(id, { ...valid, confirmation })).error).toMatch(/FERMER/)
    }
    for (const reasonCode of ["autre", "", undefined, "__proto__"]) {
      expect((await closeAccount(id, { ...valid, reasonCode })).error).toMatch(/motif/)
    }
    expect((await closeAccount(uid(999), valid)).error).toBeTruthy()
    expect(closeAccountCore).not.toHaveBeenCalled()
  })

  it("succès : appelle le coeur en acteur admin, journal sans donnée personnelle, revalidation", async () => {
    const id = addProfile(1)
    closeAccountCore.mockResolvedValue(ok)
    const res = await closeAccount(id, valid)
    expect(res).toEqual({ success: true, complete: true, alreadyClosed: false, dueAt: ok.dueAt })
    expect(closeAccountCore).toHaveBeenCalledWith(expect.anything(), {
      userId: id,
      actor: { kind: "admin", id: ADMIN_ID },
      reasonCode: "admin_decision",
    })
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    expect(JSON.parse(line)).toMatchObject({ adminId: ADMIN_ID, action: "user.close", targetId: id, reason: "admin_decision" })
    expect(JSON.parse(line)).toMatchObject({ before: { state: "active" }, after: { state: "closed" } })
    expect(line).not.toMatch(/exemple\.bj|\+229|Utilisateur/)
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${id}`)
  })

  it("reprise d'une fermeture : le journal part de l'état fermé", async () => {
    const id = addProfile(1)
    closeAccountCore.mockResolvedValue({ ...ok, alreadyClosed: true })
    await closeAccount(id, valid)
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    expect(JSON.parse(line)).toMatchObject({ action: "user.close", before: { state: "closed" }, after: { state: "closed" } })
  })

  it("blocages : messages d'administration, aucun journal", async () => {
    const id = addProfile(1)
    closeAccountCore.mockResolvedValue({ blocked: ["REPORT_OPEN", "WALLET_NOT_EMPTY"] })
    const res = await closeAccount(id, valid)
    expect(res.error).toMatch(/signalement/)
    expect(res.blockers.map((b) => b.code)).toEqual(["REPORT_OPEN", "WALLET_NOT_EMPTY"])
    expect(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")).toBeUndefined()
  })

  it("erreur du coeur ou exception : message neutre, aucun journal", async () => {
    const id = addProfile(1)
    closeAccountCore.mockResolvedValueOnce({ error: "L'opération n'a pas pu aboutir. Réessayez dans un instant." })
    expect((await closeAccount(id, valid)).error).toMatch(/pas pu aboutir/)
    closeAccountCore.mockRejectedValueOnce(new Error("boom secret"))
    expect((await closeAccount(id, valid)).error).not.toMatch(/boom|secret/)
    expect(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")).toBeUndefined()
  })

  it("fermeture incomplète : succès avec complete à false", async () => {
    const id = addProfile(1)
    closeAccountCore.mockResolvedValue({ ...ok, complete: false })
    expect((await closeAccount(id, valid)).complete).toBe(false)
  })
})

describe("reopenAccount", () => {
  const closedAt = "2026-10-10T08:00:00+00:00"

  it("refuse sans appel au coeur : uuid, soi-même, motif hors liste, admin, compte inconnu", async () => {
    const active = addProfile(1)
    const admin = addProfile(2, { role: "admin" })
    expect((await reopenAccount("x", { reasonCode: "admin_decision" })).error).toBeTruthy()
    expect((await reopenAccount(ADMIN_ID, { reasonCode: "admin_decision" })).error).toBeTruthy()
    expect((await reopenAccount(active, { reasonCode: "autre" })).error).toMatch(/motif/)
    expect((await reopenAccount(admin, { reasonCode: "admin_decision" })).error).toMatch(/administrateur/)
    expect((await reopenAccount(uid(999), { reasonCode: "admin_decision" })).error).toBeTruthy()
    expect(reopenAccountCore).not.toHaveBeenCalled()
  })

  it("compte actif : le coeur tranche (NOT_CLOSED sans bannissement, reprise sinon)", async () => {
    const id = addProfile(1)
    reopenAccountCore.mockResolvedValueOnce({ error: "Ce compte n'est pas fermé.", code: "NOT_CLOSED" })
    expect((await reopenAccount(id, { reasonCode: "admin_decision" })).error).toMatch(/pas fermé/)
    reopenAccountCore.mockResolvedValueOnce({ success: true, complete: true, alreadyActive: true })
    expect(await reopenAccount(id, { reasonCode: "admin_decision" })).toEqual({ success: true, complete: true, alreadyActive: true })
    expect(reopenAccountCore).toHaveBeenCalledTimes(2)
  })

  it.each([
    ["pseudonymizing", "Nom restant"],
    ["pseudonymized", "Compte clôturé"],
  ])("état %s : refus côté serveur avec le message d'impossibilité, sans appel au coeur", async (_state, fullName) => {
    const id = addProfile(1, { closed_at: closedAt, pseudonymized_at: "2026-10-24T08:00:00+00:00", full_name: fullName })
    const res = await reopenAccount(id, { reasonCode: "admin_decision" })
    expect(res.error).toMatch(/impossible/)
    expect(res.error).toMatch(/effacées/)
    expect(reopenAccountCore).not.toHaveBeenCalled()
  })

  it("succès : coeur en acteur admin, journal avec codes seulement", async () => {
    const id = addProfile(1, { closed_at: closedAt, is_suspended: true })
    reopenAccountCore.mockResolvedValue({ success: true, complete: true, alreadyActive: false })
    const res = await reopenAccount(id, { reasonCode: "user_request" })
    expect(res).toEqual({ success: true, complete: true, alreadyActive: false })
    expect(reopenAccountCore).toHaveBeenCalledWith(expect.anything(), {
      userId: id,
      actor: { kind: "admin", id: ADMIN_ID },
      reasonCode: "user_request",
    })
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    expect(JSON.parse(line)).toMatchObject({ action: "user.reopen", targetId: id, reason: "user_request" })
    expect(JSON.parse(line)).toMatchObject({ before: { state: "closed" }, after: { state: "active" } })
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users")
  })

  it("rétablissement de connexion d'un compte déjà actif : le journal part de l'état actif", async () => {
    const id = addProfile(1)
    reopenAccountCore.mockResolvedValue({ success: true, complete: true, alreadyActive: true })
    await reopenAccount(id, { reasonCode: "admin_decision" })
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    expect(JSON.parse(line)).toMatchObject({ action: "user.reopen", before: { state: "active" }, after: { state: "active" } })
  })

  it("le coeur répond PSEUDONYMIZED (course) : message d'impossibilité, aucun journal", async () => {
    const id = addProfile(1, { closed_at: closedAt })
    reopenAccountCore.mockResolvedValue({ error: "autre texte", code: "PSEUDONYMIZED" })
    expect((await reopenAccount(id, { reasonCode: "admin_decision" })).error).toMatch(/effacées/)
    expect(console.info.mock.calls.find((c) => c[0] === "[admin-audit]")).toBeUndefined()
  })
})

describe("getAdminUserDetail : cycle de vie", () => {
  it("compte actif : aperçu des blocages traduits, échéance absente, historique", async () => {
    const id = addProfile(1)
    readClosureSnapshot.mockResolvedValue({ ...HEALTHY_SNAPSHOT, openReports: 1 })
    readClosureHistory.mockResolvedValue({
      events: [{ event: "reopened", actor_kind: "admin", actor_id: ADMIN_ID, reason_code: "admin_decision", created_at: "2026-10-11T08:00:00Z" }],
    })
    const res = await getAdminUserDetail(id, {})
    expect(res.user.closure).toBe("active")
    expect(res.closure).toMatchObject({ state: "active", canReopen: false, dueAt: null, deferred: [] })
    expect(res.closure.blockers).toEqual([expect.objectContaining({ code: "REPORT_OPEN", message: expect.stringMatching(/signalement/) })])
    expect(res.closure.history).toEqual([{ event: "reopened", actorKind: "admin", reasonCode: "admin_decision", createdAt: "2026-10-11T08:00:00Z" }])
    expect(JSON.stringify(res.closure)).not.toContain(ADMIN_ID)
  })

  it("compte fermé : échéance à 14 jours, réactivable, pas d'aperçu de blocages", async () => {
    const id = addProfile(1, { closed_at: "2026-10-10T08:00:00+00:00", is_suspended: true })
    const res = await getAdminUserDetail(id, {})
    expect(res.closure).toMatchObject({ state: "closed", canReopen: true, dueAt: "2026-10-24T08:00:00.000Z", blockers: [], deferred: [] })
    expect(readClosureSnapshot).not.toHaveBeenCalled()
  })

  it("fermeture inachevée : compte fermé non banni, ou dernier événement différent de closed", async () => {
    const future = new Date(Date.now() + 86400000 * 365).toISOString()
    const id = addProfile(1, { closed_at: "2026-10-10T08:00:00+00:00", is_suspended: true })
    state.authUsers.find((u) => u.id === id).banned_until = future
    readClosureHistory.mockResolvedValue({ events: [{ event: "closed", actor_kind: "admin", created_at: "2026-10-10T08:00:00Z" }] })
    expect((await getAdminUserDetail(id, {})).closure).toMatchObject({ authBanned: true, incomplete: false })

    readClosureHistory.mockResolvedValue({ events: [] })
    expect((await getAdminUserDetail(id, {})).closure).toMatchObject({ authBanned: true, incomplete: true })

    state.authUsers.find((u) => u.id === id).banned_until = null
    readClosureHistory.mockResolvedValue({ events: [{ event: "closed", actor_kind: "admin", created_at: "2026-10-10T08:00:00Z" }] })
    expect((await getAdminUserDetail(id, {})).closure).toMatchObject({ authBanned: false, incomplete: true })
  })

  it("compte actif encore banni : authBanned vrai, pas d'incomplétude de fermeture", async () => {
    const id = addProfile(1)
    state.authUsers.find((u) => u.id === id).banned_until = new Date(Date.now() + 86400000 * 365).toISOString()
    expect((await getAdminUserDetail(id, {})).closure).toMatchObject({ state: "active", authBanned: true, incomplete: false })
  })

  it("compte fermé et échu avec un signalement ouvert : pseudonymisation reportée", async () => {
    const id = addProfile(1, { closed_at: "2026-09-20T08:00:00+00:00", is_suspended: true })
    readClosureSnapshot.mockResolvedValue({ ...HEALTHY_SNAPSHOT, openReports: 2 })
    const res = await getAdminUserDetail(id, {})
    expect(res.closure.deferred).toEqual(["REPORT_OPEN"])
  })

  it("compte pseudonymisé : non réactivable ; historique illisible : null", async () => {
    const id = addProfile(1, { closed_at: "2026-09-20T08:00:00+00:00", pseudonymized_at: "2026-10-05T08:00:00+00:00", full_name: "Compte clôturé" })
    readClosureHistory.mockResolvedValue({ error: "x" })
    const res = await getAdminUserDetail(id, {})
    expect(res.closure).toMatchObject({ state: "pseudonymized", canReopen: false, history: null })
  })

  it("liste : l'état de fermeture de chaque ligne", async () => {
    addProfile(1, { closed_at: "2026-10-10T08:00:00+00:00", is_suspended: true })
    addProfile(2)
    const res = await listAdminUsers({})
    expect(res.rows.map((r) => r.closure).sort()).toEqual(["active", "closed"])
  })
})
