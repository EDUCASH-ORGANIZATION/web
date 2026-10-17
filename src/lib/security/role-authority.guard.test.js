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

// Seule écriture permise : mettre à null les clés des métadonnées d'un compte à la pseudonymisation (RD-CLOSE-01).
// Les clés existantes sont passées à nullMetadata, qui n'en conserve que les noms (jamais une valeur, jamais une
// autorisation). Une seule occurrence exacte, dans ce seul fichier ; tout le reste y reste refusé.
const ADAPTER_WRITE = "user_metadata: nullMetadata(existing?.data?.user?.user_metadata)"
const WRITE_ONLY = { "src/lib/actions/account-closure-auth.js": ADAPTER_WRITE }

const FIXED_FILES = ["middleware.js", "src/app/(student)/layout.js", "src/app/(client)/layout.js"]

const ADMIN_PAGES = ["dashboard", "verifications", "users", "missions", "wallets", "transactions", "withdrawals"].map(
  (name) => `src/app/(admin)/admin/${name}/page.js`
)

// Page admin sans donnée : simple redirection, sans aucun import applicatif (`@/`).
const REDIRECT_ONLY_PAGES = ["src/app/(admin)/admin/page.js"]

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

/** Retire (une seule fois) l'écriture exacte autorisée pour ce fichier, s'il y en a une. */
function stripAllowedWrite(code, rel = "") {
  const allowed = WRITE_ONLY[rel]
  return allowed ? code.replace(allowed, "") : code
}

function readsUserMetadata(source, rel = "") {
  return /user_metadata/.test(stripAllowedWrite(stripComments(source), rel))
}

function adminPageFiles() {
  return walk(path.join(ROOT, "src/app/(admin)"))
    .filter((f) => path.basename(f) === "page.js")
    .map((f) => path.relative(ROOT, f))
    .sort()
}

/**
 * Une page admin est conforme si elle appelle requireRole(["admin"]), ou si toutes ses actions importées
 * sont des admin-*.actions (gardées par requireAdminService), ou si c'est une redirection pure sans import `@/`.
 */
function isGuardedAdminPage(source, rel = "") {
  const code = stripComments(source)
  if (/getServerRole/.test(code)) return false
  if (/requireRole\(\["admin"\]\)/.test(code)) return true
  const actionImports = [...code.matchAll(/from\s+["']@\/lib\/actions\/([\w.-]+)["']/g)].map((m) => m[1])
  if (actionImports.length > 0) return actionImports.every((name) => /^admin-[\w-]+\.actions$/.test(name))
  return REDIRECT_ONLY_PAGES.includes(rel) && /redirect\(/.test(code) && !/from\s+["']@\//.test(code)
}

function guardedFiles() {
  const actions = walk(path.join(ROOT, "src/lib/actions")).filter(
    (f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f)
  )
  const adminPages = adminPageFiles().map((f) => path.join(ROOT, f))
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

  it("surveille les 7 pages admin", () => {
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

  it("parcourt tous les page.js de (admin) et chacun est gardé côté serveur", () => {
    const pages = adminPageFiles()
    expect(pages).toEqual(expect.arrayContaining(ADMIN_PAGES))
    const offenders = pages.filter((rel) => !isGuardedAdminPage(readFileSync(path.join(ROOT, rel), "utf8"), rel))
    expect(offenders).toEqual([])
  })

  it("détecte une page admin sans garde et accepte une page conforme (fixtures en mémoire)", () => {
    const unguarded = 'import { listUsers } from "@/lib/actions/admin.actions"\nexport default async function P() { return listUsers() }'
    const mixed = 'import { a } from "@/lib/actions/admin-verifications.actions"\nimport { b } from "@/lib/actions/profile.actions"'
    const noGuard = "export default function P() { return null }"
    const roleGuarded = 'const auth = await requireRole(["admin"])'
    const adminActions = 'import { a } from "@/lib/actions/admin-dashboard.actions"\nexport default function P() {}'
    const commented = '// requireRole(["admin"])\nexport default function P() { return null }'
    const legacy = 'const role = await getServerRole()\nawait requireRole(["admin"])'
    expect(isGuardedAdminPage(unguarded)).toBe(false)
    expect(isGuardedAdminPage(mixed)).toBe(false)
    expect(isGuardedAdminPage(noGuard)).toBe(false)
    expect(isGuardedAdminPage(commented)).toBe(false)
    expect(isGuardedAdminPage(legacy)).toBe(false)
    expect(isGuardedAdminPage(roleGuarded)).toBe(true)
    expect(isGuardedAdminPage(adminActions)).toBe(true)
    expect(isGuardedAdminPage('import { redirect } from "next/navigation"\nredirect("/x")', REDIRECT_ONLY_PAGES[0])).toBe(true)
    expect(isGuardedAdminPage('import { redirect } from "next/navigation"\nredirect("/x")', "src/app/(admin)/admin/x/page.js")).toBe(false)
  })

  it("aucun user_metadata dans le code du middleware, des layouts et des actions", () => {
    const offenders = guardedFiles()
      .map((f) => path.relative(ROOT, f))
      .filter((rel) => !ALLOWED_CODE.includes(rel))
      .filter((rel) => readsUserMetadata(readFileSync(path.join(ROOT, rel), "utf8"), rel))
    expect(offenders).toEqual([])
  })

  it("l'écriture de remise à null n'est permise que dans l'adaptateur auth de fermeture (fixtures en mémoire)", () => {
    const adapter = "src/lib/actions/account-closure-auth.js"
    const write = `const a = { ${ADAPTER_WRITE} }`
    expect(readsUserMetadata(write, adapter)).toBe(false)
    expect(readsUserMetadata(write, "src/lib/actions/other.actions.js")).toBe(true)
    expect(readsUserMetadata(write)).toBe(true)
    expect(readsUserMetadata("const r = user.user_metadata.role", adapter)).toBe(true)
    expect(readsUserMetadata(`${write}\nconst r = u?.user_metadata?.role`, adapter)).toBe(true)
    expect(readsUserMetadata("const a = { user_metadata: { role: 'admin' } }", adapter)).toBe(true)
    expect(readsUserMetadata("const a = { user_metadata: {} }", adapter)).toBe(true)
    expect(readsUserMetadata("const a = { user_metadata: nullMetadata(other) }", adapter)).toBe(true)
    expect(readsUserMetadata(`${write}\nconst b = { ${ADAPTER_WRITE} }`, adapter)).toBe(true)
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
      const code = stripAllowedWrite(stripComments(readFileSync(file, "utf8")), rel)
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

  it("le layout client passe par getClientShellData et redirige ; l'action exige requireRole([\"client\"])", () => {
    const layout = readFileSync(path.join(ROOT, "src/app/(client)/layout.js"), "utf8")
    expect(layout).toMatch(/import\s*\{[^}]*getClientShellData[^}]*\}\s*from/)
    expect(layout).toMatch(/redirect\(/)
    const action = readFileSync(path.join(ROOT, "src/lib/actions/client-shell.actions.js"), "utf8")
    expect(action).toContain('requireRole(["client"])')
  })
})
