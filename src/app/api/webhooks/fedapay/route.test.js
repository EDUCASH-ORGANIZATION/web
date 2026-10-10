import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }))

import { POST } from "./route"

describe("POST /api/webhooks/fedapay", () => {
  const original = process.env.FEDAPAY_WEBHOOK_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.FEDAPAY_WEBHOOK_SECRET
    else process.env.FEDAPAY_WEBHOOK_SECRET = original
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
