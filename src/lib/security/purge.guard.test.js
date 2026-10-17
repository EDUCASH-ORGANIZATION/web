import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const createServiceClient = vi.fn()
const calls = []
const fakes = {}

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/actions/purge-rows", () => ({
  purgeContactEvents: (...a) => fakes.contact(...a),
  purgeClosedReports: (...a) => fakes.reports(...a),
}))
vi.mock("@/lib/actions/purge-files", () => ({
  purgeProofFiles: (...a) => fakes.proofs(...a),
  purgeMessageMedia: (...a) => fakes.media(...a),
  purgeAvatars: (...a) => fakes.avatars(...a),
  purgeStudentCards: (...a) => fakes.cards(...a),
}))

import * as route from "@/app/api/cron/purge/route"

const ROOT = process.cwd()
const routeSource = readFileSync(join(ROOT, "src/app/api/cron/purge/route.js"), "utf8")
const SECRET = "s3cret-value"
const URL_BASE = "http://localhost/api/cron/purge"

function call(path = "", headers = { authorization: `Bearer ${SECRET}` }) {
  return route.GET(new Request(URL_BASE + path, { headers }))
}

describe("garde statique de la route de purge", () => {
  it("exporte seulement GET comme gestionnaire HTTP", () => {
    const handlers = Object.keys(route).filter((k) => /^[A-Z]+$/.test(k))
    expect(handlers).toEqual(["GET"])
  })

  it("configure maxDuration, runtime nodejs et dynamic force-dynamic", () => {
    expect(route.maxDuration).toBe(60)
    expect(route.runtime).toBe("nodejs")
    expect(route.dynamic).toBe("force-dynamic")
  })

  it("compare le secret avec timingSafeEqual", () => {
    expect(routeSource).toContain("timingSafeEqual")
  })

  it("crée le client service role après le contrôle du secret", () => {
    const body = routeSource.slice(routeSource.indexOf("export async function GET"))
    expect(body.indexOf("createServiceClient()")).toBeGreaterThan(body.indexOf("sameSecret("))
    expect(body.indexOf("createServiceClient()")).toBeGreaterThan(body.indexOf("503"))
  })

  it("déclare le cron quotidien dans vercel.json", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"))
    expect(config.crons).toContainEqual({ path: "/api/cron/purge", schedule: "0 3 * * *" })
  })
})

describe("GET /api/cron/purge", () => {
  const saved = { ...process.env }
  const emptyFiles = (name) => ({ categories: { [name]: { examines: 4, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 } }, stops: [] })

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    delete process.env.PURGE_ENABLED
    delete process.env.PURGE_ALLOW_MASS
    createServiceClient.mockReset()
    createServiceClient.mockReturnValue({ marker: "service" })
    calls.length = 0
    const rows = (name) => vi.fn(async (_s, o) => { calls.push({ name, mode: o.mode }); return o.summary })
    const files = (name, cat) => vi.fn(async (_s, o) => { calls.push({ name, mode: o.mode }); return emptyFiles(cat) })
    fakes.contact = rows("contact")
    fakes.reports = rows("reports")
    fakes.proofs = files("proofs", "proof_orphans")
    fakes.media = files("media", "message_media")
    fakes.avatars = files("avatars", "avatars")
    fakes.cards = files("cards", "student_cards")
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    process.env = { ...saved }
    vi.restoreAllMocks()
  })

  it("répond 503 sans CRON_SECRET, sans créer de client", async () => {
    delete process.env.CRON_SECRET
    const res = await call()
    expect(res.status).toBe(503)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([
    ["absent", {}],
    ["faux", { authorization: "Bearer wrong" }],
    ["de longueur différente", { authorization: `Bearer ${SECRET}x` }],
    ["sans préfixe Bearer", { authorization: SECRET }],
  ])("répond 401 si l'en-tête est %s, sans client ni purge", async (_l, headers) => {
    const res = await call("", headers)
    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it("est en simulation par défaut", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect((await res.json()).mode).toBe("dry")
    expect(calls.every((c) => c.mode === "dry")).toBe(true)
    expect(calls).toHaveLength(6)
  })

  it("passe en réel seulement avec PURGE_ENABLED=true", async () => {
    process.env.PURGE_ENABLED = "yes"
    expect((await (await call()).json()).mode).toBe("dry")
    process.env.PURGE_ENABLED = "true"
    const body = await (await call()).json()
    expect(body.mode).toBe("real")
    expect(body.categories.avatars.supprimes).toBe(1)
  })

  it("?mode=dry force la simulation même avec PURGE_ENABLED=true", async () => {
    process.env.PURGE_ENABLED = "true"
    const body = await (await call("?mode=dry")).json()
    expect(body.mode).toBe("dry")
    expect(calls.every((c) => c.mode === "dry")).toBe(true)
  })

  it("enchaîne les catégories dans l'ordre", async () => {
    await call()
    expect(calls.map((c) => c.name)).toEqual(["contact", "reports", "proofs", "media", "avatars", "cards"])
  })

  it("isole une catégorie en échec et la compte en erreur", async () => {
    fakes.media = vi.fn(async () => {
      throw new Error("boom 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b /secret/path.jpg")
    })
    const res = await call()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.categories.message_media.erreurs).toBe(1)
    expect(body.arrets).toContainEqual({ categorie: "message_media", motif: "error" })
    expect(fakes.avatars).toHaveBeenCalled()
    expect(fakes.cards).toHaveBeenCalled()
    expect(JSON.stringify(body)).not.toContain("boom")
  })

  it("ne journalise ni identifiant ni chemin", async () => {
    fakes.cards = vi.fn(async () => {
      throw new Error("3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b/photo.jpg")
    })
    await call()
    const logged = [...console.log.mock.calls, ...console.error.mock.calls].flat().join(" ")
    expect(logged).toContain("[purge]")
    expect(logged).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
    expect(logged).not.toContain("photo.jpg")
    expect(logged).not.toContain(SECRET)
  })

  it("refuse de répondre si le résumé contient un identifiant", async () => {
    fakes.proofs = vi.fn(async () => ({
      categories: { proof_orphans: { examines: 1, candidats: 0, supprimes: 0, erreurs: 0, ignores: 0 } },
      stops: [],
    }))
    fakes.reports = vi.fn(async (_s, o) => {
      o.summary.arrets.push({ categorie: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b", motif: "error" })
      return o.summary
    })
    const res = await call()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("3f2b8c1e")
  })

  it("répond 500 générique si le client ne peut pas être créé", async () => {
    createServiceClient.mockImplementation(() => {
      throw new Error("missing key abc")
    })
    const res = await call()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("abc")
  })
})

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return listJs(full)
    return /\.(js|jsx)$/.test(name) ? [full] : []
  })
}

const isProd = (f) => !/\.test\.jsx?$/.test(f) && !/test-support/.test(f)
const purgeModules = [
  ...readdirSync(join(ROOT, "src/lib/purge")).map((n) => join(ROOT, "src/lib/purge", n)),
  ...readdirSync(join(ROOT, "src/lib/actions"))
    .filter((n) => /^purge-.*\.js$/.test(n))
    .map((n) => join(ROOT, "src/lib/actions", n)),
].filter(isProd)
const rel = (f) => f.slice(ROOT.length + 1)

describe("garde statique des modules de purge", () => {
  it("trouve les modules attendus", () => {
    expect(purgeModules.map(rel).sort()).toEqual([
      "src/lib/actions/purge-files.js",
      "src/lib/actions/purge-rows.js",
      "src/lib/purge/purge-rules.js",
      "src/lib/purge/storage-walk.js",
    ])
  })

  it.each(purgeModules.map((f) => [rel(f), readFileSync(f, "utf8")]))("%s : aucun use server", (_n, src) => {
    // Directive seule sur sa ligne : une mention dans un commentaire n'est pas une directive.
    expect(src).not.toMatch(/(^|[{;]\s*)["']use server["']/m)
  })

  it.each(purgeModules.filter((f) => !f.endsWith("purge-rules.js")).map((f) => [rel(f), readFileSync(f, "utf8")]))(
    "%s : importe server-only",
    (_n, src) => {
      expect(src).toMatch(/import\s+["']server-only["']/)
    },
  )

  it.each(purgeModules.map((f) => [rel(f), readFileSync(f, "utf8")]))("%s : ni deleteUser ni table protégée supprimée", (_n, src) => {
    expect(src).not.toContain("deleteUser")
    expect(src).not.toMatch(
      /\.from\(\s*["'](transactions|wallet_transactions|wallets|purchase_requests)["']\s*\)[\s\S]{0,400}?\.delete\(/,
    )
  })

  it(".delete( n'apparaît que dans purge-rows.js", () => {
    const withDelete = purgeModules.filter((f) => readFileSync(f, "utf8").includes(".delete(")).map(rel)
    expect(withDelete.every((f) => f === "src/lib/actions/purge-rows.js")).toBe(true)
  })

  it("purge-rows.js ne touche que message_contact_events et reports", () => {
    const src = readFileSync(join(ROOT, "src/lib/actions/purge-rows.js"), "utf8")
    const tables = [...src.matchAll(/\.from\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) expect(["message_contact_events", "reports"]).toContain(table)
  })

  it.each(purgeModules.map((f) => [rel(f), readFileSync(f, "utf8")]))("%s : aucun appel rpc", (_n, src) => {
    expect(src).not.toMatch(/\.rpc\(/)
  })

  it(".remove( n'apparaît que dans storage-walk.js", () => {
    const withRemove = purgeModules.filter((f) => readFileSync(f, "utf8").includes(".remove(")).map(rel)
    expect(withRemove).toEqual(["src/lib/purge/storage-walk.js"])
  })

  it("aucun module client n'importe un module de purge", () => {
    const clientFiles = ["src/components", "src/hooks"].flatMap((d) => listJs(join(ROOT, d)))
    const offenders = clientFiles.filter((f) => /@\/lib\/(purge\/|actions\/purge-)/.test(readFileSync(f, "utf8"))).map(rel)
    expect(offenders).toEqual([])
  })
})
