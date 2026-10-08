import { describe, expect, it, vi } from "vitest"
import { hashTargetId, isSamePageAnchor, scrollToHash, splitHref } from "./hash-scroll"

describe("hashTargetId", () => {
  it("décode le fragment", () => {
    expect(hashTargetId("#etapes")).toBe("etapes")
    expect(hashTargetId("#caf%C3%A9")).toBe("café")
  })
  it("renvoie une chaîne vide sans fragment exploitable", () => {
    expect(hashTargetId("")).toBe("")
    expect(hashTargetId("#")).toBe("")
    expect(hashTargetId("#%E0%A4%A")).toBe("")
  })
})

describe("splitHref", () => {
  it("sépare chemin et fragment", () => {
    expect(splitHref("/#etapes")).toEqual({ path: "/", hash: "#etapes" })
    expect(splitHref("/aide#achats")).toEqual({ path: "/aide", hash: "#achats" })
    expect(splitHref("#x")).toEqual({ path: "", hash: "#x" })
    expect(splitHref("/missions")).toEqual({ path: "/missions", hash: "" })
  })
})

describe("isSamePageAnchor", () => {
  it("reconnaît un lien vers la page affichée", () => {
    expect(isSamePageAnchor("/#etapes", "/")).toBe(true)
    expect(isSamePageAnchor("#sequestre", "/clients")).toBe(true)
    expect(isSamePageAnchor("/aide#achats", "/aide")).toBe(true)
  })
  it("laisse Next gérer les autres pages et les liens sans ancre", () => {
    expect(isSamePageAnchor("/#etapes", "/missions")).toBe(false)
    expect(isSamePageAnchor("/aide", "/aide")).toBe(false)
    expect(isSamePageAnchor("/aide?q=a#achats", "/aide")).toBe(false)
  })
})

describe("scrollToHash", () => {
  it("défile vers la cible et appelle prepare avant", () => {
    const calls = []
    const target = { scrollIntoView: vi.fn(() => calls.push("scroll")) }
    const doc = { getElementById: vi.fn(() => target) }
    const prepare = vi.fn(() => calls.push("prepare"))
    expect(scrollToHash("#etapes", doc, prepare)).toBe(target)
    expect(doc.getElementById).toHaveBeenCalledWith("etapes")
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start" })
    expect(calls).toEqual(["prepare", "scroll"])
  })
  it("renvoie null sans cible ni fragment", () => {
    const doc = { getElementById: vi.fn(() => null) }
    expect(scrollToHash("#absent", doc)).toBeNull()
    expect(scrollToHash("", doc)).toBeNull()
  })
})
