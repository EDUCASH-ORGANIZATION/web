import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import * as copy from "@/lib/messaging/contact-copy"
import { CONTACT_KEYWORDS, PAYMENT_KEYWORDS } from "@/lib/messaging/contact-keywords"
import { findTutoiement } from "@/lib/security/no-tutoiement.guard.test"

const TEXTS = Object.entries(copy).filter(([, v]) => typeof v === "string" && !v.startsWith("/"))

describe("textes de la protection des coordonnées", () => {
  it("expose les textes attendus", () => {
    expect(copy.PRIVACY_MESSAGES_HREF).toBe("/legal/privacy#analyse-des-messages")
    expect(TEXTS.map(([k]) => k).sort()).toEqual([
      "ANALYSIS_NOTICE_COPY",
      "ANALYSIS_NOTICE_LINK_LABEL",
      "CONTACT_WARNING_COPY",
      "KEYWORD_WARNING_COPY",
      "MASKED_RECIPIENT_NOTE",
      "MASKED_SENDER_NOTE",
    ])
  })

  it("vouvoie, sans tiret cadratin, sans mot banni ni promesse de délai", () => {
    for (const [name, text] of TEXTS) {
      expect(findTutoiement(text), name).toBeNull()
      expect(text, name).not.toContain(String.fromCharCode(0x2014))
      expect(text, name).not.toMatch(/saisie|livraison|course|coursier|bient[ôo]t|fedapay|commission/i)
      expect(text, name).not.toMatch(/\b\d+\s*(?:heures?|jours?|minutes?|h)\b|immédiat|rapidement|sous peu/i)
    }
  })

  it("contactWarning choisit le bon bandeau", () => {
    expect(copy.contactWarning(["phone"])).toBe(copy.CONTACT_WARNING_COPY)
    expect(copy.contactWarning(["email", "contact_keyword"])).toBe(copy.CONTACT_WARNING_COPY)
    expect(copy.contactWarning(["social"])).toBe(copy.CONTACT_WARNING_COPY)
    expect(copy.contactWarning(["contact_keyword"])).toBe(copy.KEYWORD_WARNING_COPY)
    expect(copy.contactWarning(["payment_keyword"])).toBe(copy.KEYWORD_WARNING_COPY)
    expect(copy.contactWarning([])).toBeNull()
    expect(copy.contactWarning(undefined)).toBeNull()
  })
})

describe("contact-keywords.js", () => {
  it("ne contient que des données : deux listes de chaînes, sans import", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/messaging/contact-keywords.js"), "utf8")
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\b(?:function|=>|return|class)\b/)
    for (const list of [CONTACT_KEYWORDS, PAYMENT_KEYWORDS]) {
      expect(list.length).toBeGreaterThan(10)
      expect(list.every((w) => typeof w === "string" && w.trim() === w && w.length > 2)).toBe(true)
      expect(new Set(list).size).toBe(list.length)
    }
    expect(source).not.toContain(String.fromCharCode(0x2014))
  })

  it("garde les formes tutoyées exemptées du garde-fou global", () => {
    expect(CONTACT_KEYWORDS).toEqual(expect.arrayContaining(["appelle-moi", "écris-moi", "ton numéro"]))
  })
})
