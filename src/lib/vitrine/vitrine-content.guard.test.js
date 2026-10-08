import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const DIRS = ["src/components/vitrine", "src/app/legal", "src/app/about", "src/app/contact", "src/app/(home)", "src/app/(public)", "src/app/(mission-detail)"]
// Fichiers MUI historiques (auth-shell, stack, theme, provider), preexistants.
const SKIP = new Set(["src/components/vitrine/auth-shell.jsx", "src/components/vitrine/stack.jsx", "src/components/vitrine/theme.js", "src/components/vitrine/vitrine-provider.jsx"])

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, out)
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) && !SKIP.has(rel)) out.push(rel)
  }
  return out
}
const files = DIRS.flatMap((d) => walk(d))
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")

describe("garde-fous de contenu vitrine", () => {
  it("scanne des fichiers", () => expect(files.length).toBeGreaterThan(30))

  it.each([
    ["EduCash SAS", /EduCash SAS/],
    ["Haie Vive", /Haie Vive/],
    ["XX XX", /XX XX/],
    ["tiret cadratin", /—/],
    ["style inline", /style=\{\{/],
    ["@mui", /@mui/],
  ])("aucun %s dans les fichiers vitrine", (_n, re) => {
    const hits = files.filter((f) => re.test(read(f)))
    expect(hits).toEqual([])
  })

  it("les mentions legales portent l'identite BRANDYBEN", () => {
    const src = read("src/components/vitrine/legal/legal-entity.js") + read("src/app/legal/mentions/page.js")
    expect(src).toContain("BRANDYBEN")
    expect(src).toContain("RB/COT/26 A 119853")
    expect(src).toContain("0202212868410")
  })

  it("les CGU contiennent la clause achats", () => {
    const src = read("src/app/legal/terms/page.js")
    expect(src).toMatch(/achats/)
    expect(src).toMatch(/Missions avec achats/)
  })

  it("chaque classe utilisee existe dans le design system", () => {
    const known = new Set()
    const cssDir = path.join(ROOT, "src/app/design")
    for (const f of fs.readdirSync(cssDir).filter((n) => n.endsWith(".css"))) {
      for (const m of fs.readFileSync(path.join(cssDir, f), "utf8").matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) known.add(m[1])
    }
    const allowed = (c) => /^(w|h|max-w)-/.test(c) || ["rounded-full", "object-cover", "sr-only", "focus:not-sr-only", "ds"].includes(c)
    const unknown = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " ")
        for (const c of text.split(/\s+/).filter(Boolean)) {
          // Fragments de gabarits dynamiques (btn--${x}, v06-val--${x}) : non verifiables.
          if (/[$?"]|--$/.test(c)) continue
          if (!known.has(c) && !allowed(c)) unknown.push(`${f}: ${c}`)
        }
      }
    }
    expect([...new Set(unknown)]).toEqual([])
  })

  it("aucune classe generique du design system n'est utilisee en dehors de lui", () => {
    const banned = new Set(["container", "grow", "grid", "table", "h1", "h2", "h3", "h4"])
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        for (const c of (m[1] ?? m[2]).split(/\s+/)) if (banned.has(c)) hits.push(`${f}: ${c}`)
      }
    }
    expect(hits).toEqual([])
  })
})
