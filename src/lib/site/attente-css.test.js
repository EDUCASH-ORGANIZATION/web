import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const css = readFileSync(join(root, "public/attente.css"), "utf8")
const tokens = readFileSync(join(root, "src/app/design/tokens.css"), "utf8")

function rootBlock(source) {
  const match = source.match(/:root\s*\{([^}]*)\}/)
  return match ? match[1] : ""
}

describe("public/attente.css", () => {
  const block = rootBlock(css)
  const redefined = [...block.matchAll(/(--c-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)]

  it("redéfinit les quatre tokens de marque", () => {
    expect(redefined.map((m) => m[1]).sort()).toEqual(["--c-bleu", "--c-blanc", "--c-citron", "--c-encre"].sort())
  })

  it("garde les valeurs de tokens.css", () => {
    for (const [, name, value] of redefined) {
      const re = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`)
      const official = tokens.match(re)
      expect(official, name).not.toBeNull()
      expect(value.toUpperCase(), name).toBe(official[1].toUpperCase())
    }
  })

  it("n'utilise aucune couleur en dur hors du bloc :root", () => {
    const rest = css.replace(/:root\s*\{[^}]*\}/, "")
    expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rest).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })

  it("n'a pas de tiret cadratin", () => {
    expect(css).not.toContain("—")
  })
})
