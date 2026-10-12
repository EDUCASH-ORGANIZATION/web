import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { resolve, join } from "node:path"

const appDir = resolve(__dirname, "..")
const read = (p) => readFileSync(resolve(appDir, p), "utf8")

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe("polices du site (inchangees : Anton, Figtree, Inter)", () => {
  const layout = read("layout.js")
  it("layout.js charge Anton, Figtree et Inter via next/font/google", () => {
    expect(layout).toMatch(/import \{ Anton, Figtree, Inter \} from "next\/font\/google"/)
    expect(layout).toContain('variable: "--font-anton"')
    expect(layout).toContain('variable: "--font-figtree"')
    expect(layout).toContain('variable: "--font-inter"')
    expect(layout).toContain("${anton.variable} ${figtree.variable} ${inter.variable}")
    expect(layout).toContain("font-[family-name:var(--font-inter)]")
  })

  it("les tokens pointent sur Anton (titres) et Figtree (texte)", () => {
    const tokens = read("design/tokens.css")
    expect(tokens).toMatch(/--f-display:\s*var\(--font-anton\)/)
    expect(tokens).toMatch(/--f-text:\s*var\(--font-figtree\)/)
  })

  it("aucun DejaVu dans src/app hors commentaire et hors ce test", () => {
    const files = walk(appDir).filter((f) => /\.(js|jsx|css)$/.test(f) && !f.endsWith(".test.js"))
    for (const f of files) {
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
      expect(code, f).not.toMatch(/dejavu/i)
    }
    expect(existsFontsDir()).toBe(false)
  })
})

function existsFontsDir() {
  try {
    return statSync(resolve(appDir, "fonts")).isDirectory()
  } catch {
    return false
  }
}
