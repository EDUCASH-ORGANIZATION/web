import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }))

import { POST } from "./route"

describe("POST /api/webhooks/fedapay", () => {
  const original = process.env.FEDAPAY_WEBHOOK_SECRET
  const originalFlag = process.env.PAYMENTS_ENABLED
  beforeEach(() => {
    process.env.PAYMENTS_ENABLED = "true"
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
})
