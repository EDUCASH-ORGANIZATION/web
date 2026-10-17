import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
const { listFiles, listOwnerFolders, listProofFiles, removePaths } = await import("./storage-walk")

const UID = "00000000-0000-4000-8000-0000000000aa"
const REQ1 = "10000000-0000-4000-8000-000000000001"
const REQ2 = "10000000-0000-4000-8000-000000000002"

const folder = (name) => ({ name, id: null, created_at: null })
const file = (name, createdAt = "2026-01-01T00:00:00Z") => ({ name, id: `id-${name}`, created_at: createdAt })

/**
 * Faux client Storage : `tree` associe un préfixe à ses entrées. `failures` peut faire échouer un appel list
 * (clé "prefix#page") ; `removeImpl` remplace remove.
 */
function fakeService({ tree = {}, failures = {}, removeImpl } = {}) {
  const calls = { list: [], remove: [] }
  const service = {
    storage: {
      from: (bucket) => ({
        list: async (prefix, options) => {
          calls.list.push({ bucket, prefix, options })
          const page = options.offset / options.limit
          const failure = failures[`${prefix}#${page}`]
          if (failure) return { data: null, error: failure }
          const all = tree[prefix] ?? []
          return { data: all.slice(options.offset, options.offset + options.limit), error: null }
        },
        remove: async (paths) => {
          calls.remove.push({ bucket, paths })
          if (removeImpl) return removeImpl(paths)
          return { data: paths.map((name) => ({ name })), error: null }
        },
      }),
    },
  }
  return { service, calls }
}

let errorSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
})

describe("listFiles", () => {
  it("distingue dossiers et fichiers et renvoie des chemins complets", async () => {
    const { service } = fakeService({ tree: { [UID]: [folder(REQ1), file("a.jpg", "2026-02-02T00:00:00Z"), file("b.jpg", null)] } })
    const out = await listFiles(service, "avatars", UID)
    expect(out.folders).toEqual([REQ1])
    expect(out.files).toEqual([
      { name: `${UID}/a.jpg`, createdAt: "2026-02-02T00:00:00Z" },
      { name: `${UID}/b.jpg`, createdAt: null },
    ])
  })

  it("liste la racine avec un préfixe vide, sans barre oblique", async () => {
    const { service, calls } = fakeService({ tree: { "": [folder(UID), file("x.txt")] } })
    const out = await listFiles(service, "avatars", "")
    expect(calls.list[0].prefix).toBe("")
    expect(out.files[0].name).toBe("x.txt")
  })

  it("pagine au-delà de 1000 entrées", async () => {
    const entries = Array.from({ length: 2503 }, (_, i) => file(`f${String(i).padStart(5, "0")}.jpg`))
    const { service, calls } = fakeService({ tree: { [UID]: entries } })
    const out = await listFiles(service, "message-media", UID)
    expect(out.files).toHaveLength(2503)
    expect(calls.list.map((c) => c.options.offset)).toEqual([0, 1000, 2000])
    expect(calls.list.every((c) => c.options.limit === 1000)).toBe(true)
  })

  it("fait un appel de plus quand la dernière page est pleine", async () => {
    const entries = Array.from({ length: 1000 }, (_, i) => file(`f${i}.jpg`))
    const { service, calls } = fakeService({ tree: { [UID]: entries } })
    const out = await listFiles(service, "avatars", UID)
    expect(out.files).toHaveLength(1000)
    expect(calls.list).toHaveLength(2)
  })

  it("renvoie error sans liste partielle si une page échoue", async () => {
    const entries = Array.from({ length: 1500 }, (_, i) => file(`f${i}.jpg`))
    const { service } = fakeService({ tree: { [UID]: entries }, failures: { [`${UID}#1`]: { statusCode: "500", message: `secret ${UID}` } } })
    const out = await listFiles(service, "avatars", UID)
    expect(out).toEqual({ error: true })
  })

  it("renvoie error si le client lève une exception", async () => {
    const service = { storage: { from: () => ({ list: async () => { throw new Error(`boom ${UID}`) } }) } }
    expect(await listFiles(service, "avatars", UID)).toEqual({ error: true })
  })

  it("renvoie error si la réponse n'est pas une liste", async () => {
    const service = { storage: { from: () => ({ list: async () => ({ data: null, error: null }) }) } }
    expect(await listFiles(service, "avatars", UID)).toEqual({ error: true })
  })

  it("s'arrête à l'échéance", async () => {
    const { service, calls } = fakeService({ tree: { [UID]: [file("a.jpg")] } })
    const out = await listFiles(service, "avatars", UID, { deadline: Date.now() - 1 })
    expect(out).toEqual({ error: true, timedOut: true })
    expect(calls.list).toHaveLength(0)
  })

  it("ne journalise que le code, jamais le chemin ni le message", async () => {
    const { service } = fakeService({ failures: { [`${UID}#0`]: { statusCode: "404", message: `not found ${UID}/secret.jpg` } } })
    await listFiles(service, "avatars", UID)
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain("404")
    expect(logged).not.toContain(UID)
    expect(logged).not.toContain("secret")
  })

  it("remplace un code suspect par unknown", async () => {
    const { service } = fakeService({ failures: { [`${UID}#0`]: { code: `bad ${UID}` } } })
    await listFiles(service, "avatars", UID)
    expect(errorSpy.mock.calls[0]).toEqual(["[purge] storage", "list", "unknown"])
  })
})

describe("listOwnerFolders", () => {
  it("renvoie les dossiers de la racine", async () => {
    const { service } = fakeService({ tree: { "": [folder(UID), folder("autre"), file("racine.txt")] } })
    expect(await listOwnerFolders(service, "avatars")).toEqual({ folders: [UID, "autre"] })
  })

  it("propage l'erreur", async () => {
    const { service } = fakeService({ failures: { "#0": { statusCode: "500" } } })
    expect(await listOwnerFolders(service, "avatars")).toEqual({ error: true })
  })
})

describe("listProofFiles", () => {
  it("parcourt deux niveaux et associe chaque fichier à sa demande", async () => {
    const { service, calls } = fakeService({
      tree: {
        [UID]: [folder(REQ1), folder(REQ2), file("vrac.jpg")],
        [`${UID}/${REQ1}`]: [file("payee-a.jpg"), file("ticket-b.jpg")],
        [`${UID}/${REQ2}`]: [file("sms-c.png")],
      },
    })
    const out = await listProofFiles(service, UID)
    expect(calls.list.every((c) => c.bucket === "purchase-proofs")).toBe(true)
    expect(out.files).toEqual([
      { name: `${UID}/vrac.jpg`, createdAt: "2026-01-01T00:00:00Z", requestId: null },
      { name: `${UID}/${REQ1}/payee-a.jpg`, createdAt: "2026-01-01T00:00:00Z", requestId: REQ1 },
      { name: `${UID}/${REQ1}/ticket-b.jpg`, createdAt: "2026-01-01T00:00:00Z", requestId: REQ1 },
      { name: `${UID}/${REQ2}/sms-c.png`, createdAt: "2026-01-01T00:00:00Z", requestId: REQ2 },
    ])
  })

  it("renvoie error pour tout le déposant si un sous-dossier échoue", async () => {
    const { service } = fakeService({
      tree: { [UID]: [folder(REQ1), folder(REQ2)], [`${UID}/${REQ1}`]: [file("payee-a.jpg")] },
      failures: { [`${UID}/${REQ2}#0`]: { statusCode: "500" } },
    })
    expect(await listProofFiles(service, UID)).toEqual({ error: true })
  })

  it("renvoie error si le dossier du déposant échoue", async () => {
    const { service } = fakeService({ failures: { [`${UID}#0`]: { statusCode: "500" } } })
    expect(await listProofFiles(service, UID)).toEqual({ error: true })
  })

  it("pagine aussi les sous-dossiers", async () => {
    const entries = Array.from({ length: 1200 }, (_, i) => file(`payee-${i}.jpg`))
    const { service } = fakeService({ tree: { [UID]: [folder(REQ1)], [`${UID}/${REQ1}`]: entries } })
    const out = await listProofFiles(service, UID)
    expect(out.files).toHaveLength(1200)
  })

  it("s'arrête à l'échéance entre deux sous-dossiers", async () => {
    const { service } = fakeService({ tree: { [UID]: [folder(REQ1)], [`${UID}/${REQ1}`]: [file("a.jpg")] } })
    const out = await listProofFiles(service, UID, { deadline: Date.now() - 1 })
    expect(out).toEqual({ error: true, timedOut: true })
  })
})

describe("removePaths", () => {
  const paths = (n) => Array.from({ length: n }, (_, i) => `${UID}/f${i}.jpg`)

  it("en simulation, n'appelle jamais remove et compte les candidats", async () => {
    const { service, calls } = fakeService()
    const out = await removePaths(service, "avatars", paths(250), { dryRun: true })
    expect(calls.remove).toHaveLength(0)
    expect(out).toEqual({ candidats: 250, supprimes: 0, erreurs: 0, ignores: 0, arretBudget: false })
  })

  it("découpe par paquets de 100 au plus", async () => {
    const { service, calls } = fakeService()
    const out = await removePaths(service, "avatars", paths(250))
    expect(calls.remove.map((c) => c.paths.length)).toEqual([100, 100, 50])
    expect(calls.remove.every((c) => c.bucket === "avatars")).toBe(true)
    expect(out).toMatchObject({ candidats: 250, supprimes: 250, erreurs: 0 })
  })

  it("un seul paquet pour exactement 100 chemins, aucun appel pour une liste vide", async () => {
    const a = fakeService()
    await removePaths(a.service, "avatars", paths(100))
    expect(a.calls.remove).toHaveLength(1)
    const b = fakeService()
    const out = await removePaths(b.service, "avatars", [])
    expect(b.calls.remove).toHaveLength(0)
    expect(out.candidats).toBe(0)
  })

  it("continue après un paquet en erreur et compte les erreurs", async () => {
    let n = 0
    const { service, calls } = fakeService({
      removeImpl: (batch) => {
        n += 1
        if (n === 2) return { data: null, error: { statusCode: "500", message: `secret ${UID}` } }
        return { data: batch.map((name) => ({ name })), error: null }
      },
    })
    const out = await removePaths(service, "avatars", paths(250))
    expect(calls.remove).toHaveLength(3)
    expect(out).toMatchObject({ candidats: 250, supprimes: 150, erreurs: 100 })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(UID)
  })

  it("compte une exception comme une erreur sans la lever", async () => {
    const { service } = fakeService({ removeImpl: () => { throw new Error(`boom ${UID}`) } })
    const out = await removePaths(service, "avatars", paths(3))
    expect(out).toMatchObject({ supprimes: 0, erreurs: 3 })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(UID)
  })

  it("ne compte comme supprimés que les objets renvoyés (fichier déjà absent)", async () => {
    const { service } = fakeService({ removeImpl: (batch) => ({ data: batch.slice(0, 1).map((name) => ({ name })), error: null }) })
    const out = await removePaths(service, "avatars", paths(3))
    expect(out).toMatchObject({ candidats: 3, supprimes: 1, erreurs: 0 })
  })

  it("s'arrête entre deux paquets quand le budget est atteint", async () => {
    const deadline = Date.now() + 60000
    const spy = vi.spyOn(Date, "now")
    spy.mockReturnValueOnce(deadline - 1).mockReturnValue(deadline + 1)
    const { service, calls } = fakeService()
    const out = await removePaths(service, "avatars", paths(250), { deadline })
    spy.mockRestore()
    expect(calls.remove).toHaveLength(1)
    expect(out).toMatchObject({ candidats: 250, supprimes: 100, arretBudget: true })
  })

  it("dédoublonne et ignore les chemins invalides", async () => {
    const { service, calls } = fakeService()
    const out = await removePaths(service, "avatars", ["a/b.jpg", "a/b.jpg", "", null, 5])
    expect(calls.remove[0].paths).toEqual(["a/b.jpg"])
    expect(out).toMatchObject({ candidats: 1, supprimes: 1, ignores: 4 })
  })
})
