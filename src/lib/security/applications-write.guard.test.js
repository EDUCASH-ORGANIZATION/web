import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou : les candidatures s'écrivent uniquement par les server actions
// (src/lib/actions/application.actions.js). Aucun fichier sous src/components ou src/app
// ne doit appeler insert, update, delete ou upsert sur la table `applications`.

const SRC = path.resolve(import.meta.dirname, "../..")
const APPLICATIONS_WRITE = /\.from\(\s*["'`]applications["'`]\s*\)\s*\.(?:insert|update|delete|upsert)\s*\(/

/**
 * @param {Array<{ file: string, source: string }>} files fichiers relatifs à src/
 * @returns {string[]} fichiers fautifs
 */
export function findApplicationsWrites(files) {
  return files
    .filter(({ file, source }) => {
      const normalized = file.split(path.sep).join("/")
      return (normalized.startsWith("components/") || normalized.startsWith("app/")) && APPLICATIONS_WRITE.test(source)
    })
    .map(({ file }) => file)
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [full] : []
  })
}

describe("garde-fou écritures sur applications", () => {
  it("détecte un insert direct, même sur plusieurs lignes (fixture)", () => {
    const leaks = findApplicationsWrites([
      { file: "components/a.js", source: `await supabase.from("applications").insert({ a: 1 })` },
      { file: "app/b/page.js", source: `await supabase\n  .from('applications')\n  .update({ status: "x" })` },
      { file: "app/c/page.js", source: `supabase.from("applications").delete()` },
    ])
    expect(leaks).toEqual(["components/a.js", "app/b/page.js", "app/c/page.js"])
  })

  it("accepte une lecture ou une écriture dans les actions (fixture)", () => {
    const leaks = findApplicationsWrites([
      { file: "components/a.js", source: `supabase.from("applications").select("id")` },
      { file: "lib/actions/application.actions.js", source: `supabase.from("applications").insert({})` },
    ])
    expect(leaks).toEqual([])
  })

  it("aucun composant ni page du dépôt n'écrit directement dans applications", () => {
    const files = walk(SRC).map((full) => ({ file: path.relative(SRC, full), source: readFileSync(full, "utf8") }))
    expect(findApplicationsWrites(files)).toEqual([])
  })
})
