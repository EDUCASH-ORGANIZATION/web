import { describe, it, expect, vi, beforeEach } from "vitest"

// QA indépendante (vague 3 de RD-CLIENT-01) : lectures du portefeuille client, messages par rôle de
// wallet.actions.js, drapeau des paiements et validations côté serveur. Vraies actions, Supabase simulé.
const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "99999999-9999-4999-8999-999999999999"

let session
let profile
let wallet
let txRows
let calls
let invoke

function table(name) {
  const state = { filters: [] }
  const rec = (m) => (...args) => { state.filters.push([m, ...args]); return b }
  const res = () => {
    if (name === "profiles") return profile
    if (name === "wallets") return wallet
    if (name === "wallet_transactions") return txRows
    if (name === "missions") return { data: [], error: null }
    return { data: [], error: null }
  }
  const b = {
    select: rec("select"), eq: rec("eq"), in: rec("in"), order: rec("order"), limit: rec("limit"),
    range: (...a) => { state.filters.push(["range", ...a]); calls.push({ table: name, ...state }); return Promise.resolve(res()) },
    single: () => { calls.push({ table: name, ...state }); return Promise.resolve(res()) },
    maybeSingle: () => { calls.push({ table: name, ...state }); return Promise.resolve(res()) },
    then: (a, c) => { calls.push({ table: name, ...state }); return Promise.resolve(res()).then(a, c) },
  }
  return b
}
const supabase = {
  auth: {
    getUser: async () => ({ data: { user: session }, error: session ? null : new Error("no") }),
    getSession: async () => ({ data: { session: session ? { access_token: "jwt" } : null } }),
  },
  from: (n) => table(n),
  functions: { invoke: (...a) => invoke(...a) },
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => supabase }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: vi.fn(async () => session) }))
vi.mock("next/navigation", () => ({ unstable_rethrow: (e) => { throw e } }))

const w = await import("@/lib/actions/wallet.actions")
const cw = await import("@/lib/actions/client-wallet.actions")

const dataCalls = () => calls.filter((c) => c.table !== "profiles")
const roleOf = (role, extra = {}) => ({ data: { role, full_name: "X", city: "Cotonou", is_suspended: false, phone: "+22901974521 08", ...extra }, error: null })

beforeEach(() => {
  session = { id: ME, user_metadata: { role: "client" } }
  profile = roleOf("client")
  wallet = { data: { balance: 10000, reserved: 2000 }, error: null }
  txRows = { data: [], error: null }
  calls = []
  invoke = vi.fn(async () => ({ data: { paymentUrl: "https://pay.example/x" }, error: null }))
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("PAYMENTS_ENABLED", "true")
})

const denials = {
  "sans session": () => { session = null },
  "étudiant (user_metadata client)": () => { profile = roleOf("student") },
  admin: () => { profile = roleOf("admin") },
  "client suspendu": () => { profile = roleOf("client", { is_suspended: true }) },
  "profil absent": () => { profile = { data: null, error: null } },
  "profil en erreur": () => { profile = { data: null, error: { message: "boom" } } },
}

describe("actions du portefeuille client : refus sans aucune lecture de données", () => {
  for (const [name, setup] of Object.entries(denials)) {
    it(`getClientFundedMissions / getClientWalletPage / getClientWalletMoreTransactions : ${name}`, async () => {
      setup()
      const a = await cw.getClientFundedMissions()
      const b = await cw.getClientWalletPage({ filtre: "recharges" })
      const c = await cw.getClientWalletMoreTransactions({ filtre: "tout", offset: 20 })
      expect(a.error).toBeTruthy(); expect(b.error).toBeTruthy(); expect(c.error).toBeTruthy()
      expect(a.missions).toBeUndefined(); expect(b.data).toBeUndefined(); expect(c.transactions).toBeUndefined()
      expect(dataCalls()).toEqual([])
    })
  }
})

describe("getClientWalletPage", () => {
  it("filtre toutes les lectures sur l'utilisateur de la session", async () => {
    await cw.getClientWalletPage({})
    for (const c of dataCalls()) {
      const eqs = c.filters.filter((f) => f[0] === "eq")
      const owner = eqs.find((f) => f[1] === "user_id" || f[1] === "client_id")
      expect(owner?.[2], c.table).toBe(ME)
    }
  })
  it("lit 21 lignes, en rend 20, hasMore vrai", async () => {
    txRows = { data: Array.from({ length: 21 }, (_, i) => ({ id: `t${i}`, type: "deposit", amount: -5, created_at: "2026-10-01", mission_id: null, missions: null })), error: null }
    const r = await cw.getClientWalletPage({})
    expect(r.data.transactions).toHaveLength(20)
    expect(r.data.hasMore).toBe(true)
    expect(r.data.transactions[0].amount).toBe(5)
    const range = calls.find((c) => c.table === "wallet_transactions").filters.find((f) => f[0] === "range")
    expect(range.slice(1)).toEqual([0, 20])
  })
  it("20 lignes exactement : hasMore faux", async () => {
    txRows = { data: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, type: "deposit", amount: 1 })), error: null }
    expect((await cw.getClientWalletPage({})).data.hasMore).toBe(false)
  })
  for (const bad of ["__proto__", "constructor", "DEPOSIT", "recharges,retraits", ["recharges", "x"].length ? undefined : 0, 42, {}, "toString"]) {
    it(`filtre inconnu ignoré : ${JSON.stringify(bad)}`, async () => {
      const r = await cw.getClientWalletPage({ filtre: bad })
      expect(r.data.filter).toBe("tout")
      const q = calls.find((c) => c.table === "wallet_transactions")
      expect(q.filters.some((f) => f[0] === "in")).toBe(false)
    })
  }
  it("filtre tableau : premier élément seulement", async () => {
    const r = await cw.getClientWalletPage({ filtre: ["retraits", "recharges"] })
    expect(r.data.filter).toBe("retraits")
    const q = calls.find((c) => c.table === "wallet_transactions")
    expect(q.filters.find((f) => f[0] === "in")).toEqual(["in", "type", ["withdrawal"]])
  })
  it("solde illisible : erreur, jamais un zéro", async () => {
    wallet = { data: null, error: { message: "x" } }
    const r = await cw.getClientWalletPage({})
    expect(r.error).toBe("Impossible de charger votre portefeuille.")
    expect(r.data).toBeUndefined()
  })
  it("paiements coupés : le numéro n'est pas lu", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false")
    const r = await cw.getClientWalletPage({})
    expect(r.data.phone).toBe("")
    expect(calls.filter((c) => c.table === "profiles" && c.filters.some((f) => f[0] === "select" && /phone/.test(f[1])))).toEqual([])
  })
  it("amount négatif ou NaN en base : valeur absolue, 0 si illisible", async () => {
    txRows = { data: [{ id: "a", type: "withdrawal", amount: "abc" }, { id: "b", type: "bogus", amount: -7 }], error: null }
    const r = await cw.getClientWalletPage({})
    expect(r.data.transactions.map((t) => t.amount)).toEqual([0, 7])
  })
})

describe("getClientWalletMoreTransactions", () => {
  it("offset hostile ramené à 0 ou plafonné", async () => {
    for (const [offset, start] of [[-5, 0], [1.5, 0], ["20", 0], [NaN, 0], [Infinity, 0], [20, 20], [10 ** 9, 100000]]) {
      calls = []
      await cw.getClientWalletMoreTransactions({ filtre: "tout", offset })
      const range = calls.find((c) => c.table === "wallet_transactions").filters.find((f) => f[0] === "range")
      expect(range[1], String(offset)).toBe(start)
      expect(range[2] - range[1]).toBeLessThanOrEqual(20)
    }
  })
  it("sans argument ni filtre : page 0, tous types", async () => {
    const r = await cw.getClientWalletMoreTransactions()
    expect(r.transactions).toEqual([])
    expect(calls.find((c) => c.table === "wallet_transactions").filters.some((f) => f[0] === "in")).toBe(false)
  })
  it("filtre par type connu et inconnu", async () => {
    await cw.getClientWalletMoreTransactions({ filtre: "commissions", offset: 0 })
    expect(calls.find((c) => c.table === "wallet_transactions").filters.find((f) => f[0] === "in")).toEqual(["in", "type", ["commission"]])
    calls = []
    await cw.getClientWalletMoreTransactions({ filtre: "nope", offset: 0 })
    expect(calls.find((c) => c.table === "wallet_transactions").filters.some((f) => f[0] === "in")).toBe(false)
  })
})

describe("getClientFundedMissions", () => {
  it("filtre client_id = session, statuts ouverts et en cours, 100 au plus", async () => {
    await cw.getClientFundedMissions()
    const q = calls.find((c) => c.table === "missions")
    expect(q.filters).toContainEqual(["eq", "client_id", ME])
    expect(q.filters).toContainEqual(["in", "status", ["open", "in_progress"]])
    expect(q.filters).toContainEqual(["limit", 100])
  })
})

describe("wallet.actions : messages vouvoyés quel que soit le rôle (RD-VOUS-01)", () => {
  it("étudiant : mêmes textes vouvoyés que le client (forbidden, read)", async () => {
    profile = roleOf("student")
    expect((await w.getWallet(OTHER)).error).toBe("Vous n'avez pas accès à ce portefeuille.")
    wallet = { data: null, error: { message: "x" } }
    expect((await w.getWallet()).error).toBe("Impossible de charger votre portefeuille.")
    expect((await w.getWalletTransactions(ME, 5, 0)).error).toBeUndefined()
  })
  it("client : vouvoiement", async () => {
    expect((await w.getWallet(OTHER)).error).toBe("Vous n'avez pas accès à ce portefeuille.")
    wallet = { data: null, error: { message: "x" } }
    expect((await w.getWallet()).error).toBe("Impossible de charger votre portefeuille.")
  })
  for (const [name, p] of Object.entries({ "rôle illisible": { data: null, error: { message: "x" } }, "rôle inconnu": roleOf("root"), "profil absent": { data: null, error: null }, admin: roleOf("admin") })) {
    it(`${name} : même texte vouvoyé`, async () => {
      profile = p
      expect((await w.getWallet(OTHER)).error).toBe("Vous n'avez pas accès à ce portefeuille.")
    })
  }
  it("user_metadata client avec profil étudiant : même texte vouvoyé", async () => {
    profile = roleOf("student")
    session = { id: ME, user_metadata: { role: "client" } }
    expect((await w.getWallet(OTHER)).error).toMatch(/^Vous /)
  })
  it("échec d'invoke : message d'initiation vouvoyé pour tous les rôles, détail jamais relayé", async () => {
    invoke = vi.fn(async () => ({ data: null, error: { message: "secret detail", context: { status: 500, text: async () => JSON.stringify({ error: "Stripe down 0.88" }) } } }))
    profile = roleOf("student")
    expect((await w.initiateDeposit({ amount: 5000 })).error).toBe("Le dépôt n'a pas pu être initié. Réessayez dans un instant.")
    expect((await w.initiateWithdrawal({ amount: 5000, phone: "0197452108", operator: "mtn" })).error).toBe("Le retrait n'a pas pu être initié. Réessayez dans un instant.")
    profile = roleOf("client")
    expect((await w.initiateDeposit({ amount: 5000 })).error).toBe("Le dépôt n'a pas pu être initié. Réessayez dans un instant.")
    expect((await w.initiateWithdrawal({ amount: 5000, phone: "0197452108", operator: "mtn" })).error).toBe("Le retrait n'a pas pu être initié. Réessayez dans un instant.")
  })
  it("getWalletTransactions : types inconnus ignorés, aucun type connu -> liste vide sans requête", async () => {
    expect(await w.getWalletTransactions(ME, 20, 0, ["bogus", "__proto__"])).toEqual([])
    expect(dataCalls().filter((c) => c.table === "wallet_transactions")).toEqual([])
    await w.getWalletTransactions(ME, 20, 0, ["bogus", "refund"])
    expect(calls.find((c) => c.table === "wallet_transactions").filters).toContainEqual(["in", "type", ["refund"]])
  })
  it("getWalletTransactions : limite plafonnée à 50, offset négatif ramené à 0", async () => {
    await w.getWalletTransactions(ME, 10 ** 6, -9)
    const range = calls.find((c) => c.table === "wallet_transactions").filters.find((f) => f[0] === "range")
    expect(range.slice(1)).toEqual([0, 49])
  })
})

describe("drapeau paymentsEnabled appliqué côté serveur", () => {
  for (const v of [undefined, "", "false", "TRUE", "1", "true ", "yes"]) {
    it(`PAYMENTS_ENABLED=${JSON.stringify(v)} : aucune requête de paiement`, async () => {
      if (v === undefined) vi.unstubAllEnvs(); else vi.stubEnv("PAYMENTS_ENABLED", v)
      const d = await w.initiateDeposit({ amount: 5000 })
      const r = await w.initiateWithdrawal({ amount: 5000, phone: "0197452108", operator: "mtn" })
      expect(d.error).toBe("Recharge et retrait en cours d'activation")
      expect(r.error).toBe("Recharge et retrait en cours d'activation")
      expect(invoke).not.toHaveBeenCalled()
      expect(calls).toEqual([])
    })
  }
})

describe("validation serveur du montant (initiateDeposit / initiateWithdrawal)", () => {
  const badDeposit = [undefined, null, 0, -1, -5000, NaN, 1999, "", 100]
  for (const amount of badDeposit) {
    it(`recharge refusée : ${String(amount)}`, async () => {
      const r = await w.initiateDeposit({ amount })
      expect(r.error).toBeTruthy()
      expect(invoke).not.toHaveBeenCalled()
    })
  }
  for (const amount of [undefined, null, 0, -1, NaN, 1999, ""]) {
    it(`retrait refusé : ${String(amount)}`, async () => {
      const r = await w.initiateWithdrawal({ amount, phone: "0197452108", operator: "mtn" })
      expect(r.error).toBeTruthy()
      expect(invoke).not.toHaveBeenCalled()
    })
  }
  it("retrait au-dessus du disponible : Solde insuffisant, pas d'appel", async () => {
    const r = await w.initiateWithdrawal({ amount: 8001, phone: "0197452108", operator: "mtn" })
    expect(r.error).toBe("Solde insuffisant")
    expect(invoke).not.toHaveBeenCalled()
  })
  it("retrait égal au disponible : accepté", async () => {
    invoke = vi.fn(async () => ({ data: {}, error: null }))
    expect((await w.initiateWithdrawal({ amount: 8000, phone: "0197452108", operator: "mtn" })).success).toBe(true)
  })
  it("Infinity : refusé (solde insuffisant)", async () => {
    expect((await w.initiateWithdrawal({ amount: Infinity, phone: "0197452108", operator: "mtn" })).error).toBe("Solde insuffisant")
  })
  // Constats : ces cas ne sont PAS bloqués par l'action serveur elle-même (la fonction Edge revalide).
  // Risque (c) du plan RD-CLIENT-01 : la validation du retrait (montant entier, numéro, opérateur) est à faire côté
  // lot sécurité. Quand elle sera ajoutée, l'inversion de ces tests CONSTAT est ATTENDUE (ce n'est pas une régression).
  it("CONSTAT : montant décimal ou chaîne numérique transmis tel quel à la fonction Edge (initiateWithdrawal)", async () => {
    invoke = vi.fn(async () => ({ data: {}, error: null }))
    await w.initiateWithdrawal({ amount: 2000.5, phone: "0197452108", operator: "mtn" })
    await w.initiateWithdrawal({ amount: "5000", phone: "0197452108", operator: "mtn" })
    expect(invoke.mock.calls.map((c) => typeof c[1].body.amount + ":" + c[1].body.amount)).toEqual(["number:2000.5", "string:5000"])
  })
  it("CONSTAT : une chaîne non numérique ou un objet passe le contrôle de l'action et n'est arrêté que par la fonction Edge (Number.isInteger)", async () => {
    invoke = vi.fn(async () => ({ data: {}, error: null }))
    await w.initiateWithdrawal({ amount: "abc", phone: "0197452108", operator: "mtn" })
    await w.initiateDeposit({ amount: {} })
    await w.initiateDeposit({ amount: "abc" })
    expect(invoke).toHaveBeenCalledTimes(3)
  })
  it("CONSTAT : initiateDeposit transmet un décimal ou une chaîne à la fonction Edge", async () => {
    await w.initiateDeposit({ amount: 2000.5 })
    await w.initiateDeposit({ amount: "5000" })
    expect(invoke).toHaveBeenCalledTimes(2)
  })
  it("CONSTAT : numéro et opérateur ne sont pas validés par l'action (transmis tels quels)", async () => {
    invoke = vi.fn(async () => ({ data: {}, error: null }))
    await w.initiateWithdrawal({ amount: 5000, phone: "n'importe quoi", operator: "celtiis" })
    expect(invoke.mock.calls[0][1].body).toEqual({ amount: 5000, phone: "n'importe quoi", operator: "celtiis" })
  })
  it("l'identité n'est pas lue du corps et le jeton vient de la session", async () => {
    invoke = vi.fn(async () => ({ data: {}, error: null }))
    await w.initiateWithdrawal({ amount: 5000, phone: "0197452108", operator: "mtn", userId: OTHER })
    const [, opts] = invoke.mock.calls[0]
    expect(opts.body).not.toHaveProperty("userId")
    expect(opts.headers.Authorization).toBe("Bearer jwt")
  })
})
