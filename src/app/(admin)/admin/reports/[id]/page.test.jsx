import { describe, it, expect, vi, beforeEach } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const requireRole = vi.fn()
const getAdminReport = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND")
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-reports.actions", () => ({ getAdminReport: (...a) => getAdminReport(...a) }))
vi.mock("next/navigation", () => ({
  redirect: (...a) => redirect(...a),
  notFound: (...a) => notFound(...a),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("@/components/admin-space/reports/report-detail-view", () => ({
  ReportDetailView: (props) => ({ marker: "view", props }),
}))

import Page from "./page.js"
import ReportNotFound from "./not-found.js"

const ID = "20000000-0000-4000-8000-000000000001"

describe("page admin détail signalement", () => {
  beforeEach(() => {
    requireRole.mockReset()
    getAdminReport.mockReset()
    redirect.mockClear()
    notFound.mockClear()
  })

  it("redirige sans lire de données si requireRole refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(getAdminReport).not.toHaveBeenCalled()
  })

  it("répond 404 pour un identifiant inconnu ou invalide", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminReport.mockResolvedValue({ notFound: true })
    await expect(Page({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow("NOT_FOUND")
    expect(getAdminReport).toHaveBeenCalledWith("abc")
  })

  it("rend la vue avec le détail", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    const detail = { report: { id: ID }, message: null, events: null }
    getAdminReport.mockResolvedValue(detail)
    const view = await Page({ params: Promise.resolve({ id: ID }) })
    expect(view.props).toEqual({ data: detail, error: undefined })
  })

  it("table indisponible : pas de 404, la vue affiche l'état indisponible", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminReport.mockResolvedValue({ unavailable: true, message: "Indisponible." })
    const view = await Page({ params: Promise.resolve({ id: ID }) })
    expect(notFound).not.toHaveBeenCalled()
    expect(view.props.data).toEqual({ unavailable: true, message: "Indisponible." })
  })

  it("une erreur de lecture est rendue comme erreur, pas comme 404", async () => {
    requireRole.mockResolvedValue({ user: { id: "a" } })
    getAdminReport.mockResolvedValue({ error: "Les signalements n'ont pas pu être chargés." })
    const view = await Page({ params: Promise.resolve({ id: ID }) })
    expect(notFound).not.toHaveBeenCalled()
    expect(view.props.data).toBeNull()
    expect(view.props.error).toMatch(/pas pu être chargés/)
  })

  it("pas de loading.js sous un segment qui appelle notFound, aucun module Supabase, marqueurs présents", () => {
    const dir = import.meta.dirname
    for (const p of [path.join(dir, "loading.js"), path.join(dir, "..", "loading.js"), path.join(dir, "..", "..", "loading.js")]) {
      expect(existsSync(p)).toBe(false)
    }
    const source = readFileSync(path.join(dir, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient/)
    for (const file of ["page.js", "not-found.js"]) {
      expect(readFileSync(path.join(dir, file), "utf8")).toContain("@ds-screen RD-ADMIN-01")
    }
  })

  it("la page 404 propose le retour à la liste", () => {
    const tree = ReportNotFound()
    expect(JSON.stringify(tree)).toContain("/admin/reports")
  })
})
