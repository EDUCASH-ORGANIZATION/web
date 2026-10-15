import { describe, it, expect, vi, beforeEach } from "vitest"

const requireRole = vi.fn()
const listAdminUsers = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-users.actions", () => ({
  listAdminUsers: (...a) => listAdminUsers(...a),
  suspendAccount: vi.fn(),
  reactivateAccount: vi.fn(),
}))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/users/users-view", () => ({
  UsersView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

describe("page admin users", () => {
  beforeEach(() => {
    requireRole.mockReset()
    listAdminUsers.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(listAdminUsers).not.toHaveBeenCalled()
  })

  it("transmet les paramètres bruts à l'action (elle les valide) et rend la vue avec la réponse", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { rows: [], total: 0 }
    listAdminUsers.mockResolvedValue(data)
    const hostile = { q: "%' or 1=1 --", role: "root", page: "-1", verif: ["a", "b"] }
    const view = await Page({ searchParams: Promise.resolve(hostile) })
    expect(listAdminUsers).toHaveBeenCalledWith(hostile)
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("rend une erreur de lecture comme une erreur, pas comme une liste vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminUsers.mockResolvedValue({ error: "Les comptes n'ont pas pu être chargés. Réessayez dans un instant." })
    const view = await Page({ searchParams: Promise.resolve({}) })
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargés/)
  })

  it("sans paramètres d'URL, l'action reçoit un objet vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminUsers.mockResolvedValue({ rows: [] })
    await Page({ searchParams: undefined })
    expect(listAdminUsers).toHaveBeenCalledWith({})
  })
})
