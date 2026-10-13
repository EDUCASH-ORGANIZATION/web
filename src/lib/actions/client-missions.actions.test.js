import { describe, it, expect, vi, beforeEach } from "vitest"

let user
let profileResult
let missionsResult
let countOverride
let reviewsResult
let calls

// Chaque requête garde sa propre chaîne : une lecture `head: true` est un comptage (un statut), les autres des listes.
function table(name) {
  const chain = []
  const record = (method) => (...args) => {
    const call = { table: name, method, args }
    calls.push(call)
    chain.push(call)
    return b
  }
  const result = () => {
    if (name === "profiles") return profileResult
    if (name === "reviews") return reviewsResult
    const status = chain.find((c) => c.method === "eq" && c.args[0] === "status")?.args[1]
    const isCount = chain.some((c) => c.method === "select" && c.args[1]?.head === true)
    if (isCount) {
      const override = countOverride?.[status]
      if (override) return override
      return { count: (missionsResult.data ?? []).filter((r) => r.status === status).length, error: missionsResult.error }
    }
    if (missionsResult.error) return missionsResult
    return { data: (missionsResult.data ?? []).filter((r) => !status || r.status === status), error: null }
  }
  const b = {
    select: record("select"),
    eq: record("eq"),
    ilike: record("ilike"),
    in: record("in"),
    order: record("order"),
    limit: record("limit"),
    maybeSingle: () => Promise.resolve(result()),
    then: (res, rej) => Promise.resolve(result()).then(res, rej),
  }
  return b
}

const supabase = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (name) => table(name),
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))

const { getClientMissions } = await import("./client-missions.actions")

const mission = (over) => ({
  id: "m1",
  title: "Garde d'enfants",
  type: "Babysitting",
  city: "Cotonou",
  budget: 6000,
  deadline: "2999-01-01",
  status: "open",
  created_at: "2026-10-01T10:00:00Z",
  applications: [],
  ...over,
})

const ROWS = [
  mission({ id: "a", status: "open", applications: [{ id: "1", student_id: "s1", status: "pending" }, { id: "2", student_id: "s2", status: "rejected" }] }),
  mission({ id: "b", status: "open", deadline: "2000-01-01" }),
  mission({ id: "c", status: "in_progress", applications: [{ id: "3", student_id: "s3", status: "accepted" }] }),
  mission({ id: "d", status: "done", applications: [{ id: "4", student_id: "s4", status: "accepted" }] }),
  mission({ id: "e", status: "done" }),
  mission({ id: "f", status: "cancelled" }),
]

const ilikeArg = () => calls.find((c) => c.method === "ilike")?.args[1]

beforeEach(() => {
  user = { id: "client-1", user_metadata: { role: "admin" } }
  profileResult = { data: { role: "client", is_suspended: false }, error: null }
  missionsResult = { data: ROWS, error: null }
  reviewsResult = { data: [{ mission_id: "d" }], error: null }
  countOverride = undefined
  calls = []
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getClientMissions : accès", () => {
  it("refuse un étudiant sans lire de mission, même si user_metadata prétend client", async () => {
    user = { id: "s", user_metadata: { role: "client" } }
    profileResult = { data: { role: "student", is_suspended: false }, error: null }
    const res = await getClientMissions({})
    expect(res).toEqual({ error: expect.any(String) })
    expect(calls.some((c) => c.table === "missions")).toBe(false)
  })

  it("refuse un client suspendu et un visiteur sans session", async () => {
    profileResult = { data: { role: "client", is_suspended: true }, error: null }
    expect(await getClientMissions({})).toHaveProperty("error")
    user = null
    expect(await getClientMissions({})).toHaveProperty("error")
  })

  it("ne lit que les missions du client connecté, avec des colonnes explicites", async () => {
    await getClientMissions({})
    const select = calls.find((c) => c.table === "missions" && c.method === "select")
    expect(select.args[0]).not.toContain("*")
    expect(calls).toContainEqual({ table: "missions", method: "eq", args: ["client_id", "client-1"] })
  })

  it("renvoie une erreur neutre quand la lecture échoue", async () => {
    missionsResult = { data: null, error: { message: "relation secrète" } }
    const res = await getClientMissions({})
    expect(res).toEqual({ error: "Impossible de charger vos missions." })
    expect(JSON.stringify(res)).not.toContain("secrète")
  })
})

describe("getClientMissions : onglets", () => {
  it("prend « open » par défaut et pour un onglet invalide", async () => {
    expect((await getClientMissions({})).onglet).toBe("open")
    expect((await getClientMissions({ onglet: "draft" })).onglet).toBe("open")
    expect((await getClientMissions({ onglet: "__proto__" })).onglet).toBe("open")
    expect((await getClientMissions({ onglet: ["done", "open"] })).onglet).toBe("done")
  })

  it("accepte les alias ?tab= et ?status=, l'onglet l'emportant", async () => {
    expect((await getClientMissions({ tab: "done" })).onglet).toBe("done")
    expect((await getClientMissions({ status: "cancelled" })).onglet).toBe("cancelled")
    expect((await getClientMissions({ onglet: "in_progress", tab: "done" })).onglet).toBe("in_progress")
    expect((await getClientMissions({ onglet: "nope", tab: "done" })).onglet).toBe("done")
  })

  it("compte les quatre statuts et ne renvoie que l'onglet courant", async () => {
    const res = await getClientMissions({ onglet: "done" })
    expect(res.counts).toEqual({ open: 2, in_progress: 1, done: 2, cancelled: 1 })
    expect(res.total).toBe(6)
    expect(res.missions.map((m) => m.id)).toEqual(["d", "e"])
  })

  it("met l'échéance dépassée en tête des ouvertes et compte les candidatures", async () => {
    const res = await getClientMissions({ onglet: "open" })
    expect(res.missions.map((m) => m.id)).toEqual(["b", "a"])
    expect(res.missions[0].overdue).toBe(true)
    const a = res.missions[1]
    expect(a).toMatchObject({ overdue: false, applicationsCount: 2, pendingCount: 1 })
  })

  it("renvoie l'étudiant retenu d'une mission en cours et l'avis déjà donné d'une terminée", async () => {
    expect((await getClientMissions({ onglet: "in_progress" })).missions[0].studentId).toBe("s3")
    const done = (await getClientMissions({ onglet: "done" })).missions
    expect(done.find((m) => m.id === "d")).toMatchObject({ reviewed: true, studentId: "s4" })
    expect(done.find((m) => m.id === "e")).toMatchObject({ reviewed: false, studentId: null })
    const reviewIn = calls.find((c) => c.table === "reviews" && c.method === "in")
    expect(reviewIn.args).toEqual(["mission_id", ["d", "e"]])
    expect(calls).toContainEqual({ table: "reviews", method: "eq", args: ["reviewer_id", "client-1"] })
  })

  it("ne lit les avis que pour l'onglet Terminées", async () => {
    await getClientMissions({ onglet: "open" })
    expect(calls.some((c) => c.table === "reviews")).toBe(false)
  })

  it("ne renvoie aucune colonne en dehors de la liste prévue", async () => {
    const [m] = (await getClientMissions({ onglet: "cancelled" })).missions
    expect(Object.keys(m).sort()).toEqual([
      "applicationsCount", "budget", "city", "createdAt", "deadline", "id", "overdue", "pendingCount",
      "reviewed", "status", "studentId", "title", "type",
    ])
  })
})

describe("getClientMissions : compteurs exacts", () => {
  const countCalls = () => calls.filter((c) => c.method === "select" && c.args[1]?.head === true)

  it("quatre requêtes de comptage exact, une par statut, plus la liste de l'onglet courant", async () => {
    await getClientMissions({ onglet: "done" })
    expect(countCalls()).toHaveLength(4)
    for (const c of countCalls()) expect(c.args[1]).toEqual({ count: "exact", head: true })
    const statuses = calls.filter((c) => c.table === "missions" && c.method === "eq" && c.args[0] === "status").map((c) => c.args[1])
    expect(statuses.sort()).toEqual(["cancelled", "done", "done", "in_progress", "open"])
  })

  it("chaque requête de missions filtre sur client_id", async () => {
    await getClientMissions({ q: "garde" })
    const missionSelects = calls.filter((c) => c.table === "missions" && c.method === "select")
    expect(missionSelects).toHaveLength(5)
    expect(calls.filter((c) => c.table === "missions" && c.method === "eq" && c.args[0] === "client_id" && c.args[1] === "client-1")).toHaveLength(5)
    expect(calls.filter((c) => c.method === "ilike")).toHaveLength(5)
  })

  it("comptes exacts même au-delà du plafond de la liste", async () => {
    countOverride = {
      open: { count: 742, error: null }, in_progress: { count: 3, error: null },
      done: { count: 1200, error: null }, cancelled: { count: 0, error: null },
    }
    const res = await getClientMissions({ onglet: "open" })
    expect(res.counts).toEqual({ open: 742, in_progress: 3, done: 1200, cancelled: 0 })
    expect(res.total).toBe(1945)
    expect(calls).toContainEqual({ table: "missions", method: "limit", args: [500] })
  })

  it("erreur de comptage : erreur neutre sans détail", async () => {
    countOverride = { done: { count: null, error: { message: "relation secrète" } } }
    const res = await getClientMissions({ onglet: "open" })
    expect(res).toEqual({ error: "Impossible de charger vos missions." })
    expect(JSON.stringify(res)).not.toContain("secrète")
  })
})

describe("getClientMissions : recherche", () => {
  it("n'applique aucun filtre sans recherche", async () => {
    await getClientMissions({})
    expect(ilikeArg()).toBeUndefined()
  })

  it("filtre sur le titre par un motif ilike", async () => {
    const res = await getClientMissions({ q: "  garde " })
    expect(res.q).toBe("garde")
    expect(calls).toContainEqual({ table: "missions", method: "ilike", args: ["title", "%garde%"] })
  })

  it("échappe les jokers LIKE : %, _ et antislash, et remplace * par _ (PostgREST le lirait comme %)", async () => {
    await getClientMissions({ q: "100%_a\\b*" })
    expect(ilikeArg()).toBe("%100\\%\\_a\\\\b_%")
  })

  it("une requête hostile ne laisse aucun caractère de syntaxe PostgREST ni joker non échappé", async () => {
    const hostile = 'x%,title.eq.1),or(client_id.neq.client-1,"a"\'b`'
    await getClientMissions({ q: hostile })
    const pattern = ilikeArg()
    // Rien d'autre que le % encadrant n'est un joker : tout % interne est précédé d'un antislash.
    expect(pattern.startsWith("%") && pattern.endsWith("%")).toBe(true)
    const inner = pattern.slice(1, -1)
    expect(inner).not.toMatch(/[,()"'`]/)
    expect(inner).not.toMatch(/(?<!\\)%/)
    // Le filtre reste borné au client connecté et ne s'élargit pas.
    expect(calls).toContainEqual({ table: "missions", method: "eq", args: ["client_id", "client-1"] })
    // Même motif sur la liste et sur les quatre comptages
    const patterns = calls.filter((c) => c.method === "ilike").map((c) => c.args[1])
    expect(patterns).toHaveLength(5)
    expect(new Set(patterns).size).toBe(1)
  })

  it("borne la recherche sans couper une paire de substitution (emoji)", async () => {
    const res = await getClientMissions({ q: "😀".repeat(150) })
    expect(Array.from(res.q)).toHaveLength(100)
    expect(res.q).toBe("😀".repeat(100))
    expect(res.q).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/)
  })

  it("borne la recherche à SEARCH_MAX_LENGTH, retire les caractères de contrôle et ignore un non-texte", async () => {
    const res = await getClientMissions({ q: "a".repeat(500) })
    expect(res.q).toHaveLength(100)
    expect((await getClientMissions({ q: "a\u0000b\nc" })).q).toBe("a b c")
    expect((await getClientMissions({ q: { $ne: "" } })).q).toBe("")
    expect((await getClientMissions({ q: ["abc", "def"] })).q).toBe("abc")
  })

  it("une recherche vide ou faite d'espaces n'ajoute pas de filtre", async () => {
    await getClientMissions({ q: "   " })
    expect(ilikeArg()).toBeUndefined()
  })
})
