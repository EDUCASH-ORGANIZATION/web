import { describe, it, expect, vi, beforeEach } from "vitest"

// QA indépendante (vague 2 de RD-CLIENT-01) : les 3 actions de lecture du espace client.
const UUID_A = "11111111-1111-4111-8111-111111111111"
const UUID_S = "22222222-2222-4222-8222-222222222222"
const UUID_OTHER = "33333333-3333-4333-8333-333333333333"
const PRIVATE_COLS = ["phone", "card_url", "verification_submitted_at", "rejection_reason", "email", "notification_token", "balance"]

let session // { user } | null
let profile // résultat de profiles
let tables // résultats par table
let calls

const noop = { data: null, error: null }
function table(name) {
  let mine = ""
  const rec = (method) => (...args) => { if (method === "select") mine = String(args[0]); calls.push({ table: name, method, args }); return b }
  const res = () => {
    if (name === "profiles" && /\brole\b/.test(mine)) return profile
    return tables[name] ?? noop
  }
  const b = {
    select: rec("select"), eq: rec("eq"), in: rec("in"), ilike: rec("ilike"), order: rec("order"), limit: rec("limit"),
    single: () => Promise.resolve(res()), maybeSingle: () => Promise.resolve(res()),
    then: (a, c) => Promise.resolve(res()).then(a, c),
  }
  return b
}
const supabase = {
  auth: { getUser: async () => ({ data: { user: session }, error: session ? null : new Error("no session") }) },
  from: (n) => table(n),
}
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))

const { getClientDashboard } = await import("@/lib/actions/client-dashboard.actions")
const { getClientMissions } = await import("@/lib/actions/client-missions.actions")
const { getClientMissionDetail, getCandidateProfile } = await import("@/lib/actions/client-mission-detail.actions")

const dataTables = () => [...new Set(calls.filter((c) => c.table !== "profiles").map((c) => c.table))]

beforeEach(() => {
  session = { id: UUID_A, user_metadata: { role: "client" } }
  profile = { data: { role: "client", full_name: "Rosine Adjovi", city: "Cotonou", is_suspended: false }, error: null }
  tables = {
    wallets: { data: { balance: 1000, reserved: 200 }, error: null },
    missions: { data: [], error: null },
    applications: { data: [], error: null },
    reviews: { data: [], error: null },
    wallet_transactions: { data: [], error: null },
  }
  calls = []
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const callers = {
  dashboard: () => getClientDashboard(),
  missions: () => getClientMissions({ onglet: "open", q: "x" }),
  detail: () => getClientMissionDetail(UUID_OTHER),
  candidate: () => getCandidateProfile(UUID_OTHER, UUID_S),
}

const denials = {
  "sans session": () => { session = null },
  "étudiant (user_metadata client)": () => { session = { id: UUID_A, user_metadata: { role: "client" } }; profile = { data: { role: "student", is_suspended: false }, error: null } },
  "admin": () => { profile = { data: { role: "admin", is_suspended: false }, error: null } },
  "client suspendu": () => { profile = { data: { role: "client", is_suspended: true }, error: null } },
  "profil absent": () => { profile = { data: null, error: null } },
  "lecture du profil en erreur": () => { profile = { data: null, error: { message: "boom" } } },
  "rôle inconnu": () => { profile = { data: { role: "superuser", is_suspended: false }, error: null } },
}

describe("refus : aucune requête de données", () => {
  for (const [dn, setup] of Object.entries(denials)) {
    for (const [cn, call] of Object.entries(callers)) {
      it(`${cn} : ${dn}`, async () => {
        setup()
        const out = await call()
        expect(dataTables()).toEqual([])
        if (cn === "detail" || cn === "candidate") expect(out).toBeNull()
        else expect(out.data ?? null).toBeNull()
        if (out?.error) expect(JSON.stringify(out)).not.toMatch(/boom|PGRST|select|relation/i)
      })
    }
  }
})

describe("getClientMissions : recherche q hostile", () => {
  const hostile = {
    pourcent: "100%", souligne: "a_b", antislash: "a\\b", virgule: "a,b", parentheses: "a(b)c", guillemets: `a"b'c`, etoile: "a*b",
    longue: "x".repeat(5000), tableau: ["a%", "b"], objet: { toString: () => "%" }, nul: "a\u0000b", emoji: "😀%🎓", ou: "x),client_id.neq.0,(title.ilike.%",
    point: ".", accolade: "{}", backtick: "`",
  }
  for (const [name, q] of Object.entries(hostile)) {
    it(`${name} : chaque requête (liste et 4 comptages) filtre client_id, motif ilike identique et sans syntaxe`, async () => {
      const out = await getClientMissions({ q })
      expect(out.error).toBeUndefined()
      const missionCalls = calls.filter((c) => c.table === "missions")
      const ilikes = missionCalls.filter((c) => c.method === "ilike")
      const selectsCount = missionCalls.filter((c) => c.method === "select").length
      expect(selectsCount).toBe(5)
      expect(ilikes.length === 0 || ilikes.length === selectsCount).toBe(true)
      expect(new Set(ilikes.map((c) => c.args[1])).size).toBeLessThanOrEqual(1)
      expect(missionCalls.filter((c) => c.method === "eq" && c.args[0] === "client_id" && c.args[1] === UUID_A)).toHaveLength(selectsCount)
      expect(calls.filter((c) => c.method === "or" ).length).toBe(0)
      const il = missionCalls.find((c) => c.method === "ilike")
      if (il) {
        const pat = il.args[1]
        expect(il.args[0]).toBe("title")
        expect(pat.length).toBeLessThanOrEqual(2 * 100 + 2)
        const core = pat.slice(1, -1)
        // aucun %, _ ou * non échappé, aucune syntaxe PostgREST
        expect(core.replace(/\\[\\%_*]/g, "")).not.toMatch(/[%*,()"'`\u0000]/)
        expect(core).not.toMatch(/\u0000/)
      }
    })
  }
  it("q vide, nombre, null : aucun ilike", async () => {
    for (const q of ["", "   ", 42, null, undefined, {}]) {
      calls = []
      await getClientMissions({ q })
      expect(calls.some((c) => c.method === "ilike")).toBe(false)
    }
  })
  it("onglet hostile ramené à open sans erreur", async () => {
    for (const onglet of ["__proto__", "constructor", ["done"], { a: 1 }, "DONE", "done; drop"]) {
      const out = await getClientMissions({ onglet })
      expect(["open", "done"]).toContain(out.onglet)
    }
    expect((await getClientMissions({ onglet: "__proto__" })).onglet).toBe("open")
  })
  it("params null ou non objet ne lève pas", async () => {
    await expect(getClientMissions(null)).resolves.toBeTruthy()
    await expect(getClientMissions("x")).resolves.toBeTruthy()
  })
  it("une ligne dont status = constructor ne casse ni la liste ni les compteurs (comptes lus par count exact)", async () => {
    tables.missions = { data: [{ id: "a", title: "t", status: "constructor", applications: [] }, { id: "b", title: "t", status: "open", applications: null }], count: 1, error: null }
    const out = await getClientMissions({})
    expect(out.error).toBeUndefined()
    expect(out.counts).toEqual({ open: 1, in_progress: 1, done: 1, cancelled: 1 })
    expect(out.total).toBe(4)
  })
})

describe("colonnes explicites et absence de fuite", () => {
  const selects = () => calls.filter((c) => c.method === "select").map((c) => [c.table, c.args[0]])
  it("aucun select('*') sur profiles / student_profiles / missions, aucune colonne privée", async () => {
    tables.missions = { data: [{ id: UUID_OTHER, title: "t", status: "open", budget: 1, selected_student_id: UUID_S, created_at: "2026-10-01", phone: "0197000000", client_id: "x", applications: [{ id: "1", student_id: UUID_S, status: "pending", phone: "x" }] }], error: null }
    tables.applications = { data: [{ id: "a1", student_id: UUID_S, status: "pending", message: "hi", created_at: "2026-10-02", phone: "0197" }], error: null }
    tables.profiles = { data: [{ user_id: UUID_S, full_name: "Sèna A", phone: "0197", card_url: "u", verification_submitted_at: "x", rejection_reason: "r" }], error: null }
    tables.student_profiles = { data: [{ user_id: UUID_S, school: "UAC", level: "L2", skills: ["Saisie"], phone: "x", card_url: "y" }], error: null }
    await getClientDashboard()
    await getClientMissions({})
    const detail = await getClientMissionDetail(UUID_OTHER)
    for (const [t, cols] of selects()) {
      if (t === "wallets" || t === "wallet_transactions") continue
      expect(cols, `${t}`).not.toMatch(/\*/)
      for (const p of PRIVATE_COLS) expect(cols, `${t}.${p}`).not.toContain(p)
    }
    expect(JSON.stringify(detail)).not.toMatch(/0197|card_url|verification_submitted_at|rejection_reason|client_id/)
  })
  it("getCandidateProfile : aucune colonne privée dans le résultat ni les select", async () => {
    tables.missions = { data: { id: UUID_OTHER }, error: null }
    tables.applications = { data: { id: "a1", student_id: UUID_S, status: "pending", message: "hi", created_at: "2026-10-02", phone: "0197" }, error: null }
    tables.profiles = { data: [{ user_id: UUID_S, full_name: "Sèna Agbo", phone: "0197", card_url: "u" }], error: null }
    tables.student_profiles = { data: [{ user_id: UUID_S, school: "UAC", level: "L2", skills: [] }], error: null }
    tables.reviews = { data: [{ id: "r1", rating: 5, comment: "ok", created_at: "2026-10-03", reviewer_id: UUID_A }], error: null, count: 1 }
    const out = await getCandidateProfile(UUID_OTHER, UUID_S)
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).not.toMatch(/0197|card_url|reviewer_id/)
    for (const [t, cols] of selects()) {
      expect(cols).not.toMatch(/\*/)
      for (const p of PRIVATE_COLS) expect(cols).not.toContain(p)
    }
  })
})

describe("détail : propriété et identifiants", () => {
  it("mission d'un autre client : null, rien d'autre lu", async () => {
    tables.missions = { data: null, error: null }
    expect(await getClientMissionDetail(UUID_OTHER)).toBeNull()
    expect(dataTables()).toEqual(["missions"])
    const eqs = calls.filter((c) => c.method === "eq")
    expect(eqs.some((c) => c.args[0] === "client_id" && c.args[1] === UUID_A)).toBe(true)
  })
  it("identifiants non UUID : null sans requête", async () => {
    for (const id of ["abc", "", null, undefined, 42, [UUID_OTHER], { a: 1 }, UUID_OTHER + "x", " " + UUID_OTHER, "1' or '1'='1", "../../x"]) {
      calls = []
      expect(await getClientMissionDetail(id)).toBeNull()
      expect(dataTables()).toEqual([])
    }
  })
  it("getCandidateProfile : ids non UUID : null sans requête", async () => {
    for (const [m, s] of [["x", UUID_S], [UUID_OTHER, "x"], [null, null], [[UUID_OTHER], UUID_S], [UUID_OTHER, { a: 1 }]]) {
      calls = []
      expect(await getCandidateProfile(m, s)).toBeNull()
      expect(dataTables()).toEqual([])
    }
  })
  it("getCandidateProfile : mission d'un autre client : null, profil non lu", async () => {
    tables.missions = { data: null, error: null }
    expect(await getCandidateProfile(UUID_OTHER, UUID_S)).toBeNull()
    expect(dataTables()).toEqual(["missions"])
  })
  it("getCandidateProfile : étudiant sans candidature : null, profil et avis non lus", async () => {
    tables.missions = { data: { id: UUID_OTHER }, error: null }
    tables.applications = { data: null, error: null }
    expect(await getCandidateProfile(UUID_OTHER, UUID_S)).toBeNull()
    expect(dataTables()).toEqual(["missions", "applications"])
    expect(calls.some((c) => c.table === "student_profiles" || c.table === "reviews")).toBe(false)
    expect(calls.some((c) => c.table === "applications" && c.method === "eq" && c.args[0] === "mission_id" && c.args[1] === UUID_OTHER)).toBe(true)
  })
  it("lectures du détail filtrées par mission_id (applications, ledger, reviews)", async () => {
    tables.missions = { data: { id: UUID_OTHER, title: "t", status: "open", budget: 1, created_at: "2026-10-01" }, error: null }
    await getClientMissionDetail(UUID_OTHER)
    for (const t of ["applications", "wallet_transactions", "reviews"]) {
      expect(calls.some((c) => c.table === t && c.method === "eq" && c.args[0] === "mission_id" && c.args[1] === UUID_OTHER), t).toBe(true)
    }
    expect(calls.some((c) => c.table === "wallet_transactions" && c.method === "eq" && c.args[0] === "user_id" && c.args[1] === UUID_A)).toBe(true)
    expect(calls.some((c) => c.table === "reviews" && c.method === "eq" && c.args[0] === "reviewer_id" && c.args[1] === UUID_A)).toBe(true)
  })
})

describe("erreurs neutres", () => {
  const SQL = { message: 'relation "missions" does not exist PGRST301 SELECT secret', code: "42P01" }
  it("dashboard : erreur SQL -> message neutre sans détail", async () => {
    tables.missions = { data: null, error: SQL }
    const out = await getClientDashboard()
    expect(out).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })
  it("dashboard : portefeuille en erreur -> neutre", async () => {
    tables.wallets = { data: null, error: SQL }
    const out = await getClientDashboard()
    expect(JSON.stringify(out)).not.toMatch(/relation|PGRST|secret|SELECT/)
    expect(out.error).toBeTruthy()
  })
  it("missions : erreur SQL -> neutre vouvoyé", async () => {
    tables.missions = { data: null, error: SQL }
    const out = await getClientMissions({})
    expect(out).toEqual({ error: "Impossible de charger vos missions." })
  })
  it("détail : erreur SQL -> exception au message neutre (sans SQL)", async () => {
    tables.missions = { data: null, error: SQL }
    await expect(getClientMissionDetail(UUID_OTHER)).rejects.toThrow(/^Impossible de charger la mission\.$/)
  })
  it("candidat : erreur SQL -> exception neutre", async () => {
    tables.missions = { data: null, error: SQL }
    await expect(getCandidateProfile(UUID_OTHER, UUID_S)).rejects.toThrow(/^Impossible de charger ce candidat\.$/)
  })
  it("refus : le message d'erreur est vouvoyé (client)", async () => {
    session = null
    const out = await getClientMissions({})
    expect(out.error).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
  })
})
