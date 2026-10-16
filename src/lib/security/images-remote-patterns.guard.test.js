import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const config = readFileSync(resolve(__dirname, "../../../next.config.mjs"), "utf8")

describe("next.config.mjs : images.remotePatterns", () => {
  it("n'autorise aucun joker d'hôte", () => {
    expect(config).not.toMatch(/hostname:\s*"\*/)
    expect(config).not.toContain("*.supabase.co")
  })

  it("autorise uniquement l'hôte exact du projet Supabase, en stockage public et signé", () => {
    const host = "ymdtwtlnenxpfnxdipek.supabase.co"
    expect(config.match(new RegExp(`hostname: "${host.replace(/\./g, "\\.")}"`, "g"))).toHaveLength(2)
    expect(config).toContain('pathname: "/storage/v1/object/public/**"')
    expect(config).toContain('pathname: "/storage/v1/object/sign/**"')
  })

  it("ne lit aucune variable d'environnement dans remotePatterns", () => {
    const block = config.slice(config.indexOf("remotePatterns"))
    expect(block).not.toMatch(/process\.env/)
  })
})
