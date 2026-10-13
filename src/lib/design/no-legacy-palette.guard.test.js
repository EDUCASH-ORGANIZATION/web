import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { EXEMPT_GREEN, GREEN_MODULES } from "./legacy-green/index.js"

// Garde-fou de palette (partie Vitest de RD-BRAND-01 ST-07).
// Bloc 1 : l'ancienne palette Direction A est interdite partout dans src/ et public/.
// Bloc 2 : la famille verte historique (#1A6B4A...) reste tolérée uniquement dans
// les modules de src/lib/design/legacy-green/ (union EXEMPT_GREEN ; espaces connectés, gabarits wallet de
// RD-SEC-01, vitrine du lot B...). La liste ne peut que diminuer : un nouveau
// fichier vert fait échouer le test, et une entrée devenue inutile aussi.

const ROOTS = ["src", "public"]
const EXT = /\.(svg|css|js|jsx|mjs)$/
const SKIP_DIRS = new Set(["node_modules", ".next"])

// Tests de garde qui citent les motifs interdits dans leurs propres expressions.
const SELF_REFERENCING = [
  "src/app/design/brand-tokens.test.js",
  "src/components/design/sprite.test.js",
  "src/lib/design/brand-assets.test.js",
  "src/lib/design/no-legacy-palette.guard.test.js",
  "src/lib/email/email-brand.guard.test.js",
  "src/lib/email/email-render.qa.test.jsx",
]


const LEGACY_A = /#2F3BED|#C8F03C|#0E0F1A|rgba\(\s*14\s*,\s*15\s*,\s*26\b|rgba\(\s*47\s*,\s*59\s*,\s*237\b|rgba\(\s*200\s*,\s*240\s*,\s*60\b/i
const LEGACY_GREEN = /#1A6B4A|#155a3d|#104530|#f0faf5|#E8F5EE|#d9f2e8/i

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (EXT.test(name)) acc.push(p.split("\\").join("/"))
  }
  return acc
}

const FILES = ROOTS.flatMap((r) => walk(r))
const scanned = FILES.filter((f) => !SELF_REFERENCING.includes(f))

describe("garde-fou de palette", () => {
  it("scanne des fichiers src/ et public/", () => {
    expect(FILES.length).toBeGreaterThan(100)
    expect(FILES).toContain("public/logo.svg")
  })

  it("les fichiers auto-référents existent encore", () => {
    for (const f of SELF_REFERENCING) expect(FILES, f).toContain(f)
  })

  it("aucune trace de l'ancienne palette Direction A (hex et rgba)", () => {
    const hits = scanned.filter((f) => LEGACY_A.test(readFileSync(f, "utf8")))
    expect(hits).toEqual([])
  })

  it("la famille verte historique n'apparait que dans les fichiers exemptés", () => {
    const hits = scanned.filter((f) => LEGACY_GREEN.test(readFileSync(f, "utf8")))
    expect(hits.filter((f) => !EXEMPT_GREEN.includes(f))).toEqual([])
  })

  it("chaque exemption est encore utile (la liste ne peut que diminuer)", () => {
    const stale = EXEMPT_GREEN.filter(
      (f) => !FILES.includes(f) || !LEGACY_GREEN.test(readFileSync(f, "utf8")),
    )
    expect(stale).toEqual([])
  })

  it("aucun doublon entre les modules d'exemption", () => {
    const all = Object.values(GREEN_MODULES).flat()
    expect(all.filter((f, i) => all.indexOf(f) !== i)).toEqual([])
    expect(EXEMPT_GREEN.length).toBeLessThanOrEqual(38)
  })
})
