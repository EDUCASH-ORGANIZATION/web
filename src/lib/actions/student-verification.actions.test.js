import { describe, it, expect, vi, beforeEach } from "vitest"

const calls = []
let reads
const requireRole = vi.fn()
const requireUser = vi.fn()
const upsert = vi.fn()
const update = vi.fn()

function service() {
  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            calls.push({ table, columns, column, value })
            return reads[table]
          },
        }),
      }),
    }),
  }
}

vi.mock("next/navigation", () => ({ unstable_rethrow: (e) => { if (e?.digest) throw e } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a), requireUser: (...a) => requireUser(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => service() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

const { getStudentVerification } = await import("./student-verification.actions")

const plus = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const ok = (data) => ({ data, error: null })

beforeEach(() => {
  calls.length = 0
  requireRole.mockReset()
  requireUser.mockReset()
  requireUser.mockResolvedValue({ user: { id: "u1" } })
  requireRole.mockResolvedValue({ user: { id: "u1" }, role: "student", profile: {}, supabase: {} })
  reads = { profiles: ok({ is_verified: false }), student_profiles: ok(null) }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getStudentVerification : accès", () => {
  it("exige le rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    const res = await getStudentVerification()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(res).toEqual({ error: "refus" })
    expect(calls).toEqual([])
  })

  it("lit uniquement les lignes de la session, avec des colonnes explicites", async () => {
    await getStudentVerification()
    expect(calls).toHaveLength(2)
    for (const c of calls) {
      expect(c.column).toBe("user_id")
      expect(c.value).toBe("u1")
      expect(c.columns).not.toContain("*")
    }
    expect(calls.map((c) => c.table).sort()).toEqual(["profiles", "student_profiles"])
  })
})

describe("getStudentVerification : statuts", () => {
  const key = async () => (await getStudentVerification()).verification.key

  it("carte jamais envoyée", async () => {
    expect(await key()).toBe("not_submitted")
  })

  it("carte envoyée : en cours d'examen, date de dépôt formatée", async () => {
    reads = {
      profiles: ok({ is_verified: false, verification_submitted_at: "2026-10-07T21:14:09.123Z" }),
      student_profiles: ok({ card_url: "u1/carte.jpg" }),
    }
    const { verification } = await getStudentVerification()
    expect(verification.key).toBe("pending")
    expect(verification.canApply).toBe(true)
    expect(verification.submittedLabel).toBe("mer. 7 oct.")
  })

  it("badge valable, à renouveler, expiré", async () => {
    reads.profiles = ok({ is_verified: true, verified_until: plus(200) })
    expect(await key()).toBe("verified")
    reads.profiles = ok({ is_verified: true, verified_until: plus(10) })
    expect(await key()).toBe("expiring")
    reads.profiles = ok({ is_verified: true, verified_until: plus(-3) })
    expect(await key()).toBe("expired")
  })

  it("carte refusée : motif transmis, rien d'autre", async () => {
    reads.profiles = ok({ is_verified: false, rejection_reason: "  La carte est expirée  " })
    const { verification } = await getStudentVerification()
    expect(verification.key).toBe("rejected")
    expect(verification.rejectionReason).toBe("La carte est expirée")
    expect(verification.submittedLabel).toBeNull()
  })

  it("le motif est borné et absent hors statut refusé", async () => {
    reads.profiles = ok({ is_verified: false, rejection_reason: "x".repeat(900) })
    expect((await getStudentVerification()).verification.rejectionReason).toHaveLength(300)
    reads.profiles = ok({ is_verified: true, verified_until: plus(200), rejection_reason: "ancien motif" })
    expect((await getStudentVerification()).verification.rejectionReason).toBeNull()
  })
})

describe("getStudentVerification : aucune fuite vers le navigateur", () => {
  it("ne renvoie ni chemin de carte ni horodatage brut", async () => {
    reads = {
      profiles: ok({ is_verified: false, phone: "+22901000000", verification_submitted_at: "2026-10-07T21:14:09.123Z", verified_until: "2027-06-29T00:00:00.000Z" }),
      student_profiles: ok({ card_url: "u1/chemin-secret.jpg" }),
    }
    const res = await getStudentVerification()
    const json = JSON.stringify(res)
    expect(json).not.toContain("chemin-secret")
    expect(json).not.toContain("card_url")
    expect(json).not.toContain("2026-10-07T21")
    expect(json).not.toContain("T00:00:00")
    expect(json).not.toContain("phone")
    expect(Object.keys(res.verification).sort()).toEqual(
      ["action", "canApply", "daysLeft", "key", "label", "rejectionReason", "submittedLabel", "until"],
    )
    expect(res.verification.until).toBe("2027-06-29")
  })
})

describe("getStudentVerification : erreurs", () => {
  it.each([
    ["profil en erreur", { profiles: { data: null, error: { message: "boom" } }, student_profiles: ok(null) }],
    ["carte en erreur", { profiles: ok({ is_verified: false }), student_profiles: { data: null, error: { message: "boom" } } }],
    ["profil introuvable", { profiles: ok(null), student_profiles: ok(null) }],
  ])("%s : message neutre, jamais un faux statut", async (_n, r) => {
    reads = r
    expect(await getStudentVerification()).toEqual({ error: "Impossible de charger votre vérification." })
  })

  it("exception inattendue : message neutre", async () => {
    requireRole.mockRejectedValue(new Error("secret interne"))
    expect(await getStudentVerification()).toEqual({ error: "Impossible de charger votre vérification." })
  })
})

// Abus : l'enregistrement du chemin de carte est revalidé par le serveur (saveStudentCardUrl, non modifié ici).
describe("saveStudentCardUrl : chemin hors du dossier de l'utilisateur", () => {
  it("refuse un chemin d'un autre utilisateur, un chemin relatif et une URL étrangère, sans écrire", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
    const write = { from: vi.fn(() => ({ upsert, update })) }
    requireRole.mockResolvedValue({ supabase: write, user: { id: "u1" }, role: "student", profile: {} })
    const { saveStudentCardUrl } = await import("./profile.actions")
    for (const bad of [
      "u2/carte.jpg",
      "../u2/carte.jpg",
      "u1/../u2/carte.jpg",
      "carte.jpg",
      "u1/",
      "https://evil.example/storage/v1/object/public/student-cards/u1/carte.jpg",
      "https://proj.supabase.co/storage/v1/object/public/avatars/u1/carte.jpg",
      "https://proj.supabase.co/storage/v1/object/public/student-cards/u2/carte.jpg",
      null,
    ]) {
      const res = await saveStudentCardUrl(bad)
      expect(res.error, String(bad)).toBeTruthy()
    }
    expect(write.from).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it("accepte un chemin du dossier de l'utilisateur", async () => {
    upsert.mockResolvedValue({ error: null })
    const eq = vi.fn().mockResolvedValue({ error: null })
    update.mockReturnValue({ eq })
    const write = { from: vi.fn(() => ({ upsert, update })) }
    requireRole.mockResolvedValue({ supabase: write, user: { id: "u1" }, role: "student", profile: {} })
    const { saveStudentCardUrl } = await import("./profile.actions")
    expect(await saveStudentCardUrl("u1/carte-1.jpg")).toEqual({ success: true })
    expect(upsert).toHaveBeenCalledWith({ user_id: "u1", card_url: "u1/carte-1.jpg" }, { onConflict: "user_id" })
  })
})
