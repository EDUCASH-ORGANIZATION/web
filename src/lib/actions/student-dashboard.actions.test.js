import { describe, it, expect, vi, beforeEach } from "vitest"

// Faux client Supabase : chaque requête est journalisée puis résolue par `respond`.
const calls = []
let respond

function makeQuery(table, tag) {
  const q = { table, tag, columns: undefined, options: undefined, filters: [] }
  const chain = {
    select: (columns, options) => { q.columns = columns; q.options = options; return chain },
    eq: (c, v) => { q.filters.push(["eq", c, v]); return chain },
    in: (c, v) => { q.filters.push(["in", c, v]); return chain },
    gte: (c, v) => { q.filters.push(["gte", c, v]); return chain },
    order: () => chain,
    limit: (n) => { q.limit = n; return chain },
    range: (a, b) => { q.range = [a, b]; return chain },
    maybeSingle: () => { q.single = true; return chain },
    then: (resolve, reject) => {
      calls.push(q)
      return Promise.resolve(respond(q)).then(resolve, reject)
    },
  }
  return chain
}

const supabase = { from: (table) => makeQuery(table, "session") }
const requireRole = vi.fn()
const getWallet = vi.fn()
const getMyProfile = vi.fn()
const getMyStudentProfile = vi.fn()

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: (...a) => getMyProfile(...a),
  getMyStudentProfile: (...a) => getMyStudentProfile(...a),
}))
vi.mock("@/lib/actions/wallet.actions", () => ({ getWallet: (...a) => getWallet(...a) }))

const { getStudentDashboard } = await import("./student-dashboard.actions")

const isStatus = (q, status) => q.filters.some(([, c, v]) => c === "status" && v === status)

function defaultRespond(q) {
  if (q.table === "profiles" && q.columns === "rating") return { data: { rating: "4.9" }, error: null }
  if (q.table === "missions" && isStatus(q, "in_progress")) {
    return { data: [{ id: "m1", title: "Cours de maths", budget: "15000.00", client_id: "c1" }, { id: "m2", title: "Saisie", budget: 10000, client_id: "c2" }], error: null }
  }
  if (q.table === "missions" && isStatus(q, "done")) {
    return { data: [{ id: "d1", title: "Flyer", client_id: "c1" }, { id: "d2", title: "Garde", client_id: "c2" }], error: null }
  }
  if (q.table === "applications" && q.options?.head) return { count: 5, error: null }
  if (q.table === "applications") return { data: [{ created_at: "2026-10-07T10:00:00Z" }], count: 3, error: null }
  if (q.table === "reviews" && q.options?.head) return { count: 12, error: null }
  if (q.table === "reviews") return { data: [{ mission_id: "d2" }], error: null }
  if (q.table === "messages") {
    return { data: [{ mission_id: "m1", created_at: "2026-10-08T10:00:00Z" }, { mission_id: "m1", created_at: "2026-10-08T09:00:00Z" }, { mission_id: "autre", created_at: "2026-10-01T09:00:00Z" }], count: 3, error: null }
  }
  if (q.table === "profiles") return { data: [{ user_id: "c1", full_name: "Rosine Houngbédji" }, { user_id: "c2", full_name: "Koffi Agbo" }], error: null }
  if (q.table === "wallet_transactions") return { data: [{ amount: 10000 }, { amount: "5040" }], error: null }
  return { data: [], error: null }
}

beforeEach(() => {
  calls.length = 0
  respond = defaultRespond
  requireRole.mockReset().mockResolvedValue({
    supabase,
    user: { id: "stu-1" },
    role: "student",
    profile: { role: "student", full_name: "Sèna Agossou", city: "Cotonou", is_suspended: false },
  })
  getMyProfile.mockReset().mockResolvedValue({
    profile: { is_verified: true, verified_until: "2099-01-01", rejection_reason: "motif prive", phone: "+22901000000" },
  })
  getMyStudentProfile.mockReset().mockResolvedValue({ studentProfile: { card_url: "student-cards/s/c.jpg" } })
  getWallet.mockReset().mockResolvedValue({ wallet: { balance: 47600, reserved: 0 }, available: 47600 })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getStudentDashboard", () => {
  it("exige le rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await getStudentDashboard()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toEqual([])
    expect(getWallet).not.toHaveBeenCalled()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("agrège portefeuille, missions en cours, messages, candidatures, note et avis à laisser", async () => {
    const { data } = await getStudentDashboard()
    expect(getWallet).toHaveBeenCalledWith("stu-1")
    expect(data.firstName).toBe("Sèna")
    expect(data.inProgress).toEqual([
      { id: "m1", title: "Cours de maths", clientName: "Rosine", budget: 15000 },
      { id: "m2", title: "Saisie", clientName: "Koffi", budget: 10000 },
    ])
    // d2 a déjà un avis de l'étudiant : seule d1 reste à noter
    expect(data.toReview).toEqual([{ id: "d1", title: "Flyer", clientName: "Rosine" }])
    expect(data.pendingApplications).toEqual({ count: 3, lastAt: "2026-10-07T10:00:00Z" })
    expect(data.rating).toEqual({ value: 4.9, reviewsCount: 12 })
    expect(data.hasActivity).toBe(true)
  })

  it("séquestre à venir : somme de la part nette (escrowSplit) des missions en cours", async () => {
    const { data } = await getStudentDashboard()
    // 15000 -> 13200 ; 10000 -> 8800
    expect(data.wallet).toEqual({ available: 47600, escrowToCome: 22000, earnedThisMonth: 15040 })
  })

  it("gains du mois : release depuis le 1er du mois au Bénin, sous le user_id de l'étudiant", async () => {
    await getStudentDashboard()
    const q = calls.find((c) => c.table === "wallet_transactions")
    expect(q.filters).toContainEqual(["eq", "user_id", "stu-1"])
    expect(q.filters).toContainEqual(["eq", "type", "release"])
    const since = q.filters.find(([op]) => op === "gte")[2]
    expect(since).toMatch(/^\d{4}-\d{2}-01T00:00:00\+01:00$/)
  })

  it("gains du mois illisibles : null, le tableau de bord se charge quand même", async () => {
    respond = (q) => (q.table === "wallet_transactions" ? { data: null, error: { message: "boom" } } : defaultRespond(q))
    const { data } = await getStudentDashboard()
    expect(data.wallet.earnedThisMonth).toBeNull()
  })

  it("messages non lus : seulement ceux d'une mission en cours de l'étudiant, regroupés par mission", async () => {
    const { data } = await getStudentDashboard()
    expect(data.unread).toEqual([{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 2 }])
  })

  it("ne renvoie jamais de colonne privée : seulement le statut de vérification calculé", async () => {
    const { data } = await getStudentDashboard()
    expect(data.verification.key).toBe("verified")
    const json = JSON.stringify(data)
    expect(json).not.toContain("motif prive")
    expect(json).not.toContain("student-cards")
    expect(json).not.toContain("card_url")
    expect(json).not.toContain("rejection")
    expect(json).not.toContain("22901000000")
  })

  it("carte refusée : statut rejected, motif non renvoyé", async () => {
    getMyProfile.mockResolvedValue({ profile: { is_verified: false, verified_until: null, rejection_reason: "photo floue" } })
    const { data } = await getStudentDashboard()
    expect(data.verification.key).toBe("rejected")
    expect(JSON.stringify(data)).not.toContain("photo floue")
  })

  it("colonnes privées lues par les lectures serveur de profile.actions ; ne lit que les données de l'étudiant connecté", async () => {
    await getStudentDashboard()
    expect(getMyProfile).toHaveBeenCalledTimes(1)
    expect(getMyStudentProfile).toHaveBeenCalledTimes(1)
    for (const q of calls.filter((c) => c.table === "missions")) {
      expect(q.filters).toContainEqual(["eq", "selected_student_id", "stu-1"])
    }
    expect(calls.filter((c) => c.table === "applications").every((c) => c.filters.some(([, k, v]) => k === "student_id" && v === "stu-1"))).toBe(true)
    expect(calls.find((c) => c.table === "messages").filters).toContainEqual(["eq", "receiver_id", "stu-1"])
    expect(calls.find((c) => c.table === "reviews" && !c.options?.head).filters).toContainEqual(["eq", "reviewer_id", "stu-1"])
  })

  it("jamais select(*) ni colonne privée dans les lectures de session", async () => {
    await getStudentDashboard()
    expect(calls.every((c) => c.columns !== "*")).toBe(true)
    for (const q of calls.filter((c) => c.tag === "session")) {
      expect(q.columns).not.toMatch(/card_url|rejection_reason|phone|verification_submitted_at/)
    }
  })

  it("nouvel inscrit : aucune candidature ni mission", async () => {
    respond = (q) => {
      if (q.table === "applications") return { data: [], count: 0, error: null }
      if (q.table === "missions") return { data: [], error: null }
      if (q.table === "messages") return { data: [], count: 0, error: null }
      if (q.table === "reviews") return { count: 0, data: [], error: null }
      return defaultRespond(q)
    }
    const { data } = await getStudentDashboard()
    expect(data.hasActivity).toBe(false)
    expect(data.pendingApplications).toEqual({ count: 0, lastAt: null })
  })

  it("lecture du profil privé en erreur : message neutre", async () => {
    getMyProfile.mockResolvedValue({ error: "Impossible de charger votre profil." })
    expect(await getStudentDashboard()).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("erreur de lecture : message neutre vouvoyé, sans détail technique", async () => {
    respond = (q) => (q.table === "messages" ? { data: null, error: { message: "relation secrète" } } : defaultRespond(q))
    const res = await getStudentDashboard()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("solde illisible : erreur plutôt qu'un faux 0", async () => {
    getWallet.mockResolvedValue({ error: "Impossible de lire votre portefeuille." })
    expect(await getStudentDashboard()).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("exception inattendue : erreur neutre", async () => {
    requireRole.mockRejectedValue(new Error("crash"))
    expect(await getStudentDashboard()).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })
})
