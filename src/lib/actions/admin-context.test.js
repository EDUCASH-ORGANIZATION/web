import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const state = { user: null, profile: null, serviceThrows: false }
const createServiceClient = vi.fn(() => {
  if (state.serviceThrows) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante")
  return { marker: "service" }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.profile }) }
      return chain
    },
  }),
}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

import {
  countPendingVerifications,
  inChunks,
  logAdminAction,
  requireAdminService,
  signStudentCard,
  sumColumnPaged,
} from "./admin-context"

const forged = { id: "u1", user_metadata: { role: "admin" } }
const adminProfile = { role: "admin", full_name: "Awa Admin", city: "Cotonou", is_suspended: false }

beforeEach(() => {
  createServiceClient.mockClear()
  state.user = forged
  state.profile = adminProfile
  state.serviceThrows = false
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("requireAdminService", () => {
  it("renvoie l'administrateur et le client service pour un profil admin", async () => {
    const ctx = await requireAdminService()
    expect(ctx.error).toBeUndefined()
    expect(ctx.admin).toEqual({ userId: "u1", fullName: "Awa Admin" })
    expect(ctx.service).toEqual({ marker: "service" })
    expect(createServiceClient).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["visiteur non connecté", () => { state.user = null }],
    ["profil student avec metadata admin", () => { state.profile = { ...adminProfile, role: "student" } }],
    ["profil client avec metadata admin", () => { state.profile = { ...adminProfile, role: "client" } }],
    ["administrateur suspendu", () => { state.profile = { ...adminProfile, is_suspended: true } }],
    ["profil introuvable", () => { state.profile = null }],
  ])("refuse sans ouvrir le client service : %s", async (_label, arrange) => {
    arrange()
    const ctx = await requireAdminService()
    expect(typeof ctx.error).toBe("string")
    expect(ctx.error).not.toBe("")
    expect(ctx.service).toBeUndefined()
    expect(ctx.admin).toBeUndefined()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("renvoie un message neutre vouvoyé quand la configuration serveur manque", async () => {
    state.serviceThrows = true
    const ctx = await requireAdminService()
    expect(ctx.error).toMatch(/Réessayez/)
    expect(ctx.error).not.toMatch(/SERVICE_ROLE/)
    expect(ctx.service).toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})

describe("logAdminAction", () => {
  it("écrit une seule ligne [admin-audit] en JSON", () => {
    logAdminAction({ adminId: "a1", action: "approve", targetId: "t1", before: { is_verified: false }, after: { is_verified: true }, reason: "Carte conforme" })
    expect(console.info).toHaveBeenCalledTimes(1)
    const [tag, json] = console.info.mock.calls[0]
    expect(tag).toBe("[admin-audit]")
    expect(JSON.parse(json)).toMatchObject({
      adminId: "a1",
      action: "approve",
      targetId: "t1",
      before: { is_verified: false },
      after: { is_verified: true },
      reason: "Carte conforme",
    })
  })

  it("ne journalise ni e-mail, ni téléphone, ni URL, ni carte", () => {
    logAdminAction({
      adminId: "a1",
      action: "reject",
      targetId: "t1",
      before: { email: "a@b.bj", phone: "+22901000000", card_url: "t1/a.jpg", note: "https://signed.example/x?token=abc", is_verified: false },
      after: { nested: { fcm_token: "zzz", ok: true } },
    })
    const line = console.info.mock.calls[0][1]
    expect(line).not.toMatch(/a@b\.bj|22901000000|a\.jpg|signed\.example|zzz|token/)
    expect(JSON.parse(line).before).toEqual({ note: "[url]", is_verified: false })
    expect(JSON.parse(line).after).toEqual({ nested: { ok: true } })
  })

  it("borne la longueur du motif", () => {
    logAdminAction({ adminId: "a1", action: "x", reason: "m".repeat(5000) })
    expect(JSON.parse(console.info.mock.calls[0][1]).reason).toHaveLength(500)
  })
})

describe("inChunks", () => {
  it("découpe par paquets de 100 par défaut", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`)
    expect(inChunks(ids).map((c) => c.length)).toEqual([100, 100, 50])
  })

  it("liste vide, taille personnalisée et taille invalide", () => {
    expect(inChunks([])).toEqual([])
    expect(inChunks(undefined)).toEqual([])
    expect(inChunks([1, 2, 3], 2)).toEqual([[1, 2], [3]])
    expect(inChunks([1, 2, 3], 0)).toEqual([[1, 2, 3]])
  })
})

describe("signStudentCard", () => {
  const USER = "11111111-1111-4111-8111-111111111111"
  const OTHER = "22222222-2222-4222-8222-222222222222"

  function makeService(result = { data: { signedUrl: "https://signed/c" }, error: null }) {
    const createSignedUrl = vi.fn(async () => result)
    const from = vi.fn(() => ({ createSignedUrl }))
    return { service: { storage: { from } }, from, createSignedUrl }
  }

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co")
  })

  it("signe une image du dossier de l'étudiant avec un TTL de 300 s", async () => {
    const { service, from, createSignedUrl } = makeService()
    const res = await signStudentCard(service, USER, `${USER}/carte.jpg`)
    expect(res).toEqual({ kind: "image", url: "https://signed/c" })
    expect(from).toHaveBeenCalledWith("student-cards")
    expect(createSignedUrl).toHaveBeenCalledWith(`${USER}/carte.jpg`, 300)
  })

  it("reconnaît un PDF et accepte une URL du projet pour le bon bucket", async () => {
    const { service, createSignedUrl } = makeService()
    const url = `https://x.supabase.co/storage/v1/object/sign/student-cards/${USER}/carte.PDF?token=t`
    expect(await signStudentCard(service, USER, url)).toEqual({ kind: "pdf", url: "https://signed/c" })
    expect(createSignedUrl).toHaveBeenCalledWith(`${USER}/carte.PDF`, 300)
  })

  it("respecte un TTL explicite", async () => {
    const { service, createSignedUrl } = makeService()
    await signStudentCard(service, USER, `${USER}/a.jpg`, 60)
    expect(createSignedUrl).toHaveBeenCalledWith(`${USER}/a.jpg`, 60)
  })

  it.each([
    ["chemin d'un autre utilisateur", `${OTHER}/carte.jpg`],
    ["traversée de dossier", `${USER}/../${OTHER}/carte.jpg`],
    ["traversée encodée", `${USER}/%2e%2e/carte.jpg`],
    ["URL externe", "https://evil.example/carte.jpg"],
    ["bucket différent", `https://x.supabase.co/storage/v1/object/public/avatars/${USER}/carte.jpg`],
    ["valeur vide", ""],
    ["valeur absente", null],
    ["chemin sans dossier", "carte.jpg"],
  ])("renvoie none sans signer : %s", async (_label, raw) => {
    const { service, createSignedUrl } = makeService()
    expect(await signStudentCard(service, USER, raw)).toEqual({ kind: "none", url: null })
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("renvoie none, jamais le chemin brut, quand la signature échoue", async () => {
    const { service } = makeService({ data: null, error: { message: "not found" } })
    const res = await signStudentCard(service, USER, `${USER}/secret.jpg`)
    expect(res).toEqual({ kind: "none", url: null })
    expect(JSON.stringify(res)).not.toContain("secret")
  })
})

/** Service factice : lignes par table, requêtes chaînables et attendables, plages respectées. */
function makeRows(tables) {
  const calls = []
  return {
    calls,
    service: {
      from: (table) => {
        const q = { table, filters: [], range: null }
        const chain = {}
        const record = (name) => (...args) => {
          q.filters.push([name, ...args])
          return chain
        }
        for (const name of ["select", "not", "order", "eq", "neq", "gte", "lte", "is", "in", "gt", "lt"]) chain[name] = record(name)
        chain.range = (a, b) => {
          q.range = [a, b]
          return chain
        }
        chain.then = (resolve) => {
          calls.push(q)
          const result = tables[table](q)
          const data = result.data && q.range ? result.data.slice(q.range[0], q.range[1] + 1) : result.data
          return resolve({ data, error: result.error ?? null })
        }
        return chain
      },
    },
  }
}

describe("countPendingVerifications", () => {
  const TODAY = "2026-10-15"

  /** Service factice : profils lus par paquet, et dates de dépôt interrogées par filtre `gte` seulement. */
  function pendingService({ cardIds, profile, submitted = {} }) {
    return makeRows({
      student_profiles: () => ({ data: cardIds.map((user_id) => ({ user_id })) }),
      profiles: (q) => {
        const ids = q.filters.find((f) => f[0] === "in")[2]
        const gte = q.filters.find((f) => f[0] === "gte")
        if (gte) return { data: ids.filter((id) => submitted[id] && Date.parse(submitted[id]) >= Date.parse(gte[2])).map((user_id) => ({ user_id })) }
        return { data: ids.map((user_id) => ({ user_id, ...profile(user_id) })) }
      },
    })
  }

  it("compte les dossiers à examiner selon la règle de classifyDossier, sur plusieurs paquets", async () => {
    const cardIds = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const { service, calls } = pendingService({
      cardIds,
      // un dossier sur 5 est expiré et sa carte n'a pas été renvoyée : il n'est pas à examiner
      profile: (id) => ({ verified_until: Number(id.slice(1)) % 5 === 0 ? "2026-01-01" : null }),
    })
    expect(await countPendingVerifications(service, TODAY)).toBe(200)
    const profileCalls = calls.filter((c) => c.table === "profiles" && !c.filters.some((f) => f[0] === "gte"))
    expect(profileCalls).toHaveLength(3)
    for (const c of profileCalls) {
      expect(c.filters).toEqual(
        expect.arrayContaining([["eq", "role", "student"], ["eq", "is_verified", false], ["is", "rejection_reason", null]]),
      )
    }
  })

  it("compte un renouvellement anticipé et une carte déposée depuis la dernière validation, pas une carte antérieure", async () => {
    const { service } = pendingService({
      cardIds: ["a", "b", "c"],
      profile: (id) => ({ verified_until: { a: "2027-03-01", b: "2026-10-01", c: "2026-10-01" }[id] }),
      submitted: { b: "2026-10-10T08:00:00Z", c: "2025-09-01T08:00:00Z" },
    })
    expect(await countPendingVerifications(service, TODAY)).toBe(2)
  })

  it("la frontière du jour de l'échéance suit le fuseau du Bénin, comme classifyDossier", async () => {
    // Échéance au 14 octobre 2026 : dernière validation le 14 octobre 2025. 13 octobre 23:30 UTC = 14 octobre
    // 00:30 au Bénin : depuis la validation ; 22:30 UTC : encore le 13.
    const { service, calls } = pendingService({
      cardIds: ["a", "b"],
      profile: () => ({ verified_until: "2026-10-14" }),
      submitted: { a: "2025-10-13T23:30:00Z", b: "2025-10-13T22:30:00Z" },
    })
    expect(await countPendingVerifications(service, TODAY)).toBe(1)
    const gte = calls.flatMap((c) => c.filters).find((f) => f[0] === "gte")
    expect(gte).toEqual(["gte", "verification_submitted_at", "2025-10-14T00:00:00+01:00"])
  })

  it("ne lit jamais la date de dépôt dans un select", async () => {
    const { service, calls } = pendingService({ cardIds: ["a"], profile: () => ({ verified_until: "2026-01-01" }) })
    await countPendingVerifications(service, TODAY)
    const selects = calls.flatMap((c) => c.filters).filter((f) => f[0] === "select").map((f) => f[1])
    expect(selects.join(" ")).not.toMatch(/verification_submitted_at|rejection_reason|card_url/)
  })

  it("lit les cartes page par page au-delà de 1000 lignes", async () => {
    const all = Array.from({ length: 2300 }, (_, i) => `s${i}`)
    const { service, calls } = pendingService({ cardIds: all, profile: () => ({ verified_until: null }) })
    expect(await countPendingVerifications(service, TODAY)).toBe(2300)
    expect(calls.filter((c) => c.table === "student_profiles").map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it("lève une erreur neutre si une lecture échoue", async () => {
    const cards = makeRows({ student_profiles: () => ({ data: null, error: { message: "relation x does not exist" } }) })
    await expect(countPendingVerifications(cards.service, TODAY)).rejects.toThrow("Lecture des cartes impossible.")
    const profiles = makeRows({
      student_profiles: () => ({ data: [{ user_id: "a" }] }),
      profiles: () => ({ data: null, error: { message: "boom" } }),
    })
    await expect(countPendingVerifications(profiles.service, TODAY)).rejects.toThrow("Lecture des profils impossible.")
    const resent = makeRows({
      student_profiles: () => ({ data: [{ user_id: "a" }] }),
      profiles: (q) =>
        q.filters.some((f) => f[0] === "gte")
          ? { data: null, error: { message: "boom" } }
          : { data: [{ user_id: "a", verified_until: "2026-01-01" }] },
    })
    await expect(countPendingVerifications(resent.service, TODAY)).rejects.toThrow("Lecture des profils impossible.")
  })

  it("renvoie 0 sans aucune carte", async () => {
    const { service } = makeRows({ student_profiles: () => ({ data: [] }) })
    expect(await countPendingVerifications(service, TODAY)).toBe(0)
  })
})

describe("sumColumnPaged", () => {
  it("additionne 2 500 lignes réparties sur 3 pages", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ reserved: i % 2 === 0 ? 100 : "50.5" }))
    const { service, calls } = makeRows({ wallets: () => ({ data: rows }) })
    expect(await sumColumnPaged(service, "wallets", "reserved", [], { orderBy: "user_id" })).toBe(1250 * 100 + 1250 * 50.5)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(calls[0].filters).toEqual(expect.arrayContaining([["select", "reserved"], ["order", "user_id", { ascending: true }]]))
  })

  it("applique les filtres demandés et s'arrête sur une page courte", async () => {
    const { service, calls } = makeRows({ wallet_transactions: () => ({ data: [{ amount: 12 }, { amount: 8 }] }) })
    const total = await sumColumnPaged(service, "wallet_transactions", "amount", [
      ["eq", "type", "commission"],
      ["gte", "created_at", "2026-10-01T00:00:00Z"],
    ])
    expect(total).toBe(20)
    expect(calls).toHaveLength(1)
    expect(calls[0].filters).toEqual(
      expect.arrayContaining([["eq", "type", "commission"], ["gte", "created_at", "2026-10-01T00:00:00Z"], ["order", "id", { ascending: true }]]),
    )
  })

  it("ignore les valeurs non numériques et renvoie 0 sans ligne", async () => {
    const odd = makeRows({ t: () => ({ data: [{ v: null }, { v: "abc" }, { v: 5 }] }) })
    expect(await sumColumnPaged(odd.service, "t", "v")).toBe(5)
    const empty = makeRows({ t: () => ({ data: [] }) })
    expect(await sumColumnPaged(empty.service, "t", "v")).toBe(0)
  })

  it("refuse un filtre hors liste et lève une erreur neutre si la lecture échoue", async () => {
    const { service } = makeRows({ t: () => ({ data: null, error: { message: "boom" } }) })
    await expect(sumColumnPaged(service, "t", "v", [["rpc", "x"]])).rejects.toThrow("Condition de somme non autorisée.")
    await expect(sumColumnPaged(service, "t", "v")).rejects.toThrow("Lecture des montants impossible.")
  })
})
