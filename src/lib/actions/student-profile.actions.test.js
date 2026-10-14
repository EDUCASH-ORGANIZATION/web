import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ unstable_rethrow: (e) => { if (e?.digest) throw e } }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }))
vi.mock("@/lib/actions/university.actions", () => ({ getUniversities: vi.fn() }))
// Lectures privées simulées ; l'écriture `updateStudentProfile` reste la vraie (contrôles d'avatar, liste blanche).
vi.mock("@/lib/actions/profile.actions", async (importOriginal) => ({
  ...(await importOriginal()),
  getMyProfile: vi.fn(),
  getMyStudentProfile: vi.fn(),
}))

import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { getUniversities } from "@/lib/actions/university.actions"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { getStudentProfileSummary, getStudentProfileForm, saveStudentProfile } from "./student-profile.actions"

const SUPABASE_URL = "https://proj.supabase.co"

// Faux client Supabase piloté par des tables en mémoire : select (count/head), eq, in, order, limit, range.
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

function makeService(response) {
  const state = { table: null, columns: null, filters: [] }
  const builder = {
    select: (c) => { state.columns = c; return builder },
    eq: (c, v) => { state.filters.push([c, v]); return builder },
    maybeSingle: () => Promise.resolve(response),
  }
  return { client: { from: (t) => { state.table = t; return builder } }, state }
}

const PRIVATE_PROFILE = {
  user_id: "u1", full_name: "Sèna Agossou", city: "Abomey-Calavi", avatar_url: null, bio: "Étudiante en L2.", role: "student",
  is_verified: true, verified_until: "2099-06-29", phone: "+2290197452108", rejection_reason: "motif secret",
  verification_submitted_at: "2026-09-01T10:00:00Z",
}
const PRIVATE_STUDENT = { user_id: "u1", school: "UAC", level: "Licence 2", skills: ["Traduction"], availability: "Week-end, mardi soir", card_url: "u1/carte-secrete.jpg" }
const release = (amount, over = {}) => ({ user_id: "u1", type: "release", amount, ...over })

function asStudent(db, { profile = PRIVATE_PROFILE, student = PRIVATE_STUDENT, own = { rating: 4.9, created_at: "2026-03-02T10:00:00Z" } } = {}) {
  requireRole.mockResolvedValue({ supabase: db.client, user: { id: "u1" }, role: "student", profile: {} })
  getMyProfile.mockResolvedValue({ profile })
  getMyStudentProfile.mockResolvedValue({ studentProfile: student })
  const service = makeService({ data: own, error: null })
  createServiceClient.mockReturnValue(service.client)
  return service.state
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
})

describe("getStudentProfileSummary", () => {
  it("refuse un appelant sans rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getStudentProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(getMyProfile).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("ne renvoie jamais une colonne privée : seul un statut de vérification calculé sort", async () => {
    asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [] }))
    const { summary } = await getStudentProfileSummary()
    const json = JSON.stringify(summary)
    for (const secret of ["0197452108", "+229", "motif secret", "carte-secrete", "card_url", "rejection_reason", "verification_submitted_at", "phone"]) {
      expect(json).not.toContain(secret)
    }
    expect(summary.verification).toMatchObject({ key: "verified", canApply: true, verifiedUntil: "2099-06-29" })
    expect(summary.identity).toEqual({
      userId: "u1", fullName: "Sèna Agossou", city: "Abomey-Calavi", avatarUrl: null, bio: "Étudiante en L2.",
      school: "UAC", level: "Licence 2", skills: ["Traduction"], availability: "Week-end, mardi soir", memberSince: "2026-03-02T10:00:00Z",
    })
  })

  it("traduit les colonnes en statut sans exposer la date de fin d'un badge inactif", async () => {
    const cases = [
      [{ ...PRIVATE_PROFILE, is_verified: false, rejection_reason: "floue" }, "rejected"],
      [{ ...PRIVATE_PROFILE, is_verified: false, rejection_reason: null }, "pending"],
      [{ ...PRIVATE_PROFILE, is_verified: true, verified_until: "2020-01-01" }, "expired"],
    ]
    for (const [profile, key] of cases) {
      asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [] }), { profile })
      const { summary } = await getStudentProfileSummary()
      expect(summary.verification.key).toBe(key)
      expect(summary.verification.verifiedUntil).toBeNull()
    }
    asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [] }), { profile: { ...PRIVATE_PROFILE, is_verified: false, rejection_reason: null }, student: { ...PRIVATE_STUDENT, card_url: null } })
    expect((await getStudentProfileSummary()).summary.verification.key).toBe("not_submitted")
  })

  it("lit les colonnes publiques de la ligne de la session, sans select('*')", async () => {
    const db = makeDb({ missions: [], reviews: [], wallet_transactions: [] })
    const state = asStudent(db)
    await getStudentProfileSummary()
    expect(state.table).toBe("profiles")
    expect(state.filters).toEqual([["user_id", "u1"]])
    expect(state.columns).toBe("rating, created_at")
    for (const q of db.log) expect(q.columns).not.toContain("*")
  })

  it("renvoie une erreur neutre si les lectures privées échouent (aucun statut inventé)", async () => {
    asStudent(makeDb({}))
    getMyProfile.mockResolvedValue({ error: "boom secret" })
    expect(await getStudentProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
    getMyProfile.mockResolvedValue({ profile: PRIVATE_PROFILE })
    getMyStudentProfile.mockResolvedValue({ error: "boom secret" })
    expect(await getStudentProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
    getMyStudentProfile.mockResolvedValue({ studentProfile: PRIVATE_STUDENT })
    getMyProfile.mockResolvedValue({ profile: null })
    expect(await getStudentProfileSummary()).toEqual({ error: "Impossible de charger votre profil." })
  })

  describe("total gagné (grand livre)", () => {
    it("somme les release de l'étudiant, jamais la table legacy transactions", async () => {
      const db = makeDb({
        missions: [],
        reviews: [],
        wallet_transactions: [release(10_000), release(25_000), release(-5_000), release(99_000, { type: "withdrawal" }), release(77_000, { user_id: "u2" })],
        transactions: [{ amount_student: 123_456 }],
      })
      asStudent(db)
      const { summary } = await getStudentProfileSummary()
      expect(summary.stats.totalEarned).toBe(40_000)
      expect(db.log.some((q) => q.table === "transactions")).toBe(false)
      const ledger = db.log.find((q) => q.table === "wallet_transactions")
      expect(ledger.columns).toBe("amount")
      expect(ledger.filters).toEqual([["user_id", "u1"], ["type", "release"]])
    })

    it("pagine par pages de 1000 : la somme reste exacte au-delà du plafond", async () => {
      const rows = Array.from({ length: 2_350 }, () => release(100))
      const db = makeDb({ missions: [], reviews: [], wallet_transactions: rows })
      asStudent(db)
      const { summary } = await getStudentProfileSummary()
      expect(summary.stats.totalEarned).toBe(235_000)
      expect(db.log.filter((q) => q.table === "wallet_transactions")).toHaveLength(3)
    })

    it("donne 0 sans libération, mais null (Indisponible) si la lecture échoue ou si un montant est illisible", async () => {
      asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [] }))
      expect((await getStudentProfileSummary()).summary.stats.totalEarned).toBe(0)
      asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [release(5)] }, { errors: { wallet_transactions: true } }))
      const res = await getStudentProfileSummary()
      expect(res.summary.stats.totalEarned).toBeNull()
      expect(JSON.stringify(res)).not.toContain("secret")
      asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [release("abc")] }))
      expect((await getStudentProfileSummary()).summary.stats.totalEarned).toBeNull()
    })

    it("donne null au-delà de 50 000 libérations plutôt qu'un total partiel", async () => {
      const full = { ...release(1) }
      const db = makeDb({ missions: [], reviews: [], wallet_transactions: Array.from({ length: 50_000 }, () => full) })
      asStudent(db)
      expect((await getStudentProfileSummary()).summary.stats.totalEarned).toBeNull()
    })
  })

  it("compte les missions terminées où l'étudiant est retenu, avec un compte exact", async () => {
    const m = (status, student = "u1") => ({ selected_student_id: student, status })
    const db = makeDb({ missions: [m("done"), m("done"), m("in_progress"), m("done", "u2")], reviews: [], wallet_transactions: [] })
    asStudent(db)
    const { summary } = await getStudentProfileSummary()
    expect(summary.stats.done).toBe(2)
    const count = db.log.find((q) => q.table === "missions" && q.opts?.head)
    expect(count.opts).toEqual({ count: "exact", head: true })
    expect(count.filters).toEqual([["selected_student_id", "u1"], ["status", "done"]])
  })

  it("renvoie null pour un chiffre dont la lecture échoue, jamais un faux 0, sans faire échouer le profil", async () => {
    asStudent(makeDb({ missions: [], reviews: [], wallet_transactions: [] }, { errors: { missions: true } }))
    const res = await getStudentProfileSummary()
    expect(res.summary.stats.done).toBeNull()
    expect(res.summary.stats.totalEarned).toBe(0)
    expect(JSON.stringify(res)).not.toContain("secret")
  })

  it("réduit l'auteur d'un avis à son prénom, ne lit jamais d'email ni de téléphone, titres des seules missions de l'étudiant", async () => {
    const db = makeDb({
      missions: [{ id: "m1", selected_student_id: "u1", title: "Cours de maths", status: "done" }, { id: "mx", selected_student_id: "u2", title: "Autre" }],
      wallet_transactions: [],
      profiles: [{ user_id: "c1", full_name: "Rosine Houngbédji", phone: "+22901000000", email: "a@b.c" }],
      reviews: [
        { id: "r1", reviewed_id: "u1", reviewer_id: "c1", mission_id: "m1", rating: 5, comment: "Ponctuelle", created_at: "2026-10-08T10:00:00Z" },
        { id: "r2", reviewed_id: "autre", reviewer_id: "c1", mission_id: "m1", rating: 1, comment: "pas moi", created_at: "2026-10-08T10:00:00Z" },
      ],
    })
    asStudent(db)
    const { summary } = await getStudentProfileSummary()
    expect(summary.reviews).toEqual([
      { id: "r1", rating: 5, comment: "Ponctuelle", createdAt: "2026-10-08T10:00:00Z", authorFirstName: "Rosine", missionTitle: "Cours de maths" },
    ])
    expect(JSON.stringify(summary.reviews)).not.toMatch(/Houngbédji|phone|email|01000000/)
    expect(summary.stats.reviewsCount).toBe(1)
    expect(db.log.find((q) => q.table === "profiles").columns).toBe("user_id, full_name")
    const titles = db.log.find((q) => q.table === "missions" && !q.opts?.head)
    expect(titles.filters).toContainEqual(["selected_student_id", "u1"])
  })

  it("garde le profil quand prénoms et titres sont illisibles (décoratifs)", async () => {
    const db = makeDb(
      {
        missions: [{ id: "m1", selected_student_id: "u1", title: "T" }],
        wallet_transactions: [],
        profiles: [],
        reviews: [{ id: "r1", reviewed_id: "u1", reviewer_id: "c1", mission_id: "m1", rating: 5, comment: null, created_at: "2026-10-08T10:00:00Z" }],
      },
      { errors: { profiles: true, missions: (q) => !q.opts?.head } },
    )
    asStudent(db)
    const { summary } = await getStudentProfileSummary()
    expect(summary.reviews[0]).toMatchObject({ authorFirstName: "Client", missionTitle: null })
  })

  it("borne les avis à 10 et expose le total exact", async () => {
    const reviews = Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, reviewed_id: "u1", reviewer_id: "c1", mission_id: "m", rating: 5, comment: null, created_at: "2026-10-08T10:00:00Z" }))
    asStudent(makeDb({ missions: [], wallet_transactions: [], profiles: [], reviews }))
    const { summary } = await getStudentProfileSummary()
    expect(summary.reviews).toHaveLength(10)
    expect(summary.stats.reviewsCount).toBe(14)
  })

  it("renvoie une erreur neutre sans fuiter le détail si une lecture lève", async () => {
    asStudent(makeDb({}))
    getMyProfile.mockRejectedValue(new Error("secret interne"))
    const res = await getStudentProfileSummary()
    expect(res).toEqual({ error: "Impossible de charger votre profil." })
  })
})

describe("getStudentProfileForm", () => {
  it("refuse un appelant sans rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getStudentProfileForm()).toEqual({ error: "Impossible de charger votre profil." })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it("renvoie les valeurs de l'utilisateur, son téléphone compris, et un statut sans carte ni motif", async () => {
    asStudent(makeDb({}))
    getUniversities.mockResolvedValue([{ id: "1", name: "Université d'Abomey-Calavi", short_name: "UAC", city: "Abomey-Calavi" }])
    const { form } = await getStudentProfileForm()
    expect(form.values).toEqual({
      userId: "u1", fullName: "Sèna Agossou", city: "Abomey-Calavi", phone: "+2290197452108", bio: "Étudiante en L2.",
      school: "UAC", level: "Licence 2", availability: "Week-end, mardi soir", skills: ["Traduction"], avatarUrl: null,
    })
    expect(form.universities).toEqual([{ name: "Université d'Abomey-Calavi", shortName: "UAC" }])
    expect(Object.keys(form.verification).sort()).toEqual(["action", "key", "label"])
    const json = JSON.stringify(form)
    for (const secret of ["motif secret", "carte-secrete", "card_url", "rejection_reason", "verification_submitted_at"]) {
      expect(json).not.toContain(secret)
    }
  })

  it("ne renvoie aucune valeur sans lecture fiable du profil (le téléphone serait effacé)", async () => {
    asStudent(makeDb({}))
    getUniversities.mockResolvedValue([])
    getMyProfile.mockResolvedValue({ error: "boom secret" })
    expect(await getStudentProfileForm()).toEqual({ error: "Impossible de charger votre profil." })
    getMyProfile.mockResolvedValue({ profile: PRIVATE_PROFILE })
    getMyStudentProfile.mockResolvedValue({ error: "boom" })
    expect(await getStudentProfileForm()).toEqual({ error: "Impossible de charger votre profil." })
  })
})

// ─── Enregistrement ──────────────────────────────────────────────────────────

// Faux client de session pour l'écriture réelle `updateStudentProfile` : consigne les charges utiles.
function writer({ captured, failOn } = {}) {
  const result = (table) => ({ error: table === failOn ? { message: "secret sql" } : null })
  return {
    from: (table) => ({
      update: (payload) => {
        captured[table] = payload
        return { eq: () => Promise.resolve(result(table)) }
      },
      upsert: (payload) => {
        captured[table] = payload
        return Promise.resolve(result(table))
      },
    }),
  }
}

const VALID = {
  fullName: "Sèna Agossou", city: "Abomey-Calavi", phone: "01 97 45 21 08", bio: "Étudiante.", school: "UAC", level: "Licence 2",
  availability: "Week-end", skills: ["Traduction", "Mathématiques"],
}
const avatar = (p) => `${SUPABASE_URL}/storage/v1/object/public/avatars/${p}`

describe("saveStudentProfile", () => {
  function asWriter(opts = {}) {
    const captured = {}
    requireRole.mockResolvedValue({ supabase: writer({ captured, ...opts }), user: { id: "u1" }, role: "student", profile: {} })
    return captured
  }

  it("exige le rôle étudiant en première instruction : refus sans aucune écriture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    const res = await saveStudentProfile(VALID)
    expect(res).toEqual({ error: "refus" })
    expect(requireRole.mock.calls[0][0]).toEqual(["student"])
    expect(requireRole).toHaveBeenCalledTimes(1)
  })

  it("enregistre par liste blanche : téléphone en E.164, jamais role, is_verified, is_suspended ni verified_until", async () => {
    const captured = asWriter()
    const res = await saveStudentProfile({
      ...VALID, role: "admin", is_verified: true, is_suspended: false, verified_until: "2099-01-01", card_url: "u2/x.jpg", user_id: "u2",
    })
    expect(res).toEqual({ success: true })
    expect(captured.profiles).toEqual({ full_name: "Sèna Agossou", city: "Abomey-Calavi", phone: "+2290197452108", bio: "Étudiante." })
    expect(captured.student_profiles).toEqual({
      user_id: "u1", school: "UAC", level: "Licence 2", availability: "Week-end", skills: ["Traduction", "Mathématiques"],
    })
  })

  it("accepte la photo du dossier de l'utilisateur et la transmet", async () => {
    const captured = asWriter()
    expect(await saveStudentProfile({ ...VALID, avatarUrl: avatar("u1/avatar-1.png") })).toEqual({ success: true })
    expect(captured.profiles.avatar_url).toBe(avatar("u1/avatar-1.png"))
  })

  it.each([
    ["dossier d'un autre utilisateur", avatar("u2/avatar.png")],
    ["URL externe", "https://evil.example/avatar.png"],
    ["traversée de dossier", avatar("u1/../u2/a.png")],
    ["autre bucket", `${SUPABASE_URL}/storage/v1/object/public/student-cards/u1/a.png`],
    ["schéma parasite", "javascript:alert(1)"],
  ])("refuse une photo hors du dossier de l'utilisateur : %s", async (_l, avatarUrl) => {
    const captured = asWriter()
    const res = await saveStudentProfile({ ...VALID, avatarUrl })
    expect(res.error).toMatch(/n'est pas valide/)
    expect(captured).toEqual({})
  })

  it.each([
    ["nom vide", { fullName: "  " }, "fullName"],
    ["nom trop long", { fullName: "a".repeat(101) }, "fullName"],
    ["nom avec caractère de contrôle", { fullName: "Sèna\u0000" }, "fullName"],
    ["ville hors liste", { city: "Parakou" }, "city"],
    ["ville vide", { city: "" }, "city"],
    ["téléphone absent", { phone: "" }, "phone"],
    ["téléphone non béninois", { phone: "0612345678" }, "phone"],
    ["téléphone avec lettres", { phone: "01 97 45 21 0a" }, "phone"],
    ["présentation trop longue", { bio: "a".repeat(401) }, "bio"],
    ["établissement trop long", { school: "a".repeat(121) }, "school"],
    ["niveau hors liste", { level: "Professeur" }, "level"],
    ["disponibilités trop longues", { availability: "a".repeat(201) }, "availability"],
    ["trop de compétences", { skills: Array.from({ length: 9 }, (_, i) => `c${i}`) }, "skills"],
    ["compétence trop longue", { skills: ["a".repeat(51)] }, "skills"],
    ["compétences non chaînes", { skills: [{ x: 1 }] }, "skills"],
    ["compétences non tableau", { skills: "Traduction" }, "skills"],
  ])("refuse sans écrire : %s", async (_l, over, field) => {
    const captured = asWriter()
    const res = await saveStudentProfile({ ...VALID, ...over })
    expect(res.error).toBe("Certains champs sont à corriger avant d'enregistrer.")
    expect(Object.keys(res.errors)).toContain(field)
    expect(captured).toEqual({})
  })

  it("dédoublonne les compétences et accepte les valeurs limites", async () => {
    const captured = asWriter()
    const res = await saveStudentProfile({
      ...VALID, fullName: "a".repeat(100), bio: "b".repeat(400), skills: ["Traduction", "Traduction", " Traduction "],
    })
    expect(res).toEqual({ success: true })
    expect(captured.student_profiles.skills).toEqual(["Traduction"])
  })

  it("renvoie un message neutre quand l'écriture échoue, sans le détail technique", async () => {
    asWriter({ failOn: "profiles" })
    const res = await saveStudentProfile(VALID)
    expect(res.error).toBe("Impossible d'enregistrer votre profil.")
    expect(JSON.stringify(res)).not.toContain("secret sql")
  })

  it("refuse une charge utile qui n'est pas un objet", async () => {
    asWriter()
    for (const bad of [null, undefined, "x", 42]) {
      const res = await saveStudentProfile(bad)
      expect(res.error).toBeTruthy()
    }
  })
})
