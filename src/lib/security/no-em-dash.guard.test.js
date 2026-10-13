import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou RD-SEC-01 : aucun tiret cadratin (U+2014) dans src/.
// Le motif est écrit en échappement unicode pour que ce fichier ne contienne jamais le caractère.

const ROOT = process.cwd()
const EM_DASH = new RegExp(String.fromCharCode(0x2014))

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe("aucun tiret cadratin dans src", () => {
  it("les fichiers hors exceptions n'en contiennent pas", () => {
    const hits = walk(path.join(ROOT, "src"))
      .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
      .filter((rel) => /\.(js|jsx|css|json|md)$/.test(rel))
      .filter((rel) => EM_DASH.test(readFileSync(path.join(ROOT, rel), "utf8")))
    expect(hits).toEqual([])
  })
})
