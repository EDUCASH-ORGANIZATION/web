import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const requireRole = vi.fn()
const createServiceClient = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a) }))
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("next/link", () => ({ default: () => null }))
vi.mock("@/components/admin/verifications-tabs", () => ({ VerificationsTabs: () => null }))
vi.mock("@/components/admin/suspend-button", () => ({ SuspendButton: () => null }))

import Verifications from "./page.js"

/** Constructeur de requête chaînable et attendable. */
function query(result) {
  const q = {}
  for (const m of ["select", "eq", "order", "range", "limit", "gte", "is", "in"]) q[m] = () => q
  q.then = (resolve) => resolve(result)
  return q
}

describe("page admin verifications : contrôle de rôle fail-closed", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    redirect.mockClear()
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
  })

  it("verifications redirige sans lire de données si requireRole refuse", async () => {
    await expect(Verifications()).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("admin/verifications : erreur visible", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    requireRole.mockResolvedValue({ supabase: {}, user: { id: "a" }, role: "admin", profile: {} })
  })

  function serviceWith(profiles, students) {
    return { from: (t) => query(t === "profiles" ? profiles : students) }
  }

  it("affiche une alerte au lieu de se replier en silence si la lecture des profils échoue", async () => {
    createServiceClient.mockReturnValue(
      serviceWith({ data: null, error: { message: "column does not exist" } }, { data: [], error: null })
    )
    const tree = JSON.stringify(await Verifications())
    expect(tree).toContain('"role":"alert"')
    expect(tree).toContain("Impossible de charger les dossiers de vérification.")
  })

  it("affiche une alerte si la lecture des student_profiles échoue", async () => {
    createServiceClient.mockReturnValue(
      serviceWith({ data: [{ user_id: "u1" }], error: null }, { data: null, error: { message: "boom" } })
    )
    expect(JSON.stringify(await Verifications())).toContain('"role":"alert"')
  })

  it("rend les onglets sans alerte quand tout va bien", async () => {
    createServiceClient.mockReturnValue(serviceWith({ data: [], error: null }, { data: [], error: null }))
    expect(JSON.stringify(await Verifications())).not.toContain('"role":"alert"')
  })
})

describe("admin/verifications : cartes et pagination", () => {
  const createSignedUrls = vi.fn()
  const ranges = []

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co")
    requireRole.mockReset()
    createServiceClient.mockReset()
    createSignedUrls.mockReset()
    ranges.length = 0
    requireRole.mockResolvedValue({ supabase: {}, user: { id: "a" }, role: "admin", profile: {} })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function service(students, { count = 1 } = {}) {
    const profiles = students.map((s) => ({ user_id: s.user_id, full_name: "E", is_verified: false, created_at: "2026-01-01T00:00:00Z" }))
    return {
      from: (t) => {
        const q = query(t === "profiles" ? { data: profiles, error: null, count } : { data: students, error: null })
        const range = q.range
        q.range = (...a) => { ranges.push(a); return range() }
        return q
      },
      storage: { from: (bucket) => ({ createSignedUrls: (...a) => createSignedUrls(bucket, ...a) }) },
    }
  }

  const cards = (tree) => JSON.stringify(tree)

  it("signe toutes les cartes en un seul appel de 1 heure", async () => {
    createServiceClient.mockReturnValue(service([
      { user_id: "u1", card_url: "u1/a.jpg" },
      { user_id: "u2", card_url: "https://x.supabase.co/storage/v1/object/sign/student-cards/u2/b.jpg?token=t" },
    ]))
    createSignedUrls.mockResolvedValue({ data: [
      { path: "u1/a.jpg", signedUrl: "https://signed/a", error: null },
      { path: "u2/b.jpg", signedUrl: "https://signed/b", error: null },
    ], error: null })
    const tree = cards(await Verifications({ searchParams: Promise.resolve({}) }))
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith("student-cards", ["u1/a.jpg", "u2/b.jpg"], 3600)
    expect(tree).toContain("https://signed/a")
    expect(tree).toContain("https://signed/b")
  })

  it("n'expose jamais le chemin brut quand la signature échoue", async () => {
    createServiceClient.mockReturnValue(service([{ user_id: "u1", card_url: "u1/secret-card.jpg" }]))
    createSignedUrls.mockResolvedValue({ data: [{ path: "u1/secret-card.jpg", signedUrl: null, error: "not found" }], error: null })
    const tree = cards(await Verifications({ searchParams: Promise.resolve({}) }))
    expect(tree).not.toContain("secret-card")
    expect(tree).toContain('"card_preview_unavailable":true')
  })

  it("n'expose pas une URL externe qui n'est pas un chemin du bucket", async () => {
    createServiceClient.mockReturnValue(service([{ user_id: "u1", card_url: "https://evil.example/x.jpg" }]))
    const tree = cards(await Verifications({ searchParams: Promise.resolve({}) }))
    expect(createSignedUrls).not.toHaveBeenCalled()
    expect(tree).not.toContain("evil.example")
  })

  it.each([
    ["chemin d'un autre utilisateur", "u2/card.jpg"],
    ["URL du bucket d'un autre utilisateur", "https://x.supabase.co/storage/v1/object/public/student-cards/u2/card.jpg"],
    ["traversée de dossier", "u1/../u2/card.jpg"],
    ["chemin sans dossier utilisateur", "card.jpg"],
    ["traversée encodée", "u1/%2e%2e/u2/card.jpg"],
    ["double encodage dans une URL", "https://x.supabase.co/storage/v1/object/public/student-cards/u1/%252e%252e/c.jpg"],
    ["segment vide", "u1//card.jpg"],
  ])("ne signe rien pour une ligne existante dont le chemin est invalide (%s)", async (_label, cardUrl) => {
    createServiceClient.mockReturnValue(service([{ user_id: "u1", card_url: cardUrl }]))
    const tree = cards(await Verifications({ searchParams: Promise.resolve({}) }))
    expect(createSignedUrls).not.toHaveBeenCalled()
    expect(tree).toContain('"card_preview_unavailable":true')
  })

  it.each([
    [{ page: "abc" }, [0, 49]],
    [{ page: "-3" }, [0, 49]],
    [{ page: "2" }, [50, 99]],
    [{}, [0, 49]],
  ])("pagination %j lit la plage %j", async (params, expected) => {
    createServiceClient.mockReturnValue(service([]))
    await Verifications({ searchParams: Promise.resolve(params) })
    expect(ranges[0]).toEqual(expected)
  })
})
