import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callWalletRpc } from "./wallet-rpc.js"

const clientReturning = (value) => ({ rpc: vi.fn().mockResolvedValue(value) })

describe("callWalletRpc", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it("appelle la RPC avec le nom et les paramètres", async () => {
    const client = clientReturning({ data: { success: true }, error: null })
    await callWalletRpc(client, "wallet_reserve", { p_mission_id: "m1" })
    expect(client.rpc).toHaveBeenCalledWith("wallet_reserve", { p_mission_id: "m1" })
  })

  it("réussit seulement si error est nul et success vaut true", async () => {
    const data = { success: true, transaction_id: "t1" }
    const result = await callWalletRpc(clientReturning({ data, error: null }), "wallet_release", {})
    expect(result).toEqual({ ok: true, data })
  })

  it("échoue sur une erreur RPC, sans exposer le détail", async () => {
    const result = await callWalletRpc(
      clientReturning({ data: null, error: { message: "permission denied for function" } }),
      "wallet_refund",
      {}
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBeNull()
    expect(result.error).not.toMatch(/permission/)
  })

  it("échoue si success vaut false et reprend le code SQL", async () => {
    const result = await callWalletRpc(
      clientReturning({ data: { success: false, error: "insufficient_balance" }, error: null }),
      "wallet_reserve",
      {}
    )
    expect(result).toMatchObject({ ok: false, code: "insufficient_balance" })
    expect(result.error).not.toMatch(/insufficient/)
  })

  it("échoue si success est absent ou n'est pas strictement true", async () => {
    for (const data of [{}, { success: "true" }, { success: 1 }]) {
      const result = await callWalletRpc(clientReturning({ data, error: null }), "wallet_release", {})
      expect(result.ok).toBe(false)
    }
  })

  it("échoue si data est null ou si la réponse est vide", async () => {
    expect((await callWalletRpc(clientReturning({ data: null, error: null }), "x", {})).ok).toBe(false)
    expect((await callWalletRpc(clientReturning(undefined), "x", {})).ok).toBe(false)
  })

  it("échoue proprement si l'appel lève une exception", async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error("réseau")) }
    const result = await callWalletRpc(client, "wallet_release", {})
    expect(result).toMatchObject({ ok: false, code: null })
  })
})
