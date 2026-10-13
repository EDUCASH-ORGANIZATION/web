import { describe, it, expect, vi, beforeEach } from "vitest"

// Faux client Supabase : chaque requête est journalisée puis résolue par `respond`.
const calls = []
let respond

function makeQuery(table) {
  const q = { table, columns: undefined, options: undefined, filters: [] }
  const chain = {
    select: (columns, options) => {
      q.columns = columns
      q.options = options
      return chain
    },
    eq: (c, v) => { q.filters.push(["eq", c, v]); return chain },
    in: (c, v) => { q.filters.push(["in", c, v]); return chain },
    order: () => chain,
    limit: (n) => { q.limit = n; return chain },
    then: (resolve, reject) => {
      calls.push(q)
      return Promise.resolve(respond(q)).then(resolve, reject)
    },
  }
  return chain
}

const supabase = { from: (table) => makeQuery(table) }
const requireRole = vi.fn()
const getWallet = vi.fn()

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/wallet.actions", () => ({ getWallet: (...a) => getWallet(...a) }))

const { getClientDashboard } = await import("./client-dashboard.actions")

const isStatus = (q, status) => q.filters.some(([, c, v]) => c === "status" && v === status)
const hasStatusIn = (q) => q.filters.some(([op, c]) => op === "in" && c === "status")

function defaultRespond(q) {
  if (q.table === "missions" && q.options?.head) return { count: 3, error: null }
  if (q.table === "missions" && hasStatusIn(q)) {
    return {
      data: [
        { id: "m1", title: "Traduire un flyer", status: "open", budget: "6000.00", deadline: "2026-10-30", created_at: "2026-10-01T08:00:00Z", selected_student_id: null },
        { id: "m2", title: "Cours de maths", status: "in_progress", budget: 15000, deadline: null, created_at: "2026-09-20T08:00:00Z", selected_student_id: "s1" },
      ],
      error: null,
    }
  }
  if (q.table === "missions" && isStatus(q, "done")) {
    return {
      data: [
        { id: "d1", title: "Livraison de documents", selected_student_id: "s1", updated_at: "2026-10-05T10:00:00Z" },
        { id: "d2", title: "Garde de nuit", selected_student_id: "s2", updated_at: "2026-10-04T10:00:00Z" },
      ],
      error: null,
    }
  }
  if (q.table === "applications") {
    return {
      data: [
        { mission_id: "m1", created_at: "2026-10-04T08:00:00Z" },
        { mission_id: "m1", created_at: "2026-10-02T08:00:00Z" },
      ],
      error: null,
    }
  }
  if (q.table === "reviews") return { data: [{ mission_id: "d2" }], error: null }
  if (q.table === "profiles") {
    return { data: [{ user_id: "s1", full_name: "Sèna Agossou" }, { user_id: "s2", full_name: "Afiavi Dossou" }], error: null }
  }
  return { data: [], error: null }
}

beforeEach(() => {
  calls.length = 0
  respond = defaultRespond
  requireRole.mockReset().mockResolvedValue({
    supabase,
    user: { id: "client-1" },
    role: "client",
    profile: { role: "client", full_name: "Rosine Houngbédji", city: "Cotonou", is_suspended: false },
  })
  getWallet.mockReset().mockResolvedValue({ wallet: { balance: 66500, reserved: 54000 }, available: 12500 })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getClientDashboard", () => {
  it("exige le rôle client avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await getClientDashboard()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(calls).toEqual([])
    expect(getWallet).not.toHaveBeenCalled()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("agrège portefeuille, missions actives, candidatures en attente et avis à laisser", async () => {
    const { data } = await getClientDashboard()
    expect(getWallet).toHaveBeenCalledWith("client-1")
    expect(data.firstName).toBe("Rosine")
    expect(data.wallet).toEqual({ available: 12500, escrow: 54000 })
    expect(data.totalMissions).toBe(3)
    expect(data.active).toEqual([
      { id: "m1", title: "Traduire un flyer", status: "open", budget: 6000, deadline: "2026-10-30", createdAt: "2026-10-01T08:00:00Z", studentName: null, pendingCount: 2, oldestPendingAt: "2026-10-02T08:00:00Z" },
      { id: "m2", title: "Cours de maths", status: "in_progress", budget: 15000, deadline: null, createdAt: "2026-09-20T08:00:00Z", studentName: "Sèna", pendingCount: 0, oldestPendingAt: null },
    ])
    // d2 a déjà un avis du client : seule d1 reste à noter
    expect(data.toReview).toEqual([{ id: "d1", title: "Livraison de documents", studentName: "Sèna" }])
  })

  it("ne lit que les données du client connecté et des colonnes explicites", async () => {
    await getClientDashboard()
    for (const q of calls.filter((c) => c.table === "missions")) {
      expect(q.filters).toContainEqual(["eq", "client_id", "client-1"])
    }
    expect(calls.find((c) => c.table === "reviews").filters).toContainEqual(["eq", "reviewer_id", "client-1"])
    expect(calls.find((c) => c.table === "applications").filters).toContainEqual(["in", "mission_id", ["m1"]])
    expect(calls.every((c) => c.columns !== "*")).toBe(true)
  })

  it("ne demande aucune colonne privée des profils", async () => {
    await getClientDashboard()
    expect(calls.find((c) => c.table === "profiles").columns).toBe("user_id, full_name")
    const asked = calls.map((c) => c.columns).join(" ")
    for (const secret of ["phone", "card_url", "role", "is_suspended", "user_metadata"]) {
      expect(asked).not.toContain(secret)
    }
  })

  it("renvoie un nouveau client sans requêtes inutiles", async () => {
    respond = (q) => {
      if (q.options?.head) return { count: 0, error: null }
      return { data: [], error: null }
    }
    getWallet.mockResolvedValue({ wallet: { balance: 0, reserved: 0 }, available: 0 })
    const { data } = await getClientDashboard()
    expect(data.totalMissions).toBe(0)
    expect(data.active).toEqual([])
    expect(data.toReview).toEqual([])
    expect(calls.map((c) => c.table).sort()).toEqual(["missions", "missions", "missions"])
  })

  it("renvoie une erreur neutre si une lecture échoue, sans exposer le détail", async () => {
    respond = (q) => (q.table === "reviews" ? { data: null, error: { message: "relation secrète" } } : defaultRespond(q))
    const res = await getClientDashboard()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
    expect(JSON.stringify(res)).not.toContain("secrète")
  })

  it("ne remplace pas un solde illisible par zéro", async () => {
    getWallet.mockResolvedValue({ error: "Impossible de charger ton portefeuille." })
    const res = await getClientDashboard()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("renvoie une erreur neutre sur une exception inattendue", async () => {
    getWallet.mockRejectedValue(new Error("boom"))
    expect(await getClientDashboard()).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })
})
