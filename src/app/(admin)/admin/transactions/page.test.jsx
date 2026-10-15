import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const listAdminTransactions = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-finance.actions", () => ({ listAdminTransactions: (...a) => listAdminTransactions(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/finance/transactions-view", () => ({ TransactionsView: (props) => ({ marker: "view", props }) }))

import Page from "./page.js"

// Le contenu est un composant asynchrone dans un <Suspense> : on l'appelle directement pour lire ses props.
async function render(searchParams) {
  const tree = await Page({ searchParams: Promise.resolve(searchParams) })
  const content = tree.props.children
  return content.type(content.props)
}

describe("page admin transactions", () => {
  beforeEach(() => {
    requireRole.mockReset()
    listAdminTransactions.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(listAdminTransactions).not.toHaveBeenCalled()
  })

  it("rend la vue avec la réponse de l'action ; paramètres hostiles transmis tels quels (validés par l'action)", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: {} })
    const data = { now: "2026-10-15T10:00:00Z", rows: [] }
    listAdminTransactions.mockResolvedValue(data)
    const view = await render({ q: "' or 1=1 --", type: "x", page: "-1" })
    expect(listAdminTransactions).toHaveBeenCalledWith({ q: "' or 1=1 --", type: "x", page: "-1" })
    expect(view.props.data).toBe(data)
    expect(view.props.error).toBeUndefined()
    expect(view.props.paymentsEnabled).toBe(false)
  })

  it("une erreur de l'action est rendue comme erreur, jamais comme liste vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: {} })
    listAdminTransactions.mockResolvedValue({ error: "Le service est momentanément indisponible. Réessayez dans un instant." })
    const view = await render({})
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/indisponible/)
  })

  it("la page n'importe aucun module Supabase ni ne cite le client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient|lucide|className/)
  })
})
