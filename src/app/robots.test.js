import { describe, it, expect, afterEach } from "vitest"
import { vi } from "vitest"
import robots from "./robots.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("robots", () => {
  it("mode normal : règles et sitemap inchangés", () => {
    const result = robots()
    expect(result.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }])
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it("drapeau invalide : mode normal", () => {
    const normal = robots()
    vi.stubEnv("SITE_WAITING_MODE", "TRUE")
    expect(robots()).toEqual(normal)
    expect(normal.sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it("mode attente : Disallow / et aucun sitemap", () => {
    vi.stubEnv("SITE_WAITING_MODE", "true")
    const result = robots()
    expect(result).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] })
    expect(result.sitemap).toBeUndefined()
  })
})
