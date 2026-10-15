import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const getList = vi.fn()
const markOne = vi.fn()
const markEvery = vi.fn()
vi.mock("@/lib/actions/client-notifications.actions", () => ({
  getClientNotifications: (...a) => getList(...a),
  markClientNotificationRead: (...a) => markOne(...a),
  markAllClientNotificationsRead: (...a) => markEvery(...a),
}))
vi.mock("next/navigation", () => ({
  redirect: (url) => {
    throw new Error(`REDIRECT:${url}`)
  },
  useRouter: () => ({ refresh: vi.fn() }),
}))

import Page from "./page.js"

const DATA = { items: [{ id: "n1", type: "application_received", title: "T", body: "", mission_id: null, actor_id: null, read_at: null, created_at: "2026-10-15T10:00:00Z" }], nextCursor: null, unreadCount: 1 }

describe("page client notifications", () => {
  beforeEach(() => {
    getList.mockReset()
  })

  it("porte le marqueur de l'espace en première ligne", () => {
    const source = readFileSync(path.join(import.meta.dirname, "page.js"), "utf8")
    expect(source.split("\n")[0]).toBe("// @ds-screen RD-CLIENT-01")
  })

  it("lit les notifications de l'appelant et passe données et actions à la vue", async () => {
    getList.mockResolvedValue(DATA)
    const tree = await Page({ searchParams: Promise.resolve({}) })
    expect(getList).toHaveBeenCalledWith({ filtre: undefined })
    expect(tree.props).toMatchObject({ space: "client", filter: "all", initial: DATA })
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
})
