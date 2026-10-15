import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const getAdminDashboard = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-dashboard.actions", () => ({ getAdminDashboard: (...a) => getAdminDashboard(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/dashboard/admin-dashboard-view", () => ({
  AdminDashboardView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

describe("page admin dashboard", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getAdminDashboard.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page()).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(getAdminDashboard).not.toHaveBeenCalled()
  })

  it("rend la vue avec la réponse de l'action et le prénom de l'administrateur", async () => {
    const data = { now: "2026-10-15T10:00:00Z", today: "2026-10-15" }
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: { full_name: "  Mawuli  Agbodjan " } })
    getAdminDashboard.mockResolvedValue(data)
    const view = await Page()
    expect(view.props).toEqual({ data, error: undefined, firstName: "Mawuli" })
  })

  it("une erreur de l'action est rendue comme erreur, jamais comme tableau vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: { full_name: "Mawuli" } })
    getAdminDashboard.mockResolvedValue({ error: "Le service est momentanément indisponible. Réessayez dans un instant." })
    const view = await Page()
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/indisponible/)
  })

  it("nom absent : prénom vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: null })
    getAdminDashboard.mockResolvedValue({})
    expect((await Page()).props.firstName).toBe("")
  })

  it("la page n'importe aucun module Supabase ni ne cite le client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
  })
})
