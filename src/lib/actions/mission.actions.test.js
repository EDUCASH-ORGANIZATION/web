import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))

import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { sendEmail } from "@/lib/email/index"
import { createMission, confirmMission, updateMissionStatus } from "./mission.actions"

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
    const { client, calls } = makeService(
      {
        wallets: wallet,
        "missions:insert": { data: { id: "m-1" }, error: null },
        "missions:delete": { data: null, error: { message: "denied" } },
      },
      async () => ({ data: { success: false }, error: null }),
    )
    createServiceClient.mockReturnValue(client)
    await createMission(validData)
    const update = calls.find((c) => c.op === "update")
    expect(update.payload).toEqual({ status: "cancelled" })
  })

  describe("nettoyage quand des fonds ont été réservés", () => {
    const ledger = { data: [{ type: "reserve", amount: 5000 }], error: null }
    const rpcByName = (refund) => async (name) =>
      name === "wallet_reserve" ? { data: { success: false }, error: null } : refund

    it("rembourse le reste réservé puis annule la mission, sans la supprimer", async () => {
      const order = []
      const { client, calls, rpc } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: ledger,
          "missions:update": () => { order.push("update"); return { data: null, error: null } },
        },
        async (name) => {
          order.push(name)
          return name === "wallet_reserve" ? { data: { success: false }, error: null } : { data: { success: true }, error: null }
        },
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res.error).toMatch(/réserver les fonds/)
      expect(rpc).toHaveBeenCalledWith("wallet_refund", { p_client_id: "client-1", p_mission_id: "m-1", p_amount: 5000 })
      expect(order).toEqual(["wallet_reserve", "wallet_refund", "update"])
      expect(calls.find((c) => c.op === "update").payload).toEqual({ status: "cancelled" })
      expect(calls.some((c) => c.op === "delete")).toBe(false)
    })

    it("ne rembourse que le reste (réservation moins remboursements)", async () => {
      const { client, rpc } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: [{ type: "reserve", amount: 5000 }, { type: "refund", amount: 2000 }], error: null },
        },
        rpcByName({ data: { success: true }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      await createMission(validData)
      expect(rpc).toHaveBeenCalledWith("wallet_refund", expect.objectContaining({ p_amount: 3000 }))
    })

    it("sans fonds restants mais avec mouvements, annule sans rembourser ni supprimer", async () => {
      const { client, calls, rpc } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: [{ type: "reserve", amount: 5000 }, { type: "refund", amount: 5000 }], error: null },
        },
        rpcByName({ data: { success: true }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      await createMission(validData)
      expect(rpc).not.toHaveBeenCalledWith("wallet_refund", expect.anything())
      expect(calls.find((c) => c.op === "update").payload).toEqual({ status: "cancelled" })
      expect(calls.some((c) => c.op === "delete")).toBe(false)
    })

    it("si le remboursement échoue, ni annulation ni suppression, erreur générique", async () => {
      const { client, calls } = makeService(
        { wallets: wallet, "missions:insert": { data: { id: "m-1" }, error: null }, wallet_transactions: ledger },
        rpcByName({ data: { success: false, error: "interne" }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
      expect(calls.some((c) => c.op === "update")).toBe(false)
      expect(calls.some((c) => c.op === "delete")).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })

    it("si le grand livre est illisible, ni annulation ni suppression", async () => {
      const { client, calls } = makeService(
        {
          wallets: wallet,
          "missions:insert": { data: { id: "m-1" }, error: null },
          wallet_transactions: { data: null, error: { message: "boom" } },
        },
        async () => ({ data: { success: false }, error: null }),
      )
      createServiceClient.mockReturnValue(client)
      const res = await createMission(validData)
      expect(res.error).toMatch(/Une erreur est survenue/)
      expect(calls.some((c) => c.op === "update" || c.op === "delete")).toBe(false)
    })
  })
})

describe("confirmMission", () => {
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
    expect(await confirmMission("m-1")).toEqual({ error: "Action non autorisée." })
    expect(rpc).not.toHaveBeenCalled()
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
      { missions: { data: mission, error: null }, profiles: { data: { full_name: "Awa K" }, error: null } },
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
      const { client, calls } = makeService({ missions: { data: mission, error: null } }, async () => result)
      createServiceClient.mockReturnValue(client)
      const res = await confirmMission("m-1")
      expect(res.error).toBeTruthy()
      expect(calls.some((c) => c.op === "update")).toBe(false)
    }
  })

  it("double confirmation : le second appel renvoie une erreur propre sans mise à jour", async () => {
    const { client, rpc, calls } = makeService({ missions: { data: { ...mission, status: "done" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await confirmMission("m-1")).toEqual({ error: "Cette mission est déjà terminée." })
    expect(rpc).not.toHaveBeenCalled()
    expect(calls.some((c) => c.op === "update")).toBe(false)
  })

  it("réussit même si l'email échoue", async () => {
    const { client, getUserById } = makeService(
      { missions: { data: mission, error: null } },
      async () => ({ data: { success: true, amount_student: 4400 }, error: null }),
    )
    getUserById.mockRejectedValue(new Error("smtp"))
    createServiceClient.mockReturnValue(client)
    expect((await confirmMission("m-1")).success).toBe(true)
  })
})

describe("updateMissionStatus", () => {
  const open = { data: { id: "m-1", client_id: "client-1", status: "open" }, error: null }
  const reserved = (...rows) => ({ data: rows, error: null })

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

  it("refuse la mission d'un autre client", async () => {
    const { client, rpc } = makeService({ missions: { data: { ...open.data, client_id: "autre" }, error: null } })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ error: "Mission introuvable." })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("refuse l'annulation d'une mission en cours par le client", async () => {
    const { client, rpc, calls } = makeService({ missions: { data: { ...open.data, status: "in_progress" }, error: null } })
    createServiceClient.mockReturnValue(client)
    const res = await updateMissionStatus("m-1", "cancelled")
    expect(res.error).toMatch(/en cours/)
    expect(rpc).not.toHaveBeenCalled()
    expect(calls.some((c) => c.op === "update")).toBe(false)
  })

  it("rembourse les fonds réservés avec les bons paramètres puis annule", async () => {
    const { client, rpc, calls } = makeService({
      missions: (s) => (s.op === "update" ? { data: [{ id: "m-1" }], error: null } : open),
      wallet_transactions: reserved({ type: "reserve", amount: 5000 }),
    })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith("wallet_refund", { p_client_id: "client-1", p_mission_id: "m-1", p_amount: 5000 })
    const update = calls.find((c) => c.op === "update")
    expect(update.payload).toEqual({ status: "cancelled" })
    expect(update.filters).toContainEqual(["status", "open"])
  })

  it("rembourse seulement le reste quand un remboursement partiel existe", async () => {
    const { client, rpc } = makeService({
      missions: (s) => (s.op === "update" ? { data: [{ id: "m-1" }], error: null } : open),
      wallet_transactions: reserved({ type: "reserve", amount: 5000 }, { type: "refund", amount: 2000 }),
    })
    createServiceClient.mockReturnValue(client)
    await updateMissionStatus("m-1", "cancelled")
    expect(rpc).toHaveBeenCalledWith("wallet_refund", expect.objectContaining({ p_amount: 3000 }))
  })

  it("laisse le statut inchangé quand le remboursement échoue", async () => {
    for (const result of [
      { data: { success: false, error: "Montant incoherent" }, error: null },
      { data: null, error: { message: "boom" } },
    ]) {
      const { client, calls } = makeService(
        { missions: open, wallet_transactions: reserved({ type: "reserve", amount: 5000 }) },
        async () => result,
      )
      createServiceClient.mockReturnValue(client)
      const res = await updateMissionStatus("m-1", "cancelled")
      expect(res.error).toMatch(/remboursement/)
      expect(calls.some((c) => c.op === "update")).toBe(false)
    }
  })

  it("annule une mission héritée sans réservation, sans remboursement", async () => {
    const { client, rpc } = makeService({
      missions: (s) => (s.op === "update" ? { data: [{ id: "m-1" }], error: null } : open),
      wallet_transactions: reserved(),
    })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ success: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("annule sans nouveau remboursement quand tout est déjà remboursé (reprise)", async () => {
    const { client, rpc } = makeService({
      missions: (s) => (s.op === "update" ? { data: [{ id: "m-1" }], error: null } : open),
      wallet_transactions: reserved({ type: "reserve", amount: 5000 }, { type: "refund", amount: 5000 }),
    })
    createServiceClient.mockReturnValue(client)
    expect(await updateMissionStatus("m-1", "cancelled")).toEqual({ success: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("signale une erreur quand la mission a changé entre-temps (aucune ligne mise à jour)", async () => {
    const { client } = makeService({
      missions: (s) => (s.op === "update" ? { data: [], error: null } : open),
      wallet_transactions: reserved(),
    })
    createServiceClient.mockReturnValue(client)
    expect((await updateMissionStatus("m-1", "cancelled")).error).toBeTruthy()
  })
})
