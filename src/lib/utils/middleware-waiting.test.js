import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const createServerClient = vi.fn(() => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  from: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args) => createServerClient(...args),
}))

import { middleware, config } from "../../../middleware.js"

async function run(path, method = "GET") {
  return middleware(new NextRequest(`http://localhost${path}`, { method }))
}

function expectWaiting(res, status = 503) {
  expect(res.status).toBe(status)
  expect(res.headers.get("retry-after")).toBe("86400")
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive")
  expect(res.headers.get("cache-control")).toBe("no-store, max-age=0")
  expect(res.headers.get("clear-site-data")).toBe('"storage"')
}

beforeEach(() => {
  createServerClient.mockClear()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("middleware en mode attente", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_WAITING_MODE", "true")
  })

  it.each([
    "/",
    "/auth/login",
    "/auth/callback",
    "/clients",
    "/admin/dashboard",
    "/missions/3f1c2d3e-0000-4000-8000-000000000000",
    "/offline",
    "/auth/login?next=/admin",
    "//admin",
    "/%61dmin",
    "/_next/image?url=%2Flogo.png&w=64&q=75",
  ])("%s -> 503 page d'attente", async (path) => {
    const res = await run(path)
    expectWaiting(res)
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(await res.text()).toContain("EduCash ouvre bientôt")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("méthode %s sur / -> 503", async (method) => {
    const res = await run("/", method)
    expectWaiting(res)
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("POST d'une server action sur /auth/login -> 503", async () => {
    const res = await middleware(
      new NextRequest("http://localhost/auth/login", { method: "POST", headers: { "next-action": "abc" }, body: "x" }),
    )
    expectWaiting(res)
  })

  it.each(["/api/email", "/api/webhooks/fedapay", "/api/check-email-mx", "/api", "/api/health/x"])(
    "POST %s -> 503 JSON",
    async (path) => {
      const res = await run(path, "POST")
      expectWaiting(res)
      expect(res.headers.get("content-type")).toContain("application/json")
      expect(await res.json()).toEqual({ error: "Service momentanément indisponible." })
      expect(createServerClient).not.toHaveBeenCalled()
    },
  )

  it("/sw.js -> 200 kill switch no-store", async () => {
    const res = await run("/sw.js")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/javascript; charset=utf-8")
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.text()
    expect(body).toContain("unregister")
    expect(body).toContain("caches.delete")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("/manifest.json -> 404 no-store noindex", async () => {
    const res = await run("/manifest.json")
    expect(res.status).toBe(404)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("x-robots-tag")).toContain("noindex")
  })

  it.each(["/api/health", "/attente.css"])("%s -> passe sans Supabase", async (path) => {
    const res = await run(path)
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("POST /api/health reste exempté (la route n'expose que GET)", async () => {
    const res = await run("/api/health", "POST")
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("le matcher couvre les chemins à bloquer et exempte les assets statiques", () => {
    const re = new RegExp("^" + config.matcher[0] + "$")
    for (const p of ["/", "/_next/image", "/sw.js", "/manifest.json", "/attente.css", "/api/email", "/offline"]) {
      expect(re.test(p), p).toBe(true)
    }
    for (const p of ["/_next/static/chunks/a.js", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/email/educash-logo-blanc.png", "/logo-horizontal-blanc.svg"]) {
      expect(re.test(p), p).toBe(false)
    }
  })
})

describe("drapeau invalide : comportement normal", () => {
  it.each([undefined, "", "false", "TRUE", "1", "true ", " true", "true\n"])("valeur %j", async (value) => {
    if (value !== undefined) vi.stubEnv("SITE_WAITING_MODE", value)
    const res = await run("/auth/login")
    expect(res.status).toBe(200)
    expect(res.headers.get("retry-after")).toBeNull()
    expect(createServerClient).toHaveBeenCalledTimes(1)
  })
})

describe("middleware hors mode attente", () => {
  it("/clients redirige toujours en 308", async () => {
    const res = await run("/clients?a=1")
    expect(res.status).toBe(308)
    expect(new URL(res.headers.get("location")).search).toBe("?a=1")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("/_next/image passe sans appel Supabase", async () => {
    const res = await run("/_next/image?url=%2Fa.png&w=64&q=75")
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("/sw.js suit le chemin normal (Supabase appelé, pas de kill switch)", async () => {
    const res = await run("/sw.js")
    expect(res.headers.get("content-type") ?? "").not.toContain("javascript")
    expect(createServerClient).toHaveBeenCalledTimes(1)
  })
})
