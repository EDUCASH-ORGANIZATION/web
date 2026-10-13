import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou RD-SEC-01 : aucune autorisation ne lit user_metadata.
// user_metadata est modifiable par l'utilisateur : il reste permis pour l'affichage côté navigateur
// (hooks, composants), pas dans le middleware, les layouts étudiant et client ni les server actions.

const ROOT = process.cwd()

// Aucun fichier gardé ne lit user_metadata. Seule exception du code applicatif : l'affichage du nom
// (`user_metadata.full_name`) dans le hook de session de la vitrine.
const ALLOWED_CODE = []
const DISPLAY_ONLY = { "src/hooks/use-vitrine-session.js": "full_name" }

const FIXED_FILES = ["middleware.js", "src/app/(student)/layout.js", "src/app/(client)/layout.js"]

const ADMIN_PAGES = ["dashboard", "verifications", "users", "missions", "wallets"].map(
  (name) => `src/app/(admin)/admin/${name}/page.js`
)

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
  const adminPages = ADMIN_PAGES.map((f) => path.join(ROOT, f))
  return [...adminPages, ...FIXED_FILES.map((f) => path.join(ROOT, f)), ...actions]
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

  it("surveille les 5 pages admin", () => {
    const files = guardedFiles().map((f) => path.relative(ROOT, f))
    expect(files).toEqual(expect.arrayContaining(ADMIN_PAGES))
  })

  it("chaque page admin passe par requireRole(['admin']) avant toute lecture", () => {
    for (const rel of ADMIN_PAGES) {
      const source = readFileSync(path.join(ROOT, rel), "utf8")
      expect(source, rel).toMatch(/requireRole\(\["admin"\]\)/)
      expect(source, rel).not.toMatch(/getServerRole/)
    }
  })

  it("aucun user_metadata dans le code du middleware, des layouts et des actions", () => {
    const offenders = guardedFiles()
      .map((f) => path.relative(ROOT, f))
      .filter((rel) => !ALLOWED_CODE.includes(rel))
      .filter((rel) => readsUserMetadata(readFileSync(path.join(ROOT, rel), "utf8")))
    expect(offenders).toEqual([])
  })

  it("server-role.js ne lit jamais user_metadata (aucun repli sans profil)", () => {
    const source = readFileSync(path.join(ROOT, "src/lib/auth/server-role.js"), "utf8")
    expect(readsUserMetadata(source)).toBe(false)
    expect(source).not.toMatch(/FALLBACK_ROLES/)
  })

  it("dans tout src et middleware.js, user_metadata ne sert qu'à l'affichage du nom", () => {
    const files = [...walk(path.join(ROOT, "src")), path.join(ROOT, "middleware.js")].filter(
      (f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f)
    )
    const offenders = []
    for (const file of files) {
      const rel = path.relative(ROOT, file)
      const code = stripComments(readFileSync(file, "utf8"))
      const uses = code.match(/user_metadata\??\.?\w*/g) ?? []
      for (const use of uses) {
        const key = DISPLAY_ONLY[rel]
        if (!key || use.replace(/\?/g, "") !== `user_metadata.${key}`) offenders.push(`${rel}: ${use}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("les hooks n'appellent plus signOut côté navigateur", () => {
    for (const rel of ["src/hooks/use-auth.js", "src/hooks/use-vitrine-session.js"]) {
      expect(readFileSync(path.join(ROOT, rel), "utf8")).not.toMatch(/auth\.signOut/)
    }
  })
})
