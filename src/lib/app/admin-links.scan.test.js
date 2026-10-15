import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import * as routes from "./admin-routes.js"

// Scan final RD-ADMIN-01 : tout chemin /admin produit par les vues, actions et fabriques correspond à une page existante.
const ROOT = process.cwd()
const APP = path.join(ROOT, "src/app/(admin)/admin")

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const patterns = walk(APP)
  .filter((f) => /page\.jsx?$/.test(f))
  .map((f) => "/admin" + path.relative(APP, path.dirname(f)).split(path.sep).filter(Boolean).map((s) => "/" + s).join(""))
  .map((p) => new RegExp("^" + p.replace(/\[[^\]]+\]/g, "[^/]+") + "$"))

const matches = (p) => patterns.some((re) => re.test(p))

const SOURCES = [
  ...walk(path.join(ROOT, "src/components/admin-space")),
  ...walk(path.join(ROOT, "src/lib/admin-space")),
  ...walk(path.join(ROOT, "src/app/(admin)")),
  ...fs.readdirSync(path.join(ROOT, "src/lib/actions")).filter((f) => /^admin-.*\.js$/.test(f)).map((f) => path.join(ROOT, "src/lib/actions", f)),
  path.join(ROOT, "src/lib/app/admin-routes.js"),
].filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f))

describe("liens de l'espace admin", () => {
  it("trouve les pages admin attendues", () => {
    expect(patterns.length).toBeGreaterThanOrEqual(9)
  })

  it("chaque chemin /admin littéral des sources vise une page existante", () => {
    const bad = []
    for (const file of SOURCES) {
      const text = fs.readFileSync(file, "utf8")
      for (const m of text.matchAll(/["'`](\/admin(?:\/[A-Za-z0-9_\-${}.[\]]*)*)/g)) {
        const raw = m[1].replace(/\$\{[^}]*\}/g, "x").replace(/\/+$/, "") || "/admin"
        if (!matches(raw)) bad.push(`${path.relative(ROOT, file)} -> ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it("chaque fabrique produit une route existante, avec ou sans paramètres", () => {
    const id = "00000000-0000-4000-8000-000000000001"
    const outputs = [
      routes.adminHomeHref(),
      routes.adminVerificationsHref(),
      routes.adminVerificationsHref({ onglet: "refuses", id, q: "a b", ecole: "UAC", page: 3 }),
      routes.adminUsersHref(),
      routes.adminUsersHref({ q: "x", role: "student", verif: "verifie", statut: "suspendu", page: 2 }),
      routes.adminUserHref(id),
      routes.adminUserHref(id, { onglet: "missions" }),
      routes.adminUserHref(undefined),
      routes.adminMissionsHref({ statut: "open", ville: "Cotonou", type: "x", page: 2 }),
      routes.adminMissionHref(id),
      routes.adminMissionHref(""),
      routes.adminWalletsHref({ q: "n", page: 2 }),
      routes.adminTransactionsHref({ type: "t", periode: "30j", q: "q", page: 2 }),
      routes.adminWithdrawalsHref(),
    ]
    for (const o of outputs) expect(matches(o.split("?")[0]), o).toBe(true)
  })

  it("un identifiant hostile est encodé et ne sort pas de /admin", () => {
    const href = routes.adminUserHref("../../etc?x=1#")
    expect(href.startsWith("/admin/users/")).toBe(true)
    expect(href).not.toMatch(/\.\.\/|#/)
    expect(routes.adminMissionHref("a/b")).toBe("/admin/missions/a%2Fb")
  })
})
