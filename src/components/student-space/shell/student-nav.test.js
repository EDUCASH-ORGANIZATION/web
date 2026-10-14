import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { STUDENT_NAV } from "./student-nav.js"
import { activeKey, isHiddenBelow } from "../../app-shell/nav-model.js"

const APP = path.join(process.cwd(), "src/app")
const BANNED = /livraison|course|coursier|saisie|bient[oô]t/i
const VOUVOIEMENT = /\b(vous|votre|vos)\b/i

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
const desktop = STUDENT_NAV.groups.flatMap((g) => g.items)
const all = [...desktop, ...STUDENT_NAV.mobile]
const mobile = STUDENT_NAV.mobile

describe("STUDENT_NAV", () => {
  it("décrit l'espace étudiant sans CTA, avec la recherche vers l'explorateur", () => {
    expect(STUDENT_NAV.space).toBe("Espace étudiant")
    expect(STUDENT_NAV.identityLabel).toBe("Étudiant")
    expect(STUDENT_NAV.homeHref).toBe("/dashboard")
    expect(STUDENT_NAV.profileHref).toBe("/profile")
    expect(STUDENT_NAV.cta).toBeUndefined()
    expect(STUDENT_NAV.search).toMatchObject({ action: "/student/missions", param: "q", label: "Rechercher une mission" })
  })

  it("bureau : 5 entrées principales puis Compte (profil, vérification, aide), clés uniques", () => {
    expect(STUDENT_NAV.groups[0].items.map((i) => i.key)).toEqual(["accueil", "missions", "candidatures", "messages", "portefeuille"])
    expect(STUDENT_NAV.groups[1].title).toBe("Compte")
    expect(STUDENT_NAV.groups[1].items.map((i) => i.href)).toEqual(["/profile", "/profile/verify", "/aide"])
    expect(new Set(desktop.map((i) => i.key)).size).toBe(desktop.length)
  })

  it("mobile : 4 onglets (décision D3), sans portefeuille ni bouton central", () => {
    expect(mobile.map((i) => i.key)).toEqual(["accueil", "missions", "candidatures", "messages"])
    expect(mobile.some((i) => i.cta)).toBe(false)
    expect(STUDENT_NAV.mobileMore).toBeUndefined()
  })

  it("chaque href vise une page existante", () => {
    expect([...new Set(all.map((i) => i.href))].filter((h) => !exists(h))).toEqual([])
    expect(exists("/inexistant")).toBe(false)
    expect(exists("/student/missions/abc")).toBe(true)
    expect(exists(STUDENT_NAV.search.action)).toBe(true)
  })

  it("chaque icône existe dans le sprite", () => {
    for (const { icon } of all) expect(sprite).toContain(`id="${icon}"`)
  })

  it("libellés sans mot banni ni vouvoiement", () => {
    for (const { label } of all) {
      expect(label).not.toMatch(BANNED)
      expect(label).not.toMatch(VOUVOIEMENT)
    }
  })

  it("Messages porte le badge messages, bureau et mobile", () => {
    expect(desktop.find((i) => i.key === "messages").badge).toBe("messages")
    expect(mobile.find((i) => i.key === "messages").badge).toBe("messages")
  })

  it("détermine l'entrée active du bureau par route", () => {
    expect(activeKey("/dashboard", desktop)).toBe("accueil")
    expect(activeKey("/student/missions", desktop)).toBe("missions")
    expect(activeKey("/student/missions/abc", desktop)).toBe("missions")
    expect(activeKey("/applications", desktop)).toBe("candidatures")
    expect(activeKey("/messages/abc", desktop)).toBe("messages")
    expect(activeKey("/wallet", desktop)).toBe("portefeuille")
    expect(activeKey("/profile", desktop)).toBe("profil")
    expect(activeKey("/profile/edit", desktop)).toBe("profil")
    expect(activeKey("/aide", desktop)).toBe("aide")
  })

  it("Vérification et Mon profil ne sont jamais actifs ensemble", () => {
    expect(activeKey("/profile/verify", desktop)).toBe("verification")
    expect(activeKey("/profile/verify/", desktop)).toBe("verification")
  })

  it("détermine l'entrée active du mobile, aucune sur le profil", () => {
    expect(activeKey("/student/missions/abc", mobile)).toBe("missions")
    expect(activeKey("/messages", mobile)).toBe("messages")
    expect(activeKey("/profile", mobile)).toBeNull()
    expect(activeKey("/wallet", mobile)).toBeNull()
  })

  it("masque la barre mobile sur les enfants de /messages seulement", () => {
    expect(STUDENT_NAV.mobileHideBelow).toEqual(["/messages"])
    const hide = STUDENT_NAV.mobileHideBelow
    expect(isHiddenBelow("/messages/abc", hide)).toBe(true)
    expect(isHiddenBelow("/messages", hide)).toBe(false)
    expect(isHiddenBelow("/student/missions/abc", hide)).toBe(false)
    expect(isHiddenBelow("/dashboard", hide)).toBe(false)
  })

  it("est sérialisable sans perte", () => {
    expect(JSON.parse(JSON.stringify(STUDENT_NAV))).toEqual(STUDENT_NAV)
  })
})
