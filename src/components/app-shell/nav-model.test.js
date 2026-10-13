import { describe, it, expect } from "vitest"
import {
  activeKey,
  countLabel,
  formatCount,
  isCloseKey,
  isHiddenBelow,
  isItemActive,
  isOutside,
  closeMoreState,
  initialMoreState,
  isSearchShortcut,
  moreAccessibleName,
  resolveMobileActive,
  syncMoreState,
  toggleMoreState,
} from "./nav-model"
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

  it("mobile : 5 emplacements dont le CTA central, /client/missions/new n'active aucun onglet", () => {
    expect(CLIENT_NAV.mobile.map((i) => i.key)).toEqual(["accueil", "missions", "publier", "messages", "portefeuille"])
    expect(CLIENT_NAV.mobile.filter((i) => i.cta).map((i) => i.key)).toEqual(["publier"])
    const at = (path) => resolveMobileActive(path, CLIENT_NAV.mobile).activeKey
    expect(at("/client/missions/new")).toBe(null)
    expect(at("/client/missions")).toBe("missions")
    expect(at("/client/missions/abc")).toBe("missions")
    expect(at("/client/messages/x")).toBe("messages")
  })

  it("aucun actif hors de l'espace", () => {
    expect(activeKey("/contact", DESKTOP)).toBe(null)
    expect(resolveMobileActive("/aide", CLIENT_NAV.mobile).activeKey).toBe(null)
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

describe("isHiddenBelow", () => {
  const bases = ["/messages", "/student/missions"]

  it("vrai seulement pour un enfant strict d'une base", () => {
    expect(isHiddenBelow("/messages/abc", bases)).toBe(true)
    expect(isHiddenBelow("/student/missions/42", bases)).toBe(true)
    expect(isHiddenBelow("/messages/abc/", bases)).toBe(true)
  })

  it("jamais la base elle-même, ni un préfixe de texte, ni un slash final seul", () => {
    expect(isHiddenBelow("/messages", bases)).toBe(false)
    expect(isHiddenBelow("/messages/", bases)).toBe(false)
    expect(isHiddenBelow("/messagesx", bases)).toBe(false)
    expect(isHiddenBelow("/messagesx/abc", bases)).toBe(false)
    expect(isHiddenBelow("/student/missions", bases)).toBe(false)
  })

  it("chemin vide ou bases absentes : faux", () => {
    expect(isHiddenBelow("", bases)).toBe(false)
    expect(isHiddenBelow(undefined, bases)).toBe(false)
    expect(isHiddenBelow("/messages/abc", undefined)).toBe(false)
    expect(isHiddenBelow("/messages/abc", [])).toBe(false)
  })
})

describe("resolveMobileActive", () => {
  const items = [
    { key: "accueil", href: "/admin/dashboard" },
    { key: "verifications", href: "/admin/verifications" },
  ]
  const more = {
    items: [
      { key: "missions", href: "/admin/missions" },
      { key: "wallets", href: "/admin/wallets" },
    ],
  }

  it("entrée visible active", () => {
    expect(resolveMobileActive("/admin/verifications/x", items, more)).toEqual({
      activeKey: "verifications",
      moreActive: false,
      moreActiveKey: null,
    })
  })

  it("lien du panneau actif : Plus est actif et la clé du lien est rendue", () => {
    expect(resolveMobileActive("/admin/wallets", items, more)).toEqual({
      activeKey: null,
      moreActive: true,
      moreActiveKey: "wallets",
    })
  })

  it("le plus spécifique l'emporte entre entrées et panneau", () => {
    const nested = [{ key: "admin", href: "/admin" }]
    const deep = { items: [{ key: "wallets", href: "/admin/wallets" }] }
    expect(resolveMobileActive("/admin/wallets/1", nested, deep).moreActiveKey).toBe("wallets")
    expect(resolveMobileActive("/admin/users", nested, deep).activeKey).toBe("admin")
  })

  it("une entrée cta n'est jamais l'onglet actif", () => {
    const withCta = [...items, { key: "publier", href: "/admin/new", cta: true }]
    expect(resolveMobileActive("/admin/new", withCta, more).activeKey).toBe(null)
  })

  it("aucun actif, ou pas de panneau", () => {
    expect(resolveMobileActive("/contact", items, more)).toEqual({ activeKey: null, moreActive: false, moreActiveKey: null })
    expect(resolveMobileActive("/admin/dashboard", items, undefined).activeKey).toBe("accueil")
  })
})

describe("aides du panneau Plus", () => {
  it("isCloseKey : Échap seulement", () => {
    expect(isCloseKey("Escape")).toBe(true)
    expect(isCloseKey("Enter")).toBe(false)
  })

  it("isOutside : cible hors du conteneur", () => {
    const inside = {}
    const container = { contains: (node) => node === inside }
    expect(isOutside(container, inside)).toBe(false)
    expect(isOutside(container, {})).toBe(true)
    expect(isOutside(null, inside)).toBe(true)
  })
})

describe("état du panneau Plus", () => {
  it("ouvert sur A, navigation vers B puis retour sur A : fermé", () => {
    let state = initialMoreState("/admin/a")
    state = toggleMoreState(syncMoreState(state, "/admin/a"))
    expect(syncMoreState(state, "/admin/a").open).toBe(true)
    state = syncMoreState(state, "/admin/b")
    expect(state.open).toBe(false)
    expect(syncMoreState(state, "/admin/a").open).toBe(false)
  })

  it("un clic sur le lien de la page courante ferme sans changer de chemin", () => {
    const opened = toggleMoreState(initialMoreState("/admin/a"))
    const closed = closeMoreState(opened)
    expect(closed.open).toBe(false)
    expect(syncMoreState(closed, "/admin/a").open).toBe(false)
  })

  it("mêmes objets quand rien ne change (pas de rendu en boucle)", () => {
    const state = initialMoreState("/x")
    expect(syncMoreState(state, "/x")).toBe(state)
    expect(closeMoreState(state)).toBe(state)
  })

  it("nom accessible : « Plus » ou « Plus, page courante »", () => {
    const more = { label: "Plus", items: [{ key: "wallets", label: "Portefeuilles" }] }
    expect(moreAccessibleName(more, null)).toBe("Plus")
    expect(moreAccessibleName(more, "wallets")).toBe("Plus, Portefeuilles")
    expect(moreAccessibleName(more, "inconnu")).toBe("Plus")
  })

  it("resolveMobileActive : une clé commune à une entrée et à un lien du panneau ne les confond pas", () => {
    const items = [{ key: "missions", href: "/a" }]
    const more = { items: [{ key: "missions", href: "/b" }] }
    expect(resolveMobileActive("/b", items, more)).toEqual({ activeKey: null, moreActive: true, moreActiveKey: "missions" })
    expect(resolveMobileActive("/a", items, more)).toEqual({ activeKey: "missions", moreActive: false, moreActiveKey: null })
  })
})
