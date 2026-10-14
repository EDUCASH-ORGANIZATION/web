import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Faux client Supabase : base en mémoire qui applique réellement les filtres eq/in, pour prouver l'isolation.
const calls = []
let db
let failTable

function makeQuery(table) {
  const q = { table, columns: undefined, filters: [], range: undefined }
  const chain = {
    select: (columns) => { q.columns = columns; return chain },
    eq: (c, v) => { q.filters.push(["eq", c, v]); return chain },
    in: (c, v) => { q.filters.push(["in", c, v]); return chain },
    order: () => chain,
    range: (a, b) => { q.range = [a, b]; return chain },
    then: (resolve, reject) => {
      calls.push(q)
      if (failTable === table) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject)
      let rows = db[table] ?? []
      for (const [op, c, v] of q.filters) rows = rows.filter((r) => (op === "eq" ? r[c] === v : v.includes(r[c])))
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1)
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
    },
  }
  return chain
}

const supabase = { from: (table) => makeQuery(table) }
const requireRole = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))

const { getStudentApplicationsView } = await import("./student-applications.actions")

const NOW = new Date("2026-10-08T12:00:00Z")
const mission = (over) => ({
  title: "Cours de maths", type: "Cours particuliers", city: "Cotonou", budget: 25000, status: "open",
  deadline: "2026-10-30", selected_student_id: null, client_id: "c1", ...over,
})
const app = (id, status, m, over = {}) => ({
  id, mission_id: `m-${id}`, student_id: "stu-1", status,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", missions: m, ...over,
})

beforeEach(() => {
  calls.length = 0
  failTable = undefined
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  db = {
    applications: [
      app("a1", "pending", mission({})),
      app("a2", "pending", mission({ status: "in_progress", selected_student_id: "other" })),
      app("a3", "accepted", mission({ status: "in_progress", budget: 15000, client_id: "c2" }), { updated_at: "2026-10-07T17:40:00Z" }),
      app("a4", "accepted", mission({ status: "in_progress", budget: 10000 }), { updated_at: "2026-09-01T17:40:00Z" }),
      app("a5", "accepted", mission({ status: "done", budget: 8000 })),
      app("a6", "rejected", mission({ status: "in_progress" })),
      app("a7", "pending", null),
      { ...app("x1", "accepted", mission({ status: "in_progress", budget: 999999 })), student_id: "stu-2" },
      { ...app("x2", "pending", mission({})), student_id: "stu-2" },
    ],
    profiles: [
      { user_id: "c1", full_name: "Rosine Houngbédji", phone: "+22901", email: "r@x.bj" },
      { user_id: "c2", full_name: "Nadège Kpadonou" },
    ],
    reviews: [
      { mission_id: "m-a5", reviewer_id: "stu-1", rating: 5 },
      { mission_id: "m-a5", reviewer_id: "stu-2", rating: 1 },
    ],
  }
  requireRole.mockReset().mockResolvedValue({ supabase, user: { id: "stu-1" }, role: "student", profile: {} })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => vi.useRealTimers())

describe("getStudentApplicationsView", () => {
  it("exige le rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await getStudentApplicationsView()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toEqual([])
    expect(res).toEqual({ error: "Impossible de charger tes candidatures." })
  })

  it("refus de rôle levé par requireRole : erreur neutre", async () => {
    requireRole.mockRejectedValue(new Error("db secret"))
    expect(await getStudentApplicationsView()).toEqual({ error: "Impossible de charger tes candidatures." })
  })

  it("compteurs exacts par onglet, mission illisible comptée dans Non retenues", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-attente" })
    expect(data.counts).toEqual({ "en-attente": 1, "en-cours": 2, terminees: 1, "non-retenues": 3 })
    expect(data.total).toBe(7)
  })

  it("isolation : aucune candidature d'un autre étudiant, filtre student_id sur la requête", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    const query = calls.find((c) => c.table === "applications")
    expect(query.filters).toContainEqual(["eq", "student_id", "stu-1"])
    expect(data.total).toBe(7)
    expect(data.rows.map((r) => r.id)).toEqual(["a3", "a4"])
    expect(JSON.stringify(data)).not.toContain("x1")
    expect(JSON.stringify(data)).not.toContain("999999")
    expect(data.escrow.total).toBe(13200 + 8800)
  })

  it("isolation : les avis lus sont ceux de l'étudiant de la session", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    const query = calls.find((c) => c.table === "reviews")
    expect(query.filters).toContainEqual(["eq", "reviewer_id", "stu-1"])
    expect(data.rows[0].review).toEqual({ rating: 5 })
  })

  it("onglet invalide ou tableau : ramené au premier onglet non vide", async () => {
    for (const bad of ["nimporte-quoi", ["x"], undefined, "", "__proto__"]) {
      const { data } = await getStudentApplicationsView({ onglet: bad })
      expect(data.tab).toBe("en-attente")
    }
    db.applications = db.applications.filter((a) => a.id !== "a1")
    expect((await getStudentApplicationsView({ onglet: "nimporte-quoi" })).data.tab).toBe("en-cours")
  })

  it("onglet valide gardé même vide", async () => {
    db.applications = db.applications.filter((a) => a.id !== "a5")
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    expect(data.tab).toBe("terminees")
    expect(data.rows).toEqual([])
  })

  it("ta part par escrowSplit, séquestre total des missions retenues en cours", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.rows.map((r) => r.net)).toEqual([13200, 8800])
    expect(data.escrow).toEqual({ total: 22000, count: 2 })
  })

  it("candidature retenue récente : la plus récente des 7 derniers jours seulement", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-attente" })
    expect(data.highlight).toMatchObject({ missionId: "m-a3", net: 13200, clientFirst: "Nadège", acceptedAt: "2026-10-07T17:40:00Z" })
    db.applications = db.applications.filter((a) => a.id !== "a3")
    expect((await getStudentApplicationsView()).data.highlight).toBeNull()
  })

  it("client public : prénom et initiale, jamais téléphone ni email, colonnes explicites", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-attente" })
    expect(data.rows[0].clientName).toBe("Rosine H.")
    expect(JSON.stringify(data)).not.toMatch(/\+22901|r@x\.bj/)
    const profileQuery = calls.find((c) => c.table === "profiles")
    expect(profileQuery.columns).toBe("user_id, full_name")
    for (const c of calls) expect(c.columns).not.toMatch(/\*/)
    // l'embarqué liste aussi ses colonnes
    expect(calls.find((c) => c.table === "applications").columns).not.toContain("*")
  })

  it("mission illisible : ni titre ni montant ni lien de mission", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "non-retenues" })
    const hidden = data.rows.find((r) => r.id === "a7")
    expect(hidden).toMatchObject({ missionId: null, title: "Mission indisponible", net: 0, budget: 0 })
  })

  it("erreur de lecture : erreur neutre, rien d'interne", async () => {
    for (const table of ["applications", "profiles", "reviews"]) {
      failTable = table
      const res = await getStudentApplicationsView({ onglet: table === "reviews" ? "terminees" : "en-attente" })
      expect(res).toEqual({ error: "Impossible de charger tes candidatures." })
    }
  })

  it("aucune candidature : onglets à zéro, pas de lecture des clients ni des avis", async () => {
    db.applications = []
    const { data } = await getStudentApplicationsView()
    expect(data).toMatchObject({ tab: "en-attente", total: 0, rows: [], highlight: null, escrow: { total: 0, count: 0 } })
    expect(calls.map((c) => c.table)).toEqual(["applications"])
  })
})
