import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { SPRITE_VERSION } from "./sprite"

const svg = readFileSync(join(process.cwd(), "public", "sprite.svg"), "utf8")
const ids = [...svg.matchAll(/<symbol[^>]*\sid="([^"]+)"/g)].map((m) => m[1])

describe("sprite.svg", () => {
  it("conserve 117 symboles aux id uniques", () => {
    expect(ids).toHaveLength(117)
    expect(new Set(ids).size).toBe(117)
  })

  it("contient les symboles de marque recolorés", () => {
    for (const id of ["seal", "seal-citron", "roundel", "av-1", "av-2", "av-3", "av-4", "av-5", "av-6"]) {
      expect(ids).toContain(id)
    }
  })

  it("ne contient plus l'ancienne palette Direction A", () => {
    expect(svg).not.toMatch(/#2F3BED|#C8F03C|#0E0F1A/i)
  })

  it("utilise la palette de la charte", () => {
    expect(svg).toMatch(/#1028F0/i)
    expect(svg).toMatch(/#C1EE3E/i)
    expect(svg).toMatch(/#17213A/i)
  })

  it("SPRITE_VERSION est le préfixe SHA-256 du sprite et a changé", () => {
    const hash = createHash("sha256").update(readFileSync(join(process.cwd(), "public", "sprite.svg"))).digest("hex")
    expect(SPRITE_VERSION).toBe(hash.slice(0, 8))
    expect(SPRITE_VERSION).not.toBe("262d9eb4")
  })
})
