import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))
vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn(async () => ({ ok: true })),
  notifyMany: vi.fn(async () => ({ ok: true })),
}))

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { sendEmail } from "@/lib/email/index"
import { notify, notifyMany } from "@/lib/notifications/notify"
import { MISSION_TYPES } from "@/lib/supabase/database.constants"
import { createMission, confirmMission, updateMissionStatus, getMissions } from "./mission.actions"

// Faux client Supabase : chaque requête est un constructeur chaînable consignant ses appels,
// résolu avec la réponse programmée pour `table` (ou `table:op`).
function makeService(responses = {}, rpcImpl = async () => ({ data: { success: true }, error: null })) {
  const calls = []
  const rpc = vi.fn(rpcImpl)
  const from = vi.fn((table) => {
    const state = { table, op: "select", args: [], filters: [] }
    calls.push(state)
    const resolve = () => {
      const r = responses[`${table}:${state.op}`] ?? responses[table] ?? { data: null, error: null }
      return typeof r === "function" ? r(state) : r
    }
    const builder = {
      select: (...a) => { if (state.op === "select") state.args = a; return builder },
      insert: (v) => { state.op = "insert"; state.payload = v; return builder },
      update: (v) => { state.op = "update"; state.payload = v; return builder },
      delete: () => { state.op = "delete"; return builder },
      eq: (c, v) => { state.filters.push([c, v]); return builder },
      in: (c, v) => { state.filters.push([c, v]); return builder },
      single: () => Promise.resolve(resolve()),
      maybeSingle: () => Promise.resolve(resolve()),
      then: (ok, ko) => Promise.resolve(resolve()).then(ok, ko),
    }
    return builder
  })
  const getUserById = vi.fn(async () => ({ data: { user: { email: "etu@example.com" } } }))
  return { client: { from, rpc, auth: { admin: { getUserById } } }, calls, rpc, getUserById }
}

const CLIENT = { id: "client-1" }
const validData = {
  title: "Faire des courses",
  description: "Acheter des légumes au marché",
  type: "Livraison",
  city: "Cotonou",
  budget: 5000,
  urgency: "low",
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYMENTS_ENABLED", "true")
  requireRole.mockResolvedValue({ user: CLIENT, role: "client" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("createMission", () => {
  const wallet = { data: { balance: 10000, reserved: 0 }, error: null }

  it("refuse un non client sans toucher à la base", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await createMission(validData)
    expect(res.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("exige le rôle client", async () => {
    createServiceClient.mockReturnValue(makeService().client)
    await createMission(validData)
    expect(requireRole).toHaveBeenCalledWith(["client"])
  })

  it("refuse quand PAYMENTS_ENABLED n'est pas vrai, sans aucune écriture", async () => {
    for (const value of [undefined, "false", "1", ""]) {
      if (value === undefined) vi.stubEnv("PAYMENTS_ENABLED", "")
      else vi.stubEnv("PAYMENTS_ENABLED", value)
      const res = await createMission(validData)
      expect(res.error).toMatch(/en cours d'activation/)
      expect(res.error).not.toMatch(/fedapay|paiement/i)
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([
    ["budget inférieur à 2000", { budget: 1999 }],
    ["budget non entier", { budget: 2500.5 }],
    ["budget non numérique", { budget: "abc" }],
    ["type hors liste", { type: "Piratage" }],
    ["ville hors liste", { city: "Paris" }],
    ["titre vide", { title: "  " }],
    ["description absente", { description: undefined }],
    ["urgence inconnue", { urgency: "extreme" }],
  ])("refuse %s", async (_label, patch) => {
    const res = await createMission({ ...validData, ...patch })
    expect(res.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("renvoie wallet_insufficient quand le solde disponible est trop bas", async () => {
    const { client, calls } = makeService({ wallets: { data: { balance: 3000, reserved: 500 }, error: null } })
    createServiceClient.mockReturnValue(client)
    const res = await createMission(validData)
    expect(res).toEqual({ error: "wallet_insufficient", available: 2500, required: 5000, shortfall: 2500 })
    expect(calls.some((c) => c.table === "missions")).toBe(false)
  })

  it("insère open puis réserve, et renvoie l'id", async () => {
    const order = []
    const { client, rpc } = makeService(
      { wallets: wallet, "missions:insert": () => { order.push("insert"); return { data: { id: "m-1" }, error: null } } },
      async () => { order.push("rpc"); return { data: { success: true }, error: null } },
    )
    createServiceClient.mockReturnValue(client)
    const res = await createMission(validData)
    expect(res).toEqual({ id: "m-1" })
    expect(order).toEqual(["insert", "rpc"])
    expect(rpc).toHaveBeenCalledWith("wallet_reserve", { p_user_id: "client-1", p_amount: 5000, p_mission_id: "m-1" })
  })

  it("prend le client de la session et le statut open, jamais ceux du corps", async () => {
    const { client, calls } = makeService({ wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } })
    createServiceClient.mockReturnValue(client)
    await createMission({ ...validData, client_id: "autre", status: "done" })
    const insert = calls.find((c) => c.op === "insert")
    expect(insert.payload.client_id).toBe("client-1")
    expect(insert.payload.status).toBe("open")
  })

  it("supprime la mission et renvoie une erreur quand la réservation répond success false", async () => {
    const { client, calls } = makeService(
      { wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } },
      async () => ({ data: { success: false, error: "Solde insuffisant" }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    const res = await createMission(validData)
    expect(res.error).toMatch(/réserver les fonds/)
    expect(res.id).toBeUndefined()
    const del = calls.find((c) => c.op === "delete")
    expect(del.table).toBe("missions")
    expect(del.filters).toContainEqual(["id", "m-1"])
  })

  it("supprime aussi la mission quand la RPC renvoie une erreur ou aucune donnée", async () => {
    for (const result of [{ data: null, error: { message: "boom" } }, { data: null, error: null }]) {
      const { client, calls } = makeService(
        { wallets: wallet, "missions:insert": { data: { id: "m-2" }, error: null } },
        async () => result,
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res.error).toBeTruthy()
      expect(calls.some((c) => c.op === "delete")).toBe(true)
    }
  })

  it("annule la mission si sa suppression échoue", async () => {
    const { client, calls, rpc } = makeService(
      {
        wallets: wallet,
        "missions:insert": { data: { id: "m-1" }, error: null },
        "missions:delete": { data: null, error: { message: "denied" } },
      },
      async (name) => (name === "wallet_reserve" ? { data: { success: false }, error: null } : { data: { success: true, refunded: 0 }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    await createMission(validData)
    expect(rpc).toHaveBeenCalledWith("wallet_cancel_mission", { p_mission_id: "m-1", p_client_id: "client-1" })
    expect(calls.some((c) => c.op === "update")).toBe(false)
  })

  describe("nettoyage quand des fonds ont été réservés", () => {
    const ledger = { data: [{ type: "reserve", amount: 5000 }], error: null }
    const cancelRpc = (cancel) => async (name) =>
      name === "wallet_reserve" ? { data: { success: false }, error: null } : cancel

    it("annule via la RPC atomique, sans wallet_refund, sans update ni suppression", async () => {
      const order = []
      const { client, calls, rpc } = makeService(
        { wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null }, wallet_transactions: ledger },
        async (name) => {
          order.push(name)
          return name === "wallet_reserve" ? { data: { success: false }, error: null } : { data: { success: true, refunded: 5000 }, error: null }
        },
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res.error).toMatch(/réserver les fonds/)
      expect(rpc).toHaveBeenCalledWith("wallet_cancel_mission", { p_mission_id: "m-1", p_client_id: "client-1" })
      expect(rpc).not.toHaveBeenCalledWith("wallet_refund", expect.anything())
      expect(order).toEqual(["wallet_reserve", "wallet_cancel_mission"])
      expect(calls.some((c) => c.op === "update" || c.op === "delete")).toBe(false)
    })

    it("avec mouvements déjà soldés, passe quand même par la RPC (qui gère le reste)", async () => {
      const { client, calls, rpc } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: [{ type: "reserve", amount: 5000 }, { type: "refund", amount: 5000 }], error: null },
        },
        cancelRpc({ data: { success: true, refunded: 0 }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      await createMission(validData)
      expect(rpc).toHaveBeenCalledWith("wallet_cancel_mission", { p_mission_id: "m-1", p_client_id: "client-1" })
      expect(rpc).not.toHaveBeenCalledWith("wallet_refund", expect.anything())
      expect(calls.some((c) => c.op === "delete")).toBe(false)
    })

    it("si la RPC d'annulation échoue, aucune écriture directe, erreur générique et log", async () => {
      const { client, calls } = makeService(
        { wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null }, wallet_transactions: ledger },
        cancelRpc({ data: { success: false, error: "interne" }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
      expect(calls.some((c) => c.op === "update")).toBe(false)
      expect(calls.some((c) => c.op === "delete")).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })

    it("si le grand livre est illisible : pas de suppression, mais l'annulation atomique est tentée", async () => {
      const { client, calls, rpc } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: null, error: { message: "boom" } },
        },
        async (name) =>
          name === "wallet_reserve" ? { data: { success: false }, error: null } : { data: { success: true, refunded: 0 }, error: null },
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res.error).toMatch(/réserver les fonds/)
      expect(calls.some((c) => c.op === "update" || c.op === "delete")).toBe(false)
      expect(rpc).toHaveBeenCalledWith("wallet_cancel_mission", { p_mission_id: "m-1", p_client_id: "client-1" })
    })

    it("si le grand livre est illisible ET l'annulation échoue : alerte sans donnée sensible et erreur générique", async () => {
      const { client, calls } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: null, error: { message: "boom secret" } },
        },
        async () => ({ data: { success: false, error: "invalid_status" }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
      expect(calls.some((c) => c.op === "update" || c.op === "delete")).toBe(false)
      const alert = console.error.mock.calls.find((c) => String(c[0]).includes("ALERTE"))
      expect(alert).toBeTruthy()
      expect(JSON.stringify(alert)).not.toMatch(/boom secret|balance|budget/)
    })
  })
})

describe("createMission : validation serveur des textes", () => {
  const wallet = { data: { balance: 10000, reserved: 0 }, error: null }
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString()

  it.each([
    ["titre trop long", { title: "a".repeat(121) }, /titre/],
    ["description trop longue", { description: "a".repeat(3001) }, /description/],
    ["titre non texte", { title: 42 }, /titre/],
    ["date limite passée", { deadline: "2020-01-01" }, /futur/],
    ["date limite invalide", { deadline: "demain" }, /futur|invalide/],
    ["date limite non texte", { deadline: 12345 }, /invalide/],
  ])("refuse : %s, sans toucher à la base", async (_l, patch, message) => {
    const { client, calls } = makeService({ wallets: wallet })
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...validData, ...patch })
    expect(res.error).toMatch(message)
    expect(calls).toHaveLength(0)
  })

  it.each([
    ["date seule d'un jour futur", "2999-01-01"],
    ["date-heure ISO future", future(5)],
  ])("accepte : %s, et l'enregistre", async (_l, deadline) => {
    const { client, calls } = makeService({ wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await createMission({ ...validData, deadline })).toEqual({ id: "m-1" })
    expect(calls.find((c) => c.op === "insert").payload.deadline).toBe(deadline)
  })

  it("enregistre null sans date limite", async () => {
    const { client, calls } = makeService({ wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } })
    createServiceClient.mockReturnValue(client)
    await createMission({ ...validData, deadline: "" })
    expect(calls.find((c) => c.op === "insert").payload.deadline).toBeNull()
  })
})

describe("getMissions", () => {
  function makeSupabase() {
    const range = vi.fn()
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      range: (...a) => { range(...a); return builder },
      then: (ok, ko) => Promise.resolve({ data: [], error: null }).then(ok, ko),
    }
    return { client: { from: () => builder }, range }
  }

  it.each([
    [undefined, 19],
    [10, 9],
    [1000, 49],
    [0, 19],
    [-5, 0],
    ["abc", 19],
  ])("borne limit %s (fin de plage %s)", async (limit, end) => {
    const { client, range } = makeSupabase()
    createClient.mockResolvedValue(client)
    await getMissions({ limit })
    expect(range).toHaveBeenCalledWith(0, end)
  })
})

describe("getMissions : offset et erreurs", () => {
  function setup(result = { data: [], error: null }) {
    const range = vi.fn()
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      range: (...a) => { range(...a); return builder },
      then: (ok, ko) => Promise.resolve(result).then(ok, ko),
    }
    createClient.mockResolvedValue({ from: () => builder })
    return range
  }

  it.each([
    ["40", 40, 59],
    [-3, 0, 19],
    ["abc", 0, 19],
    [12.9, 12, 31],
    [undefined, 0, 19],
  ])("convertit l'offset %j en entier positif", async (offset, start, end) => {
    const range = setup()
    await getMissions({ offset })
    expect(range).toHaveBeenCalledWith(start, end)
  })

  it("lève une erreur neutre et journalise le détail", async () => {
    setup({ data: null, error: { message: "relation \"missions\" secret" } })
    await expect(getMissions()).rejects.toThrow("Impossible de charger les missions.")
    expect(console.error).toHaveBeenCalledWith("[getMissions]", expect.stringContaining("secret"))
  })
})

describe("confirmMission", () => {
  const reserved = { data: [{ type: "reserve" }], error: null }
  const mission = {
    id: "m-1", title: "T", budget: 5000, client_id: "client-1",
    selected_student_id: "etu-1", status: "in_progress",
  }

  it("refuse un non client", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect((await confirmMission("m-1")).error).toBe("refus")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse la mission d'un autre client sans libérer", async () => {
    const { client, rpc } = makeService({ missions: { data: { ...mission, client_id: "autre" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await confirmMission("m-1")).toEqual({ error: "Action non autorisée.", code: "generic" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("code not_in_progress pour une mission ouverte ou annulée", async () => {
    for (const status of ["open", "cancelled"]) {
      const { client } = makeService({ missions: { data: { ...mission, status }, error: null } })
      createServiceClient.mockReturnValue(client)
      expect(await confirmMission("m-1")).toEqual({ error: "Cette mission n'est pas en cours.", code: "not_in_progress" })
    }
  })

  it("refuse une mission non en cours ou sans étudiant", async () => {
    for (const patch of [{ status: "open" }, { status: "cancelled" }, { selected_student_id: null }]) {
      const { client, rpc } = makeService({ missions: { data: { ...mission, ...patch }, error: null } })
      createServiceClient.mockReturnValue(client)
      expect((await confirmMission("m-1")).error).toBeTruthy()
      expect(rpc).not.toHaveBeenCalled()
    }
  })

  it("libère avec le taux officiel puis passe en done", async () => {
    const { client, rpc, calls } = makeService(
      { wallet_transactions: reserved, missions: (st) => (st.op === "update" ? { data: [{ id: "m-1" }], error: null } : { data: mission, error: null }), profiles: { data: { full_name: "Awa K" }, error: null } },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    const res = await confirmMission("m-1")
    expect(res).toEqual({ success: true, amountStudent: 4400 })
    expect(rpc).toHaveBeenCalledWith("wallet_release", {
      p_client_id: "client-1", p_student_id: "etu-1", p_mission_id: "m-1",
      p_amount_total: 5000, p_commission_rate: 0.12,
    })
    const update = calls.find((c) => c.op === "update")
    expect(update.payload).toEqual({ status: "done" })
    expect(update.filters).toContainEqual(["status", "in_progress"])
    expect(sendEmail).toHaveBeenCalledWith("payment-received-wallet", "etu@example.com", expect.objectContaining({ firstName: "Awa" }))
  })

  it("ne passe pas en done quand la libération est refusée", async () => {
    for (const result of [
      { data: { success: false, error: "Fonds deja liberes" }, error: null },
      { data: null, error: { message: "boom" } },
    ]) {
      const { client, calls } = makeService({ wallet_transactions: reserved, missions: { data: mission, error: null } }, async () => result)
      createServiceClient.mockReturnValue(client)
      const res = await confirmMission("m-1")
      expect(res.error).toBeTruthy()
      expect(res.code).toBe("generic")
      expect(calls.some((c) => c.op === "update")).toBe(false)
    }
  })

  it("refuse une mission héritée sans réservation, sans libérer", async () => {
    for (const ledger of [{ data: [], error: null }, { data: null, error: null }]) {
      const { client, rpc, calls } = makeService({ wallet_transactions: ledger, missions: { data: mission, error: null } })
      createServiceClient.mockReturnValue(client)
      expect(await confirmMission("m-1")).toEqual({ error: "Impossible de libérer les fonds pour cette mission.", code: "generic" })
      expect(rpc).not.toHaveBeenCalled()
      expect(calls.some((c) => c.op === "update")).toBe(false)
    }
  })

  it("refuse quand une libération existe déjà (double confirmation, statut resté en cours)", async () => {
    const ledger = { data: [{ type: "reserve" }, { type: "release" }], error: null }
    const { client, rpc, calls } = makeService({ wallet_transactions: ledger, missions: { data: mission, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await confirmMission("m-1")).toEqual({ error: "Impossible de libérer les fonds pour cette mission.", code: "already_released" })
    expect(rpc).not.toHaveBeenCalled()
    expect(calls.some((c) => c.op === "update")).toBe(false)
  })

  it("refuse sans libérer quand le grand livre est illisible, et journalise", async () => {
    const { client, rpc } = makeService({ wallet_transactions: { data: null, error: { message: "boom" } }, missions: { data: mission, error: null } })
    createServiceClient.mockReturnValue(client)
    const res = await confirmMission("m-1")
    expect(res.error).toBe("Impossible de libérer les fonds pour cette mission.")
    expect(res.code).toBe("generic")
    expect(rpc).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it("lit le grand livre du client pour cette mission (réservation et libération)", async () => {
    const { client, calls } = makeService(
      { wallet_transactions: reserved, missions: (st) => (st.op === "update" ? { data: [{ id: "m-1" }], error: null } : { data: mission, error: null }) },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    await confirmMission("m-1")
    const read = calls.find((c) => c.table === "wallet_transactions")
    expect(read.filters).toEqual(expect.arrayContaining([["user_id", "client-1"], ["mission_id", "m-1"], ["type", ["reserve", "release"]]]))
  })

  it("double confirmation : le second appel renvoie une erreur propre sans mise à jour", async () => {
    const { client, rpc, calls } = makeService({ missions: { data: { ...mission, status: "done" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await confirmMission("m-1")).toEqual({ error: "Cette mission est déjà terminée.", code: "already_done" })
    expect(rpc).not.toHaveBeenCalled()
    expect(calls.some((c) => c.op === "update")).toBe(false)
  })

  it("alerte et renvoie une erreur neutre quand le statut done n'est pas enregistré (0 ligne)", async () => {
    const { client } = makeService(
      { wallet_transactions: reserved, missions: (st) => (st.op === "update" ? { data: [], error: null } : { data: mission, error: null }) },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    const res = await confirmMission("m-1")
    expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant.", code: "generic" })
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("fonds libérés"), expect.anything())
  })

  it("alerte aussi quand la mise à jour du statut done est en erreur", async () => {
    const { client } = makeService(
      { wallet_transactions: reserved, missions: (st) => (st.op === "update" ? { data: null, error: { message: "boom" } } : { data: mission, error: null }) },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    const res = await confirmMission("m-1")
    expect(res.error).toBeTruthy()
    expect(res.success).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("fonds libérés"), expect.anything())
  })

  it("réussit même si l'email échoue", async () => {
    const { client, getUserById } = makeService(
      { wallet_transactions: reserved, missions: (st) => (st.op === "update" ? { data: [{ id: "m-1" }], error: null } : { data: mission, error: null }) },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    getUserById.mockRejectedValue(new Error("smtp"))
    createServiceClient.mockReturnValue(client)
    expect((await confirmMission("m-1")).success).toBe(true)
  })
})

describe("updateMissionStatus", () => {
  const owned = { data: { id: "m-1", client_id: "client-1" }, error: null }
  const cancelOk = async () => ({ data: { success: true, refunded: 5000 }, error: null })

  it.each(["open", "in_progress", "done", undefined])("refuse le statut %s", async (status) => {
    const res = await updateMissionStatus("m-1", status)
    expect(res.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un non client", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect((await updateMissionStatus("m-1", "cancelled")).error).toBe("refus")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse la mission d'un autre client sans appeler la RPC", async () => {
    const { client, rpc } = makeService({ missions: { data: { ...owned.data, client_id: "autre" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ error: "Mission introuvable." })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("refuse une mission introuvable sans appeler la RPC", async () => {
    const { client, rpc } = makeService({ missions: { data: null, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ error: "Mission introuvable." })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("appelle la RPC atomique avec les bons paramètres, sans wallet_refund ni update séparé", async () => {
    const { client, rpc, calls } = makeService({ missions: owned }, cancelOk)
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("wallet_cancel_mission", { p_mission_id: "m-1", p_client_id: "client-1" })
    expect(calls.some((c) => c.op === "update" || c.op === "delete" || c.table === "wallet_transactions")).toBe(false)
  })

  it("la RPC renvoie invalid_status (mission changée entre-temps) : erreur, aucun autre appel", async () => {
    const { client, rpc, calls } = makeService(
      { missions: owned },
      async () => ({ data: { success: false, error: "invalid_status" }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    const res = await updateMissionStatus("m-1", "cancelled")
    expect(res.error).toMatch(/ne peut plus être annulée/)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(calls.some((c) => c.op === "update" || c.op === "delete")).toBe(false)
  })

  it("la RPC renvoie forbidden : refus neutre", async () => {
    const { client } = makeService({ missions: owned }, async () => ({ data: { success: false, error: "forbidden" }, error: null }))
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ error: "Mission introuvable." })
  })

  it("échec de la RPC (erreur ou refus) : erreur générique et log", async () => {
    for (const result of [
      { data: null, error: { message: "boom" } },
      { data: { success: false, error: "autre" }, error: null },
      { data: { success: false, error: "wallet_not_found" }, error: null },
      { data: { success: false, error: "inconsistent_funds" }, error: null },
    ]) {
      console.error.mockClear()
      const { client } = makeService({ missions: owned }, async () => result)
      createServiceClient.mockReturnValue(client)
      expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
      expect(console.error).toHaveBeenCalled()
    }
  })
})

describe("createMission : mission avec achats", () => {
  const wallet = { data: { balance: 10000, reserved: 0 }, error: null }
  const inserted = () => makeService({ wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } })
  const payloadOf = (calls) => calls.find((c) => c.op === "insert").payload

  it("enregistre l'estimation quand la case est vraie", async () => {
    const { client, calls } = inserted()
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...validData, with_purchases: true, purchases_estimate: 15000 })
    expect(res).toEqual({ id: "m-1" })
    expect(payloadOf(calls).purchases_estimate).toBe(15000)
  })

  it("accepte la case pour tous les types de mission", async () => {
    for (const type of MISSION_TYPES) {
      const { client, calls } = inserted()
      createServiceClient.mockReturnValue(client)
      expect(await createMission({ ...validData, type, with_purchases: true, purchases_estimate: 2500 })).toEqual({ id: "m-1" })
      expect(payloadOf(calls).purchases_estimate).toBe(2500)
    }
  })

  it.each([
    ["case absente", {}],
    ["case fausse", { with_purchases: false }],
    ["case non booléenne (chaîne)", { with_purchases: "true" }],
    ["case non booléenne (1)", { with_purchases: 1 }],
  ])("neutralise une estimation hostile : %s", async (_l, flag) => {
    const { client, calls } = inserted()
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...validData, ...flag, purchases_estimate: 999999 })
    expect(res).toEqual({ id: "m-1" })
    expect(payloadOf(calls).purchases_estimate ?? null).toBeNull()
    expect(Object.keys(payloadOf(calls))).not.toContain("purchases_estimate")
  })

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["chaîne numérique", "15000"],
    ["chaîne texte", "beaucoup"],
    ["négatif", -100],
    ["zéro", 0],
    ["décimal", 150.5],
    ["trop grand", 1e12],
    ["juste au dessus du plafond", 1000000000],
    ["absent", undefined],
    ["null", null],
    ["objet", { $gt: 0 }],
    ["tableau", [15000]],
  ])("refuse une estimation invalide avec la case vraie : %s, sans écriture", async (_l, value) => {
    const { client, calls } = inserted()
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...validData, with_purchases: true, purchases_estimate: value })
    expect(res.error).toMatch(/estimation des achats/)
    expect(calls).toHaveLength(0)
  })

  it("prend le client de la session même avec une estimation et un client_id du corps", async () => {
    const { client, calls } = inserted()
    createServiceClient.mockReturnValue(client)
    await createMission({ ...validData, with_purchases: true, purchases_estimate: 8000, client_id: "autre" })
    expect(payloadOf(calls).client_id).toBe("client-1")
    expect(payloadOf(calls).purchases_estimate).toBe(8000)
  })

  it("n'a aucun effet sur le montant bloqué", async () => {
    const { client, rpc } = makeService(
      { wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null } },
      async () => ({ data: { success: true }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    await createMission({ ...validData, with_purchases: true, purchases_estimate: 9000 })
    expect(rpc).toHaveBeenCalledWith("wallet_reserve", { p_user_id: "client-1", p_amount: 5000, p_mission_id: "m-1" })
  })

  it("le solde se compare au seul budget, sans l'estimation", async () => {
    const { client } = makeService({ wallets: { data: { balance: 5000, reserved: 0 }, error: null }, "missions:insert": { data: { id: "m-1" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await createMission({ ...validData, with_purchases: true, purchases_estimate: 90000 })).toEqual({ id: "m-1" })
  })
})

describe("notifications in-app (RD-NOTIF-01)", () => {
  const MISSION_ID = "11111111-1111-4111-8111-111111111111"
  const STUDENT_ID = "22222222-2222-4222-8222-222222222222"
  const OTHER_ID = "33333333-3333-4333-8333-333333333333"
  const CLIENT_ID = "44444444-4444-4444-8444-444444444444"

  beforeEach(() => {
    requireRole.mockResolvedValue({ user: { id: CLIENT_ID }, role: "client" })
    notify.mockReset()
    notify.mockResolvedValue({ ok: true })
    notifyMany.mockReset()
    notifyMany.mockResolvedValue({ ok: true })
    sendEmail.mockReset()
    sendEmail.mockResolvedValue({})
  })

  describe("confirmMission : payment_released", () => {
    const mission = {
      id: MISSION_ID, title: "Traduction d'un flyer", budget: 25000, client_id: CLIENT_ID,
      selected_student_id: STUDENT_ID, status: "in_progress",
    }
    const done = (releaseResult) => makeService(
      {
        wallet_transactions: { data: [{ type: "reserve" }], error: null },
        missions: (st) => (st.op === "update" ? { data: [{ id: MISSION_ID }], error: null } : { data: mission, error: null }),
        profiles: { data: { full_name: "Awa K" }, error: null },
      },
      async () => releaseResult ?? { data: { success: true, amount_student: 22000 }, error: null },
    )

    it("notifie l'étudiant avec le montant renvoyé par la libération", async () => {
      createServiceClient.mockReturnValue(done().client)
      expect(await confirmMission(MISSION_ID)).toEqual({ success: true, amountStudent: 22000 })
      expect(notify).toHaveBeenCalledTimes(1)
      const input = notify.mock.calls[0][0]
      expect(input).toMatchObject({
        recipientId: STUDENT_ID,
        type: "payment_released",
        body: "Le client a validé « Traduction d'un flyer ».",
        dedupeKey: `payment_released:${MISSION_ID}`,
        missionId: MISSION_ID,
      })
      expect(input.title).toMatch(/^Paiement reçu : \+22\s000\sFCFA$/u)
    })

    it("montant absent dans la réponse de libération : titre générique, sans montant inventé", async () => {
      createServiceClient.mockReturnValue(done({ data: { success: true }, error: null }).client)
      expect(await confirmMission(MISSION_ID)).toEqual({ success: true, amountStudent: 0 })
      expect(notify).toHaveBeenCalledTimes(1)
      expect(notify.mock.calls[0][0].title).toBe("Paiement reçu")
    })

    it("la notification précède l'email", async () => {
      const order = []
      notify.mockImplementation(async () => { order.push("notify"); return { ok: true } })
      sendEmail.mockImplementation(async () => { order.push("email") })
      createServiceClient.mockReturnValue(done().client)
      await confirmMission(MISSION_ID)
      expect(order).toEqual(["notify", "email"])
    })

    it("aucune notification quand la libération est refusée ou que le statut done n'est pas écrit", async () => {
      createServiceClient.mockReturnValue(done({ data: { success: false }, error: null }).client)
      expect((await confirmMission(MISSION_ID)).error).toBeTruthy()
      const { client } = makeService(
        {
          wallet_transactions: { data: [{ type: "reserve" }], error: null },
          missions: (st) => (st.op === "update" ? { data: [], error: null } : { data: mission, error: null }),
        },
        async () => ({ data: { success: true, amount_student: 22000 }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      expect((await confirmMission(MISSION_ID)).error).toBeTruthy()
      expect(notify).not.toHaveBeenCalled()
    })

    it("même résultat si notify échoue ou lève", async () => {
      notify.mockResolvedValueOnce({ ok: false })
      createServiceClient.mockReturnValue(done().client)
      expect(await confirmMission(MISSION_ID)).toEqual({ success: true, amountStudent: 22000 })
      notify.mockRejectedValueOnce(new Error("boom"))
      createServiceClient.mockReturnValue(done().client)
      expect(await confirmMission(MISSION_ID)).toEqual({ success: true, amountStudent: 22000 })
    })
  })

  describe("updateMissionStatus : mission_cancelled", () => {
    const owned = { data: { id: MISSION_ID, title: "Traduction d'un flyer", client_id: CLIENT_ID }, error: null }
    const cancelOk = async () => ({ data: { success: true, refunded: 25000 }, error: null })

    it("notifie les étudiants dont la candidature était en attente, après l'annulation", async () => {
      const { client, calls } = makeService(
        { missions: owned, applications: { data: [{ student_id: STUDENT_ID }, { student_id: OTHER_ID }], error: null } },
        cancelOk,
      )
      createServiceClient.mockReturnValue(client)
      expect(await updateMissionStatus(MISSION_ID, "cancelled")).toEqual({ success: true })
      const read = calls.find((c) => c.table === "applications")
      expect(read.filters).toEqual([["mission_id", MISSION_ID], ["status", "pending"]])
      expect(notifyMany).toHaveBeenCalledTimes(1)
      const [recipients, built] = notifyMany.mock.calls[0]
      expect(recipients).toEqual([STUDENT_ID, OTHER_ID])
      expect(built).toMatchObject({
        type: "mission_cancelled",
        body: "La mission « Traduction d'un flyer » a été annulée par le client.",
        dedupeKey: `mission_cancelled:${MISSION_ID}`,
      })
    })

    it("aucune lecture ni notification quand l'annulation échoue", async () => {
      const { client, calls } = makeService(
        { missions: owned },
        async () => ({ data: { success: false, error: "invalid_status" }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      expect((await updateMissionStatus(MISSION_ID, "cancelled")).error).toBeTruthy()
      expect(calls.some((c) => c.table === "applications")).toBe(false)
      expect(notifyMany).not.toHaveBeenCalled()
    })

    it("même résultat si la lecture des candidatures échoue, ou si notifyMany échoue ou lève", async () => {
      const failing = makeService({ missions: owned, applications: { data: null, error: { code: "XX000", message: "boom" } } }, cancelOk)
      createServiceClient.mockReturnValue(failing.client)
      expect(await updateMissionStatus(MISSION_ID, "cancelled")).toEqual({ success: true })
      expect(notifyMany).not.toHaveBeenCalled()

      notifyMany.mockResolvedValueOnce({ ok: false })
      createServiceClient.mockReturnValue(makeService({ missions: owned, applications: { data: [{ student_id: STUDENT_ID }], error: null } }, cancelOk).client)
      expect(await updateMissionStatus(MISSION_ID, "cancelled")).toEqual({ success: true })

      notifyMany.mockRejectedValueOnce(new Error("boom"))
      createServiceClient.mockReturnValue(makeService({ missions: owned, applications: { data: [{ student_id: STUDENT_ID }], error: null } }, cancelOk).client)
      expect(await updateMissionStatus(MISSION_ID, "cancelled")).toEqual({ success: true })
    })
  })
})
