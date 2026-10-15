import { describe, it, expect, vi, beforeEach } from "vitest"

const requireRole = vi.fn()
const getWallet = vi.fn()
const createServiceClient = vi.fn()
let missionResult
const calls = []

function query() {
  const q = {
    select: (...args) => (calls.push({ method: "select", args }), q),
    eq: (...args) => (calls.push({ method: "eq", args }), q),
    maybeSingle: () => Promise.resolve(missionResult),
  }
  return q
}
const supabase = { from: (table) => (calls.push({ method: "from", args: [table] }), query()) }

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/wallet.actions", () => ({ getWallet: (...a) => getWallet(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/wallet/wallet-rpc", () => ({ callWalletRpc: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ unstable_rethrow: (e) => { if (e?.digest) throw e } }))

const { getDuplicatePrefill, getPublishPage } = await import("./client-publish.actions")
const { createMission } = await import("./mission.actions")

const ID = "3f2b8c1e-9a4d-4e6b-8c2a-1d5f7e9b0a3c"
const ROW = {
  title: "Traduire un flyer",
  description: "Traduire un flyer de deux pages du français vers l'anglais.",
  type: "Traduction",
  city: "Cotonou",
  budget: 8000,
  urgency: "medium",
}
const filters = () => calls.filter((c) => c.method === "eq").map((c) => c.args)

beforeEach(() => {
  calls.length = 0
  for (const f of [requireRole, getWallet, createServiceClient]) f.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ supabase, user: { id: "client-1" }, role: "client", profile: {} })
  getWallet.mockResolvedValue({ wallet: { balance: 12500, reserved: 0 }, available: 12500 })
  missionResult = { data: { ...ROW }, error: null }
})

describe("garde de rôle", () => {
  it.each([
    ["getDuplicatePrefill", () => getDuplicatePrefill(ID)],
    ["getPublishPage", () => getPublishPage({ duplicate: ID })],
  ])("%s exige requireRole([client]) avant toute lecture", async (_n, call) => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await call()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(res === null || Boolean(res.error)).toBe(true)
    expect(getWallet).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })
})

describe("getDuplicatePrefill : propriété", () => {
  it("lit la mission en filtrant sur l'identifiant ET sur le client connecté", async () => {
    await getDuplicatePrefill(ID)
    expect(filters()).toEqual([["id", ID], ["client_id", "client-1"]])
  })

  it("ne lit que les colonnes reprises, jamais select(*)", async () => {
    await getDuplicatePrefill(ID)
    const select = calls.find((c) => c.method === "select").args[0]
    expect(select).toBe("title, description, type, city, budget, urgency, purchases_estimate")
    expect(select).not.toContain("*")
  })

  it("renvoie les valeurs de la mission du client, sans échéance", async () => {
    expect(await getDuplicatePrefill(ID)).toEqual(ROW)
  })

  it("une mission d'un autre client (aucune ligne) donne null", async () => {
    missionResult = { data: null, error: null }
    expect(await getDuplicatePrefill(ID)).toBeNull()
  })

  it("l'identifiant de session prime : le client n'est jamais pris dans les paramètres", async () => {
    requireRole.mockResolvedValue({ supabase, user: { id: "client-2" }, role: "client", profile: {} })
    await getDuplicatePrefill(ID)
    expect(filters()).toContainEqual(["client_id", "client-2"])
    expect(filters()).not.toContainEqual(["client_id", "client-1"])
  })

  it.each([undefined, "", "abc", "m-1", `${ID}' or 1=1`, ["x"], 42])("ignore l'identifiant invalide %j sans lire la base", async (bad) => {
    expect(await getDuplicatePrefill(bad)).toBeNull()
    expect(calls).toEqual([])
  })

  it("une erreur de lecture donne null et reste silencieuse", async () => {
    missionResult = { data: null, error: { message: "boom" } }
    expect(await getDuplicatePrefill(ID)).toBeNull()
  })

  it("nettoie ce qui est lu (valeurs hors bornes ignorées)", async () => {
    missionResult = { data: { ...ROW, type: "Piratage", city: "Paris", budget: 10, urgency: "extreme" }, error: null }
    expect(await getDuplicatePrefill(ID)).toEqual({ title: ROW.title, description: ROW.description })
  })
})

describe("getPublishPage", () => {
  it("renvoie le disponible et la mission dupliquée", async () => {
    const res = await getPublishPage({ duplicate: ID })
    expect(res).toEqual({ data: { available: 12500, duplicate: ROW } })
    expect(getWallet).toHaveBeenCalledWith("client-1")
  })

  it("sans duplicate : aucune lecture de mission", async () => {
    const res = await getPublishPage({})
    expect(res).toEqual({ data: { available: 12500, duplicate: null } })
    expect(calls).toEqual([])
  })

  it("un duplicate d'un autre client est ignoré, la page reste utilisable", async () => {
    missionResult = { data: null, error: null }
    const res = await getPublishPage({ duplicate: ID })
    expect(res).toEqual({ data: { available: 12500, duplicate: null } })
  })

  it("un solde illisible n'empêche pas de rédiger : disponible null", async () => {
    getWallet.mockResolvedValue({ error: "Impossible de charger votre portefeuille." })
    const res = await getPublishPage({})
    expect(res).toEqual({ data: { available: null, duplicate: null } })
  })

  it("laisse passer les exceptions internes de Next (redirection, 404)", async () => {
    getWallet.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" }))
    await expect(getPublishPage({})).rejects.toThrow("NEXT_REDIRECT")
  })

  it("un échec inattendu donne une erreur neutre", async () => {
    getWallet.mockRejectedValue(new Error("secret interne"))
    const res = await getPublishPage({})
    expect(res).toEqual({ error: "Impossible de charger la publication de mission." })
  })
})

describe("publication en pause : appel direct de createMission", () => {
  const payload = {
    title: "Traduire un flyer",
    description: ROW.description,
    type: "Traduction",
    city: "Cotonou",
    budget: 8000,
    urgency: "low",
    deadline: "2999-12-31",
  }

  it.each([undefined, "", "false", "1", "TRUE"])("refuse sans aucune écriture quand PAYMENTS_ENABLED vaut %j", async (value) => {
    if (value === undefined) vi.stubEnv("PAYMENTS_ENABLED", "")
    else vi.stubEnv("PAYMENTS_ENABLED", value)
    const res = await createMission(payload)
    expect(res.error).toMatch(/en cours d'activation/)
    expect(createServiceClient).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})

describe("getDuplicatePrefill : mission avec achats", () => {
  it("recoche la case et reprend l'estimation positive de la mission d'origine", async () => {
    missionResult = { data: { ...ROW, purchases_estimate: 15000 }, error: null }
    expect(await getDuplicatePrefill(ID)).toEqual({ ...ROW, avecAchats: true, estimationAchats: 15000 })
  })

  it.each([null, 0, -2, "abc", 1e12])("ne recoche pas la case pour %j", async (purchases_estimate) => {
    missionResult = { data: { ...ROW, purchases_estimate }, error: null }
    expect(await getDuplicatePrefill(ID)).toEqual(ROW)
  })
})
