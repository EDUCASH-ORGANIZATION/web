import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
const requireRole = vi.fn()
const createServiceClient = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

const { getAdminMissionDetail } = await import("./admin-mission-detail.actions")

const ADMIN = { user: { id: "00000000-0000-4000-8000-0000000000aa" }, role: "admin", profile: { full_name: "Awa Admin" } }
const MISSION_ID = "10000000-0000-4000-8000-000000000001"
const CLIENT = "00000000-0000-4000-8000-000000000001"
const STUDENT = "00000000-0000-4000-8000-000000000002"
const OTHER = "00000000-0000-4000-8000-000000000003"

function makeService(resolve) {
  const queries = []
  return {
    queries,
    from(table) {
      const q = { table, select: null, options: null, calls: [] }
      queries.push(q)
      const b = new Proxy(
        {},
        {
          get(_, name) {
            if (name === "then") return (ok, ko) => Promise.resolve(resolve(q)).then(ok, ko)
            if (name === "select") {
              return (cols, options) => {
                q.select = cols
                q.options = options ?? null
                return b
              }
            }
            return (...args) => {
              q.calls.push([String(name), ...args])
              return b
            }
          },
        },
      )
      return b
    },
  }
}

const MISSION = {
  id: MISSION_ID,
  title: "Aide au déménagement",
  description: "Porter des cartons.",
  type: "Livraison",
  city: "Cotonou",
  budget: 10000,
  urgency: "low",
  deadline: "2026-10-20",
  status: "in_progress",
  created_at: "2026-10-10T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
  client_id: CLIENT,
  selected_student_id: STUDENT,
}

function resolver(over = {}) {
  const data = {
    missions: MISSION,
    applications: [
      { id: "a1", student_id: STUDENT, status: "accepted", created_at: "2026-10-11T08:00:00Z" },
      { id: "a2", student_id: OTHER, status: "rejected", created_at: "2026-10-11T09:00:00Z" },
    ],
    mission_completions: { created_at: "2026-10-13T08:00:00Z" },
    declared: [{ id: MISSION_ID, completion_declared_at: "2026-10-12T08:00:00Z" }],
    reviews: [{ id: "r1", reviewer_id: CLIENT, rating: 5, comment: "Parfait", created_at: "2026-10-14T08:00:00Z" }],
    wallet_transactions: [
      { id: "w1", user_id: CLIENT, type: "reserve", amount: 10000, created_at: "2026-10-10T08:01:00Z" },
    ],
    profiles: [
      { user_id: CLIENT, full_name: "Koffi Client" },
      { user_id: STUDENT, full_name: "Esther Etudiante" },
      { user_id: OTHER, full_name: "Yao Autre" },
    ],
    ...over,
  }
  return (q) => {
    if (q.table === "missions" && q.select === "id, completion_declared_at") {
      const value = data.declared
      if (value && typeof value === "object" && "error" in value) return { data: null, error: value.error }
      return { data: value, error: null }
    }
    const value = data[q.table]
    if (value && typeof value === "object" && "error" in value) return { data: null, error: value.error }
    return { data: value, error: null, count: Array.isArray(value) ? value.length : undefined }
  }
}

beforeEach(() => {
  requireRole.mockReset()
  createServiceClient.mockReset()
  requireRole.mockResolvedValue(ADMIN)
})

describe("getAdminMissionDetail : accès et identifiants", () => {
  it("refuse un non admin sans ouvrir le client service", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(await getAdminMissionDetail(MISSION_ID)).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un administrateur suspendu", async () => {
    requireRole.mockResolvedValue({ error: "Votre compte est suspendu." })
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([[""], ["abc"], ["1 or 1=1"], [MISSION_ID.slice(0, 20)], [undefined], [null], [42], [{ id: MISSION_ID }]])(
    "identifiant non uuid %j : introuvable, aucune lecture",
    async (id) => {
      const service = makeService(resolver())
      createServiceClient.mockReturnValue(service)
      expect(await getAdminMissionDetail(id)).toEqual({ notFound: true })
      expect(service.queries).toHaveLength(0)
    },
  )

  it("mission inexistante : introuvable", async () => {
    createServiceClient.mockReturnValue(makeService(resolver({ missions: null })))
    expect(await getAdminMissionDetail(MISSION_ID)).toEqual({ notFound: true })
  })
})

describe("getAdminMissionDetail : lecture", () => {
  it("renvoie mission, parties, candidatures, fin, avis et grand livre", async () => {
    createServiceClient.mockReturnValue(makeService(resolver()))
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeUndefined()
    expect(result.mission).toMatchObject({ id: MISSION_ID, status: "in_progress", budget: 10000, clientId: CLIENT })
    expect(result.client).toEqual({ id: CLIENT, name: "Koffi Client" })
    expect(result.student).toEqual({ id: STUDENT, name: "Esther Etudiante" })
    expect(result.applications.total).toBe(2)
    expect(result.applications.items[0]).toMatchObject({ name: "Esther Etudiante", status: "accepted", selected: true })
    expect(result.applications.items[1]).toMatchObject({ name: "Yao Autre", selected: false })
    expect(result.completion).toEqual({ declaredAt: "2026-10-12T08:00:00Z", finishedAt: "2026-10-13T08:00:00Z" })
    expect(result.reviews[0]).toMatchObject({ rating: 5, byRole: "client" })
    expect(result.ledger[0]).toMatchObject({ type: "reserve", party: "client", amount: 10000 })
  })

  it("mission sans étudiant ni fin : champs vides explicites", async () => {
    createServiceClient.mockReturnValue(
      makeService(resolver({ missions: { ...MISSION, status: "open", selected_student_id: null }, mission_completions: null, declared: [{ id: MISSION_ID, completion_declared_at: null }], applications: [], reviews: [], wallet_transactions: [] })),
    )
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.student).toBeNull()
    expect(result.completion).toEqual({ declaredAt: null, finishedAt: null })
    expect(result.applications).toEqual({ total: 0, items: [] })
  })

  it("colonne de déclaration absente : la page se rend, sans déclaration", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ declared: { error: { code: "42703" } } })))
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeUndefined()
    expect(result.completion).toEqual({ declaredAt: null, finishedAt: "2026-10-13T08:00:00Z" })
    spy.mockRestore()
  })

  it("autre erreur sur la lecture de la déclaration : message neutre", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ declared: { error: { code: "XX000" } } })))
    expect((await getAdminMissionDetail(MISSION_ID)).error).toBeTruthy()
    spy.mockRestore()
  })

  it("n'écrit jamais la colonne de déclaration", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    for (const q of service.queries) {
      expect(q.calls.find((c) => ["update", "insert", "upsert", "delete"].includes(c[0]))).toBeUndefined()
    }
  })

  it("ne lit jamais les messages, jamais select(*), aucune donnée privée de profil", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    expect(service.queries.map((q) => q.table).sort()).toEqual(
      ["applications", "mission_completions", "missions", "missions", "profiles", "reviews", "wallet_transactions"].sort(),
    )
    for (const q of service.queries) {
      expect(q.select).not.toBe("*")
      expect(q.select).not.toMatch(/phone|email|fcm_token|card_url|rejection_reason/)
    }
  })

  it("le grand livre est limité à cette mission et aux types liés à la mission", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    const ledger = service.queries.find((q) => q.table === "wallet_transactions")
    expect(ledger.calls).toContainEqual(["eq", "mission_id", MISSION_ID])
    expect(ledger.calls.find((c) => c[0] === "in")[2]).toEqual(["reserve", "release", "commission", "refund"])
  })

  it("une lecture en erreur renvoie un message neutre sans détail technique", async () => {
    createServiceClient.mockReturnValue(makeService(resolver({ wallet_transactions: { error: { message: "permission denied for table secret" } } })))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await getAdminMissionDetail(MISSION_ID)
    spy.mockRestore()
    expect(result.error).toMatch(/Réessayez/)
    expect(JSON.stringify(result)).not.toMatch(/secret|permission/)
  })
})
