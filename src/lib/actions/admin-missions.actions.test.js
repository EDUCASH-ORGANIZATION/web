import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
const requireRole = vi.fn()
const createServiceClient = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

const { listAdminMissions } = await import("./admin-missions.actions")

const ADMIN = { user: { id: "00000000-0000-4000-8000-0000000000aa" }, role: "admin", profile: { full_name: "Awa Admin" } }
const STUDENT_ID = "00000000-0000-4000-8000-000000000002"

/**
 * Faux client service : chaque requête enregistre ses appels ; `resolve(q)` renvoie `{ data, count, error }`.
 */
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

const mission = (over = {}) => ({
  id: "10000000-0000-4000-8000-000000000001",
  title: "Aide au déménagement",
  type: "Livraison",
  city: "Cotonou",
  budget: 12000,
  status: "in_progress",
  deadline: "2026-10-20",
  created_at: "2026-10-10T08:00:00Z",
  client_id: "00000000-0000-4000-8000-000000000001",
  selected_student_id: STUDENT_ID,
  profiles: { full_name: "Koffi Client" },
  ...over,
})

function resolver({ rows = [mission()], count = 1, declared = "2026-10-12T08:00:00Z", columnMissing = false } = {}) {
  const missing = { data: null, count: null, error: { code: "42703" } }
  const usesColumn = (q) => q.calls.some((c) => c[0] === "not" && c[1] === "completion_declared_at")
  return (q) => {
    if (columnMissing && (q.select === "id, completion_declared_at" || usesColumn(q))) return missing
    if (q.select === "id, completion_declared_at") {
      return { data: rows.map((r) => ({ id: r.id, completion_declared_at: declared })), error: null }
    }
    if (q.table === "profiles") return { data: [{ user_id: STUDENT_ID, full_name: "Esther Etudiante" }], error: null }
    if (q.options?.head) return { count, error: null }
    return { data: rows, error: null, count }
  }
}

beforeEach(() => {
  requireRole.mockReset()
  createServiceClient.mockReset()
  requireRole.mockResolvedValue(ADMIN)
})

describe("listAdminMissions : accès", () => {
  it("refuse un non admin sans ouvrir le client service", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const result = await listAdminMissions({})
    expect(result.error).toBeTruthy()
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un administrateur suspendu (requireRole le signale)", async () => {
    requireRole.mockResolvedValue({ error: "Votre compte est suspendu." })
    const result = await listAdminMissions({ statut: "open" })
    expect(result).toEqual({ error: "Votre compte est suspendu." })
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("listAdminMissions : lecture", () => {
  it("renvoie les lignes avec client, étudiant retenu, fin à confirmer et compteurs", async () => {
    const service = makeService(resolver({ count: 7 }))
    createServiceClient.mockReturnValue(service)
    const result = await listAdminMissions({})
    expect(result.error).toBeUndefined()
    expect(result.total).toBe(7)
    expect(result.counts).toMatchObject({ toutes: 7, open: 7, in_progress: 7, "a-confirmer": 7, done: 7, cancelled: 7 })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      title: "Aide au déménagement",
      clientName: "Koffi Client",
      studentName: "Esther Etudiante",
      awaitingConfirm: true,
      budget: 12000,
    })
    expect(result.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("une mission en cours sans déclaration n'est pas à confirmer", async () => {
    createServiceClient.mockReturnValue(makeService(resolver({ declared: null })))
    const result = await listAdminMissions({})
    expect(result.rows[0].awaitingConfirm).toBe(false)
  })

  it("ne lit que des colonnes explicites et jamais d'e-mail ni de téléphone", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await listAdminMissions({})
    for (const q of service.queries) {
      expect(q.select).not.toBe("*")
      expect(q.select).not.toMatch(/phone|email|fcm_token|card_url/)
    }
  })

  it("la pagination est côté serveur : 25 lignes, plage de la page demandée", async () => {
    const service = makeService(resolver({ count: 120 }))
    createServiceClient.mockReturnValue(service)
    const result = await listAdminMissions({ page: "3" })
    expect(result.page).toBe(3)
    expect(result.pageCount).toBe(5)
    const list = service.queries.find((q) => q.table === "missions" && !q.options?.head)
    expect(list.calls.find((c) => c[0] === "range").slice(1)).toEqual([50, 74])
  })

  it("une page hors limites est ramenée à la dernière page", async () => {
    const service = makeService(resolver({ count: 30 }))
    createServiceClient.mockReturnValue(service)
    const result = await listAdminMissions({ page: "999999" })
    expect(result.page).toBe(2)
    const list = service.queries.find((q) => q.table === "missions" && !q.options?.head)
    expect(list.calls.find((c) => c[0] === "range").slice(1)).toEqual([25, 49])
  })

  it.each([["-1"], ["1e9"], ["abc"], [""], ["0"]])("page invalide %j : première page", async (page) => {
    const service = makeService(resolver({ count: 30 }))
    createServiceClient.mockReturnValue(service)
    const result = await listAdminMissions({ page })
    expect(result.page).toBe(1)
  })
})

describe("listAdminMissions : filtres", () => {
  it("applique statut, ville et type de la liste fermée", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await listAdminMissions({ statut: "open", ville: "Cotonou", type: "Livraison" })
    const list = service.queries.find((q) => q.table === "missions" && !q.options?.head)
    expect(list.calls).toEqual(expect.arrayContaining([["eq", "status", "open"], ["eq", "city", "Cotonou"], ["eq", "type", "Livraison"]]))
  })

  it("« à confirmer » filtre sur la date de déclaration, sans jointure sur mission_completions", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await listAdminMissions({ statut: "a-confirmer" })
    const list = service.queries.find((q) => q.table === "missions" && !q.options?.head && q.select !== "id, completion_declared_at")
    expect(list.calls).toContainEqual(["eq", "status", "in_progress"])
    expect(list.calls).toContainEqual(["not", "completion_declared_at", "is", null])
    const counts = service.queries.filter((q) => q.options?.head && q.calls.some((c) => c[0] === "not"))
    expect(counts).toHaveLength(1)
    for (const q of service.queries) expect(q.select ?? "").not.toContain("mission_completions")
  })

  it("colonne de déclaration absente : compteur 0, onglet vide, aucune erreur", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ columnMissing: true, count: 4 })))
    const result = await listAdminMissions({ statut: "a-confirmer" })
    expect(result.error).toBeUndefined()
    expect(result.counts["a-confirmer"]).toBe(0)
    expect(result.counts.toutes).toBe(4)
    expect(result.total).toBe(0)
    expect(result.rows).toEqual([])
    spy.mockRestore()
  })

  it("colonne absente : les autres onglets se rendent, sans fin à confirmer", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ columnMissing: true, count: 4 })))
    const result = await listAdminMissions({ statut: "in_progress" })
    expect(result.error).toBeUndefined()
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].awaitingConfirm).toBe(false)
    spy.mockRestore()
  })

  it("ignore les valeurs hors liste (statut, ville, type)", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    const result = await listAdminMissions({ statut: "done or 1=1", ville: "Paris", type: "'; drop table missions;--" })
    expect(result).toMatchObject({ statut: "toutes", ville: "", type: "" })
    const list = service.queries.find((q) => q.table === "missions" && !q.options?.head)
    expect(list.calls.filter((c) => c[0] === "eq")).toEqual([])
  })

  it("recherche hostile : caractères du filtre échappés, une seule colonne, jamais .or()", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    const hostile = "50%_off,title.eq.x),or=(status.eq.done" + "a".repeat(200)
    const result = await listAdminMissions({ q: hostile })
    expect(result.error).toBeUndefined()
    expect(result.q.length).toBeLessThanOrEqual(80)
    for (const q of service.queries.filter((x) => x.table === "missions" && x.select !== "id, completion_declared_at")) {
      expect(q.calls.find((c) => c[0] === "or")).toBeUndefined()
      const like = q.calls.find((c) => c[0] === "ilike")
      expect(like[1]).toBe("title")
      expect(like[2]).toMatch(/^%.*%$/)
      expect(like[2]).toContain("\\%\\_off\\,title.eq.x\\)\\,or=\\(status.eq.done")
    }
  })

  it("une erreur de lecture renvoie un message neutre sans détail technique", async () => {
    createServiceClient.mockReturnValue(
      makeService((q) => (q.table === "missions" ? { data: null, count: null, error: { message: "relation missions secret" } } : { data: [], error: null })),
    )
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await listAdminMissions({})
    spy.mockRestore()
    expect(result.error).toMatch(/Réessayez/)
    expect(JSON.stringify(result)).not.toMatch(/secret|relation/)
  })
})
