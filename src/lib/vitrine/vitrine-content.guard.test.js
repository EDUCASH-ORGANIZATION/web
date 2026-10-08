import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const DIRS = ["src/components/vitrine", "src/app/legal", "src/app/about", "src/app/contact", "src/app/(home)", "src/app/(public)", "src/app/(mission-detail)"]
// auth-shell.jsx est preexistant et hors perimetre de ce lot.
const SKIP = new Set(["src/components/vitrine/auth-shell.jsx"])

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
})
