import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const getAdminMissionDetail = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND")
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-mission-detail.actions", () => ({
  getAdminMissionDetail: (...a) => getAdminMissionDetail(...a),
}))
vi.mock("next/navigation", () => ({
  redirect: (...a) => redirect(...a),
  notFound: (...a) => notFound(...a),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("@/components/admin-space/mission-detail/mission-detail-view", () => ({
  MissionDetailView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

const ID = "10000000-0000-4000-8000-000000000001"

describe("page admin détail mission", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getAdminMissionDetail.mockReset()
    redirect.mockClear()
    notFound.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(getAdminMissionDetail).not.toHaveBeenCalled()
  })

  it("répond 404 pour un identifiant inconnu ou invalide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminMissionDetail.mockResolvedValue({ notFound: true })
    await expect(Page({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow("NOT_FOUND")
    expect(getAdminMissionDetail).toHaveBeenCalledWith("abc")
  })

  it("rend la vue avec le détail", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const detail = { mission: { id: ID } }
    getAdminMissionDetail.mockResolvedValue(detail)
    const view = await Page({ params: Promise.resolve({ id: ID }) })
    expect(view.props).toEqual({ data: detail, error: undefined })
  })

  it("une erreur de lecture est rendue comme erreur, pas comme 404", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminMissionDetail.mockResolvedValue({ error: "Cette mission n'a pas pu être chargée." })
    const view = await Page({ params: Promise.resolve({ id: ID }) })
    expect(notFound).not.toHaveBeenCalled()
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargée/)
  })

  it("pas de loading.js sous missions (le segment appelle notFound) et aucun module Supabase dans la page", () => {
    const dir = path.join(import.meta.dirname, "..")
    expect(() => readFileSync(path.join(dir, "loading.js"))).toThrow()
    expect(() => readFileSync(path.join(import.meta.dirname, "loading.js"))).toThrow()
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
  })
})
