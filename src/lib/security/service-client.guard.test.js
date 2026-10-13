import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou : le client service role (clé SUPABASE_SERVICE_ROLE_KEY) ne doit jamais
// atteindre le navigateur. Il est interdit dans tout module "use client" et sous
// src/components et src/hooks.

const SRC = path.resolve(import.meta.dirname, "../..")
const SERVICE_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["'](?:@\/lib\/supabase\/service|(?:\.{1,2}\/)+[\w./-]*supabase\/service|\.\/service)(?:\.js)?["']/
const USE_CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/

/**
 * @param {Array<{ file: string, source: string }>} files fichiers relatifs à src/
 * @returns {string[]} fichiers fautifs
 */
export function findServiceClientLeaks(files) {
  return files
    .filter(({ file, source }) => {
      if (!SERVICE_IMPORT.test(source)) return false
      const normalized = file.split(path.sep).join("/")
      return (
        USE_CLIENT.test(source) ||
        normalized.startsWith("components/") ||
        normalized.startsWith("hooks/")
      )
    })
    .map(({ file }) => file)
}

const SERVICE_KEY_ALLOWED = ["lib/supabase/service.js"]

/**
 * @param {Array<{ file: string, source: string }>} files fichiers relatifs à src/
 * @returns {string[]} fichiers qui citent la clé service role hors de la liste autorisée
 */
export function findServiceKeyReferences(files) {
  return files
    .filter(({ file, source }) => {
      const normalized = file.split(path.sep).join("/")
      return source.includes("SUPABASE_SERVICE_ROLE_KEY") && !SERVICE_KEY_ALLOWED.includes(normalized)
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

describe("garde-fou client service role", () => {
  it("détecte un module use client qui importe service.js (fixture)", () => {
    const leaks = findServiceClientLeaks([
      { file: "app/foo.js", source: `"use client"\nimport { createServiceClient } from "@/lib/supabase/service"` },
    ])
    expect(leaks).toEqual(["app/foo.js"])
  })

  it("détecte un import relatif ou dynamique sous components et hooks (fixture)", () => {
    const leaks = findServiceClientLeaks([
      { file: "components/a.jsx", source: `import { x } from "../lib/supabase/service.js"` },
      { file: "hooks/use-b.js", source: `const m = await import("@/lib/supabase/service")` },
    ])
    expect(leaks).toEqual(["components/a.jsx", "hooks/use-b.js"])
  })

  it("accepte un import depuis une server action (fixture)", () => {
    const leaks = findServiceClientLeaks([
      { file: "lib/actions/mission.actions.js", source: `"use server"\nimport { createServiceClient } from "@/lib/supabase/service"` },
    ])
    expect(leaks).toEqual([])
  })

  it("aucun module client ni composant ni hook du dépôt n'importe service.js", () => {
    const files = walk(SRC).map((full) => ({
      file: path.relative(SRC, full),
      source: readFileSync(full, "utf8"),
    }))
    expect(findServiceClientLeaks(files)).toEqual([])
  })

  it("détecte la clé service role citée hors de service.js (fixture)", () => {
    const leaks = findServiceKeyReferences([
      { file: "lib/actions/x.js", source: "createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)" },
      { file: "app/api/webhooks/y/route.js", source: "process.env.SUPABASE_SERVICE_ROLE_KEY" },
      { file: "lib/supabase/service.js", source: "process.env.SUPABASE_SERVICE_ROLE_KEY" },
    ])
    expect(leaks).toEqual(["lib/actions/x.js", "app/api/webhooks/y/route.js"])
  })

  it("seul lib/supabase/service.js cite SUPABASE_SERVICE_ROLE_KEY", () => {
    const files = walk(SRC).map((full) => ({
      file: path.relative(SRC, full),
      source: readFileSync(full, "utf8"),
    }))
    expect(findServiceKeyReferences(files)).toEqual([])
  })

  it("service.js garde l'import server-only", () => {
    const source = readFileSync(path.join(SRC, "lib/supabase/service.js"), "utf8")
    expect(source).toMatch(/^import "server-only"/m)
  })
})
