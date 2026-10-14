import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { ADMIN_MOBILE_NAV } from "./admin-nav.js"
import { activeKey } from "../app-shell/nav-model.js"

const APP = path.join(process.cwd(), "src/app")
const BANNED = /livraison|course|coursier|saisie|bient[oô]t/i
// Vouvoiement partout (RD-VOUS-01) : un libelle ne contient aucune forme de tutoiement.
const TUTOIEMENT = /\b(tu|toi|ton|ta|tes|te)\b|\bt['\u2019]|-(toi|tu)\b/i

function pages(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) pages(full, acc)
    else if (name === "page.js" || name === "page.jsx") acc.push(path.relative(APP, path.dirname(full)))
  }
  return acc
}
const routes = pages(APP).map((dir) => "/" + dir.split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/"))
const exists = (href) =>
  routes.some((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "/?$").test(href))

const sprite = readFileSync(path.join(process.cwd(), "public/sprite.svg"), "utf8")
const { mobile, mobileMore } = ADMIN_MOBILE_NAV
const all = [...mobile, ...mobileMore.items]

describe("ADMIN_MOBILE_NAV", () => {
  it("compte 3 entrées visibles plus Plus (4 onglets), clés uniques", () => {
    expect(mobile).toHaveLength(3)
    expect(mobileMore.label).toBe("Plus")
    expect(mobileMore.icon).toBe("i-more-h")
    const keys = [...all.map((i) => i.key), mobileMore.key]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("chaque href vise une page existante", () => {
    expect(all.map((i) => i.href).filter((h) => !exists(h))).toEqual([])
  })

  it("chaque icône existe dans le sprite", () => {
    for (const { icon } of [...all, mobileMore]) expect(sprite).toContain(`id="${icon}"`)
  })

  it("libellés sans mot banni ni tutoiement", () => {
    for (const { label } of [...all, mobileMore]) {
      expect(label).not.toMatch(BANNED)
      expect(label).not.toMatch(TUTOIEMENT)
    }
  })

  it("Vérifications porte le badge en attente", () => {
    const v = mobile.find((i) => i.key === "verifications")
    expect(v.badge).toBe("verifications")
    expect(v.badgeUnit).toBe("en attente")
  })

  it("ne définit pas de masquage", () => {
    expect(ADMIN_MOBILE_NAV.mobileHideBelow).toBeUndefined()
  })

  it("détermine l'entrée active", () => {
    expect(activeKey("/admin/verifications/x", mobile)).toBe("verifications")
    expect(activeKey("/admin/wallets", mobileMore.items)).toBe("portefeuilles")
    expect(activeKey("/admin/wallets", mobile)).toBeNull()
  })

  it("couvre les 5 destinations de la barre latérale", () => {
    const side = readFileSync(path.join(process.cwd(), "src/components/admin/admin-sidebar.js"), "utf8")
    const hrefs = [...side.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toHaveLength(5)
    for (const h of hrefs) expect(all.map((i) => i.href)).toContain(h)
  })

  it("est sérialisable sans perte", () => {
    expect(JSON.parse(JSON.stringify(ADMIN_MOBILE_NAV))).toEqual(ADMIN_MOBILE_NAV)
  })
})
