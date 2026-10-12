import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const dir = path.join(import.meta.dirname)
const read = (name) => readFileSync(path.join(dir, name), "utf8")
const tokens = read("tokens.css")
const components = read("components.css")
const layouts = read("layouts.css")
const all = { "tokens.css": tokens, "components.css": components, "layouts.css": layouts }

// Règles CSS à plat : [sélecteur, déclarations]
const rules = (css) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(^|[}\s])([^{}@][^{}]*)\{([^{}]*)\}/g)].map((m) => [m[2].trim(), m[3]])

describe("typographie DejaVu Sans du design system", () => {
  it("--f-display et --f-text pointent sur --font-dejavu, repli Arial puis sans-serif", () => {
    const re = (n) => new RegExp(`--${n}:\\s*var\\(--font-dejavu\\),\\s*Arial,\\s*sans-serif;`)
    expect(tokens).toMatch(re("f-display"))
    expect(tokens).toMatch(re("f-text"))
  })

  it("aucune mention des anciennes polices dans src/app/design", () => {
    for (const [name, css] of Object.entries(all)) {
      expect(css, name).not.toMatch(/Anton|Figtree|--font-anton|--font-figtree|--font-inter/)
    }
  })

  it("les poids des tokens sont limités à 400 et 700, poids display 700", () => {
    const fw = [...tokens.matchAll(/--fw-[a-z]+:\s*(\d+)/g)].map((m) => m[1])
    expect(fw.length).toBeGreaterThan(5)
    for (const w of fw) expect(["400", "700"]).toContain(w)
    expect(tokens).toMatch(/--fw-display:\s*700/)
    for (const [name, css] of Object.entries(all)) {
      const weights = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => m[1])
      for (const w of weights) expect(["400", "700"], name).toContain(w)
    }
  })

  it("toute règle en var(--f-display) utilise var(--fw-display)", () => {
    for (const css of [components, layouts]) {
      for (const [sel, decl] of rules(css)) {
        if (decl.includes("font-family: var(--f-display)")) {
          expect(decl, sel).toMatch(/font-weight:\s*var\(--fw-display\)/)
        }
      }
    }
  })

  it("aucun text-transform: uppercase sur les titres et textes longs", () => {
    const interdits = [".display", ".block-title", ".hello__title", ".v04-name", ".v07-group h3", ".site-menu__links a", ".site-footer__pitch", ".v-cat--big .v-cat__name"]
    for (const css of [components, layouts]) {
      for (const [sel, decl] of rules(css)) {
        if (!/text-transform:\s*uppercase/.test(decl)) continue
        for (const i of interdits) expect(sel.split(",").map((s) => s.trim()), sel).not.toContain(i)
      }
    }
  })

  it("l'échelle display est réduite pour une police large", () => {
    expect(tokens).toMatch(/--t-display-xxl:\s*80px/)
    expect(tokens).toMatch(/--t-display-xl:\s*64px/)
    expect(tokens).toMatch(/--t-display-l:\s*48px/)
    expect(tokens).toMatch(/--t-display-m:\s*40px/)
    expect(tokens).toMatch(/--t-display-s:\s*24px/)
  })
})
