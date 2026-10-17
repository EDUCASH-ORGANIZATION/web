import { describe, it, expect, vi, beforeEach } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const listAdminReports = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-reports.actions", () => ({ listAdminReports: (...a) => listAdminReports(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/components/admin-space/reports/reports-view", () => ({
  ReportsView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"

/** Renvoie le contenu chargé : la page rend un Suspense dont l'enfant est le composant de lecture. */
async function load(searchParams) {
  const tree = await Page({ searchParams })
  const child = tree.props.children
  return child.type(child.props)
}

describe("page admin signalements", () => {
  beforeEach(() => {
    requireRole.mockReset()
    listAdminReports.mockReset()
    redirect.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(listAdminReports).not.toHaveBeenCalled()
  })

  it("transmet les paramètres bruts à l'action (elle les valide) et rend la vue avec la réponse", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { tab: "resolus", items: [] }
    listAdminReports.mockResolvedValue(data)
    const hostile = { statut: "<script>", tri: "' or 1=1", page: ["1", "2"] }
    const view = await load(Promise.resolve(hostile))
    expect(listAdminReports).toHaveBeenCalledWith(hostile)
    expect(view.props).toEqual({ data, error: undefined })
  })

  it("table indisponible : la vue reçoit la réponse telle quelle pour afficher l'état indisponible", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const data = { unavailable: true, message: "Les signalements ne sont pas disponibles pour le moment.", items: [] }
    listAdminReports.mockResolvedValue(data)
    const view = await load(Promise.resolve({}))
    expect(view.props.data).toBe(data)
  })

  it("une erreur de lecture est rendue comme erreur, pas comme liste vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminReports.mockResolvedValue({ error: "Les signalements n'ont pas pu être chargés. Réessayez dans un instant." })
    const view = await load(Promise.resolve({}))
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargés/)
  })

  it("la clé du Suspense change avec le filtre de type pour réafficher le squelette", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const keyFor = async (params) => (await Page({ searchParams: Promise.resolve(params) })).key
    const all = await keyFor({ statut: "resolus" })
    const purchases = await keyFor({ statut: "resolus", type: "demande-paiement-achats" })
    const messages = await keyFor({ statut: "resolus", type: "messages" })
    expect(new Set([all, purchases, messages]).size).toBe(3)
    expect(purchases).toContain("demande-paiement-achats")
  })

  it("sans paramètres d'URL, l'action reçoit un objet vide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    listAdminReports.mockResolvedValue({ items: [] })
    await load(undefined)
    expect(listAdminReports).toHaveBeenCalledWith({})
  })

  it("la page n'importe aucun module Supabase ni le client service, porte le marqueur, et aucun loading.js sous reports", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
    expect(source).toContain("@ds-screen RD-ADMIN-01")
    expect(existsSync(path.join(import.meta.dirname, "loading.js"))).toBe(false)
    expect(existsSync(path.join(import.meta.dirname, "[id]", "loading.js"))).toBe(false)
    expect(existsSync(path.join(import.meta.dirname, "..", "loading.js"))).toBe(false)
  })
})
