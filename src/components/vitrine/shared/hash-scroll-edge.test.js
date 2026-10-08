import { describe, expect, it, vi } from "vitest"
import { hashTargetId, isSamePageAnchor, scrollToHash, splitHref } from "./hash-scroll"

describe("hash-scroll cas limites", () => {
  it("hashTargetId accepte un fragment sans diese et un fragment encodé avec espace", () => {
    expect(hashTargetId("etapes")).toBe("etapes")
    expect(hashTargetId("#a%20b")).toBe("a b")
    expect(hashTargetId(null)).toBe("")
    expect(hashTargetId(undefined)).toBe("")
  })
  it("splitHref coupe au premier diese", () => {
    expect(splitHref("/a#b#c")).toEqual({ path: "/a", hash: "#b#c" })
    expect(splitHref("")).toEqual({ path: "", hash: "" })
  })
  it("isSamePageAnchor ignore les fragments vides et distingue les chemins", () => {
    expect(isSamePageAnchor("/#", "/")).toBe(false)
    expect(isSamePageAnchor("#", "/")).toBe(false)
    expect(isSamePageAnchor("/clients#sequestre", "/clients/")).toBe(false)
    expect(isSamePageAnchor("/#etapes", "/clients")).toBe(false)
    expect(isSamePageAnchor("#%E0%A4%A", "/")).toBe(false)
  })
  it("scrollToHash n'appelle ni prepare ni scrollIntoView sans cible", () => {
    const prepare = vi.fn()
    const doc = { getElementById: vi.fn(() => null) }
    expect(scrollToHash("#x", doc, prepare)).toBeNull()
    expect(prepare).not.toHaveBeenCalled()
    expect(scrollToHash("#%E0%A4%A", doc, prepare)).toBeNull()
    expect(doc.getElementById).toHaveBeenCalledTimes(1)
  })
})
