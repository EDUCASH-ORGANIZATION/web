import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createHmac } from "node:crypto"

const rpc = vi.fn()
const from = vi.fn()
const getUserById = vi.fn()
const createServiceClient = vi.fn()
const sendEmail = vi.fn()

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/email/index", () => ({ sendEmail: (...a) => sendEmail(...a) }))

import { POST } from "./route"

const SECRET = "whsec"
const sign = (body) => createHmac("sha256", SECRET).update(body).digest("hex")
function signed(event) {
  const body = JSON.stringify(event)
  return new Request("http://localhost/x", { method: "POST", headers: { "x-fedapay-signature": sign(body) }, body })
}

describe("POST /api/webhooks/fedapay", () => {
  const original = process.env.FEDAPAY_WEBHOOK_SECRET
  const originalFlag = process.env.PAYMENTS_ENABLED
  beforeEach(() => {
    process.env.PAYMENTS_ENABLED = "true"
    for (const f of [rpc, from, getUserById, createServiceClient, sendEmail]) f.mockReset()
    createServiceClient.mockReturnValue({ rpc, from, auth: { admin: { getUserById } } })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.PAYMENTS_ENABLED
    else process.env.PAYMENTS_ENABLED = originalFlag
    if (original === undefined) delete process.env.FEDAPAY_WEBHOOK_SECRET
    else process.env.FEDAPAY_WEBHOOK_SECRET = original
  })

  it("répond 503 paiements désactivés sans lire le corps si le drapeau est faux", async () => {
    delete process.env.PAYMENTS_ENABLED
    process.env.FEDAPAY_WEBHOOK_SECRET = "whsec"
    const req = new Request("http://localhost/x", { method: "POST", body: "{}" })
    const textSpy = vi.spyOn(req, "text")
    const res = await POST(req)
    expect(res.status).toBe(503)
    expect(textSpy).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/désactivés/)
  })

  it("répond 503 sans exception si le secret est absent", async () => {
    delete process.env.FEDAPAY_WEBHOOK_SECRET
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: "{}" }))
    expect(res.status).toBe(503)
  })

  it("répond 401 si la signature est invalide", async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = "whsec"
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", headers: { "x-fedapay-signature": "bad" }, body: "{}" })
    )
    expect(res.status).toBe(401)
  })

  it("répond 401 si la signature a une longueur différente ou est absente", async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = SECRET
    const body = "{}"
    for (const headers of [{ "x-fedapay-signature": sign(body).slice(0, -2) }, { "x-fedapay-signature": sign(body) + "00" }, {}]) {
      const res = await POST(new Request("http://localhost/x", { method: "POST", headers, body }))
      expect(res.status).toBe(401)
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("accepte une signature valide et crédite un dépôt de portefeuille", async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = SECRET
    rpc.mockResolvedValue({ data: { success: true, new_balance: 7000 }, error: null })
    getUserById.mockResolvedValue({ data: { user: { email: "a@b.bj" } } })
    from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { full_name: "Awa K" } }) }) }) })
    const res = await POST(signed({
      name: "transaction.approved",
      entity: { id: 42, amount: 5000, custom_metadata: { type: "wallet_deposit", userId: "u1" } },
    }))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("wallet_deposit", { p_user_id: "u1", p_amount: 5000, p_fedapay_id: "42" })
    expect(sendEmail).toHaveBeenCalledWith("wallet-deposited", "a@b.bj", expect.objectContaining({ firstName: "Awa" }))
  })

  it.each([
    ["mission_payment", { type: "mission_payment" }],
    ["type absent", {}],
    ["type inconnu", { type: "autre" }],
  ])("acquitte un paiement approuvé (%s) sans aucune écriture", async (_n, custom_metadata) => {
    process.env.FEDAPAY_WEBHOOK_SECRET = SECRET
    const res = await POST(signed({ name: "transaction.approved", entity: { id: 1, amount: 10, custom_metadata } }))
    expect(res.status).toBe(200)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it("acquitte une transaction refusée sans écriture", async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = SECRET
    const res = await POST(signed({ name: "transaction.declined", entity: { id: 1, custom_metadata: {} } }))
    expect(res.status).toBe(200)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it("acquitte un événement inconnu et répond 400 sur un corps illisible", async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = SECRET
    expect((await POST(signed({ name: "autre" }))).status).toBe(200)
    const bad = "pas du json"
    const res = await POST(new Request("http://localhost/x", { method: "POST", headers: { "x-fedapay-signature": sign(bad) }, body: bad }))
    expect(res.status).toBe(400)
  })
})
