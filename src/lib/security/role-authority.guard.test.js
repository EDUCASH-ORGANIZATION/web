import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou RD-SEC-01 : aucune autorisation ne lit user_metadata.
// user_metadata est modifiable par l'utilisateur : il reste permis pour l'affichage côté navigateur
// (hooks, composants), pas dans le middleware, les layouts étudiant et client ni les server actions.

const ROOT = process.cwd()

// Seul server-role.js lit user_metadata dans du code : repli limité à student et client, jamais admin.
const ALLOWED_CODE = ["src/lib/auth/server-role.js"]

const FIXED_FILES = ["middleware.js", "src/app/(student)/layout.js", "src/app/(client)/layout.js"]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** Retire les commentaires : un commentaire qui explique pourquoi on ne lit pas user_metadata est permis. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
}

function readsUserMetadata(source) {
  return /user_metadata/.test(stripComments(source))
}

function guardedFiles() {
  const actions = walk(path.join(ROOT, "src/lib/actions")).filter(
    (f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f)
  )
  return [...FIXED_FILES.map((f) => path.join(ROOT, f)), ...actions]
}

describe("garde-fou role-authority", () => {
  it("détecte une lecture de user_metadata hors commentaire (fixtures en mémoire)", () => {
    expect(readsUserMetadata('const r = user.user_metadata?.role')).toBe(true)
    expect(readsUserMetadata('const { user_metadata } = user')).toBe(true)
    expect(readsUserMetadata("// user_metadata n'est jamais lu ici\nconst a = 1")).toBe(false)
    expect(readsUserMetadata("/** user_metadata.client_type */\nconst a = 1")).toBe(false)
  })

  it("surveille bien le middleware, les deux layouts et les server actions", () => {
    const files = guardedFiles().map((f) => path.relative(ROOT, f))
    expect(files).toEqual(expect.arrayContaining([...FIXED_FILES, "src/lib/actions/auth.actions.js"]))
  })

  it("aucun user_metadata dans le code du middleware, des layouts et des actions", () => {
    const offenders = guardedFiles()
      .map((f) => path.relative(ROOT, f))
      .filter((rel) => !ALLOWED_CODE.includes(rel))
      .filter((rel) => readsUserMetadata(readFileSync(path.join(ROOT, rel), "utf8")))
    expect(offenders).toEqual([])
  })

  it("le repli de server-role.js reste limité à student et client", () => {
    const source = readFileSync(path.join(ROOT, ALLOWED_CODE[0]), "utf8")
    expect(source).toMatch(/FALLBACK_ROLES\s*=\s*\["student",\s*"client"\]/)
  })

  it("les hooks n'appellent plus signOut côté navigateur", () => {
    for (const rel of ["src/hooks/use-auth.js", "src/hooks/use-vitrine-session.js"]) {
      expect(readFileSync(path.join(ROOT, rel), "utf8")).not.toMatch(/auth\.signOut/)
    }
  })
})
