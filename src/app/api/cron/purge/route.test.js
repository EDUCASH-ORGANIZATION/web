import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/actions/purge-rows", () => ({ purgeContactEvents: vi.fn(), purgeClosedReports: vi.fn() }))
vi.mock("@/lib/actions/account-closure-pseudonymize", () => ({ pseudonymizeClosedAccounts: vi.fn() }))
vi.mock("@/lib/actions/purge-files", () => ({
  purgeProofFiles: vi.fn(),
  purgeMessageMedia: vi.fn(),
  purgeAvatars: vi.fn(),
  purgeStudentCards: vi.fn(),
}))

import { createServiceClient } from "@/lib/supabase/service"
import { purgeContactEvents, purgeClosedReports } from "@/lib/actions/purge-rows"
import { pseudonymizeClosedAccounts } from "@/lib/actions/account-closure-pseudonymize"
import { purgeProofFiles, purgeMessageMedia, purgeAvatars, purgeStudentCards } from "@/lib/actions/purge-files"
import * as routeModule from "./route"

const { GET } = routeModule
const SECRET = "s3cret-value"
const fileFns = [purgeProofFiles, purgeMessageMedia, purgeAvatars, purgeStudentCards]

function req(auth, query = "") {
  return new Request(`http://localhost/api/cron/purge${query}`, { headers: auth ? { authorization: auth } : {} })
}

describe("GET /api/cron/purge", () => {
  const saved = {}
  const keys = ["CRON_SECRET", "PURGE_ENABLED", "PURGE_ALLOW_MASS"]
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of keys) saved[k] = process.env[k]
    process.env.CRON_SECRET = SECRET
    delete process.env.PURGE_ENABLED
    delete process.env.PURGE_ALLOW_MASS
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue({ fake: true })
    purgeContactEvents.mockResolvedValue(undefined)
    purgeClosedReports.mockResolvedValue(undefined)
    for (const fn of fileFns) fn.mockResolvedValue({ categories: {}, stops: [] })
    pseudonymizeClosedAccounts.mockResolvedValue({ categories: {}, stops: [] })
  })
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("exporte seulement GET (les autres methodes donnent 405 via Next)", () => {
    const methods = ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    for (const m of methods) expect(routeModule[m]).toBeUndefined()
    expect(routeModule.dynamic).toBe("force-dynamic")
    expect(routeModule.maxDuration).toBe(60)
  })

  it("503 sans CRON_SECRET et ne cree pas le client service", async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req("Bearer undefined"))
    expect(res.status).toBe(503)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("503 si CRON_SECRET est vide", async () => {
    process.env.CRON_SECRET = ""
    const res = await GET(req("Bearer "))
    expect(res.status).toBe(503)
    expect(purgeContactEvents).not.toHaveBeenCalled()
  })

  it.each([
    ["absent", null],
    ["vide", ""],
    ["faux", "Bearer wrong"],
    ["sans Bearer", SECRET],
    ["casse differente", `bearer ${SECRET}`],
    ["secret + suffixe", `Bearer ${SECRET}x`],
    ["secret tronque", `Bearer ${SECRET.slice(0, -1)}`],
  ])("401 avec un en-tete %s, sans rien purger", async (_n, header) => {
    const res = await GET(req(header))
    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(purgeContactEvents).not.toHaveBeenCalled()
    for (const fn of fileFns) expect(fn).not.toHaveBeenCalled()
  })

  it("200 avec le bon secret, mode dry par defaut, no-store", async () => {
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.mode).toBe("dry")
    expect(purgeContactEvents.mock.calls[0][1].mode).toBe("dry")
    for (const fn of fileFns) expect(fn.mock.calls[0][1].mode).toBe("dry")
  })

  it.each(["TRUE", "1", "yes", " true", "true "])("PURGE_ENABLED=%j reste en dry", async (v) => {
    process.env.PURGE_ENABLED = v
    const body = await (await GET(req(`Bearer ${SECRET}`))).json()
    expect(body.mode).toBe("dry")
  })

  it("PURGE_ENABLED=true donne le mode real", async () => {
    process.env.PURGE_ENABLED = "true"
    const body = await (await GET(req(`Bearer ${SECRET}`))).json()
    expect(body.mode).toBe("real")
    expect(purgeClosedReports.mock.calls[0][1].mode).toBe("real")
  })

  it("?mode=dry force la simulation meme avec PURGE_ENABLED=true", async () => {
    process.env.PURGE_ENABLED = "true"
    const body = await (await GET(req(`Bearer ${SECRET}`, "?mode=dry"))).json()
    expect(body.mode).toBe("dry")
    for (const fn of fileFns) expect(fn.mock.calls[0][1].mode).toBe("dry")
  })

  it("?mode=real sans PURGE_ENABLED ne supprime pas", async () => {
    const body = await (await GET(req(`Bearer ${SECRET}`, "?mode=real"))).json()
    expect(body.mode).toBe("dry")
  })

  it("PURGE_ALLOW_MASS exact transmis aux purges de fichiers", async () => {
    process.env.PURGE_ALLOW_MASS = "true"
    await GET(req(`Bearer ${SECRET}`))
    for (const fn of fileFns) expect(fn.mock.calls[0][1].allowMass).toBe(true)
    vi.clearAllMocks()
    process.env.PURGE_ALLOW_MASS = "1"
    createServiceClient.mockReturnValue({})
    for (const fn of fileFns) fn.mockResolvedValue({ categories: {}, stops: [] })
    await GET(req(`Bearer ${SECRET}`))
    for (const fn of fileFns) expect(fn.mock.calls[0][1].allowMass).toBe(false)
  })

  it("une categorie qui leve n'arrete pas les suivantes et compte une erreur", async () => {
    purgeContactEvents.mockRejectedValue(new Error("boom /secret/path 123e4567-e89b-12d3-a456-426614174000"))
    purgeProofFiles.mockRejectedValue(new Error("boom"))
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(purgeClosedReports).toHaveBeenCalled()
    expect(purgeMessageMedia).toHaveBeenCalled()
    expect(purgeAvatars).toHaveBeenCalled()
    expect(purgeStudentCards).toHaveBeenCalled()
    expect(body.categories.contact_events.erreurs).toBe(1)
    expect(body.categories.proof_orphans.erreurs).toBe(1)
    expect(JSON.stringify(body)).not.toMatch(/boom|secret\/path|123e4567/)
  })

  it("closed_accounts : mode dry transmis sans PURGE_ENABLED, entre closed_reports et proof_orphans", async () => {
    await GET(req(`Bearer ${SECRET}`))
    const opts = pseudonymizeClosedAccounts.mock.calls[0][1]
    expect(opts.mode).toBe("dry")
    expect(opts.allowMass).toBe(false)
    const order = (fn) => fn.mock.invocationCallOrder[0]
    expect(order(purgeClosedReports)).toBeLessThan(order(pseudonymizeClosedAccounts))
    expect(order(pseudonymizeClosedAccounts)).toBeLessThan(order(purgeProofFiles))
  })

  it("closed_accounts : mode real avec PURGE_ENABLED=true et allowMass transmis", async () => {
    process.env.PURGE_ENABLED = "true"
    process.env.PURGE_ALLOW_MASS = "true"
    await GET(req(`Bearer ${SECRET}`))
    const opts = pseudonymizeClosedAccounts.mock.calls[0][1]
    expect(opts.mode).toBe("real")
    expect(opts.allowMass).toBe(true)
  })

  it("closed_accounts : une exception n'arrete pas les categories suivantes", async () => {
    pseudonymizeClosedAccounts.mockRejectedValue(new Error("boom 123e4567-e89b-12d3-a456-426614174000"))
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.categories.closed_accounts.erreurs).toBe(1)
    expect(body.arrets).toContainEqual({ categorie: "closed_accounts", motif: "error" })
    for (const fn of fileFns) expect(fn).toHaveBeenCalled()
    expect(JSON.stringify(body)).not.toMatch(/boom|123e4567/)
  })

  it("closed_accounts : fusionne ses compteurs", async () => {
    pseudonymizeClosedAccounts.mockResolvedValue({ categories: { closed_accounts: { examines: 2, candidats: 1 } }, stops: ["breaker"] })
    const body = await (await GET(req(`Bearer ${SECRET}`))).json()
    expect(body.categories.closed_accounts.examines).toBe(2)
    expect(body.arrets).toContainEqual({ categorie: "closed_accounts", motif: "breaker" })
  })

  it("fusionne les compteurs de fichiers et le journal ne contient que des compteurs", async () => {
    purgeAvatars.mockResolvedValue({ categories: { avatars: { examines: 3, candidats: 1 } }, stops: [] })
    const res = await GET(req(`Bearer ${SECRET}`))
    const body = await res.json()
    expect(body.categories.avatars.examines).toBe(3)
    expect(body.categories.avatars.candidats).toBe(1)
    const line = console.log.mock.calls.find((c) => c[0] === "[purge]")
    expect(line).toBeTruthy()
    expect(console.log.mock.calls.filter((c) => c[0] === "[purge]")).toHaveLength(1)
    expect(line[1]).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)
    expect(line[1]).not.toContain(SECRET)
    expect(line[1]).not.toContain("/")
  })

  it("500 generique si le client service ne peut pas etre cree", async () => {
    createServiceClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing")
    })
    const res = await GET(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/SERVICE_ROLE/)
  })
})
