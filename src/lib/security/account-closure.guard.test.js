import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { walk } from "./space-guard-rules"

// Garde-fou statique de la fermeture de compte (RD-CLOSE-01) : aucune suppression d'utilisateur ni de profil, et
// des écritures limitées aux tables prévues. Chaque règle est une fonction pure testée sur des fixtures en mémoire
// (qui doivent être refusées), puis appliquée au code livré.

const ROOT = process.cwd()
const CLOSURE_MODULES = [
  "src/lib/actions/account-closure-core.js",
  "src/lib/actions/account-closure-auth.js",
  "src/lib/actions/account-closure-pseudonymize.js",
]
const PSEUDONYMIZE = "src/lib/actions/account-closure-pseudonymize.js"
const AUTH = "src/lib/actions/account-closure-auth.js"
const ADMIN_ACTIONS = "src/lib/actions/admin-users.actions.js"
const UPDATE_ALLOWED = ["profiles", "student_profiles"]
const DELETE_ALLOWED = ["notifications", "applications"]
const PROTECTED_TABLES = [
  "transactions",
  "wallet_transactions",
  "wallets",
  "purchase_requests",
  "reports",
  "missions",
  "messages",
  "conversations",
  "reviews",
  "account_closure_events",
]

const read = (file) => readFileSync(join(ROOT, file), "utf8")

/** Retire les commentaires (bloc et ligne) pour ne juger que le code. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

/** Table littérale la plus proche avant l'index, ou null si l'appel `.from(...)` n'est pas un littéral. */
function nearestTable(code, index) {
  const before = code.slice(0, index)
  const at = before.lastIndexOf(".from(")
  if (at === -1) return null
  const match = /^\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/.exec(code.slice(at, at + 80))
  return match ? match[1] : null
}

/** Tables visées par chaque appel `verb` (`.update(` ou `.delete(`) du code. */
function writesOf(source, verb) {
  const code = stripComments(source)
  const hits = []
  let from = code.indexOf(verb)
  while (from !== -1) {
    hits.push(nearestTable(code, from))
    from = code.indexOf(verb, from + verb.length)
  }
  return hits
}

function noDeleteUser(source) {
  return /\bdeleteUser\b/.test(stripComments(source)) ? ["deleteUser"] : []
}

function serverOnlyWithoutUseServer(source) {
  const code = stripComments(source)
  const problems = []
  if (!/^\s*import\s+["']server-only["']/m.test(code)) problems.push("server-only manquant")
  if (/["']use server["']/.test(code)) problems.push("use server présent")
  return problems
}

function deleteOutsideAllowed(source) {
  return writesOf(source, ".delete(").filter((table) => !DELETE_ALLOWED.includes(table))
}

function updateOutsideAllowed(source) {
  return writesOf(source, ".update(").filter((table) => !UPDATE_ALLOWED.includes(table))
}

function touchesProtectedTable(source) {
  return [...writesOf(source, ".update("), ...writesOf(source, ".delete(")].filter((table) => PROTECTED_TABLES.includes(table))
}

function callsUpdateUserById(source) {
  return /\bupdateUserById\s*\(/.test(stripComments(source))
}

/** Vrai si la fonction exportée commence par `await requireAdminService()`. */
function startsWithAdminCheck(source, name) {
  const code = stripComments(source)
  const match = new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{\\s*(.*)`).exec(code)
  return Boolean(match) && /^const\s+\w+\s*=\s*await\s+requireAdminService\(\)/.test(match[1])
}

function importsClosureModule(source) {
  return /from\s+["'][^"']*account-closure-(core|auth|pseudonymize)["']/.test(stripComments(source))
}

function isClientModule(source) {
  return /^\s*["']use client["']/.test(source.replace(/^(\s*\/\/.*\n|\s*\/\*[\s\S]*?\*\/)*/, ""))
}

const GOOD_PSEUDO = `import "server-only"
async function f(service, id) {
  await service.from("notifications").delete().eq("recipient_id", id)
  await service.from("applications").delete().eq("student_id", id)
  await service.from("profiles").update({ a: 1 }).eq("user_id", id)
  await service.from("student_profiles").update({ a: 1 }).eq("user_id", id)
}`

describe("règles du garde de fermeture sur des fixtures en mémoire", () => {
  it("accepte une pseudonymisation conforme", () => {
    expect(noDeleteUser(GOOD_PSEUDO)).toEqual([])
    expect(serverOnlyWithoutUseServer(GOOD_PSEUDO)).toEqual([])
    expect(deleteOutsideAllowed(GOOD_PSEUDO)).toEqual([])
    expect(updateOutsideAllowed(GOOD_PSEUDO)).toEqual([])
    expect(touchesProtectedTable(GOOD_PSEUDO)).toEqual([])
  })

  it("ignore les commentaires qui citent les mots interdits", () => {
    expect(noDeleteUser("// jamais deleteUser\n/* auth.admin.deleteUser */\nconst a = 1")).toEqual([])
  })

  it("refuse deleteUser", () => {
    expect(noDeleteUser("await service.auth.admin.deleteUser(id)")).toEqual(["deleteUser"])
  })

  it("refuse un module sans server-only ou avec use server", () => {
    expect(serverOnlyWithoutUseServer("export const a = 1")).toContain("server-only manquant")
    expect(serverOnlyWithoutUseServer('"use server"\nimport "server-only"')).toContain("use server présent")
  })

  it("refuse un delete sur profiles, transactions ou une table non littérale", () => {
    expect(deleteOutsideAllowed('await s.from("profiles").delete().eq("user_id", id)')).toEqual(["profiles"])
    expect(deleteOutsideAllowed('await s.from("transactions").delete().eq("id", id)')).toEqual(["transactions"])
    expect(deleteOutsideAllowed("await s.from(table).delete().eq('id', id)")).toEqual([null])
  })

  it("refuse un update ou un delete sur une table protégée", () => {
    expect(touchesProtectedTable('await s.from("wallets").update({ balance: 0 }).eq("user_id", id)')).toEqual(["wallets"])
    expect(touchesProtectedTable('await s.from("missions").delete().eq("client_id", id)')).toEqual(["missions"])
    expect(updateOutsideAllowed('await s.from("reports").update({ a: 1 })')).toEqual(["reports"])
  })

  it("repère un appel à updateUserById", () => {
    expect(callsUpdateUserById("await service.auth.admin.updateUserById(id, {})")).toBe(true)
    expect(callsUpdateUserById("// updateUserById\nconst a = 1")).toBe(false)
  })

  it("exige requireAdminService en première instruction", () => {
    const ok = "export async function closeAccount(id, opts = {}) {\n  const ctx = await requireAdminService()\n}"
    const late = "export async function closeAccount(id) {\n  const x = 1\n  const ctx = await requireAdminService()\n}"
    expect(startsWithAdminCheck(ok, "closeAccount")).toBe(true)
    expect(startsWithAdminCheck(late, "closeAccount")).toBe(false)
    expect(startsWithAdminCheck(ok, "reopenAccount")).toBe(false)
  })

  it("repère un module client qui importe un module de fermeture", () => {
    const client = '"use client"\nimport { closeAccountCore } from "@/lib/actions/account-closure-core"'
    expect(isClientModule(client)).toBe(true)
    expect(importsClosureModule(client)).toBe(true)
    const relative = '"use client"\nimport { pseudonymizeAuthUser } from "./account-closure-auth"'
    expect(isClientModule(relative)).toBe(true)
    expect(importsClosureModule(relative)).toBe(true)
    expect(importsClosureModule('import { a } from "../actions/account-closure-pseudonymize"')).toBe(true)
    expect(importsClosureModule('import { a } from "./account-closure-other"')).toBe(false)
    expect(isClientModule('import "server-only"')).toBe(false)
  })
})

describe("code livré de la fermeture de compte", () => {
  const sources = walk(join(ROOT, "src")).map((abs) => {
    const file = relative(ROOT, abs).split("\\").join("/")
    return { file, source: readFileSync(abs, "utf8") }
  })

  it("lit bien le code de l'application", () => {
    expect(sources.length).toBeGreaterThan(100)
    for (const file of CLOSURE_MODULES) expect(sources.map((s) => s.file)).toContain(file)
  })

  it("n'appelle deleteUser nulle part dans src hors tests", () => {
    expect(sources.filter(({ source }) => noDeleteUser(source).length > 0).map((s) => s.file)).toEqual([])
  })

  it.each(CLOSURE_MODULES)("%s importe server-only sans use server", (file) => {
    expect(serverOnlyWithoutUseServer(read(file))).toEqual([])
  })

  it("ne supprime de lignes que dans la pseudonymisation, sur notifications et applications", () => {
    const withDelete = CLOSURE_MODULES.filter((file) => /\.delete\(/.test(stripComments(read(file))))
    expect(withDelete).toEqual([PSEUDONYMIZE])
    expect(deleteOutsideAllowed(read(PSEUDONYMIZE))).toEqual([])
    expect(writesOf(read(PSEUDONYMIZE), ".delete(").length).toBeGreaterThan(0)
  })

  it.each(CLOSURE_MODULES)("%s n'écrit que sur profiles et student_profiles (UPDATE) et jamais sur une table protégée", (file) => {
    expect(touchesProtectedTable(read(file))).toEqual([])
    expect(updateOutsideAllowed(read(file))).toEqual([])
  })

  it("laisse updateUserById au seul adaptateur auth", () => {
    const callers = sources.filter(({ source }) => callsUpdateUserById(source)).map((s) => s.file)
    expect(callers).toEqual([AUTH])
  })

  it.each(["closeAccount", "reopenAccount"])("%s appelle requireAdminService en première instruction", (name) => {
    expect(startsWithAdminCheck(read(ADMIN_ACTIONS), name)).toBe(true)
  })

  it("n'importe aucun module de fermeture depuis un module client", () => {
    const offenders = sources
      .filter(({ source }) => isClientModule(source) && importsClosureModule(source))
      .map((s) => s.file)
    expect(offenders).toEqual([])
  })
})
