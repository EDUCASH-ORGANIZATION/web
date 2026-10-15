import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const getAdminWallets = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-finance.actions", () => ({ getAdminWallets: (...a) => getAdminWallets(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/wallets/wallets-view", () => ({ WalletsView: (props) => ({ marker: "view", props }) }))

import Page from "./page.js"

// Le contenu est un composant asynchrone dans un <Suspense> : on l'appelle directement pour lire ses props.
async function render(searchParams) {
  const tree = await Page({ searchParams: Promise.resolve(searchParams) })
  const content = tree.props.children
  return content.type(content.props)
}

describe("page admin wallets", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getAdminWallets.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(getAdminWallets).not.toHaveBeenCalled()
  })

  it("transmet les paramètres bruts à l'action (validés côté action) et rend la réponse", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: {} })
    const data = { now: "2026-10-15T10:00:00Z", rows: [] }
    getAdminWallets.mockResolvedValue(data)
    const view = await render({ q: "%' or 1=1", page: "-3" })
    expect(getAdminWallets).toHaveBeenCalledWith({ q: "%' or 1=1", page: "-3" })
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("une erreur de l'action est rendue comme erreur, jamais comme liste vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: {} })
    getAdminWallets.mockResolvedValue({ error: "Le service est momentanément indisponible. Réessayez dans un instant." })
    const view = await render({})
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/indisponible/)
  })

  it("la page n'importe aucun module Supabase ni ne cite le client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient|lucide|className/)
  })
})
