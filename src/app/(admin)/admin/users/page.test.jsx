import { describe, it, expect, vi, beforeEach } from "vitest"

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

import Users from "./page.js"

/** Constructeur de requête chaînable et attendable. */
function query(result) {
  const q = {}
  for (const m of ["select", "eq", "order", "range", "limit", "gte", "is", "in"]) q[m] = () => q
  q.then = (resolve) => resolve(result)
  return q
}

describe("page admin users : contrôle de rôle fail-closed", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    redirect.mockClear()
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
  })

  it("users redirige sans lire de données si requireRole refuse", async () => {
    await expect(Users({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("page admin users : lectures via le client service role", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
  })

  it("users lit avec le client service et jamais avec la session", async () => {
    const session = { from: vi.fn(() => { throw new Error("lecture avec la session interdite") }) }
    requireRole.mockResolvedValue({ supabase: session, user: { id: "a" }, role: "admin", profile: {} })
    const ranges = []
    const service = {
      from: () => {
        const q = query({ data: [], error: null, count: 0 })
        const range = q.range
        q.range = (...a) => { ranges.push(a); return range() }
        return q
      },
      auth: { admin: { getUserById: async () => ({ data: null }) } },
    }
    createServiceClient.mockReturnValue(service)
    await Users({ searchParams: Promise.resolve({ page: "abc" }) })
    expect(session.from).not.toHaveBeenCalled()
    for (const r of ranges) expect(r[0]).toBe(0)
  })
})
