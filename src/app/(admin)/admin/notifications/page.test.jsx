import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const getList = vi.fn()
const markOne = vi.fn()
const markEvery = vi.fn()
const requireRole = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/admin-notifications.actions", () => ({
  getAdminNotifications: (...a) => getList(...a),
  markAdminNotificationRead: (...a) => markOne(...a),
  markAllAdminNotificationsRead: (...a) => markEvery(...a),
}))
vi.mock("next/navigation", () => ({
  redirect: (url) => {
    throw new Error(`REDIRECT:${url}`)
  },
  useRouter: () => ({ refresh: vi.fn() }),
}))

import Page from "./page.js"

const DATA = { items: [{ id: "n1", type: "card_submitted", title: "T", body: "", mission_id: null, actor_id: null, read_at: null, created_at: "2026-10-15T10:00:00Z" }], nextCursor: null, unreadCount: 1 }

describe("page admin notifications", () => {
  beforeEach(() => {
    getList.mockReset()
    requireRole.mockReset()
    requireRole.mockResolvedValue({ user: { id: "a" }, profile: {} })
  })

  it("porte le marqueur de l'espace en première ligne", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source.split("\n")[0]).toBe("// @ds-screen RD-ADMIN-01")
  })

  it("lit les notifications de l'appelant et passe données et actions à la vue", async () => {
    getList.mockResolvedValue(DATA)
    const tree = await Page({ searchParams: Promise.resolve({}) })
    expect(getList).toHaveBeenCalledWith({ filtre: undefined })
    expect(tree.props).toMatchObject({ space: "admin", filter: "all", initial: DATA })
    expect(tree.props.actions).toEqual({ list: expect.any(Function), markRead: expect.any(Function), markAll: expect.any(Function) })
    expect(Number.isNaN(Date.parse(tree.props.nowIso))).toBe(false)
  })

  it("?filtre=non-lues : un filtre, aucune écriture", async () => {
    getList.mockResolvedValue(DATA)
    const tree = await Page({ searchParams: Promise.resolve({ filtre: "non-lues" }) })
    expect(getList).toHaveBeenCalledWith({ filtre: "non-lues" })
    expect(tree.props.filter).toBe("unread")
    expect(markOne).not.toHaveBeenCalled()
    expect(markEvery).not.toHaveBeenCalled()
  })

  it("valeur de filtre hostile : liste complète", async () => {
    getList.mockResolvedValue(DATA)
    const tree = await Page({ searchParams: Promise.resolve({ filtre: "<script>" }) })
    expect(getList).toHaveBeenCalledWith({ filtre: undefined })
    expect(tree.props.filter).toBe("all")
  })

  it("lecture impossible (table absente) : la vue reçoit initial null, jamais une liste vide", async () => {
    getList.mockResolvedValue({ error: "Les notifications sont momentanément indisponibles.", unavailable: true })
    const tree = await Page({ searchParams: Promise.resolve({}) })
    expect(tree.props.initial).toBeNull()
  })

  it("aucun accès direct aux données ni au client service", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source).not.toMatch(/supabase|createServiceClient|className|dangerouslySetInnerHTML/)
  })

  it("redirige sans lire de données si le contrôle admin refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(getList).not.toHaveBeenCalled()
  })
})
