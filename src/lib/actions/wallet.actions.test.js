import { describe, it, expect, vi, beforeEach } from "vitest"

const invoke = vi.fn()
const getSession = vi.fn()
const single = vi.fn()
const eq = vi.fn()
const range = vi.fn()
const requireUser = vi.fn()
const inFilter = vi.fn()
const getServerRole = vi.fn()
let txResult

function builder() {
  const b = {
    select: () => b,
    eq: (...a) => { eq(...a); return b },
    order: () => b,
    in: (...a) => { inFilter(...a); return b },
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
vi.mock("@/lib/auth/server-role", () => ({ getServerRole: (...a) => getServerRole(...a) }))
vi.mock("@/lib/actions/auth.actions", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}))

import { PAYMENTS_PENDING_COPY } from "@/lib/constants/payments"
import { initiateWithdrawal, initiateDeposit, getWallet, getWalletTransactions, getWalletStats } from "./wallet.actions"

beforeEach(() => {
  for (const f of [invoke, getSession, single, eq, range, requireUser, inFilter, getServerRole]) f.mockReset()
  txResult = { data: [], error: null }
  getServerRole.mockResolvedValue({ role: "student" })
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

describe("filtre par type de mouvement", () => {
  it("sans filtre, aucune clause de type (comportement étudiant inchangé)", async () => {
    await getWalletTransactions("user-1", 20, 0)
    expect(inFilter).not.toHaveBeenCalled()
  })

  it("filtre sur les types demandés et garde la pagination", async () => {
    await getWalletTransactions("user-1", 20, 40, ["refund", "deposit"])
    expect(inFilter).toHaveBeenCalledWith("type", ["refund", "deposit"])
    expect(range).toHaveBeenLastCalledWith(40, 59)
  })

  it("ignore les types inconnus et renvoie une liste vide si aucun n'est connu", async () => {
    await getWalletTransactions("user-1", 20, 0, ["deposit", "drop table"])
    expect(inFilter).toHaveBeenLastCalledWith("type", ["deposit"])
    range.mockClear()
    expect(await getWalletTransactions("user-1", 20, 0, ["inconnu"])).toEqual([])
    expect(range).not.toHaveBeenCalled()
  })
})

describe("messages d'erreur selon le rôle", () => {
  const failRead = () => {
    single.mockResolvedValue({ data: null, error: { message: "boom" } })
    txResult = { data: null, error: { message: "boom" } }
  }

  it("le client est vouvoyé sur toutes les lectures", async () => {
    getServerRole.mockResolvedValue({ role: "client" })
    failRead()
    for (const res of [await getWallet(), await getWalletTransactions(), await getWalletStats()]) {
      expect(res.error).toBe("Impossible de charger votre portefeuille.")
    }
    expect((await getWallet("victime")).error).toBe("Vous n'avez pas accès à ce portefeuille.")
  })

  it("l'étudiant garde exactement les messages tutoyés", async () => {
    failRead()
    for (const res of [await getWallet(), await getWalletTransactions(), await getWalletStats()]) {
      expect(res.error).toBe("Impossible de charger ton portefeuille.")
    }
    expect((await getWallet("victime")).error).toBe("Tu n'as pas accès à ce portefeuille.")
  })

  it("un rôle illisible garde le texte étudiant", async () => {
    getServerRole.mockRejectedValue(new Error("db"))
    failRead()
    expect((await getWallet()).error).toBe("Impossible de charger ton portefeuille.")
  })

  it("le client est vouvoyé quand la fonction de paiement échoue", async () => {
    getServerRole.mockResolvedValue({ role: "client" })
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 500, text: async () => "{}" } } })
    expect((await initiateDeposit({ amount: 5000 })).error).toBe("Le dépôt n'a pas pu être initié. Réessayez dans un instant.")
    expect((await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })).error).toBe(
      "Le retrait n'a pas pu être initié. Réessayez dans un instant.",
    )
  })

  it("l'étudiant garde les messages tutoyés quand la fonction de paiement échoue", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 500, text: async () => "{}" } } })
    expect((await initiateDeposit({ amount: 5000 })).error).toBe("Le dépôt n'a pas pu être initié. Réessaie dans un instant.")
    expect((await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })).error).toBe(
      "Le retrait n'a pas pu être initié. Réessaie dans un instant.",
    )
  })

  it("502 après débit : le client est vouvoyé avec le code debit_uncertain", async () => {
    getServerRole.mockResolvedValue({ role: "client" })
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 502, text: async () => '{"error":"Le retrait n\'a pas pu être lancé, contactez-nous"}' } } })
    expect(await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })).toEqual({
      error: "Votre demande a peut-être été débitée. Contactez l'aide avant toute nouvelle demande.",
      code: "debit_uncertain",
    })
  })

  it("502 après débit : l'étudiant est tutoyé avec le code debit_uncertain", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 502, text: async () => "{}" } } })
    expect(await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })).toEqual({
      error: "Ta demande a peut-être été débitée. Contacte l'aide avant toute nouvelle demande.",
      code: "debit_uncertain",
    })
  })

  it("les autres statuts d'erreur du retrait n'ont pas de code et restent inchangés", async () => {
    for (const status of [400, 403, 500, 503]) {
      invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status, text: async () => "{}" } } })
      const res = await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })
      expect(res).toEqual({ error: "Le retrait n'a pas pu être initié. Réessaie dans un instant." })
    }
  })

  it("un 502 du dépôt reste un échec ordinaire sans code", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: { status: 502, text: async () => "{}" } } })
    expect(await initiateDeposit({ amount: 5000 })).toEqual({ error: "Le dépôt n'a pas pu être initié. Réessaie dans un instant." })
  })

  it("le portefeuille illisible lors d'un retrait suit le rôle", async () => {
    getServerRole.mockResolvedValue({ role: "client" })
    single.mockResolvedValue({ data: null, error: { message: "boom" } })
    expect((await initiateWithdrawal({ amount: 5000, phone: "0197000000", operator: "mtn" })).error).toBe(
      "Impossible de charger votre portefeuille.",
    )
    expect(invoke).not.toHaveBeenCalled()
  })
})
