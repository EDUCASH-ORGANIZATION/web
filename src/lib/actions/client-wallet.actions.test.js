import { describe, it, expect, vi, beforeEach } from "vitest"

const requireRole = vi.fn()
const getWallet = vi.fn()
const getWalletTransactions = vi.fn()
const getMyProfile = vi.fn()
let missionsResult
let profilesResult
const calls = []

function table(name) {
  const record = (method) => (...args) => {
    calls.push({ table: name, method, args })
    return b
  }
  const result = () => (name === "profiles" ? profilesResult : missionsResult)
  const b = {
    select: record("select"),
    eq: record("eq"),
    in: record("in"),
    order: record("order"),
    limit: record("limit"),
    then: (res, rej) => Promise.resolve(result()).then(res, rej),
  }
  return b
}
const supabase = { from: (name) => table(name) }

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/wallet.actions", () => ({
  getWallet: (...a) => getWallet(...a),
  getWalletTransactions: (...a) => getWalletTransactions(...a),
}))
vi.mock("@/lib/actions/profile.actions", () => ({ getMyProfile: (...a) => getMyProfile(...a) }))
vi.mock("next/navigation", () => ({ unstable_rethrow: (e) => { throw e } }))

const { getClientFundedMissions, getClientWalletPage, getClientWalletMoreTransactions } = await import("./client-wallet.actions")

const row = (over) => ({ id: "t1", type: "deposit", amount: 5000, created_at: "2026-10-05T10:00:00Z", mission_id: null, missions: null, ...over })

beforeEach(() => {
  calls.length = 0
  for (const f of [requireRole, getWallet, getWalletTransactions, getMyProfile]) f.mockReset()
  vi.stubEnv("PAYMENTS_ENABLED", "false")
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ supabase, user: { id: "client-1" }, role: "client", profile: {} })
  getWallet.mockResolvedValue({ wallet: { balance: 66500, reserved: 54000 }, available: 12500 })
  getWalletTransactions.mockResolvedValue([])
  getMyProfile.mockResolvedValue({ profile: { phone: "+2290197452108" } })
  missionsResult = { data: [], error: null }
  profilesResult = { data: [], error: null }
})

describe("garde de rôle", () => {
  it.each([
    ["getClientFundedMissions", () => getClientFundedMissions()],
    ["getClientWalletPage", () => getClientWalletPage({})],
    ["getClientWalletMoreTransactions", () => getClientWalletMoreTransactions({})],
  ])("%s exige requireRole([client]) avant toute lecture", async (_n, call) => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await call()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(res.error).toBeTruthy()
    expect(getWallet).not.toHaveBeenCalled()
    expect(getWalletTransactions).not.toHaveBeenCalled()
    expect(getMyProfile).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })
})

describe("getClientFundedMissions", () => {
  it("lit les missions ouvertes et en cours du client connecté, avec le budget réservé", async () => {
    missionsResult = {
      data: [
        { id: "m1", title: "Cours de maths", status: "in_progress", budget: 25000, deadline: null, selected_student_id: "s1", applications: [] },
        { id: "m2", title: "Flyer", status: "open", budget: 8000, deadline: "2026-12-01", selected_student_id: null, applications: [{ id: "a", status: "pending" }, { id: "b", status: "rejected" }, { id: "c", status: "pending" }] },
      ],
      error: null,
    }
    profilesResult = { data: [{ user_id: "s1", full_name: "Sèna Agossou" }], error: null }
    const res = await getClientFundedMissions()
    expect(calls).toContainEqual({ table: "missions", method: "eq", args: ["client_id", "client-1"] })
    expect(calls).toContainEqual({ table: "missions", method: "in", args: ["status", ["open", "in_progress"]] })
    expect(res.missions).toEqual([
      { id: "m1", title: "Cours de maths", status: "in_progress", budget: 25000, deadline: null, studentName: "Sèna", pendingCount: 0 },
      { id: "m2", title: "Flyer", status: "open", budget: 8000, deadline: "2026-12-01", studentName: null, pendingCount: 2 },
    ])
  })

  it("ne lit que des colonnes publiques de profiles, jamais select(*)", async () => {
    missionsResult = { data: [{ id: "m1", title: "x", status: "in_progress", budget: 1, selected_student_id: "s1", applications: [] }], error: null }
    await getClientFundedMissions()
    const profileSelect = calls.find((c) => c.table === "profiles" && c.method === "select")
    expect(profileSelect.args[0]).toBe("user_id, full_name")
  })

  it("renvoie une erreur neutre (sans le détail) si la lecture échoue", async () => {
    missionsResult = { data: null, error: { message: 'permission denied for table "missions"' } }
    const res = await getClientFundedMissions()
    expect(res).toEqual({ error: "Impossible de charger vos missions financées." })
    missionsResult = { data: [{ id: "m1", title: "x", status: "in_progress", budget: 1, selected_student_id: "s1", applications: [] }], error: null }
    profilesResult = { data: null, error: { message: "secret detail" } }
    expect(JSON.stringify(await getClientFundedMissions())).not.toMatch(/secret/)
  })
})

describe("getClientWalletPage", () => {
  it("assemble solde, séquestre, historique et missions financées", async () => {
    getWalletTransactions.mockResolvedValue([row({ id: "t1", type: "reserve", amount: 8000, mission_id: "m2", missions: { title: "Flyer" } })])
    const res = await getClientWalletPage({})
    expect(res.data.wallet).toEqual({ available: 12500, escrow: 54000, total: 66500 })
    expect(res.data.transactions).toEqual([
      { id: "t1", type: "reserve", amount: 8000, createdAt: "2026-10-05T10:00:00Z", missionId: "m2", missionTitle: "Flyer" },
    ])
    expect(res.data.hasMore).toBe(false)
    expect(res.data.filter).toBe("tout")
    expect(res.data.funded).toEqual([])
  })

  it("lit une page de 21 pour savoir s'il en reste et n'en rend que 20", async () => {
    getWalletTransactions.mockResolvedValue(Array.from({ length: 21 }, (_, i) => row({ id: `t${i}` })))
    const res = await getClientWalletPage({})
    expect(getWalletTransactions).toHaveBeenCalledWith("client-1", 21, 0, undefined)
    expect(res.data.transactions).toHaveLength(20)
    expect(res.data.hasMore).toBe(true)
  })

  it("filtre l'historique par type pour chacun des 7 filtres, un filtre inconnu donne tout", async () => {
    const expected = { recharges: ["deposit"], reservations: ["reserve"], liberations: ["release"], commissions: ["commission"], remboursements: ["refund"], retraits: ["withdrawal"] }
    for (const [filtre, types] of Object.entries(expected)) {
      getWalletTransactions.mockClear()
      const res = await getClientWalletPage({ filtre })
      expect(getWalletTransactions).toHaveBeenCalledWith("client-1", 21, 0, types)
      expect(res.data.filter).toBe(filtre)
    }
    for (const filtre of ["tout", "n'importe quoi", undefined, ["retraits"], "__proto__"]) {
      getWalletTransactions.mockClear()
      await getClientWalletPage({ filtre })
      const [, , , types] = getWalletTransactions.mock.calls[0]
      if (Array.isArray(filtre)) expect(types).toEqual(["withdrawal"])
      else expect(types).toBeUndefined()
    }
  })

  it("passe en erreur si le solde ou l'historique est illisible, sans zéro de remplacement", async () => {
    getWallet.mockResolvedValue({ error: "Impossible de charger votre portefeuille." })
    expect(await getClientWalletPage({})).toEqual({ error: "Impossible de charger votre portefeuille." })
    getWallet.mockResolvedValue({ wallet: { balance: 1, reserved: 0 }, available: 1 })
    getWalletTransactions.mockResolvedValue({ error: "x" })
    expect(await getClientWalletPage({})).toEqual({ error: "Impossible de charger votre portefeuille." })
  })

  it("garde la page si seules les missions financées sont illisibles", async () => {
    missionsResult = { data: null, error: { message: "x" } }
    const res = await getClientWalletPage({})
    expect(res.data.funded).toBeNull()
    expect(res.data.wallet.available).toBe(12500)
  })

  it("ne lit pas le téléphone quand les paiements sont coupés", async () => {
    const res = await getClientWalletPage({})
    expect(getMyProfile).not.toHaveBeenCalled()
    expect(res.data.phone).toBe("")
  })

  it("pré-remplit le numéro de l'utilisateur quand les paiements sont ouverts, formaté", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    const res = await getClientWalletPage({})
    expect(getMyProfile).toHaveBeenCalledTimes(1)
    expect(res.data.phone).toBe("01 97 45 21 08")
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("0197"))
  })

  it("un profil illisible ou un numéro invalide donne un champ vide, jamais une erreur", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    getMyProfile.mockResolvedValue({ error: "x" })
    expect((await getClientWalletPage({})).data.phone).toBe("")
    getMyProfile.mockResolvedValue({ profile: { phone: "12345" } })
    expect((await getClientWalletPage({})).data.phone).toBe("")
    getMyProfile.mockResolvedValue({ profile: null })
    expect((await getClientWalletPage({})).data.phone).toBe("")
  })

  it("ne renvoie aucune autre colonne privée du profil", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    getMyProfile.mockResolvedValue({ profile: { phone: "0197452108", rejection_reason: "secret", verification_submitted_at: "x" } })
    const res = await getClientWalletPage({})
    expect(JSON.stringify(res)).not.toMatch(/secret|verification_submitted_at|rejection/)
  })
})

describe("getClientWalletMoreTransactions", () => {
  it("lit la page suivante du filtre et signale s'il en reste", async () => {
    getWalletTransactions.mockResolvedValue(Array.from({ length: 21 }, (_, i) => row({ id: `n${i}` })))
    const res = await getClientWalletMoreTransactions({ filtre: "recharges", offset: 20 })
    expect(getWalletTransactions).toHaveBeenCalledWith("client-1", 21, 20, ["deposit"])
    expect(res.transactions).toHaveLength(20)
    expect(res.hasMore).toBe(true)
  })

  it("assainit le décalage", async () => {
    for (const offset of [-5, 1.5, "20", null, undefined, Number.NaN]) {
      getWalletTransactions.mockClear()
      await getClientWalletMoreTransactions({ offset })
      expect(getWalletTransactions.mock.calls[0][2]).toBe(0)
    }
    getWalletTransactions.mockClear()
    await getClientWalletMoreTransactions({ offset: 10 ** 9 })
    expect(getWalletTransactions.mock.calls[0][2]).toBe(100000)
  })

  it("renvoie une erreur neutre si la lecture échoue", async () => {
    getWalletTransactions.mockResolvedValue({ error: "x" })
    expect(await getClientWalletMoreTransactions({ offset: 20 })).toEqual({ error: "Impossible de charger les mouvements suivants." })
  })
})
