import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const listAdminMissions = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-missions.actions", () => ({ listAdminMissions: (...a) => listAdminMissions(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/missions/missions-view", () => ({
  MissionsView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

/** Renvoie le contenu chargé : la page rend un Suspense dont l'enfant est le composant de lecture. */
async function load(searchParams) {
  const tree = await Page({ searchParams })
  const child = tree.props.children
  return child.type(child.props)
}

describe("page admin missions", () => {
  beforeEach(() => {
    requireRole.mockReset()
    listAdminMissions.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(listAdminMissions).not.toHaveBeenCalled()
  })

  it("transmet les paramètres bruts à l'action (elle les valide) et rend la vue avec la réponse", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { statut: "toutes", rows: [] }
    listAdminMissions.mockResolvedValue(data)
    const hostile = { statut: "<script>", q: "x".repeat(10000), ville: "' or 1=1", page: ["1", "2"] }
    const view = await load(Promise.resolve(hostile))
    expect(listAdminMissions).toHaveBeenCalledWith(hostile)
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("une erreur de lecture est rendue comme erreur, pas comme liste vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminMissions.mockResolvedValue({ error: "Les missions n'ont pas pu être chargées. Réessayez dans un instant." })
    const view = await load(Promise.resolve({}))
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargées/)
  })

  it("sans paramètres d'URL, l'action reçoit un objet vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminMissions.mockResolvedValue({ rows: [] })
    await load(undefined)
    expect(listAdminMissions).toHaveBeenCalledWith({})
  })

  it("la page n'importe aucun module Supabase ni ne cite le client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
  })
})
