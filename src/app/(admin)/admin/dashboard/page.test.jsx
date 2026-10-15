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

import Dashboard from "./page.js"

describe("page admin dashboard : contrôle de rôle fail-closed", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    redirect.mockClear()
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
  })

  it("dashboard redirige sans lire de données si requireRole refuse", async () => {
    await expect(Dashboard()).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
