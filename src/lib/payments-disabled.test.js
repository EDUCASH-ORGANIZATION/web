import { describe, it, expect, vi, afterEach } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import {
  paymentsEnabled,
  paymentsGuard,
  PAYMENTS_DISABLED_MESSAGE,
} from "../../supabase/functions/_shared/payments-flag.js"
import { POST } from "@/app/api/webhooks/fedapay/route.js"

describe("paymentsEnabled", () => {
  it("n'active que la valeur exacte true", () => {
    expect(paymentsEnabled("true")).toBe(true)
    for (const v of [undefined, null, "", "false", "TRUE", "1", " true"]) {
      expect(paymentsEnabled(v)).toBe(false)
    }
  })
})

describe("paymentsGuard", () => {
  it("renvoie null quand les paiements sont actifs", () => {
    expect(paymentsGuard("true")).toBeNull()
  })

  it("renvoie 503 avec le message et les en-tetes CORS sinon", async () => {
    const res = paymentsGuard(undefined, { "Access-Control-Allow-Origin": "https://app.test" })
    expect(res.status).toBe(503)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.test")
    expect(res.headers.get("Content-Type")).toBe("application/json")
    expect(await res.json()).toEqual({ error: PAYMENTS_DISABLED_MESSAGE })
    expect(PAYMENTS_DISABLED_MESSAGE).toBe("Paiements désactivés")
  })
})

describe("Edge Functions de paiement", () => {
  const read = (n) => readFileSync(`supabase/functions/${n}/index.ts`, "utf8")

  it.each(["process-withdrawal", "create-deposit-transaction"])(
    "%s verifie le drapeau apres OPTIONS et avant l'authentification et le corps",
    (name) => {
      const src = read(name)
      const guard = src.indexOf('paymentsGuard(Deno.env.get("PAYMENTS_ENABLED")')
      expect(guard).toBeGreaterThan(src.indexOf('req.method === "OPTIONS"'))
      expect(guard).toBeLessThan(src.indexOf("extractBearerToken(req"))
      expect(guard).toBeLessThan(src.indexOf("req.json()"))
    },
  )

  it("auto-release est inerte : aucun acces donnees ni liberation de fonds", () => {
    const src = read("auto-release")
    expect(src).toContain("status: 503")
    expect(src).not.toMatch(/createClient|wallet_release|\.update\(|fetch\(/)
  })

  it("create-fedapay-transaction est supprimee", () => {
    expect(existsSync("supabase/functions/create-fedapay-transaction")).toBe(false)
  })
})

describe("webhook de paiement", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("repond 503 sans lire le corps tant que PAYMENTS_ENABLED n'est pas true", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false")
    const request = { text: vi.fn(), headers: { get: vi.fn() } }
    const res = await POST(request)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: "Paiements désactivés" })
    expect(request.text).not.toHaveBeenCalled()
  })

  it("est ferme quand la variable est absente", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", undefined)
    const res = await POST({ text: vi.fn(), headers: { get: vi.fn() } })
    expect(res.status).toBe(503)
  })
})
