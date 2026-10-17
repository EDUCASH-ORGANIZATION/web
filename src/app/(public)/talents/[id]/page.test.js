import { describe, it, expect, vi, beforeEach } from "vitest"
import { existsSync } from "node:fs"

// /talents/[id] : un compte fermé ou pseudonymisé (closed_at posé, script 96) répond 404, un compte actif reste
// affiché. Faux client Supabase en mémoire : aucune base n'est lue.

const notFound = vi.fn(() => {
  throw new Error("notFound")
})
vi.mock("next/navigation", () => ({ notFound }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/components/vitrine/shared/vitrine-page", () => ({ VitrinePage: () => null }))
vi.mock("@/components/vitrine/shared/breadcrumb", () => ({ Breadcrumb: () => null }))
vi.mock("@/components/vitrine/talent/talent-header", () => ({ TalentHeader: () => null }))
vi.mock("@/components/vitrine/talent/talent-reviews", () => ({ TalentReviews: () => null, REVIEWS_PAGE_SIZE: 5 }))
vi.mock("@/components/vitrine/talent/talent-actions", () => ({ TalentActions: () => null, OwnerBanner: () => null }))

const { createClient } = await import("@/lib/supabase/server")
const { default: TalentPage, generateMetadata } = await import("./page")

const ID = "22222222-2222-4222-8222-222222222221"
const params = () => Promise.resolve({ id: ID })

let profile
let selected

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from(table) {
      const b = {
        select: (columns) => {
          if (table === "profiles") selected = columns
          return b
        },
        eq: () => b,
        in: () => b,
        order: () => b,
        range: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: table === "profiles" ? profile : null }),
        then: (ok) => ok({ data: [], count: 0 }),
      }
      return b
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  selected = null
  profile = { user_id: ID, full_name: "Awa Kouassi", role: "student", closed_at: null, rating: 0, missions_done: 0 }
  createClient.mockResolvedValue(makeSupabase())
})

describe("/talents/[id] et compte fermé", () => {
  it("un profil actif s'affiche", async () => {
    await expect(TalentPage({ params: params(), searchParams: Promise.resolve({}) })).resolves.toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it("lit closed_at, jamais select(*)", async () => {
    await TalentPage({ params: params(), searchParams: Promise.resolve({}) })
    expect(selected).toContain("closed_at")
    expect(selected).not.toBe("*")
  })

  it.each([
    ["2026-10-10T08:00:00Z"],
    ["2026-09-01T08:00:00Z"],
  ])("un compte fermé (closed_at %s) répond 404, page et métadonnées", async (closedAt) => {
    profile.closed_at = closedAt
    await expect(TalentPage({ params: params(), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound")
    await expect(generateMetadata({ params: params() })).rejects.toThrow("notFound")
  })

  it("un compte pseudonymisé répond 404", async () => {
    profile.closed_at = "2026-09-01T08:00:00Z"
    profile.full_name = "Compte clôturé"
    await expect(TalentPage({ params: params(), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound")
  })

  it("pas de loading.js à côté de la page", () => {
    expect(existsSync(new URL("./loading.js", import.meta.url))).toBe(false)
  })
})
