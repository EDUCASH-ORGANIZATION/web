import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"

// Faux client Supabase : base en mémoire qui applique réellement les filtres eq/in, pour prouver l'isolation.
const calls = []
let db
let failTable
// Erreur simulée sur la lecture séparée de accepted_at (requête "id, accepted_at")
let acceptedError

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
      if (acceptedError && table === "applications" && q.columns === "id, accepted_at") {
        return Promise.resolve({ data: null, error: acceptedError }).then(resolve, reject)
      }
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
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))

const { getStudentApplicationsView } = await import("./student-applications.actions")

// Vrais UUID : la lecture de accepted_at filtre les identifiants par isUuid.
const ID = Object.fromEntries(
  ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "x1", "x2"].map((k, i) => [k, `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]),
)
const NOW = new Date("2026-10-08T12:00:00Z")
const mission = (over) => ({
  title: "Cours de maths", type: "Cours particuliers", city: "Cotonou", budget: 25000, status: "open",
  deadline: "2026-10-30", selected_student_id: null, client_id: "c1", ...over,
})
const app = (id, status, m, over = {}) => ({
  id: ID[id] ?? id, mission_id: `m-${id}`, student_id: "stu-1", status,
  created_at: "2026-10-05T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", missions: m, ...over,
})

beforeEach(() => {
  calls.length = 0
  failTable = undefined
  acceptedError = undefined
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  db = {
    applications: [
      app("a1", "pending", mission({})),
      app("a2", "pending", mission({ status: "in_progress", selected_student_id: "other" })),
      app("a3", "accepted", mission({ status: "in_progress", budget: 15000, client_id: "c2" }), { updated_at: "2026-10-07T17:40:00Z", accepted_at: "2026-10-07T17:40:00Z" }),
      app("a4", "accepted", mission({ status: "in_progress", budget: 10000 }), { created_at: "2026-08-20T10:00:00Z", updated_at: "2026-09-01T17:40:00Z", accepted_at: "2026-09-01T17:40:00Z" }),
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
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await getStudentApplicationsView()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toEqual([])
    expect(res).toEqual({ error: "Impossible de charger vos candidatures." })
  })

  it("refus de rôle levé par requireRole : erreur neutre", async () => {
    requireRole.mockRejectedValue(new Error("db secret"))
    expect(await getStudentApplicationsView()).toEqual({ error: "Impossible de charger vos candidatures." })
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
    expect(data.rows.map((r) => r.id)).toEqual([ID.a3, ID.a4])
    expect(JSON.stringify(data)).not.toContain(ID.x1)
    expect(JSON.stringify(data)).not.toContain("999999")
    expect(data.escrow.total).toBe(13200 + 8800)
  })

  it("isolation : les avis lus sont ceux de l'étudiant de la session", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    const query = calls.find((c) => c.table === "reviews")
    expect(query.filters).toContainEqual(["eq", "reviewer_id", "stu-1"])
    expect(data.rows[0].review).toEqual({ rating: 5 })
  })

  it("avis : filtrés sur les missions de l'onglet, par lots (aucun avis d'une autre mission lu)", async () => {
    db.reviews.push({ mission_id: "m-a1", reviewer_id: "stu-1", rating: 2 })
    await getStudentApplicationsView({ onglet: "terminees" })
    const query = calls.find((c) => c.table === "reviews")
    expect(query.filters).toContainEqual(["in", "mission_id", ["m-a5"]])
    expect(query.range).toBeUndefined()
  })

  it("avis : plus de 100 missions terminées lues en plusieurs lots, aucune perte", async () => {
    db.applications = Array.from({ length: 250 }, (_, i) => app(`d${i}`, "accepted", mission({ status: "done" })))
    db.reviews = [{ mission_id: "m-d249", reviewer_id: "stu-1", rating: 4 }]
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    expect(calls.filter((c) => c.table === "reviews")).toHaveLength(3)
    expect(data.rows.find((r) => r.id === "d249").review).toEqual({ rating: 4 })
  })

  it("candidature acceptée dont un autre étudiant est retenu : Non retenues, jamais En cours ni séquestre", async () => {
    db.applications.push(app("a8", "accepted", mission({ status: "in_progress", selected_student_id: "other", budget: 777000 }), { updated_at: "2026-10-07T17:40:00Z" }))
    const { data } = await getStudentApplicationsView({ onglet: "non-retenues" })
    expect(data.rows.map((r) => r.id)).toContain(ID.a8)
    expect(data.counts["en-cours"]).toBe(2)
    expect(data.escrow.total).toBe(13200 + 8800)
  })

  it("onglet invalide ou tableau : ramené au premier onglet non vide", async () => {
    for (const bad of ["nimporte-quoi", ["x"], undefined, "", "__proto__"]) {
      const { data } = await getStudentApplicationsView({ onglet: bad })
      expect(data.tab).toBe("en-attente")
    }
    db.applications = db.applications.filter((a) => a.id !== ID.a1)
    expect((await getStudentApplicationsView({ onglet: "nimporte-quoi" })).data.tab).toBe("en-cours")
  })

  it("onglet valide gardé même vide", async () => {
    db.applications = db.applications.filter((a) => a.id !== ID.a5)
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    expect(data.tab).toBe("terminees")
    expect(data.rows).toEqual([])
  })

  it("votre part par escrowSplit, séquestre total des missions retenues en cours", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.rows.map((r) => r.net)).toEqual([13200, 8800])
    expect(data.escrow).toEqual({ total: 22000, count: 2 })
  })

  it("candidature retenue récente : la plus récente des 7 derniers jours seulement", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-attente" })
    expect(data.highlight).toMatchObject({ missionId: "m-a3", net: 13200, clientFirst: "Nadège", acceptedAt: "2026-10-07T17:40:00Z" })
    db.applications = db.applications.filter((a) => a.id !== ID.a3)
    expect((await getStudentApplicationsView()).data.highlight).toBeNull()
  })

  it("date de rétention : accepted_at lu dans une requête séparée, jamais updated_at", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.rows.map((r) => [r.id, r.acceptedAt])).toEqual([[ID.a3, "2026-10-07T17:40:00Z"], [ID.a4, "2026-09-01T17:40:00Z"]])
    const read = calls.filter((c) => c.columns === "id, accepted_at")
    expect(read).toHaveLength(1)
    expect(read[0].filters).toContainEqual(["in", "id", [ID.a3, ID.a4]])
    expect(read[0].filters).toContainEqual(["eq", "student_id", "stu-1"])
    // la requête principale n'ajoute pas accepted_at à son select
    expect(calls.find((c) => c.table === "applications").columns).not.toContain("accepted_at")
  })

  it("updated_at récent mais accepted_at ancien : aucune carte, date ancienne", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = "2026-09-20T10:00:00Z"
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.highlight).toBeNull()
    expect(data.rows.find((r) => r.id === ID.a3).acceptedAt).toBe("2026-09-20T10:00:00Z")
  })

  it("accepted_at NULL : carte sans date, ligne sans date, updated_at ignoré", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = null
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.rows.find((r) => r.id === ID.a3).acceptedAt).toBeNull()
    expect(data.highlight).toMatchObject({ missionId: "m-a3", acceptedAt: null })
    expect(JSON.stringify(data.highlight)).not.toContain("2026-10-07")
  })

  it("retenue datée de plus de 7 jours : jamais de carte, même à côté d'une retenue sans date ancienne", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = "2026-09-20T10:00:00Z"
    db.applications.find((a) => a.id === ID.a4).accepted_at = null
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    // a4 est sans date mais sa candidature date d'août : la retenue ne peut pas être récente
    expect(data.highlight).toBeNull()
  })

  it("retenue sans date : carte seulement si la candidature a été créée il y a 0 à 7 jours", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = "2026-09-20T10:00:00Z"
    const a4 = db.applications.find((a) => a.id === ID.a4)
    a4.accepted_at = null
    for (const [createdAt, expected] of [
      ["2026-10-08T11:00:00Z", "m-a4"],
      ["2026-10-01T13:00:00Z", "m-a4"],
      ["2026-10-01T10:00:00Z", null],
      ["2026-08-20T10:00:00Z", null],
      ["2026-10-09T10:00:00Z", null],
      ["pas une date", null],
    ]) {
      a4.created_at = createdAt
      const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
      expect(data.highlight?.missionId ?? null, createdAt).toBe(expected)
    }
  })

  it("colonne absente : carte sans date seulement pour une candidature de moins de 7 jours", async () => {
    acceptedError = { code: "42703", message: "column applications.accepted_at does not exist" }
    db.applications.find((a) => a.id === ID.a3).created_at = "2026-09-25T10:00:00Z"
    expect((await getStudentApplicationsView({ onglet: "en-cours" })).data.highlight).toBeNull()
    db.applications.find((a) => a.id === ID.a3).created_at = "2026-10-06T10:00:00Z"
    expect((await getStudentApplicationsView({ onglet: "en-cours" })).data.highlight).toMatchObject({ missionId: "m-a3", acceptedAt: null })
  })

  it("une retenue récente datée passe avant une retenue sans date", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = null
    db.applications.find((a) => a.id === ID.a4).accepted_at = "2026-10-06T09:00:00Z"
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.highlight).toMatchObject({ missionId: "m-a4", acceptedAt: "2026-10-06T09:00:00Z" })
  })

  it("accepted_at invalide ou dans le futur : traité comme absent", async () => {
    db.applications.find((a) => a.id === ID.a3).accepted_at = "pas une date"
    db.applications.find((a) => a.id === ID.a4).accepted_at = "2027-01-01T00:00:00Z"
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(data.rows.map((r) => r.acceptedAt)).toEqual([null, null])
    expect(data.highlight).toMatchObject({ missionId: "m-a3", acceptedAt: null })
  })

  it("ligne manquante dans la lecture de la date : carte sans date, page rendue", async () => {
    const original = db.applications
    db.applications = original.filter((a) => a.id !== ID.a3)
    const res = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(res.data.rows.map((r) => r.id)).toEqual([ID.a4])
    // a3 n'existe plus : seule a4 (datée de septembre) reste, donc aucune carte
    expect(res.data.highlight).toBeNull()
  })

  it("colonne absente (42703 et PGRST204) : page rendue, compteurs exacts, carte et notes sans date", async () => {
    for (const code of ["42703", "PGRST204"]) {
      acceptedError = { code, message: "column applications.accepted_at does not exist" }
      const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
      expect(data.counts).toEqual({ "en-attente": 1, "en-cours": 2, terminees: 1, "non-retenues": 3 })
      expect(data.rows.map((r) => r.acceptedAt)).toEqual([null, null])
      expect(data.highlight).toMatchObject({ missionId: "m-a3", acceptedAt: null })
      expect(data.escrow).toEqual({ total: 22000, count: 2 })
    }
  })

  it("autre erreur de la lecture de la date : page rendue sans date, journal par code seulement", async () => {
    acceptedError = { code: "57014", message: "secret interne de la base" }
    const { data, error } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(error).toBeUndefined()
    expect(data.rows.map((r) => r.acceptedAt)).toEqual([null, null])
    expect(data.highlight).toMatchObject({ acceptedAt: null })
    const logged = console.error.mock.calls.flat().join(" ")
    expect(logged).toContain("57014")
    expect(logged).not.toContain("secret interne")
  })

  it("plusieurs retenues en cours : chacune a sa propre date", async () => {
    db.applications.push(app("a9", "accepted", mission({ status: "in_progress" }), { accepted_at: "2026-10-08T09:00:00Z" }))
    const { data } = await getStudentApplicationsView({ onglet: "en-cours" })
    expect(Object.fromEntries(data.rows.map((r) => [r.id, r.acceptedAt]))).toEqual({
      [ID.a3]: "2026-10-07T17:40:00Z", [ID.a4]: "2026-09-01T17:40:00Z", [ID.a9]: "2026-10-08T09:00:00Z",
    })
  })

  it("onglets hors En cours : aucune date de rétention", async () => {
    const { data } = await getStudentApplicationsView({ onglet: "terminees" })
    expect(data.rows.map((r) => r.acceptedAt)).toEqual([null])
  })

  it("aucun usage de updated_at pour la date de rétention (source)", () => {
    const src = readFileSync(new URL("./student-applications.actions.js", import.meta.url), "utf8")
    expect(src).not.toMatch(/acceptedAt:\s*recent\.updated_at/)
    expect(src).not.toMatch(/new Date\([^)]*updated_at/)
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
    const hidden = data.rows.find((r) => r.id === ID.a7)
    expect(hidden).toMatchObject({ missionId: null, title: "Mission indisponible", net: 0, budget: 0 })
  })

  it("erreur de lecture : erreur neutre, rien d'interne", async () => {
    for (const table of ["applications", "profiles", "reviews"]) {
      failTable = table
      const res = await getStudentApplicationsView({ onglet: table === "reviews" ? "terminees" : "en-attente" })
      expect(res).toEqual({ error: "Impossible de charger vos candidatures." })
    }
  })

  it("aucune candidature : onglets à zéro, pas de lecture des clients ni des avis", async () => {
    db.applications = []
    const { data } = await getStudentApplicationsView()
    expect(data).toMatchObject({ tab: "en-attente", total: 0, rows: [], highlight: null, escrow: { total: 0, count: 0 } })
    expect(calls.map((c) => c.table)).toEqual(["applications"])
  })
})
