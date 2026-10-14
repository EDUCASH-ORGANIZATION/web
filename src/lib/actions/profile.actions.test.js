import { describe, it, expect, vi, beforeEach } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { requireUser, requireRole } from "@/lib/auth/require-role"
import { createClient } from "@/lib/supabase/server"
import { verificationFromRows } from "@/lib/student-space/verification-status"
import {
  getMyProfile,
  getMyStudentProfile,
  updateStudentProfile,
  saveStudentCardUrl,
  updateStudentProfileWithCard,
  updateClientProfile,
  getClientProfileSummary,
} from "./profile.actions"

// Faux client service role : consigne la table, les colonnes et les filtres de la lecture.
function makeService(response) {
  const state = { table: null, columns: null, filters: [] }
  const builder = {
    select: (c) => { state.columns = c; return builder },
    eq: (c, v) => { state.filters.push([c, v]); return builder },
    maybeSingle: () => Promise.resolve(response),
  }
  return { client: { from: (t) => { state.table = t; return builder } }, state }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getMyProfile", () => {
  it("refuse un appelant non connecté sans ouvrir le client service role", async () => {
    requireUser.mockResolvedValue({ error: "Non connecté" })
    expect(await getMyProfile()).toEqual({ error: "Non connecté" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("filtre sur l'identifiant de la session et demande des colonnes explicites", async () => {
    requireUser.mockResolvedValue({ user: { id: "u1" } })
    const { client, state } = makeService({ data: { user_id: "u1", phone: "+22901000000" }, error: null })
    createServiceClient.mockReturnValue(client)

    const res = await getMyProfile()

    expect(res).toEqual({ profile: { user_id: "u1", phone: "+22901000000" } })
    expect(state.table).toBe("profiles")
    expect(state.filters).toEqual([["user_id", "u1"]])
    for (const col of ["phone", "rejection_reason", "verification_submitted_at"]) {
      expect(state.columns).toContain(col)
    }
    expect(state.columns).not.toContain("*")
    expect(state.columns).not.toContain("fcm_token")
  })

  it("renvoie une erreur neutre si la lecture échoue", async () => {
    requireUser.mockResolvedValue({ user: { id: "u1" } })
    createServiceClient.mockReturnValue(makeService({ data: null, error: { message: "boom" } }).client)
    expect(await getMyProfile()).toEqual({ error: "Impossible de charger ton profil." })
  })
})

describe("getMyStudentProfile", () => {
  it("refuse un appelant non connecté", async () => {
    requireUser.mockResolvedValue({ error: "Non connecté" })
    expect(await getMyStudentProfile()).toEqual({ error: "Non connecté" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("filtre sur la session et inclut card_url", async () => {
    requireUser.mockResolvedValue({ user: { id: "u2" } })
    const { client, state } = makeService({ data: { user_id: "u2", card_url: "u2/carte.jpg" }, error: null })
    createServiceClient.mockReturnValue(client)

    const res = await getMyStudentProfile()

    expect(res).toEqual({ studentProfile: { user_id: "u2", card_url: "u2/carte.jpg" } })
    expect(state.table).toBe("student_profiles")
    expect(state.filters).toEqual([["user_id", "u2"]])
    expect(state.columns).toContain("card_url")
    expect(state.columns).not.toContain("*")
  })

  it("renvoie studentProfile null quand la ligne n'existe pas", async () => {
    requireUser.mockResolvedValue({ user: { id: "u2" } })
    createServiceClient.mockReturnValue(makeService({ data: null, error: null }).client)
    expect(await getMyStudentProfile()).toEqual({ studentProfile: null })
  })

  it("renvoie une erreur neutre si la lecture échoue", async () => {
    requireUser.mockResolvedValue({ user: { id: "u2" } })
    createServiceClient.mockReturnValue(makeService({ data: null, error: { message: "boom" } }).client)
    expect(await getMyStudentProfile()).toEqual({ error: "Impossible de charger ton profil." })
  })
})

// ─── Écritures : aucun message interne renvoyé au navigateur ─────────────────

const LEAK = 'duplicate key value violates constraint "profiles_pkey"'
const SUPABASE_URL = "https://proj.supabase.co"

function session({ failOn, captured } = {}) {
  const result = (table) => ({ error: table === failOn ? { message: LEAK } : null })
  const chain = (table) => ({
    update: (payload) => {
      if (captured) captured[table] = payload
      return { eq: () => Promise.resolve(result(table)) }
    },
    upsert: (payload) => {
      if (captured) captured[table] = payload
      return Promise.resolve(result(table))
    },
  })
  return { from: chain }
}

function asRole(supabase) {
  requireRole.mockResolvedValue({ supabase, user: { id: "u1" }, role: "student" })
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
})

describe("écritures de profil", () => {
  const input = { fullName: "Awa", city: "Cotonou" }
  const cases = [
    ["updateStudentProfile (profil)", () => updateStudentProfile(input), "profiles"],
    ["updateStudentProfile (étudiant)", () => updateStudentProfile(input), "student_profiles"],
    ["saveStudentCardUrl (carte)", () => saveStudentCardUrl("u1/c.jpg"), "student_profiles"],
    ["saveStudentCardUrl (remise en attente)", () => saveStudentCardUrl("u1/c.jpg"), "profiles"],
    ["updateStudentProfileWithCard (profil)", () => updateStudentProfileWithCard(input), "profiles"],
    ["updateStudentProfileWithCard (étudiant)", () => updateStudentProfileWithCard(input), "student_profiles"],
    ["updateClientProfile", () => updateClientProfile(input), "profiles"],
  ]

  it.each(cases)("%s renvoie un message neutre et journalise le détail", async (_n, call, failOn) => {
    asRole(session({ failOn }))
    const res = await call()
    expect(res.error).toBeTruthy()
    expect(res.error).not.toContain(LEAK)
    expect(console.error).toHaveBeenCalledWith(expect.any(String), LEAK)
  })

  it("exige le rôle étudiant ou client selon l'action, sans écrire en cas de refus", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    const write = vi.fn()
    createClient.mockResolvedValue({ from: write })
    for (const call of [
      () => updateStudentProfile({ fullName: "A", city: "C" }),
      () => saveStudentCardUrl("u1/c.jpg"),
      () => updateStudentProfileWithCard({ fullName: "A", city: "C" }),
      () => updateClientProfile({ fullName: "A", city: "C" }),
    ]) {
      expect(await call()).toEqual({ error: "refus" })
    }
    expect(requireRole.mock.calls.map((c) => c[0][0])).toEqual(["student", "student", "student", "client"])
    expect(write).not.toHaveBeenCalled()
  })
})

describe("carte étudiante : chemin du bucket student-cards", () => {
  const publicUrl = (p) => `${SUPABASE_URL}/storage/v1/object/public/student-cards/${p}`
  const abusive = [
    ["chemin d'un autre utilisateur", "u2/card.jpg"],
    ["URL d'un autre utilisateur", publicUrl("u2/card.jpg")],
    ["traversée de dossier", "u1/../u2/card.jpg"],
    ["traversée encodée dans une URL", publicUrl("u1/%2e%2e/u2/card.jpg")],
    ["URL externe", "https://evil.example/storage/v1/object/public/student-cards/u1/card.jpg"],
    ["schéma parasite", "javascript:alert(1)"],
    ["URL d'un autre bucket", `${SUPABASE_URL}/storage/v1/object/public/avatars/u1/card.jpg`],
    ["chemin vide", ""],
    ["blancs seuls", "   "],
    ["dossier seul", "u1/"],
    ["non-chaîne", { path: "u1/card.jpg" }],
    ["chemin absolu", "/u1/card.jpg"],
    ["antislash", "u1\\..\\card.jpg"],
    ["traversée encodée en chemin brut", "u1/%2e%2e/u2/card.jpg"],
    ["traversée encodée majuscule", "u1/%2E%2E/u2/x"],
    ["double encodage dans une URL", publicUrl("u1/%252e%252e/c.jpg")],
    ["segment point", "u1/./x"],
    ["segment vide", "u1//x"],
  ]

  it.each(abusive)("saveStudentCardUrl refuse : %s", async (_l, value) => {
    const captured = {}
    asRole(session({ captured }))
    const res = await saveStudentCardUrl(value)
    expect(res).toEqual({ error: "Cette carte n'est pas valide. Envoie-la à nouveau." })
    expect(captured).toEqual({})
  })

  it.each(abusive.filter(([, v]) => v !== "" ))("updateStudentProfileWithCard refuse : %s", async (_l, value) => {
    const captured = {}
    asRole(session({ captured }))
    const res = await updateStudentProfileWithCard({ fullName: "Awa", city: "Cotonou", cardUrl: value })
    expect(res.error).toBe("Cette carte n'est pas valide. Envoie-la à nouveau.")
    expect(captured).toEqual({})
  })

  it.each([
    ["chemin", "u1/card.jpg", "u1/card.jpg"],
    ["URL publique", publicUrl("u1/card.png"), "u1/card.png"],
    ["URL signée", `${SUPABASE_URL}/storage/v1/object/sign/student-cards/u1/card.pdf?token=t`, "u1/card.pdf"],
  ])("stocke le chemin pour : %s", async (_l, value, expected) => {
    const captured = {}
    asRole(session({ captured }))
    expect(await saveStudentCardUrl(value)).toEqual({ success: true })
    expect(captured.student_profiles).toEqual({ user_id: "u1", card_url: expected })

    const captured2 = {}
    asRole(session({ captured: captured2 }))
    const res = await updateStudentProfileWithCard({ fullName: "Awa", city: "Cotonou", cardUrl: value })
    expect(res).toEqual({ success: true })
    expect(captured2.student_profiles.card_url).toBe(expected)
    expect(captured2.profiles.is_verified).toBe(false)
  })

  it("saveStudentCardUrl remet le dossier en attente : liste blanche, jamais role, is_suspended ni verified_until", async () => {
    const captured = {}
    asRole(session({ captured }))
    expect(await saveStudentCardUrl("u1/card.jpg")).toEqual({ success: true })
    expect(Object.keys(captured.profiles).sort()).toEqual(["is_verified", "rejection_reason", "verification_submitted_at"])
    expect(captured.profiles).toMatchObject({ is_verified: false, rejection_reason: null })
    expect(Date.parse(captured.profiles.verification_submitted_at)).not.toBeNaN()
    for (const col of ["role", "is_suspended", "verified_until"]) {
      expect(captured.profiles).not.toHaveProperty(col)
      expect(captured.student_profiles).not.toHaveProperty(col)
    }
    expect(Object.keys(captured.student_profiles).sort()).toEqual(["card_url", "user_id"])
  })

  it("carte refusée puis renvoyée : le statut calculé repasse de rejected à pending", async () => {
    const rejected = { is_verified: false, rejection_reason: "floue" }
    expect(verificationFromRows(rejected, { card_url: "u1/old.jpg" }).key).toBe("rejected")
    const captured = {}
    asRole(session({ captured }))
    await saveStudentCardUrl("u1/new.jpg")
    const after = { ...rejected, ...captured.profiles }
    expect(verificationFromRows(after, captured.student_profiles).key).toBe("pending")
    // L'onglet admin « en attente » filtre sur !rejection_reason : la carte y réapparaît.
    expect(after.rejection_reason).toBeNull()
  })

  it("saveStudentCardUrl : un chemin refusé n'écrit rien, ni carte ni remise en attente", async () => {
    const captured = {}
    asRole(session({ captured }))
    await saveStudentCardUrl("u2/card.jpg")
    expect(captured).toEqual({})
  })

  it("updateStudentProfileWithCard sans carte ne touche pas à la vérification", async () => {
    const captured = {}
    asRole(session({ captured }))
    expect(await updateStudentProfileWithCard({ fullName: "Awa", city: "Cotonou", cardUrl: "" })).toEqual({ success: true })
    expect(captured.profiles).not.toHaveProperty("is_verified")
    expect(captured.student_profiles).not.toHaveProperty("card_url")
  })
})

describe("avatar : URL publique du bucket avatars sous le dossier de l'utilisateur", () => {
  const avatar = (p) => `${SUPABASE_URL}/storage/v1/object/public/avatars/${p}`
  const abusive = [
    ["dossier d'un autre utilisateur", avatar("u2/avatar.png")],
    ["URL externe", "https://evil.example/avatar.png"],
    ["URL de tracking externe avec chemin imité", "https://evil.example/storage/v1/object/public/avatars/u1/a.png"],
    ["autre bucket", `${SUPABASE_URL}/storage/v1/object/public/student-cards/u1/a.png`],
    ["traversée de dossier", avatar("u1/../u2/a.png")],
    ["schéma parasite", "javascript:alert(1)"],
    ["URL signée (non publique)", `${SUPABASE_URL}/storage/v1/object/sign/avatars/u1/a.png?token=t`],
    ["non-chaîne", 42],
  ]
  const calls = [
    ["updateStudentProfile", (avatarUrl) => updateStudentProfile({ fullName: "Awa", city: "Cotonou", avatarUrl })],
    ["updateStudentProfileWithCard", (avatarUrl) => updateStudentProfileWithCard({ fullName: "Awa", city: "Cotonou", avatarUrl })],
    ["updateClientProfile", (avatarUrl) => updateClientProfile({ fullName: "Awa", city: "Cotonou", avatarUrl })],
  ]

  describe.each(calls)("%s", (_name, call) => {
    it.each(abusive)("refuse : %s", async (_l, value) => {
      const captured = {}
      asRole(session({ captured }))
      const res = await call(value)
      expect(res.error).toMatch(/n'est pas valide/)
      expect(captured).toEqual({})
    })

    it("accepte l'URL publique du dossier de l'utilisateur", async () => {
      const captured = {}
      asRole(session({ captured }))
      expect((await call(avatar("u1/avatar.png"))).success).toBe(true)
      expect(captured.profiles.avatar_url).toBe(avatar("u1/avatar.png"))
    })
  })
})

// ─── Résumé du profil client (C17) ───────────────────────────────────────────

// Faux client Supabase piloté par des tables en mémoire. Gère select (avec count/head), eq, in, order,
// limit et range ; consigne chaque requête pour contrôler colonnes et filtres.
function makeDb(tables, { errors = {} } = {}) {
  const log = []
  function from(table) {
    const q = { table, columns: null, opts: null, filters: [], ins: [], ranges: [], limit: null }
    log.push(q)
    const builder = {
      select: (c, o) => { q.columns = c; q.opts = o ?? null; return builder },
      eq: (c, v) => { q.filters.push([c, v]); return builder },
      in: (c, v) => { q.ins.push([c, v]); return builder },
      order: () => builder,
      limit: (n) => { q.limit = n; return builder },
      range: (a, b) => { q.ranges.push([a, b]); return builder },
      then: (resolve, reject) => {
        const failure = errors[table]
        if (failure && (failure === true || failure(q))) {
          return Promise.resolve({ data: null, count: null, error: { message: `secret ${table}` } }).then(resolve, reject)
        }
        let rows = (tables[table] ?? []).filter(
          (r) => q.filters.every(([c, v]) => r[c] === v) && q.ins.every(([c, vs]) => vs.includes(r[c])),
        )
        if (q.opts?.head) return Promise.resolve({ data: null, count: rows.length, error: null }).then(resolve, reject)
        if (q.ranges.length) rows = rows.slice(q.ranges[0][0], q.ranges[0][1] + 1)
        if (q.limit !== null) rows = rows.slice(0, q.limit)
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
      },
    }
    return builder
  }
  return { client: { from }, log }
}

function asClientWith(db, profileRow = null) {
  requireRole.mockResolvedValue({ supabase: db.client, user: { id: "u1" }, role: "client", profile: {} })
  const { client, state } = makeService({ data: profileRow, error: null })
  createServiceClient.mockReturnValue(client)
  return state
}

const OWN_PROFILE = {
  user_id: "u1", full_name: "Rosine Houngbédji", city: "Cotonou", avatar_url: null,
  bio: "Boutique Ayaba", rating: 4.8, created_at: "2026-04-02T10:00:00Z", phone: "+22901974521" + "08",
}
const release = (amount, over = {}) => ({ user_id: "u1", type: "release", amount, ...over })

describe("getClientProfileSummary", () => {
  it("refuse un appelant sans rôle client avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getClientProfileSummary()).toEqual({ error: "refus" })
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("lit le profil avec des colonnes explicites sous l'identifiant de la session, téléphone par le service role", async () => {
    const db = makeDb({ missions: [], reviews: [], wallet_transactions: [] })
    const state = asClientWith(db, OWN_PROFILE)
    await getClientProfileSummary()
    expect(state.table).toBe("profiles")
    expect(state.filters).toEqual([["user_id", "u1"]])
    expect(state.columns).not.toContain("*")
    for (const col of ["full_name", "city", "avatar_url", "bio", "rating", "created_at", "phone"]) {
      expect(state.columns).toContain(col)
    }
    for (const col of ["role", "is_suspended", "rejection_reason", "fcm_token", "verification_submitted_at"]) {
      expect(state.columns).not.toContain(col)
    }
    // Aucune lecture de profiles avec la session sur cette action sauf les prénoms des auteurs.
    const sessionProfiles = db.log.filter((q) => q.table === "profiles")
    for (const q of sessionProfiles) expect(q.columns).toBe("user_id, full_name")
  })

  it("renvoie une erreur neutre si le profil est illisible ou absent", async () => {
    asClientWith(makeDb({}), null)
    expect(await getClientProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
    requireRole.mockResolvedValue({ supabase: makeDb({}).client, user: { id: "u1" } })
    createServiceClient.mockReturnValue(makeService({ data: null, error: { message: "boom secret" } }).client)
    const res = await getClientProfileSummary()
    expect(res).toEqual({ error: "Impossible de charger votre profil." })
  })

  it("compte les missions avec des comptes exacts, filtrés sur la session", async () => {
    const m = (status) => ({ client_id: "u1", status })
    const db = makeDb({
      missions: [m("open"), m("open"), m("in_progress"), m("done"), m("done"), m("done"), m("cancelled"), { client_id: "u2", status: "done" }],
      reviews: [],
      wallet_transactions: [],
    })
    asClientWith(db, OWN_PROFILE)
    const { summary } = await getClientProfileSummary()
    expect(summary.stats).toMatchObject({ published: 7, active: 3, done: 3, cancelled: 1 })
    const counts = db.log.filter((q) => q.table === "missions" && q.opts?.head)
    expect(counts).toHaveLength(4)
    for (const q of counts) {
      expect(q.opts).toEqual({ count: "exact", head: true })
      expect(q.filters).toContainEqual(["client_id", "u1"])
    }
  })

  it("expose l'identité, la note du profil et le nombre d'avis", async () => {
    const db = makeDb({
      missions: [],
      wallet_transactions: [],
      reviews: [
        { id: "r1", reviewed_id: "u1", reviewer_id: "s1", mission_id: "m1", rating: 5, comment: "Super", created_at: "2026-10-08T10:00:00Z" },
        { id: "r2", reviewed_id: "u1", reviewer_id: "s2", mission_id: "m2", rating: "4", comment: null, created_at: "2026-09-01T10:00:00Z" },
        { id: "r3", reviewed_id: "autre", reviewer_id: "s1", mission_id: "m9", rating: 1, comment: "pas moi", created_at: "2026-09-01T10:00:00Z" },
      ],
    })
    asClientWith(db, OWN_PROFILE)
    const { summary } = await getClientProfileSummary()
    expect(summary.identity).toEqual({
      userId: "u1",
      fullName: "Rosine Houngbédji",
      companyName: "Boutique Ayaba",
      city: "Cotonou",
      avatarUrl: null,
      phone: "+2290197452108",
      memberSince: "2026-04-02T10:00:00Z",
    })
    expect(summary.stats.rating).toBe(4.8)
    expect(summary.stats.reviewsCount).toBe(2)
    expect(summary.reviews.map((r) => [r.id, r.rating])).toEqual([["r1", 5], ["r2", 4]])
  })

  it("réduit l'auteur d'un avis à son prénom et ne lit jamais d'email ni de téléphone", async () => {
    const db = makeDb({
      missions: [{ id: "m1", client_id: "u1", title: "Garde mercredi" }, { id: "mx", client_id: "u2", title: "Autre" }],
      wallet_transactions: [],
      profiles: [{ user_id: "s1", full_name: "Afiavi Dossou", phone: "+22901000000", email: "a@b.c" }],
      reviews: [{ id: "r1", reviewed_id: "u1", reviewer_id: "s1", mission_id: "m1", rating: 5, comment: "Bien", created_at: "2026-10-08T10:00:00Z" }],
    })
    asClientWith(db, OWN_PROFILE)
    const { summary } = await getClientProfileSummary()
    expect(summary.reviews).toEqual([
      { id: "r1", rating: 5, comment: "Bien", createdAt: "2026-10-08T10:00:00Z", authorFirstName: "Afiavi", missionTitle: "Garde mercredi" },
    ])
    expect(JSON.stringify(summary.reviews)).not.toMatch(/Dossou|phone|email|01000000/)
    const authors = db.log.find((q) => q.table === "profiles")
    expect(authors.columns).toBe("user_id, full_name")
    // Les titres ne viennent que des missions du client.
    const titles = db.log.find((q) => q.table === "missions" && !q.opts?.head)
    expect(titles.filters).toContainEqual(["client_id", "u1"])
  })

  it("garde le profil quand les prénoms ou les titres sont illisibles (décoratifs)", async () => {
    const db = makeDb(
      {
        missions: [{ id: "m1", client_id: "u1", title: "T" }],
        wallet_transactions: [],
        profiles: [],
        reviews: [{ id: "r1", reviewed_id: "u1", reviewer_id: "s1", mission_id: "m1", rating: 5, comment: null, created_at: "2026-10-08T10:00:00Z" }],
      },
      { errors: { profiles: true, missions: (q) => !q.opts?.head } },
    )
    asClientWith(db, OWN_PROFILE)
    const { summary } = await getClientProfileSummary()
    expect(summary.reviews[0]).toMatchObject({ authorFirstName: "Étudiant", missionTitle: null })
  })

  it("renvoie null pour un chiffre dont la lecture échoue, jamais un faux 0", async () => {
    const db = makeDb(
      { missions: [{ client_id: "u1", status: "done" }], reviews: [], wallet_transactions: [] },
      { errors: { reviews: true } },
    )
    asClientWith(db, OWN_PROFILE)
    const { summary } = await getClientProfileSummary()
    expect(summary.stats.reviewsCount).toBeNull()
    expect(summary.reviews).toEqual([])
    expect(summary.stats.done).toBe(1)
  })

  it("renvoie une erreur neutre si une exception inattendue survient", async () => {
    requireRole.mockResolvedValue({ supabase: { from: () => { throw new Error("kaboom secret") } }, user: { id: "u1" } })
    createServiceClient.mockReturnValue(makeService({ data: OWN_PROFILE, error: null }).client)
    expect(await getClientProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
  })
})

describe("getClientProfileSummary : total dépensé (grand livre, règle de la PR #24)", () => {
  async function total(ledger, options) {
    const db = makeDb({ missions: [], reviews: [], wallet_transactions: ledger }, options)
    asClientWith(db, OWN_PROFILE)
    const res = await getClientProfileSummary()
    return { total: res.summary.stats.totalSpent, db }
  }

  it("vaut 0 sans aucune libération", async () => {
    expect((await total([])).total).toBe(0)
  })

  it("additionne plusieurs libérations de l'utilisateur et ignore les autres types", async () => {
    const { total: t } = await total([
      release(5000), release("7500"),
      { user_id: "u1", type: "reserve", amount: 99999 },
      { user_id: "u1", type: "commission", amount: 1500 },
    ])
    expect(t).toBe(12500)
  })

  it("ignore les libérations d'un autre utilisateur et filtre sur la session et le type", async () => {
    const { total: t, db } = await total([release(40000, { user_id: "u2" }), release(3000)])
    expect(t).toBe(3000)
    const ledger = db.log.filter((q) => q.table === "wallet_transactions")
    expect(ledger[0].columns).toBe("amount")
    expect(ledger[0].filters).toEqual([["user_id", "u1"], ["type", "release"]])
  })

  it("devient null (Indisponible) si la lecture échoue, sans détail technique", async () => {
    const { total: t } = await total([release(5000)], { errors: { wallet_transactions: true } })
    expect(t).toBeNull()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("total dépensé"), "secret wallet_transactions")
  })

  it("gère décimaux en chaîne, null et undefined", async () => {
    const { total: t } = await total([release("1500.50"), release(null), release(undefined), release(0.25)])
    expect(t).toBe(1500.75)
  })

  it("compte une libération journalisée en négatif en valeur absolue", async () => {
    const { total: t } = await total([release(-5000), release("-2500"), release(1000)])
    expect(t).toBe(8500)
  })

  it("gère de très grands montants sans NaN", async () => {
    const { total: t } = await total([release("999999999999"), release(1)])
    expect(t).toBe(1000000000000)
  })

  it("un montant non numérique rend le total indisponible au lieu d'afficher NaN (la colonne est numeric NOT NULL)", async () => {
    const { total: t } = await total([release("abc")])
    expect(t).toBeNull()
  })

  it("lit toutes les pages au-delà du plafond de 1000 lignes de PostgREST", async () => {
    const ledger = Array.from({ length: 2500 }, () => release(10))
    const { total: t, db } = await total(ledger)
    expect(t).toBe(25000)
    const pages = db.log.filter((q) => q.table === "wallet_transactions").map((q) => q.ranges[0])
    expect(pages).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it("demande une page de plus quand le nombre de lignes tombe pile sur le plafond", async () => {
    const { total: t, db } = await total(Array.from({ length: 1000 }, () => release(1)))
    expect(t).toBe(1000)
    expect(db.log.filter((q) => q.table === "wallet_transactions")).toHaveLength(2)
  })

  it("devient null (jamais un total partiel) si une page suivante échoue", async () => {
    const ledger = Array.from({ length: 1500 }, () => release(10))
    const { total: t } = await total(ledger, { errors: { wallet_transactions: (q) => q.ranges[0][0] >= 1000 } })
    expect(t).toBeNull()
  })

  it("devient null au-delà de 50 000 libérations plutôt que d'afficher un total partiel", async () => {
    const ledger = Array.from({ length: 50000 }, () => release(1))
    const { total: t } = await total(ledger)
    expect(t).toBeNull()
  })
})

describe("updateClientProfile : validation et message vouvoyé", () => {
  const base = { fullName: "Rosine", city: "Cotonou" }

  it("renvoie un message vouvoyé et journalise le détail quand l'écriture échoue", async () => {
    asRole(session({ failOn: "profiles" }))
    const res = await updateClientProfile(base)
    expect(res).toEqual({ error: "Impossible d'enregistrer votre profil." })
    expect(res.error).not.toMatch(/\b(ton|ta|tes|toi)\b/i)
  })

  it("n'écrit que la liste blanche de colonnes (jamais role, is_verified, is_suspended, verified_until)", async () => {
    const captured = {}
    asRole(session({ captured }))
    const res = await updateClientProfile({
      ...base, phone: "01 97 45 21 08", companyName: " Boutique ", avatarUrl: undefined,
      role: "admin", is_verified: true, is_suspended: false, verified_until: "2099-01-01", rating: 5,
    })
    expect(res).toEqual({ success: true })
    expect(captured.profiles).toEqual({ full_name: "Rosine", city: "Cotonou", phone: "+2290197452108", bio: "Boutique" })
  })

  it.each([
    ["ville hors liste", { city: "Parakou" }, "Choisissez une ville de la liste."],
    ["nom vide", { fullName: "  " }, "Le nom complet est requis."],
    ["ville vide", { city: "" }, "La ville est requise."],
    ["nom trop long", { fullName: "a".repeat(101) }, /ne doivent pas dépasser 100 caractères/],
    ["nom de structure trop long", { companyName: "b".repeat(101) }, /ne doivent pas dépasser 100 caractères/],
    ["caractère de contrôle", { fullName: "Ro\u0000sine" }, /caractère spécial/],
    ["numéro trop court", { phone: "0197" }, /10 chiffres/],
    ["numéro étranger", { phone: "+33 6 12 34 56 78" }, /10 chiffres/],
    ["numéro qui ne commence pas par 01", { phone: "02 97 45 21 08" }, /10 chiffres/],
  ])("refuse sans écrire : %s", async (_l, patch, expected) => {
    const captured = {}
    asRole(session({ captured }))
    const res = await updateClientProfile({ ...base, ...patch })
    expect(res.error).toMatch(expected)
    expect(captured).toEqual({})
  })

  it("accepte un téléphone vide (efface le numéro) et le format +229", async () => {
    const captured = {}
    asRole(session({ captured }))
    await updateClientProfile({ ...base, phone: "" })
    expect(captured.profiles.phone).toBeNull()
    await updateClientProfile({ ...base, phone: "+229 01 97 45 21 08" })
    expect(captured.profiles.phone).toBe("+2290197452108")
  })
})

// ─── Garde-fou : aucune lecture de colonne privée avec la session ────────────
// Colonnes illisibles pour anon et authenticated après sql/15. Seuls les modules serveur
// ci-dessous, qui lisent avec le client service role ou n'écrivent que, peuvent les citer.

const SRC = path.resolve(import.meta.dirname, "../..")
const PRIVATE_COLUMNS = ["phone", "fcm_token", "rejection_reason", "verification_submitted_at", "card_url"]
const SERVER_ALLOWLIST = [
  "lib/actions/profile.actions.js",
  "lib/actions/admin.actions.js",
  "lib/actions/onboarding.actions.js",
  "app/(admin)/admin/verifications/page.js",
]

const SELECT_ARG = /\.select\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g
const STAR_ON_PROFILES = /from\(\s*["'](?:profiles|student_profiles)["']\s*\)\s*\.select\(\s*["'`]\s*\*/
const STAR_JOIN = /(?:profiles|student_profiles)!?[\w]*\(\s*\*\s*\)/

/**
 * @param {Array<{ file: string, source: string }>} files fichiers relatifs à src/
 * @returns {string[]} descriptions des lectures interdites
 */
export function findPrivateColumnReads(files) {
  const found = []
  for (const { file, source } of files) {
    const normalized = file.split(path.sep).join("/")
    if (!SERVER_ALLOWLIST.includes(normalized)) {
      for (const match of source.matchAll(SELECT_ARG)) {
        const col = PRIVATE_COLUMNS.find((c) => new RegExp(`\\b${c}\\b`).test(match[1]))
        if (col) found.push(`${normalized}: select de ${col}`)
      }
    }
    if (STAR_ON_PROFILES.test(source)) found.push(`${normalized}: select(*) sur profiles`)
    if (STAR_JOIN.test(source)) found.push(`${normalized}: jointure profiles(*)`)
  }
  return found
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [full] : []
  })
}

describe("garde-fou colonnes privées de profiles", () => {
  it("détecte les lectures interdites (fixtures)", () => {
    const files = [
      { file: "app/a/page.js", source: 'supabase.from("profiles").select("full_name, phone")' },
      { file: "app/b/page.js", source: 'supabase.from("student_profiles")\n  .select("card_url")' },
      { file: "app/c/page.js", source: 'supabase.from("profiles").select("*")' },
      { file: "app/d/page.js", source: 'supabase.from("missions").select("*, profiles!client_id(*)")' },
      { file: "app/e/page.js", source: 'supabase.from("profiles").select("*", { count: "exact", head: true })' },
    ]
    expect(findPrivateColumnReads(files)).toHaveLength(5)
  })

  it("accepte les lectures publiques, les missions et la liste blanche serveur (fixtures)", () => {
    const files = [
      { file: "app/a/page.js", source: 'supabase.from("profiles").select("user_id, full_name, city")' },
      { file: "app/b/page.js", source: 'supabase.from("missions").select("*")' },
      { file: "lib/actions/profile.actions.js", source: 'x.from("profiles").select("phone, rejection_reason")' },
    ]
    expect(findPrivateColumnReads(files)).toEqual([])
  })

  it("aucun module de src ne lit une colonne privée avec la session", () => {
    const files = walk(SRC).map((full) => ({
      file: path.relative(SRC, full),
      source: readFileSync(full, "utf8"),
    }))
    expect(findPrivateColumnReads(files)).toEqual([])
  })
})
