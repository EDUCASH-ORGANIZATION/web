import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))

import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { createMission } from "@/lib/actions/mission.actions"

// RD-MISSION-02 : essais de casse complémentaires de createMission (mission avec achats).
function makeService({ insert = { data: { id: "m-1" }, error: null }, balance = 10000 } = {}) {
  const calls = []
  const rpc = vi.fn(async () => ({ data: { success: true }, error: null }))
  const from = vi.fn((table) => {
    const state = { table, op: "select" }
    calls.push(state)
    const res = () => {
      if (table === "wallets") return { data: { balance, reserved: 0 }, error: null }
      if (table === "missions" && state.op === "insert") return insert
      return { data: null, error: null }
    }
    const b = {
      select: () => b,
      insert: (v) => { state.op = "insert"; state.payload = v; return b },
      update: () => { state.op = "update"; return b },
      delete: () => { state.op = "delete"; return b },
      eq: () => b,
      in: () => b,
      single: () => Promise.resolve(res()),
      maybeSingle: () => Promise.resolve(res()),
      then: (ok, ko) => Promise.resolve(res()).then(ok, ko),
    }
    return b
  })
  return { client: { from, rpc, auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "e@x.fr" } } })) } } }, calls, rpc }
}

const base = { title: "Faire des courses", description: "Acheter des légumes au marché", type: "Livraison", city: "Cotonou", budget: 5000, urgency: "low" }
const insertPayload = (calls) => calls.find((c) => c.op === "insert")?.payload

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYMENTS_ENABLED", "true")
  requireRole.mockResolvedValue({ user: { id: "client-1" }, role: "client" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("createMission avec achats : casse complémentaire", () => {
  it.each([1, 15000, 999999999])("accepte la borne valable %s", async (n) => {
    const { client, calls } = makeService()
    createServiceClient.mockReturnValue(client)
    expect(await createMission({ ...base, with_purchases: true, purchases_estimate: n })).toEqual({ id: "m-1" })
    expect(insertPayload(calls).purchases_estimate).toBe(n)
  })

  it.each([
    ["-0", -0], ["0.5", 0.5], ["1e21", 1e21], ["-Infinity", Number.NEGATIVE_INFINITY],
    ["chaîne vide", ""], ["booléen true", true], ["chaîne 1e3", "1e3"], ["objet Number", new Number(5)],
  ])("refuse %s avec la case vraie, sans écriture ni réservation", async (_l, v) => {
    const { client, calls, rpc } = makeService()
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...base, with_purchases: true, purchases_estimate: v })
    expect(res.error).toMatch(/estimation des achats/)
    expect(calls).toHaveLength(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([NaN, Infinity, "15000", -1, 0, 0.5, 1e12, null, undefined, {}, []])(
    "case décochée : l'estimation %j est ignorée, la mission est créée sans la colonne",
    async (v) => {
      const { client, calls } = makeService()
      createServiceClient.mockReturnValue(client)
      expect(await createMission({ ...base, with_purchases: false, purchases_estimate: v })).toEqual({ id: "m-1" })
      expect("purchases_estimate" in insertPayload(calls)).toBe(false)
    },
  )

  it.each([[[]], [{}], [null], ["true"], [1], [0]])("with_purchases %j n'est pas un vrai booléen : aucune estimation écrite", async (flag) => {
    const { client, calls } = makeService()
    createServiceClient.mockReturnValue(client)
    await createMission({ ...base, with_purchases: flag, purchases_estimate: 15000 })
    expect("purchases_estimate" in insertPayload(calls)).toBe(false)
  })

  it.each([["student"], ["admin"]])("session %s refusée, aucun accès base", async (role) => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await createMission({ ...base, with_purchases: true, purchases_estimate: 15000 })
    expect(res.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(role).toBeTruthy()
  })

  it("budget absent avec la case cochée : erreur de budget, aucune écriture", async () => {
    const { client, calls } = makeService()
    createServiceClient.mockReturnValue(client)
    const { budget, ...noBudget } = base
    const res = await createMission({ ...noBudget, with_purchases: true, purchases_estimate: 15000 })
    expect(res.error).toMatch(/budget/i)
    expect(calls).toHaveLength(0)
  })

  it("solde = budget exact suffit, solde inférieur au budget refuse même avec une petite estimation", async () => {
    const ok = makeService({ balance: 5000 })
    createServiceClient.mockReturnValue(ok.client)
    expect(await createMission({ ...base, with_purchases: true, purchases_estimate: 1 })).toEqual({ id: "m-1" })
    const ko = makeService({ balance: 4999 })
    createServiceClient.mockReturnValue(ko.client)
    const res = await createMission({ ...base, with_purchases: true, purchases_estimate: 1 })
    expect(res.error).toBeTruthy()
    expect(insertPayload(ko.calls)).toBeUndefined()
  })

  it("échec d'insertion (colonne absente avant le SQL) : erreur générique, aucune réservation, pas de fuite technique", async () => {
    const { client, rpc } = makeService({ insert: { data: null, error: { code: "PGRST204", message: "Could not find the 'purchases_estimate' column" } } })
    createServiceClient.mockReturnValue(client)
    const res = await createMission({ ...base, with_purchases: true, purchases_estimate: 15000 })
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/purchases_estimate|PGRST/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("données nulles : refus propre, sans exception", async () => {
    createServiceClient.mockReturnValue(makeService().client)
    for (const d of [null, undefined, "x", 5]) {
      await expect(createMission(d)).resolves.toHaveProperty("error")
    }
  })
})
