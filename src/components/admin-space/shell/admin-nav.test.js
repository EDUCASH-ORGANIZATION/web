import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { ADMIN_NAV } from "./admin-nav.js"
import { activeKey, resolveMobileActive } from "../../app-shell/nav-model.js"

const APP = path.join(process.cwd(), "src/app")
const BANNED = /livraison|course|coursier|saisie|bient[oô]t/i
// Registre unique : un libellé ne contient aucune forme de tutoiement.
const TUTOIEMENT = /\b(tu|toi|ton|ta|tes|te)\b|\bt['’]|-(toi|tu)\b/i

function pages(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) pages(full, acc)
    else if (name === "page.js" || name === "page.jsx") acc.push(path.relative(APP, path.dirname(full)))
  }
  return acc
}
const routes = pages(APP).map((dir) => "/" + dir.split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/"))
const exists = (href) => routes.some((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "/?$").test(href))

const sprite = readFileSync(path.join(process.cwd(), "public/sprite.svg"), "utf8")
const desktop = ADMIN_NAV.groups.flatMap((g) => g.items)
const { mobile, mobileMore } = ADMIN_NAV
const all = [...desktop, ...mobile, ...mobileMore.items]

describe("ADMIN_NAV", () => {
  it("décrit l'espace d'administration sans abonnement temps réel", () => {
    expect(ADMIN_NAV.space).toBe("Administration")
    expect(ADMIN_NAV.identityLabel).toBe("Admin")
    expect(ADMIN_NAV.homeHref).toBe("/admin/dashboard")
    expect(ADMIN_NAV.profileHref).toBe("/admin/dashboard")
    expect(ADMIN_NAV.realtime).toBe(false)
    expect(ADMIN_NAV.cta).toBeUndefined()
    expect(ADMIN_NAV.search).toMatchObject({ action: "/admin/users", param: "q", label: "Rechercher un utilisateur" })
  })

  it("bureau : groupes Général puis Finances, clés uniques par liste", () => {
    expect(ADMIN_NAV.groups.map((g) => g.title)).toEqual(["Général", "Finances"])
    expect(ADMIN_NAV.groups[0].items.map((i) => i.key)).toEqual(["accueil", "verifications", "utilisateurs", "missions"])
    expect(ADMIN_NAV.groups[1].items.map((i) => i.key)).toEqual(["transactions", "portefeuilles", "retraits"])
    expect(new Set(desktop.map((i) => i.key)).size).toBe(desktop.length)
  })

  it("mobile : Accueil, Vérifs, Missions, Utilisateurs puis Plus (Transactions, Portefeuilles, Retraits)", () => {
    expect(mobile.map((i) => i.key)).toEqual(["accueil", "verifications", "missions", "utilisateurs"])
    expect(mobile.map((i) => i.label)).toEqual(["Accueil", "Vérifs", "Missions", "Utilisateurs"])
    expect(mobileMore).toMatchObject({ key: "plus", label: "Plus", icon: "i-more-h" })
    expect(mobileMore.items.map((i) => i.key)).toEqual(["transactions", "portefeuilles", "retraits"])
    expect(mobile.some((i) => i.cta)).toBe(false)
    expect(ADMIN_NAV.mobileHideBelow).toBeUndefined()
  })

  it("chaque href et la recherche visent une page existante", () => {
    expect([...new Set(all.map((i) => i.href))].filter((h) => !exists(h))).toEqual([])
    expect(exists(ADMIN_NAV.search.action)).toBe(true)
    expect(exists("/inexistant")).toBe(false)
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

  it("Vérifications porte le compteur « à examiner », bureau et mobile", () => {
    for (const list of [desktop, mobile]) {
      const v = list.find((i) => i.key === "verifications")
      expect(v.badge).toBe("verifications")
      expect(v.badgeUnit).toBe("à examiner")
    }
    expect(all.filter((i) => i.badge && i.badge !== "verifications")).toEqual([])
  })

  it("bureau et mobile : mêmes destinations pour la même clé", () => {
    for (const item of [...mobile, ...mobileMore.items]) {
      const twin = desktop.find((d) => d.key === item.key)
      expect(twin, item.key).toMatchObject({ href: item.href, icon: item.icon })
    }
  })

  it("détermine l'entrée active du bureau par route", () => {
    expect(activeKey("/admin/dashboard", desktop)).toBe("accueil")
    expect(activeKey("/admin/verifications", desktop)).toBe("verifications")
    expect(activeKey("/admin/verifications/", desktop)).toBe("verifications")
    expect(activeKey("/admin/users/abc", desktop)).toBe("utilisateurs")
    expect(activeKey("/admin/missions/abc", desktop)).toBe("missions")
    expect(activeKey("/admin/wallets", desktop)).toBe("portefeuilles")
    expect(activeKey("/admin/transactions", desktop)).toBe("transactions")
    expect(activeKey("/admin/withdrawals", desktop)).toBe("retraits")
    expect(activeKey("/admin/walletsx", desktop)).toBeNull()
  })

  it("mobile : Plus est actif sur Portefeuilles, jamais en même temps qu'un onglet", () => {
    expect(resolveMobileActive("/admin/wallets", mobile, mobileMore)).toEqual({
      activeKey: null,
      moreActive: true,
      moreActiveKey: "portefeuilles",
    })
    expect(resolveMobileActive("/admin/withdrawals", mobile, mobileMore)).toMatchObject({
      activeKey: null,
      moreActive: true,
      moreActiveKey: "retraits",
    })
    expect(resolveMobileActive("/admin/verifications", mobile, mobileMore)).toMatchObject({
      activeKey: "verifications",
      moreActive: false,
    })
    expect(resolveMobileActive("/admin/dashboard", mobile, mobileMore).activeKey).toBe("accueil")
  })

  it("est sérialisable sans perte", () => {
    expect(JSON.parse(JSON.stringify(ADMIN_NAV))).toEqual(ADMIN_NAV)
  })
})

describe("ADMIN_NAV : notifications", () => {
  it("la cloche pointe vers la page des notifications de l'espace, qui existe", () => {
    expect(ADMIN_NAV.notifications).toEqual({ space: "admin", href: "/admin/notifications" })
    expect(routes).toContain("/admin/notifications")
  })
})
