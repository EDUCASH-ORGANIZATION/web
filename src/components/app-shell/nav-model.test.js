import { describe, it, expect } from "vitest"
import { activeKey, countLabel, formatCount, isItemActive, isSearchShortcut } from "./nav-model"
import { CLIENT_NAV } from "../client-space/shell/client-nav"

const DESKTOP = CLIENT_NAV.groups.flatMap((g) => g.items)

describe("isItemActive", () => {
  const missions = { key: "m", href: "/client/missions", exclude: ["/client/missions/new"] }

  it("actif sur le chemin exact et sur ses enfants", () => {
    expect(isItemActive("/client/missions", missions)).toBe(true)
    expect(isItemActive("/client/missions/abc", missions)).toBe(true)
    expect(isItemActive("/client/missions/", missions)).toBe(true)
  })

  it("exclut /client/missions/new et ses enfants", () => {
    expect(isItemActive("/client/missions/new", missions)).toBe(false)
    expect(isItemActive("/client/missions/new/", missions)).toBe(false)
  })

  it("ne confond pas un préfixe de texte avec un chemin enfant", () => {
    expect(isItemActive("/client/missions-archive", missions)).toBe(false)
    expect(isItemActive("/client/missions/newsletter", missions)).toBe(true)
  })

  it("exact : seulement le chemin lui-même", () => {
    const publish = { key: "p", href: "/client/missions/new", exact: true }
    expect(isItemActive("/client/missions/new", publish)).toBe(true)
    expect(isItemActive("/client/missions/new/etape", publish)).toBe(false)
  })

  it("renvoie false sans chemin ou sans lien", () => {
    expect(isItemActive(undefined, missions)).toBe(false)
    expect(isItemActive("/client/missions", {})).toBe(false)
  })
})

describe("activeKey sur la configuration client", () => {
  it("bureau : un seul élément actif par route", () => {
    expect(activeKey("/client/dashboard", DESKTOP)).toBe("accueil")
    expect(activeKey("/client/missions", DESKTOP)).toBe("missions")
    expect(activeKey("/client/missions/42", DESKTOP)).toBe("missions")
    expect(activeKey("/client/messages/42", DESKTOP)).toBe("messages")
    expect(activeKey("/client/wallet", DESKTOP)).toBe("portefeuille")
    expect(activeKey("/client/profile/edit", DESKTOP)).toBe("profil")
  })

  it("bureau : /client/missions/new n'active pas Mes missions (publier n'a pas d'entrée de menu)", () => {
    expect(activeKey("/client/missions/new", DESKTOP)).toBe(null)
  })

  it("mobile : /client/missions/new active Publier et pas Missions", () => {
    expect(activeKey("/client/missions/new", CLIENT_NAV.mobile)).toBe("publier")
    expect(activeKey("/client/missions", CLIENT_NAV.mobile)).toBe("missions")
  })

  it("aucun actif hors de l'espace", () => {
    expect(activeKey("/contact", DESKTOP)).toBe(null)
    expect(activeKey("/aide", CLIENT_NAV.mobile)).toBe(null)
  })

  it("en cas de chevauchement, le chemin le plus long l'emporte", () => {
    const items = [{ key: "a", href: "/x" }, { key: "b", href: "/x/y" }]
    expect(activeKey("/x/y/z", items)).toBe("b")
    expect(activeKey("/x/z", items)).toBe("a")
  })
})

describe("formatCount", () => {
  it("borne à 99+ et masque zéro et les valeurs invalides", () => {
    expect(formatCount(1)).toBe("1")
    expect(formatCount(99)).toBe("99")
    expect(formatCount(100)).toBe("99+")
    expect(formatCount(12345)).toBe("99+")
    expect(formatCount(0)).toBe(null)
    expect(formatCount(-4)).toBe(null)
    expect(formatCount(null)).toBe(null)
    expect(formatCount(undefined)).toBe(null)
    expect(formatCount("abc")).toBe(null)
    expect(formatCount(NaN)).toBe(null)
    expect(formatCount(3.7)).toBe("3")
  })
})

describe("countLabel", () => {
  it("complète le nom accessible avec le compteur", () => {
    expect(countLabel("Messages", 3)).toBe("Messages, 3 non lus")
    expect(countLabel("Messages", 250)).toBe("Messages, plus de 99 non lus")
    expect(countLabel("Messages", 0)).toBe("Messages")
  })
})

describe("isSearchShortcut", () => {
  const key = (over) => ({ key: "/", target: { tagName: "BODY" }, ...over })

  it("« / » hors d'un champ déclenche le raccourci", () => {
    expect(isSearchShortcut(key())).toBe(true)
  })

  it("ignore la saisie, les modificateurs, les autres touches et les événements traités", () => {
    expect(isSearchShortcut(key({ target: { tagName: "INPUT" } }))).toBe(false)
    expect(isSearchShortcut(key({ target: { tagName: "TEXTAREA" } }))).toBe(false)
    expect(isSearchShortcut(key({ target: { tagName: "DIV", isContentEditable: true } }))).toBe(false)
    expect(isSearchShortcut(key({ ctrlKey: true }))).toBe(false)
    expect(isSearchShortcut(key({ metaKey: true }))).toBe(false)
    expect(isSearchShortcut(key({ key: "a" }))).toBe(false)
    expect(isSearchShortcut(key({ defaultPrevented: true }))).toBe(false)
    expect(isSearchShortcut(null)).toBe(false)
  })
})
