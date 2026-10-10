import { describe, it, expect, vi, beforeEach } from "vitest"

const invoke = vi.fn()
const getSession = vi.fn()
const single = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getSession },
    functions: { invoke },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  })),
}))
vi.mock("@/lib/actions/auth.actions", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}))

import { initiateWithdrawal, initiateDeposit } from "./wallet.actions"

beforeEach(() => {
  invoke.mockReset()
  getSession.mockReset()
  single.mockReset()
  single.mockResolvedValue({ data: { balance: 10000, reserved: 0 } })
  getSession.mockResolvedValue({ data: { session: { access_token: "session-jwt" } } })
  invoke.mockResolvedValue({ data: { message: "ok" }, error: null })
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-public-key")
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
