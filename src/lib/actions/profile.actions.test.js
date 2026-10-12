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
import {
  getMyProfile,
  getMyStudentProfile,
  updateStudentProfile,
  saveStudentCardUrl,
  updateStudentProfileWithCard,
  updateClientProfile,
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
    ["saveStudentCardUrl", () => saveStudentCardUrl("u1/c.jpg"), "student_profiles"],
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
