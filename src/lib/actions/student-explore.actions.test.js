import { describe, it, expect, vi, beforeEach } from "vitest"

let user
let profileResult
let missionsResult
let applicationsResult
let serviceProfile
let serviceCard
let calls

function table(name) {
  const b = {}
  const record = (method) => (...args) => {
    calls.push({ table: name, method, args })
    return b
  }
  const result = () => {
    if (name === "profiles") return profileResult
    if (name === "applications") return applicationsResult
    return missionsResult
  }
  for (const method of ["select", "eq", "or", "ilike", "in", "gte", "lte", "order", "range"]) b[method] = record(method)
  b.maybeSingle = () => Promise.resolve(result())
  b.then = (res, rej) => Promise.resolve(result()).then(res, rej)
  return b
}

const supabase = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (name) => table(name),
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: vi.fn(async () => serviceProfile),
  getMyStudentProfile: vi.fn(async () => serviceCard),
}))

const { getStudentExplore } = await import("./student-explore.actions")

const row = (over) => ({
  id: "m1",
  title: "Cours de maths",
  type: "Cours particuliers",
  city: "Cotonou",
  budget: 20000,
  urgency: "normal",
  deadline: "2999-01-01",
  created_at: "2026-10-01T10:00:00Z",
  ...over,
})

const missionCalls = (method) => calls.filter((c) => c.table === "missions" && c.method === method)
const arg = (method, index = 1) => missionCalls(method)[0]?.args[index]

beforeEach(() => {
  user = { id: "student-1", user_metadata: { role: "admin" } }
  profileResult = { data: { role: "student", is_suspended: false }, error: null }
  missionsResult = { data: [row()], count: 1, error: null }
  applicationsResult = { data: [], error: null }
  serviceProfile = { profile: { is_verified: true, verified_until: "2999-01-01", rejection_reason: null } }
  serviceCard = { studentProfile: { card_url: "uid/card.jpg" } }
  calls = []
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getStudentExplore : accès", () => {
  it("refuse un client sans lire de mission, même si user_metadata prétend étudiant", async () => {
    user = { id: "c", user_metadata: { role: "student" } }
    profileResult = { data: { role: "client", is_suspended: false }, error: null }
    const res = await getStudentExplore({})
    expect(res.error).toMatch(/droits/)
    expect(calls.some((c) => c.table === "missions")).toBe(false)
  })

  it("refuse un étudiant suspendu, un visiteur et un profil illisible", async () => {
    profileResult = { data: { role: "student", is_suspended: true }, error: null }
    expect((await getStudentExplore({})).error).toBeTruthy()
    profileResult = { data: null, error: { message: "boom" } }
    expect((await getStudentExplore({})).error).toBeTruthy()
    user = null
    expect((await getStudentExplore({})).error).toMatch(/connecté/)
    expect(calls.some((c) => c.table === "missions")).toBe(false)
  })
})

describe("getStudentExplore : requête", () => {
  it("ne lit que les missions ouvertes non expirées, avec des colonnes listées (jamais *)", async () => {
    await getStudentExplore({})
    expect(arg("select", 0)).toBe("id, title, type, city, budget, urgency, deadline, created_at")
    expect(arg("select", 0)).not.toContain("*")
    expect(missionCalls("select")[0].args[1]).toEqual({ count: "exact" })
    expect(missionCalls("eq")[0].args).toEqual(["status", "open"])
    expect(arg("or", 0)).toMatch(/^deadline\.is\.null,deadline\.gte\.\d{4}-\d{2}-\d{2}$/)
  })

  it("ne lit aucune colonne de profil dans la liste ni colonne privée du client", async () => {
    await getStudentExplore({})
    // Seule la lecture du rôle (requireRole) touche à profiles avec la session : aucun select("*").
    const selects = calls.filter((c) => c.table === "profiles" && c.method === "select").map((c) => c.args[0])
    expect(selects).toEqual(["role, full_name, city, is_suspended"])
    expect(arg("select", 0)).not.toMatch(/client|phone|card_url|rejection/)
  })

  it("applique type, villes, urgence, budget et tri validés", async () => {
    await getStudentExplore({ type: "Traduction", cities: "Cotonou,Porto-Novo", urgency: "urgent", budget: "5000-15000", sort: "prix-desc" })
    expect(missionCalls("eq").map((c) => c.args)).toContainEqual(["type", "Traduction"])
    expect(arg("in")).toEqual(["Cotonou", "Porto-Novo"])
    expect(missionCalls("eq").map((c) => c.args)).toContainEqual(["urgency", "high"])
    expect(missionCalls("gte")[0].args).toEqual(["budget", 5000])
    expect(missionCalls("lte")[0].args).toEqual(["budget", 15000])
    expect(missionCalls("order")[0].args).toEqual(["budget", { ascending: false }])
  })

  it("une seule ville : égalité ; budget sans plafond : pas de lte", async () => {
    await getStudentExplore({ cities: "Cotonou", budget: "30000+" })
    expect(missionCalls("eq").map((c) => c.args)).toContainEqual(["city", "Cotonou"])
    expect(missionCalls("in")).toHaveLength(0)
    expect(missionCalls("lte")).toHaveLength(0)
  })

  it("refuse les valeurs hors liste (type, ville, urgence, budget, tri)", async () => {
    await getStudentExplore({ type: "x,status.eq.done", cities: "Paris,Lagos", urgency: "high)", budget: "0-1", sort: "id" })
    expect(missionCalls("eq").map((c) => c.args[0])).toEqual(["status"])
    expect(missionCalls("in")).toHaveLength(0)
    expect(missionCalls("gte")).toHaveLength(0)
    expect(missionCalls("order")[0].args).toEqual(["created_at", { ascending: false }])
  })

  it("pagine par pages de 9", async () => {
    const res = await getStudentExplore({ page: "3" })
    expect(missionCalls("range")[0].args).toEqual([18, 26])
    expect(res.filters.page).toBe(3)
    expect(res.pageSize).toBe(9)
  })
})

describe("getStudentExplore : recherche hostile", () => {
  it("échappe %, _, *, antislash, virgule et parenthèses avant le motif ILIKE", async () => {
    await getStudentExplore({ q: "a%b_c,d(e)f*g\\h" })
    expect(arg("ilike", 0)).toBe("title")
    expect(arg("ilike")).toBe("%a\\%b\\_c\\,d\\(e\\)f\\*g\\\\h%")
  })

  it("une injection de filtre par q reste du texte littéral et n'atteint jamais le .or()", async () => {
    const hostile = "x%,status.eq.done),(deadline.is.null"
    const res = await getStudentExplore({ q: hostile })
    const pattern = arg("ilike")
    // Aucune virgule ni parenthèse non échappée : le motif ne peut plus sortir de sa condition.
    expect(pattern.replace(/\\./g, "")).not.toMatch(/[,()*]/)
    expect(arg("or", 0)).not.toContain("status.eq.done")
    expect(missionCalls("or")).toHaveLength(1)
    expect(res.error).toBeUndefined()
  })

  it("borne la longueur de la recherche et ignore une valeur non texte", async () => {
    await getStudentExplore({ q: "a".repeat(500) })
    expect(arg("ilike").length).toBe(100 + 2)
    calls = []
    await getStudentExplore({ q: { toString: () => "x" } })
    expect(missionCalls("ilike")).toHaveLength(0)
  })

  it("une valeur tableau (q répété) ne garde que la première", async () => {
    await getStudentExplore({ q: ["premier", "second"] })
    expect(arg("ilike")).toBe("%premier%")
  })
})

describe("getStudentExplore : résultat", () => {
  it("renvoie le gain net par escrowSplit, le budget du client et le total exact", async () => {
    missionsResult = { data: [row({ budget: 20000 }), row({ id: "m2", budget: 6000, urgency: "high" })], count: 24, error: null }
    const res = await getStudentExplore({})
    expect(res.total).toBe(24)
    expect(res.missions[0]).toMatchObject({ id: "m1", budget: 20000, net: 17600, urgent: false })
    expect(res.missions[1]).toMatchObject({ budget: 6000, net: 5280, urgent: true })
  })

  it("joint le statut de la candidature de l'étudiant, lue pour lui seul et pour les missions de la page", async () => {
    missionsResult = { data: [row(), row({ id: "m2" })], count: 2, error: null }
    applicationsResult = { data: [{ mission_id: "m2", status: "pending" }], error: null }
    const res = await getStudentExplore({})
    expect(res.missions.map((m) => m.applicationStatus)).toEqual([null, "pending"])
    const app = calls.filter((c) => c.table === "applications")
    expect(app.find((c) => c.method === "eq").args).toEqual(["student_id", "student-1"])
    expect(app.find((c) => c.method === "in").args).toEqual(["mission_id", ["m1", "m2"]])
  })

  it("ne renvoie aucune colonne privée : seulement le statut de vérification calculé", async () => {
    serviceProfile = { profile: { is_verified: false, verified_until: null, rejection_reason: "Photo floue" } }
    const res = await getStudentExplore({})
    expect(res.verification).toMatchObject({ key: "rejected", canApply: false })
    const json = JSON.stringify(res)
    expect(json).not.toMatch(/card_url|rejection_reason|Photo floue|uid\/card/)
  })

  it("carte jamais envoyée : canApply faux ; carte en examen : canApply vrai", async () => {
    serviceProfile = { profile: { is_verified: false, verified_until: null, rejection_reason: null } }
    serviceCard = { studentProfile: null }
    expect((await getStudentExplore({})).verification).toMatchObject({ key: "not_submitted", canApply: false })
    serviceCard = { studentProfile: { card_url: "p" } }
    expect((await getStudentExplore({})).verification).toMatchObject({ key: "pending", canApply: true })
  })

  it("lecture de la vérification en échec : liste servie, statut absent", async () => {
    serviceProfile = { error: "boom" }
    const res = await getStudentExplore({})
    expect(res.error).toBeUndefined()
    expect(res.verification).toBeNull()
    expect(res.missions).toHaveLength(1)
  })

  it("page au-delà du dernier résultat : liste vide, pas d'erreur", async () => {
    missionsResult = { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } }
    const res = await getStudentExplore({ page: "99" })
    expect(res.error).toBeUndefined()
    expect(res.missions).toEqual([])
    expect(res.total).toBe(0)
  })

  it("erreur de lecture : message neutre, sans détail technique", async () => {
    missionsResult = { data: null, count: null, error: { code: "XX000", message: "relation secret_table" } }
    const res = await getStudentExplore({ q: "x" })
    expect(res).toEqual({ error: "Impossible de charger les missions." })
    expect(JSON.stringify(res)).not.toContain("secret_table")
  })
})
