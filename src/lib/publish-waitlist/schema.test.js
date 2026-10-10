import { describe, expect, it } from "vitest"
import { parseWaitlistForm } from "./schema"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

describe("parseWaitlistForm", () => {
  it("accepte un email valide et le nettoie", () => {
    expect(parseWaitlistForm(form({ email: "  awa@exemple.bj " }))).toEqual({ ok: true, data: { email: "awa@exemple.bj" } })
  })

  it.each(["", "nope", "a@b", "a b@exemple.bj"])("refuse %j", (email) => {
    const r = parseWaitlistForm(form({ email }))
    expect(r.ok).toBe(false)
    expect(r.fieldErrors.email).toBeTruthy()
  })

  it("refuse un email trop long", () => {
    const r = parseWaitlistForm(form({ email: `${"a".repeat(250)}@exemple.bj` }))
    expect(r.fieldErrors.email).toMatch(/trop longue/)
  })

  it("refuse un email absent", () => {
    expect(parseWaitlistForm(new FormData()).ok).toBe(false)
  })

  it("détecte le honeypot rempli", () => {
    expect(parseWaitlistForm(form({ email: "awa@exemple.bj", website: "http://spam" }))).toEqual({ ok: false, spam: true })
  })

  it("vouvoie dans ses messages", () => {
    const r = parseWaitlistForm(form({ email: "" }))
    expect(r.fieldErrors.email).toMatch(/Saisissez/)
  })
})
