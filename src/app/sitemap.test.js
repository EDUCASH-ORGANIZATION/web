import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const limit = vi.fn()

const createClient = vi.fn(() => ({
  from: () => ({
    select: () => ({ eq: () => ({ or: () => ({ limit }) }) }),
  }),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args) => createClient(...args),
}))

import sitemap from "./sitemap.js"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj"

afterEach(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  limit.mockReset()
  createClient.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("sitemap", () => {
  it("liste /etudiants et plus /clients, avec les missions ouvertes", async () => {
    limit.mockResolvedValue({
      data: [{ id: "m1", updated_at: "2026-10-01T00:00:00Z" }],
      error: null,
    })
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).not.toContain(`${APP_URL}/clients`)
    expect(urls).toContain(`${APP_URL}/etudiants`)
    expect(urls).toContain(`${APP_URL}/missions/m1`)
    const etudiants = entries.find((e) => e.url === `${APP_URL}/etudiants`)
    expect(etudiants.changeFrequency).toBe("monthly")
    expect(etudiants.priority).toBe(0.8)
  })

  it("garde les routes statiques si Supabase échoue", async () => {
    limit.mockResolvedValue({ data: null, error: new Error("down") })
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toContain(APP_URL)
    expect(urls).toContain(`${APP_URL}/etudiants`)
    expect(urls).not.toContain(`${APP_URL}/clients`)
    expect(urls.some((u) => u.includes("/missions/"))).toBe(false)
  })

  it("mode attente : liste vide sans appel Supabase", async () => {
    vi.stubEnv("SITE_WAITING_MODE", "true")
    expect(await sitemap()).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
    expect(limit).not.toHaveBeenCalled()
  })
})
