import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { STUDENT_MOBILE_NAV } from "./student-nav.js"
import { activeKey } from "../app-shell/nav-model.js"

const APP = path.join(process.cwd(), "src/app")
const BANNED = /livraison|course|coursier|saisie|bient[oô]t/i
const VOUVOIEMENT = /\b(vous|votre|vos)\b/i
const TUTOIEMENT = /\b(tu|ton|ta|tes|toi)\b/i

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
const items = STUDENT_MOBILE_NAV.mobile

describe("STUDENT_MOBILE_NAV", () => {
  it("compte 4 entrées aux clés uniques", () => {
    expect(items).toHaveLength(4)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })

  it("chaque href vise une page existante", () => {
    expect(items.map((i) => i.href).filter((h) => !exists(h))).toEqual([])
    expect(exists("/student/missions/abc")).toBe(true)
    expect(exists("/inexistant")).toBe(false)
  })

  it("chaque icône existe dans le sprite", () => {
    for (const { icon } of items) expect(sprite).toContain(`id="${icon}"`)
  })

  it("libellés sans mot banni ni formule de politesse", () => {
    for (const { label } of items) {
      expect(label).not.toMatch(BANNED)
      expect(label).not.toMatch(VOUVOIEMENT)
      expect(label).not.toMatch(TUTOIEMENT)
    }
  })

  it("Messages porte le badge messages", () => {
    expect(items.find((i) => i.key === "messages").badge).toBe("messages")
  })

  // Assertion inversée : /student/missions n'est plus masqué (ApplyStickyButton n'est importé par aucun écran,
  // aucune barre fixe ne chevauche la capsule sur le détail de mission).
  it("masque la barre sur les enfants de /messages seulement, pas sur le détail de mission", () => {
    expect(STUDENT_MOBILE_NAV.mobileHideBelow).toEqual(["/messages"])
    expect(STUDENT_MOBILE_NAV.mobileHideBelow).not.toContain("/student/missions")
    expect(STUDENT_MOBILE_NAV.mobileMore).toBeUndefined()
  })

  it("détermine l'entrée active", () => {
    expect(activeKey("/student/missions/abc", items)).toBe("missions")
    expect(activeKey("/applications", items)).toBe("candidatures")
    expect(activeKey("/dashboard", items)).toBe("accueil")
    expect(activeKey("/messages/abc", items)).toBe("messages")
    expect(activeKey("/profile", items)).toBeNull()
  })

  it("couvre les destinations de la barre latérale hors profil", () => {
    const side = readFileSync(path.join(process.cwd(), "src/components/shared/sidebar.jsx"), "utf8")
    const hrefs = [...side.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]).filter((h) => h !== "/profile")
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) expect(items.map((i) => i.href)).toContain(h)
  })

  it("est sérialisable sans perte", () => {
    expect(JSON.parse(JSON.stringify(STUDENT_MOBILE_NAV))).toEqual(STUDENT_MOBILE_NAV)
  })
})
