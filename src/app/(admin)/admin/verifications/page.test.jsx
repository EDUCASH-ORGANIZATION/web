import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const getVerificationQueue = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  getVerificationQueue: (...a) => getVerificationQueue(...a),
  approveStudentCard: vi.fn(),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/verifications/verifications-view", () => ({
  VerificationsView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

/** Renvoie le contenu chargé : la page rend un Suspense dont l'enfant est le composant de lecture. */
async function load(searchParams) {
  const tree = await Page({ searchParams })
  const child = tree.props.children
  return child.type(child.props)
}

describe("page admin verifications", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getVerificationQueue.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(getVerificationQueue).not.toHaveBeenCalled()
  })

  it("transmet les paramètres bruts à l'action (elle les valide) et rend la vue avec la réponse", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { onglet: "a-examiner", rows: [] }
    getVerificationQueue.mockResolvedValue(data)
    const hostile = { onglet: "<script>", id: "' or 1=1", q: "x".repeat(10000), page: ["1", "2"] }
    const view = await load(Promise.resolve(hostile))
    expect(getVerificationQueue).toHaveBeenCalledWith(hostile)
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("une erreur de lecture est rendue comme erreur, pas comme file vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getVerificationQueue.mockResolvedValue({ error: "Les dossiers n'ont pas pu être chargés. Réessayez dans un instant." })
    const view = await load(Promise.resolve({}))
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargés/)
  })

  it("sans paramètres d'URL, l'action reçoit un objet vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getVerificationQueue.mockResolvedValue({ rows: [] })
    await load(undefined)
    expect(getVerificationQueue).toHaveBeenCalledWith({})
  })

  it("la page n'importe aucun module Supabase ni ne cite le client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
  })
})
