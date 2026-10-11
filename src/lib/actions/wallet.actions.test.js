import { describe, it, expect, vi, beforeEach } from "vitest"

const invoke = vi.fn()
const getSession = vi.fn()
const single = vi.fn()
const eq = vi.fn()
const range = vi.fn()
const requireUser = vi.fn()
let txResult

function builder() {
  const b = {
    select: () => b,
    eq: (...a) => { eq(...a); return b },
    order: () => b,
    range: (...a) => { range(...a); return Promise.resolve(txResult) },
    single,
    then: (res, rej) => Promise.resolve(txResult).then(res, rej),
  }
  return b
}

const supabase = {
  auth: { getSession },
  functions: { invoke },
  from: () => builder(),
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock("@/lib/auth/require-role", () => ({ requireUser: (...a) => requireUser(...a) }))
vi.mock("@/lib/actions/auth.actions", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}))

import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"
import { initiateWithdrawal, initiateDeposit, getWallet, getWalletTransactions, getWalletStats } from "./wallet.actions"

beforeEach(() => {
  for (const f of [invoke, getSession, single, eq, range, requireUser]) f.mockReset()
  txResult = { data: [], error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireUser.mockResolvedValue({ supabase, user: { id: "user-1" } })
  single.mockResolvedValue({ data: { balance: 10000, reserved: 0 } })
  getSession.mockResolvedValue({ data: { session: { access_token: "session-jwt" } } })
  invoke.mockResolvedValue({ data: { message: "ok" }, error: null })
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-public-key")
  vi.stubEnv("PAYMENTS_ENABLED", "true")
})

describe("initiateWithdrawal", () => {
  it("appelle la fonction avec le jeton de session et sans userId", async () => {
    const res = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(res.success).toBe(true)
    const [name, options] = invoke.mock.calls[0]
    expect(name).toBe("process-withdrawal")
    expect(options.headers.Authorization).toBe("Bearer session-jwt")
    expect(options.headers.Authorization).not.toContain("anon-public-key")
    expect(options.body).toEqual({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(options.body).not.toHaveProperty("userId")
  })

  it("refuse sans session et n'appelle pas la fonction", async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const res = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(res.error).toBeTruthy()
    expect(invoke).not.toHaveBeenCalled()
  })

  it("gere un 401 de la fonction", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 401 } } })
    const res = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(res.error).toMatch(/Session expirée/)
  })
})

describe("initiateDeposit", () => {
  it("utilise le jeton de session et n'envoie pas userId", async () => {
    invoke.mockResolvedValue({ data: { paymentUrl: "https://pay" }, error: null })
    const res = await initiateDeposit({ amount: 5000 })
    expect(res.paymentUrl).toBe("https://pay")
    const [, options] = invoke.mock.calls[0]
    expect(options.headers.Authorization).toBe("Bearer session-jwt")
    expect(options.body).toEqual({ amount: 5000 })
  })
})

describe("paiements désactivés", () => {
  it("initiateDeposit et initiateWithdrawal refusent avant tout appel", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false")
    const dep = await initiateDeposit({ amount: 5000 })
    const wd = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(dep.error).toBe(PAYMENTS_PENDING_COPY.wallet.title)
    expect(wd.error).toBe(PAYMENTS_PENDING_COPY.wallet.title)
    expect(invoke).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })
})

describe("messages d'erreur des fonctions", () => {
  const fnError = (body) => ({
    message: "Edge Function returned a non-2xx status code",
    context: { status: 500, text: async () => body },
  })

  it("ne relaie pas le corps interne de la fonction", async () => {
    invoke.mockResolvedValue({ data: null, error: fnError(JSON.stringify({ error: "relation wallets_secret does not exist" })) })
    const dep = await initiateDeposit({ amount: 5000 })
    const wd = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    for (const res of [dep, wd]) {
      expect(res.error).toBeTruthy()
      expect(res.error).not.toMatch(/wallets_secret|Edge Function/)
    }
    expect(console.error).toHaveBeenCalledWith("[initiateDeposit]", "relation wallets_secret does not exist")
  })

  it("relaie le message de pause des paiements", async () => {
    invoke.mockResolvedValue({ data: null, error: fnError(JSON.stringify({ error: PAYMENTS_PENDING_COPY.wallet.title })) })
    const dep = await initiateDeposit({ amount: 5000 })
    expect(dep.error).toBe(PAYMENTS_PENDING_COPY.wallet.title)
  })

  it("ne relaie pas un corps texte brut", async () => {
    invoke.mockResolvedValue({ data: null, error: fnError("stack trace at /var/task/index.ts") })
    const wd = await initiateWithdrawal({ amount: 5000, phone: "97000000", operator: "mtn" })
    expect(wd.error).not.toMatch(/stack trace/)
  })
})

describe("lectures du portefeuille", () => {
  it("dérive l'identité de la session et refuse un autre userId", async () => {
    for (const call of [
      () => getWallet("victime"),
      () => getWalletTransactions("victime"),
      () => getWalletStats("victime"),
    ]) {
      const res = await call()
      expect(res.error).toBeTruthy()
    }
    expect(eq).not.toHaveBeenCalled()
  })

  it("refuse sans session", async () => {
    requireUser.mockResolvedValue({ error: "Non connecté" })
    expect(await getWallet()).toEqual({ error: "Non connecté" })
    expect(await getWalletStats()).toEqual({ error: "Non connecté" })
  })

  it("filtre sur l'identifiant de la session, avec ou sans argument", async () => {
    await getWallet("user-1")
    await getWalletTransactions()
    expect(eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(eq).toHaveBeenCalledTimes(2)
  })

  it("borne limit à 50 et offset à 0 minimum", async () => {
    await getWalletTransactions("user-1", 100000, -5)
    expect(range).toHaveBeenLastCalledWith(0, 49)
    await getWalletTransactions("user-1", Number.NaN, 10)
    expect(range).toHaveBeenLastCalledWith(10, 29)
    await getWalletTransactions("user-1", 0)
    expect(range).toHaveBeenLastCalledWith(0, 0)
  })

  it("renvoie un message neutre si la lecture échoue", async () => {
    single.mockResolvedValue({ data: null, error: { message: 'permission denied for table "wallets"' } })
    txResult = { data: null, error: { message: 'permission denied for table "wallet_transactions"' } }
    for (const res of [await getWallet(), await getWalletTransactions(), await getWalletStats()]) {
      expect(res.error).toBeTruthy()
      expect(res.error).not.toMatch(/permission denied/)
    }
  })

  it("calcule les statistiques", async () => {
    txResult = { data: [{ type: "deposit", amount: 100 }, { type: "release", amount: 40 }, { type: "deposit", amount: 5 }], error: null }
    expect(await getWalletStats()).toEqual({ totalDeposited: 105, totalEarned: 40, totalWithdrawn: 0, totalCommissions: 0 })
  })
})
