import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Faux client Supabase : chaque requête est journalisée puis résolue par `respond`.
const calls = []
let respond

function makeQuery(table) {
  const q = { table, columns: undefined, filters: [], range: null }
  const chain = {
    select: (columns) => { q.columns = columns; return chain },
    eq: (c, v) => { q.filters.push(["eq", c, v]); return chain },
    in: (c, v) => { q.filters.push(["in", c, v]); return chain },
    is: (c, v) => { q.filters.push(["is", c, v]); return chain },
    order: () => chain,
    limit: (n) => { q.limit = n; return chain },
    range: (a, b) => { q.range = [a, b]; return chain },
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
const getWalletTransactions = vi.fn()
const getMyProfile = vi.fn()
const paymentsEnabled = vi.fn()

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/wallet.actions", () => ({
  getWallet: (...a) => getWallet(...a),
  getWalletTransactions: (...a) => getWalletTransactions(...a),
}))
vi.mock("@/lib/actions/profile.actions", () => ({ getMyProfile: (...a) => getMyProfile(...a) }))
vi.mock("@/lib/constants/payments", async (importOriginal) => ({
  ...(await importOriginal()),
  paymentsEnabled: () => paymentsEnabled(),
}))

const { getStudentWallet, getStudentWalletMore, getStudentWithdrawPrefill } = await import("./student-wallet.actions")

const isLedger = (q, type) => q.table === "wallet_transactions" && q.filters.some(([, c, v]) => c === "type" && v === type)

function defaultRespond(q) {
  if (isLedger(q, "release")) {
    return {
      data: [
        { amount: "7040", created_at: "2026-10-12T09:00:00Z" }, // semaine du 12 oct. (en cours)
        { amount: 10000, created_at: "2026-10-06T09:00:00Z" }, // semaine du 5 oct.
        { amount: 2000, created_at: "2026-08-20T09:00:00Z" }, // hors des 8 semaines : compté au total seulement
      ],
      error: null,
    }
  }
  if (isLedger(q, "withdrawal")) return { data: [], error: null }
  if (q.table === "missions") {
    return { data: [{ id: "m1", title: "Cours de maths", budget: "25000.00", client_id: "c1" }, { id: "m2", title: "Flyer", budget: 10000, client_id: "c2" }], error: null }
  }
  if (q.table === "profiles") return { data: [{ user_id: "c1", full_name: "Rosine Houngbédji" }, { user_id: "c2", full_name: "Koffi Agbo" }], error: null }
  return { data: [], error: null }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-14T10:00:00Z")) // mercredi
  calls.length = 0
  respond = defaultRespond
  paymentsEnabled.mockReset().mockReturnValue(true)
  requireRole.mockReset().mockResolvedValue({ supabase, user: { id: "stu-1" }, role: "student", profile: { role: "student" } })
  getWallet.mockReset().mockResolvedValue({ wallet: { balance: 47600, reserved: 0 }, available: 47600 })
  getWalletTransactions.mockReset().mockResolvedValue([])
  getMyProfile.mockReset().mockResolvedValue({ profile: { phone: "+2290197452108" } })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getStudentWallet", () => {
  it("exige le rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await getStudentWallet()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toEqual([])
    expect(getWallet).not.toHaveBeenCalled()
    expect(getWalletTransactions).not.toHaveBeenCalled()
    expect(res).toEqual({ error: "Impossible de charger ton portefeuille." })
  })

  it("ne lit jamais la table historique `transactions` : seul le grand livre est utilisé", async () => {
    await getStudentWallet({ filtre: "retraits" })
    await getStudentWalletMore({ filtre: "tout", offset: 20 })
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.map((c) => c.table)).not.toContain("transactions")
    expect(new Set(calls.map((c) => c.table))).toEqual(new Set(["wallet_transactions", "missions", "profiles"]))
  })

  it("renvoie le disponible lu par getWallet, jamais un total du navigateur", async () => {
    const { data } = await getStudentWallet()
    expect(getWallet).toHaveBeenCalledWith("stu-1")
    expect(data.wallet).toEqual({ available: 47600 })
  })

  it("filtre : valeur validée puis types du grand livre (release pour les paiements)", async () => {
    await getStudentWallet({ filtre: "paiements" })
    expect(getWalletTransactions).toHaveBeenCalledWith("stu-1", 21, 0, ["release"])
    getWalletTransactions.mockClear()
    const { data } = await getStudentWallet({ filtre: "n'importe quoi" })
    expect(data.filter).toBe("tout")
    expect(getWalletTransactions).toHaveBeenCalledWith("stu-1", 21, 0, undefined)
  })

  it("première page de 20 mouvements, « Voir plus » si le 21e existe, montants en valeur absolue", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ id: `t${i}`, type: "release", amount: -1500, created_at: "2026-10-05T10:00:00Z", mission_id: "m1", missions: { title: "Flyer" } }))
    getWalletTransactions.mockResolvedValue(rows)
    const { data } = await getStudentWallet()
    expect(data.transactions).toHaveLength(20)
    expect(data.hasMore).toBe(true)
    expect(data.transactions[0]).toEqual({ id: "t0", type: "release", amount: 1500, createdAt: "2026-10-05T10:00:00Z", missionId: "m1", missionTitle: "Flyer" })
  })

  it("gains : release de la session, 8 semaines (la courante en dernier) et total", async () => {
    const { data } = await getStudentWallet()
    const q = calls.find((c) => isLedger(c, "release"))
    expect(q.filters).toContainEqual(["eq", "user_id", "stu-1"])
    expect(q.range).toEqual([0, 999])
    expect(data.gains.weeks).toHaveLength(8)
    expect(data.gains.weeks[7]).toEqual({ start: "2026-10-12", total: 7040 })
    expect(data.gains.weeks[6]).toEqual({ start: "2026-10-05", total: 10000 })
    expect(data.gains.eightWeeks).toBe(17040)
    expect(data.gains.total).toBe(19040)
  })

  it("gains : pagination par 1000 lignes, une page de plus quand la première est pleine", async () => {
    const full = Array.from({ length: 1000 }, () => ({ amount: 10, created_at: "2026-10-13T10:00:00Z" }))
    respond = (q) => (isLedger(q, "release") ? { data: q.range[0] === 0 ? full : [{ amount: 5, created_at: "2026-10-13T10:00:00Z" }], error: null } : defaultRespond(q))
    const { data } = await getStudentWallet()
    const pages = calls.filter((c) => isLedger(c, "release")).map((c) => c.range)
    expect(pages).toEqual([[0, 999], [1000, 1999]])
    expect(data.gains.total).toBe(10005)
  })

  it("gains : erreur ou plafond atteint => omis (null), jamais un faux 0, le reste se charge", async () => {
    respond = (q) => (isLedger(q, "release") ? { data: null, error: { message: "boom" } } : defaultRespond(q))
    const failed = await getStudentWallet()
    expect(failed.data.gains).toBeNull()
    expect(failed.data.wallet.available).toBe(47600)

    const full = Array.from({ length: 1000 }, () => ({ amount: 1, created_at: "2026-10-13T10:00:00Z" }))
    respond = (q) => (isLedger(q, "release") ? { data: full, error: null } : defaultRespond(q))
    const capped = await getStudentWallet()
    expect(capped.data.gains).toBeNull()
    expect(calls.filter((c) => isLedger(c, "release") && c.range[0] >= 5000)).toHaveLength(0)
  })

  it("à venir : missions en cours où l'étudiant est retenu, part nette par escrowSplit (jamais 0.88 en dur)", async () => {
    const { data } = await getStudentWallet()
    const q = calls.find((c) => c.table === "missions")
    expect(q.filters).toContainEqual(["eq", "selected_student_id", "stu-1"])
    expect(q.filters).toContainEqual(["eq", "status", "in_progress"])
    expect(q.columns).not.toContain("*")
    // 25000 -> 22000 ; 10000 -> 8800
    expect(data.toCome).toEqual({
      total: 30800,
      missions: [
        { id: "m1", title: "Cours de maths", clientName: "Rosine", budget: 25000, net: 22000 },
        { id: "m2", title: "Flyer", clientName: "Koffi", budget: 10000, net: 8800 },
      ],
    })
  })

  it("à venir : lecture en échec => omis, le portefeuille se charge", async () => {
    respond = (q) => (q.table === "missions" ? { data: null, error: { message: "boom" } } : defaultRespond(q))
    const { data } = await getStudentWallet()
    expect(data.toCome).toBeNull()
    expect(data.wallet.available).toBe(47600)
  })

  it("aucune mission en cours : liste vide et total 0 (pas d'erreur)", async () => {
    respond = (q) => (q.table === "missions" ? { data: [], error: null } : defaultRespond(q))
    const { data } = await getStudentWallet()
    expect(data.toCome).toEqual({ total: 0, missions: [] })
  })

  it("retrait en cours : dernier retrait débité sans virement confirmé, de la session", async () => {
    respond = (q) => (isLedger(q, "withdrawal") ? { data: [{ id: "w1", amount: -10000, created_at: "2026-10-14T08:20:00Z" }], error: null } : defaultRespond(q))
    const { data } = await getStudentWallet()
    const q = calls.find((c) => isLedger(c, "withdrawal"))
    expect(q.filters).toContainEqual(["eq", "user_id", "stu-1"])
    expect(q.filters).toContainEqual(["is", "fedapay_id", null])
    expect(data.pendingWithdrawal).toEqual({ amount: 10000, createdAt: "2026-10-14T08:20:00Z" })
  })

  it("retrait en cours : aucun, ou lecture en échec => null", async () => {
    expect((await getStudentWallet()).data.pendingWithdrawal).toBeNull()
    respond = (q) => (isLedger(q, "withdrawal") ? { data: null, error: { message: "boom" } } : defaultRespond(q))
    expect((await getStudentWallet()).data.pendingWithdrawal).toBeNull()
  })

  it("solde ou historique illisible : erreur tutoyée, jamais un zéro", async () => {
    getWallet.mockResolvedValue({ error: "Impossible de charger ton portefeuille." })
    expect(await getStudentWallet()).toEqual({ error: "Impossible de charger ton portefeuille." })
    getWallet.mockResolvedValue({ wallet: { balance: 1, reserved: 0 }, available: 1 })
    getWalletTransactions.mockResolvedValue({ error: "Impossible de charger ton portefeuille." })
    expect(await getStudentWallet()).toEqual({ error: "Impossible de charger ton portefeuille." })
  })

  it("une exception inattendue donne une erreur neutre", async () => {
    getWallet.mockRejectedValue(new Error("boom"))
    expect(await getStudentWallet()).toEqual({ error: "Impossible de charger ton portefeuille." })
  })

  it("ne renvoie aucun numéro de téléphone", async () => {
    const res = await getStudentWallet()
    expect(JSON.stringify(res)).not.toMatch(/phone|0197|22901/)
    expect(getMyProfile).not.toHaveBeenCalled()
  })
})

describe("getStudentWalletMore", () => {
  it("exige le rôle étudiant", async () => {
    requireRole.mockResolvedValue({ error: "non" })
    expect(await getStudentWalletMore({ offset: 20 })).toEqual({ error: "Impossible de charger les mouvements suivants." })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(getWalletTransactions).not.toHaveBeenCalled()
  })

  it("lit la page suivante du filtre, offset borné", async () => {
    await getStudentWalletMore({ filtre: "remboursements", offset: 20 })
    expect(getWalletTransactions).toHaveBeenLastCalledWith("stu-1", 21, 20, ["refund"])
    await getStudentWalletMore({ filtre: "tout", offset: -5 })
    expect(getWalletTransactions).toHaveBeenLastCalledWith("stu-1", 21, 0, undefined)
    await getStudentWalletMore({ filtre: "tout", offset: 10 ** 12 })
    expect(getWalletTransactions).toHaveBeenLastCalledWith("stu-1", 21, 100000, undefined)
  })

  it("lecture en échec : erreur neutre", async () => {
    getWalletTransactions.mockResolvedValue({ error: "x" })
    expect(await getStudentWalletMore({ offset: 20 })).toEqual({ error: "Impossible de charger les mouvements suivants." })
  })
})

describe("getStudentWithdrawPrefill", () => {
  it("exige le rôle étudiant avant de lire le profil", async () => {
    requireRole.mockResolvedValue({ error: "non" })
    expect(await getStudentWithdrawPrefill()).toEqual({ error: "Impossible de lire ton numéro." })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it("paiements coupés : le numéro n'est pas lu", async () => {
    paymentsEnabled.mockReturnValue(false)
    expect(await getStudentWithdrawPrefill()).toEqual({ phone: "", masked: "" })
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it("numéro complet pour le champ, version masquée (deux derniers chiffres) pour l'affichage", async () => {
    getMyProfile.mockResolvedValue({ profile: { phone: "+2290197452108" } })
    expect(await getStudentWithdrawPrefill()).toEqual({ phone: "01 97 45 21 08", masked: "01 97 •• •• 08" })
  })

  it("numéro absent, invalide ou profil illisible : vides, jamais une erreur", async () => {
    getMyProfile.mockResolvedValue({ profile: { phone: null } })
    expect(await getStudentWithdrawPrefill()).toEqual({ phone: "", masked: "" })
    getMyProfile.mockResolvedValue({ profile: { phone: "12345" } })
    expect(await getStudentWithdrawPrefill()).toEqual({ phone: "", masked: "" })
    getMyProfile.mockResolvedValue({ error: "x" })
    expect(await getStudentWithdrawPrefill()).toEqual({ phone: "", masked: "" })
  })

  it("une exception inattendue ne journalise pas le numéro", async () => {
    getMyProfile.mockRejectedValue(new Error("boom"))
    expect(await getStudentWithdrawPrefill()).toEqual({ error: "Impossible de lire ton numéro." })
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/0197|22901/)
  })
})
