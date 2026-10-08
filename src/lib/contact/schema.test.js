import { describe, it, expect } from "vitest"
import {
  CONTACT_SUBJECTS,
  CONTACT_LIMITS,
  HONEYPOT_FIELD,
  parseContactForm,
} from "./schema"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

const valid = {
  name: "Sèna Agossou",
  email: "sena@exemple.bj",
  subject: "paiement",
  message: "Bonjour, mon retrait est en cours.",
}

describe("parseContactForm", () => {
  it("expose les 6 sujets attendus", () => {
    expect(CONTACT_SUBJECTS.map((s) => s.id)).toEqual([
      "question", "paiement", "verification", "signalement", "partenariat", "autre",
    ])
  })

  it("accepte des champs valides", () => {
    const r = parseContactForm(form(valid))
    expect(r).toEqual({ ok: true, data: valid })
  })

  it("refuse tous les champs vides", () => {
    const r = parseContactForm(form({ name: "", email: "", subject: "", message: "" }))
    expect(r.ok).toBe(false)
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["email", "message", "name", "subject"])
  })

  it("refuse un email invalide", () => {
    const r = parseContactForm(form({ ...valid, email: "sena@" }))
    expect(r.fieldErrors.email).toBeDefined()
  })

  it("refuse un message de 1001 caracteres et accepte 1000", () => {
    const tooLong = parseContactForm(form({ ...valid, message: "a".repeat(CONTACT_LIMITS.messageMax + 1) }))
    expect(tooLong.ok).toBe(false)
    expect(tooLong.fieldErrors.message).toBeDefined()
    const max = parseContactForm(form({ ...valid, message: "a".repeat(CONTACT_LIMITS.messageMax) }))
    expect(max.ok).toBe(true)
  })

  it("refuse un message trop court", () => {
    const r = parseContactForm(form({ ...valid, message: "Salut" }))
    expect(r.fieldErrors.message).toBeDefined()
  })

  it("refuse un sujet hors liste", () => {
    const r = parseContactForm(form({ ...valid, subject: "pirate" }))
    expect(r.fieldErrors.subject).toBeDefined()
  })

  it("retire CR et LF du nom", () => {
    const r = parseContactForm(form({ ...valid, name: "Sèna\r\nBcc: x@y.z" }))
    expect(r.ok).toBe(true)
    expect(r.data.name).not.toMatch(/[\r\n]/)
  })

  it("detecte le honeypot rempli", () => {
    const r = parseContactForm(form({ ...valid, [HONEYPOT_FIELD]: "http://spam" }))
    expect(r).toEqual({ ok: false, spam: true })
  })
})
