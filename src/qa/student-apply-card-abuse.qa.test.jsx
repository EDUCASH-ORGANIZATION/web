// QA indépendante RD-STUDENT-01 vague 1 : apply (refus selon le statut de vérification, sans insertion),
// saveStudentCardUrl (liste blanche, renvoi après refus) et page /profile/verify (redirection seulement si vérifié).
// Actions réelles (requireRole, getMyProfile, getMyStudentProfile, verificationFromRows réels) sur une base en mémoire inscriptible.
import { describe, it, expect, vi, beforeEach } from "vitest"

const ME = "stu-me"
const ctx = { db: {}, writes: [], user: null }

function fake() {
  return {
    auth: { getUser: async () => ({ data: { user: ctx.user }, error: ctx.user ? null : new Error("no session") }) },
    from: (table) => {
      const q = { table, filters: [], op: "select", payload: null }
      const rows = () => (ctx.db[table] ?? []).filter((r) => q.filters.every(([c, v]) => r[c] === v))
      const done = async (single) => {
        if (q.op !== "select") ctx.writes.push({ table, op: q.op, payload: q.payload, filters: q.filters })
        if (q.op === "select") return { data: single ? (rows()[0] ?? null) : rows(), error: null }
        // UPDATE avec { count: "exact" } : nombre de lignes visées par les filtres.
        if (q.op === "update" && q.count) return { data: null, error: null, count: rows().length }
        return { data: null, error: null }
      }
      const b = {
        select: () => b,
        eq: (c, v) => (q.filters.push([c, v]), b),
        insert: (p) => ((q.op = "insert"), (q.payload = p), b),
        update: (p, o) => ((q.op = "update"), (q.payload = p), (q.count = o?.count), b),
        upsert: (p) => ((q.op = "upsert"), (q.payload = p), b),
        maybeSingle: () => done(true),
        single: () => done(true),
        then: (ok, ko) => done(false).then(ok, ko),
      }
      return b
    },
  }
}

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: (to) => { throw new Error(`REDIRECT:${to}`) },
  unstable_rethrow: () => {},
}))
vi.mock("next/link", () => ({ default: ({ href, children }) => <a href={href}>{children}</a> }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => fake() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: async () => ctx.user }))

import { apply } from "@/lib/actions/application.actions"
import { saveStudentCardUrl } from "@/lib/actions/profile.actions"
import ProfileVerifyPage from "@/app/(student)/profile/verify/page"

const plus = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const STATES = {
  not_submitted: { profile: { is_verified: false }, card: null, ok: false },
  rejected: { profile: { is_verified: false, rejection_reason: "Photo floue" }, card: "stu-me/c.jpg", ok: false },
  expired: { profile: { is_verified: true, verified_until: plus(-1) }, card: "stu-me/c.jpg", ok: false },
  verified: { profile: { is_verified: true, verified_until: plus(200) }, card: "stu-me/c.jpg", ok: true },
  expiring: { profile: { is_verified: true, verified_until: plus(5) }, card: "stu-me/c.jpg", ok: true },
  pending: { profile: { is_verified: false }, card: "stu-me/c.jpg", ok: true },
}

function seed(state) {
  const s = STATES[state]
  ctx.user = { id: ME, user_metadata: { role: "student" } }
  ctx.db = {
    profiles: [{ user_id: ME, role: "student", full_name: "Awa K", city: "Cotonou", is_suspended: false, ...s.profile }],
    student_profiles: [{ user_id: ME, card_url: s.card }],
    missions: [{ id: "11111111-1111-4111-8111-111111111111", title: "Maths", client_id: "cli", status: "open" }],
    applications: [],
  }
  ctx.writes = []
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
})

describe("apply : refus selon le statut de vérification", () => {
  it.each(Object.entries(STATES))("%s", async (state, { ok }) => {
    seed(state)
    const res = await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })
    const inserts = ctx.writes.filter((w) => w.table === "applications" && w.op === "insert")
    if (ok) {
      expect(res).toEqual({ success: true })
      expect(inserts).toHaveLength(1)
      expect(inserts[0].payload).toMatchObject({ mission_id: "11111111-1111-4111-8111-111111111111", student_id: ME, status: "pending" })
    } else {
      expect(res.error).toBeTruthy()
      expect(inserts).toHaveLength(0)
    }
  })

  it("un statut refusé n'expose pas le motif de refus ni le chemin de la carte dans l'erreur", async () => {
    seed("rejected")
    const res = await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })
    expect(JSON.stringify(res)).not.toMatch(/floue|stu-me\/c\.jpg/)
  })

  it("date d'échéance illisible : traité comme expiré, aucune insertion", async () => {
    seed("verified")
    ctx.db.profiles[0].verified_until = "n'importe quoi"
    const res = await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })
    expect(res.error).toMatch(/expiré/)
    expect(ctx.writes).toHaveLength(0)
  })

  it("profil illisible (absent) : erreur générique, aucune insertion", async () => {
    seed("verified")
    ctx.db.profiles = ctx.db.profiles.map((p) => ({ ...p, user_id: "autre" }))
    const res = await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })
    expect(res.error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })

  it.each([["client"], ["admin"]])("rôle %s : refusé avant toute lecture de mission", async (role) => {
    seed("verified")
    ctx.db.profiles[0].role = role
    const res = await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })
    expect(res.error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })

  it("étudiant suspendu ou user_metadata forgé : refusé", async () => {
    seed("verified")
    ctx.db.profiles[0].is_suspended = true
    expect((await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })).error).toBeTruthy()
    seed("verified")
    ctx.db.profiles[0].role = "client"
    ctx.user = { id: ME, user_metadata: { role: "student" }, app_metadata: { role: "student" } }
    expect((await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })).error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })

  it("sans session : refusé", async () => {
    seed("verified")
    ctx.user = null
    expect((await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })).error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })
})

describe("saveStudentCardUrl", () => {
  it("chemin du dossier de l'appelant : carte enregistrée et statut remis en attente (refus effacé)", async () => {
    seed("rejected")
    const res = await saveStudentCardUrl("stu-me/nouvelle.jpg")
    expect(res).toEqual({ success: true })
    // La carte n'est jamais dans un upsert (EXCLUDED.card_url exigerait SELECT sur une colonne privée, RD-FIX-15) :
    // ligne garantie sans la carte, puis UPDATE de la carte filtré sur l'appelant.
    const ensure = ctx.writes.find((w) => w.table === "student_profiles" && w.op === "upsert")
    expect(ensure.payload).toEqual({ user_id: ME })
    const up = ctx.writes.find((w) => w.table === "student_profiles" && w.op === "update")
    expect(up.payload).toEqual({ card_url: "stu-me/nouvelle.jpg" })
    expect(up.filters).toEqual([["user_id", ME]])
    const order = ctx.writes.map((w) => w.table)
    expect(order).toEqual(["profiles", "student_profiles", "student_profiles", "profiles"])
    const reset = ctx.writes.filter((w) => w.table === "profiles").at(-1)
    expect(reset.payload).toMatchObject({ is_verified: false, rejection_reason: null })
    expect(Object.keys(reset.payload).sort()).toEqual(["is_verified", "rejection_reason", "verification_submitted_at"])
    expect(reset.filters).toEqual([["user_id", ME]])
  })

  it("refus puis renvoi : le statut calculé passe de rejected à pending et canApply devient vrai", async () => {
    seed("rejected")
    expect((await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })).error).toBeTruthy()
    await saveStudentCardUrl("stu-me/nouvelle.jpg")
    const reset = ctx.writes.filter((w) => w.table === "profiles").at(-1).payload
    ctx.db.profiles[0] = { ...ctx.db.profiles[0], ...reset }
    ctx.db.student_profiles[0].card_url = "stu-me/nouvelle.jpg"
    ctx.writes = []
    expect(await apply({ missionId: "11111111-1111-4111-8111-111111111111", message: "Bonjour" })).toEqual({ success: true })
  })

  it.each([
    ["autre dossier", "autre/card.jpg"],
    ["remontée de dossier", "stu-me/../autre/card.jpg"],
    ["dossier seul", "stu-me/"],
    ["URL externe", "https://evil.com/storage/v1/object/public/student-cards/stu-me/c.jpg"],
    ["URL du projet, autre bucket", "https://example.supabase.co/storage/v1/object/public/avatars/stu-me/c.jpg"],
    ["schéma javascript", "javascript:alert(1)"],
    ["encodage %2e", "stu-me/%2e%2e/x.jpg"],
    ["antislash", "stu-me\\x.jpg"],
    ["requête", "stu-me/c.jpg?x=1"],
    ["vide", ""],
    ["espaces", "   "],
    ["null", null],
    ["nombre", 42],
    ["objet", { path: "stu-me/c.jpg" }],
  ])("refuse : %s", async (_n, value) => {
    seed("pending")
    const res = await saveStudentCardUrl(value)
    expect(res.error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })

  it("accepte une URL du projet vers le bucket student-cards et la normalise en chemin", async () => {
    seed("pending")
    const res = await saveStudentCardUrl("https://example.supabase.co/storage/v1/object/sign/student-cards/stu-me/c.jpg")
    expect(res).toEqual({ success: true })
    expect(ctx.writes.find((w) => w.table === "student_profiles" && w.op === "update").payload.card_url).toBe("stu-me/c.jpg")
  })

  it.each([["client"], ["admin"]])("rôle %s : refusé, aucune écriture", async (role) => {
    seed("pending")
    ctx.db.profiles[0].role = role
    expect((await saveStudentCardUrl("stu-me/c.jpg")).error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })

  it("suspendu ou sans session : refusé, aucune écriture", async () => {
    seed("pending")
    ctx.db.profiles[0].is_suspended = true
    expect((await saveStudentCardUrl("stu-me/c.jpg")).error).toBeTruthy()
    seed("pending")
    ctx.user = null
    expect((await saveStudentCardUrl("stu-me/c.jpg")).error).toBeTruthy()
    expect(ctx.writes).toHaveLength(0)
  })
})

describe("/profile/verify : redirection seulement si le badge est valable", () => {
  it.each(Object.entries(STATES))("%s", async (state) => {
    seed(state)
    const run = ProfileVerifyPage()
    if (state === "verified") await expect(run).rejects.toThrow("REDIRECT:/profile")
    else expect(await run).toBeTruthy()
  })

  it("sans session : connexion ; profil illisible : pas de redirection vers /profile", async () => {
    seed("verified")
    ctx.user = null
    await expect(ProfileVerifyPage()).rejects.toThrow("REDIRECT:/auth/login")
    seed("verified")
    ctx.db.profiles = []
    expect(await ProfileVerifyPage()).toBeTruthy()
  })
})
