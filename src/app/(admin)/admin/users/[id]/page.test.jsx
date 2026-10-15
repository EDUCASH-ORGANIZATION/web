import { describe, it, expect, vi, beforeEach } from "vitest"

const requireRole = vi.fn()
const getAdminUserDetail = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND")
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-users.actions", () => ({
  getAdminUserDetail: (...a) => getAdminUserDetail(...a),
  suspendAccount: vi.fn(),
  reactivateAccount: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  redirect: (...a) => redirect(...a),
  notFound: (...a) => notFound(...a),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("@/components/admin-space/users/user-detail-view", () => ({
  UserDetailView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

const ID = "00000000-0000-4000-8000-000000000001"

describe("page admin fiche utilisateur", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getAdminUserDetail.mockReset()
    redirect.mockClear()
    notFound.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/auth/login",
    )
    expect(getAdminUserDetail).not.toHaveBeenCalled()
  })

  it("répond 404 pour un compte inconnu ou un identifiant invalide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminUserDetail.mockResolvedValue({ notFound: true })
    for (const id of [ID, "abc", "1 or 1=1"]) {
      await expect(Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND")
    }
    expect(notFound).toHaveBeenCalledTimes(3)
  })

  it("transmet l'identifiant et l'onglet bruts à l'action et rend la vue", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { user: { userId: ID } }
    getAdminUserDetail.mockResolvedValue(data)
    const view = await Page({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({ onglet: "missions" }) })
    expect(getAdminUserDetail).toHaveBeenCalledWith(ID, { onglet: "missions" })
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("rend une erreur de lecture sans répondre 404", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminUserDetail.mockResolvedValue({ error: "Les comptes n'ont pas pu être chargés." })
    const view = await Page({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({}) })
    expect(notFound).not.toHaveBeenCalled()
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargés/)
  })

  it("aucun loading.js sous users/ (le statut 404 serait perdu)", async () => {
    const { existsSync } = await import("node:fs")
    const path = await import("node:path")
    const dir = path.join(process.cwd(), "src/app/(admin)/admin/users")
    expect(existsSync(path.join(dir, "loading.js"))).toBe(false)
    expect(existsSync(path.join(dir, "[id]", "loading.js"))).toBe(false)
  })
})
