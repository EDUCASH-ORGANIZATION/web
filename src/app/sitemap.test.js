import { describe, it, expect, vi, beforeEach } from "vitest"

const limit = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ or: () => ({ limit }) }) }),
    }),
  }),
}))

import sitemap from "./sitemap.js"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj"

beforeEach(() => {
  limit.mockReset()
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
})
