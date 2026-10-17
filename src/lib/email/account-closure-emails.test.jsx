import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect } from "vitest"
import AccountClosed from "@/lib/email/templates/account-closed"
import AccountReopened from "@/lib/email/templates/account-reopened"

// Rendu des e-mails de fermeture et de réactivation de compte (RD-CLOSE-01 ST-05).
const html = (Template, p = {}) => renderToStaticMarkup(Template(p))
const visible = (out) => out.replace(/<[^>]*>/g, " ")

// Aucun montant, aucun lien de connexion ou de jeton.
const FORBIDDEN = /FCFA|\d[\d\s.]*\s?F\b|token=|signed|supabase\.co|\/login|\/connexion|\u2014|undefined|\[object|null/i

describe.each([
  ["account-closed", AccountClosed],
  ["account-reopened", AccountReopened],
])("%s", (_name, Template) => {
  it("logo de marque en image, aucun logo retapé en texte", () => {
    const out = html(Template)
    expect(out).toMatch(/<img[^>]*alt="EduCash"/)
    expect(out).toMatch(/educash-logo-bleu\.png/)
    expect(out).not.toMatch(/>\s*Edu\s*<|>Cash</)
  })

  it("sans donnée : repli neutre, ni montant ni lien de connexion", () => {
    const out = html(Template, {})
    expect(out).toContain("Bonjour,")
    expect(out.length).toBeGreaterThan(300)
    expect(visible(out)).not.toMatch(FORBIDDEN)
    expect(out).not.toMatch(/<a[^>]*href="https?:/)
  })

  it("prénom repris, HTML hostile échappé", () => {
    expect(html(Template, { name: "Awa Sow" })).toContain("Bonjour Awa,")
    const evil = "<script>alert(1)</script>"
    const out = html(Template, { name: evil, reactivationDeadline: evil })
    expect(out).not.toContain("<script>alert")
  })

  it("vouvoiement et contact de l'équipe", () => {
    const out = html(Template)
    expect(visible(out)).not.toMatch(/\b(tu|toi|ton|ta|tes|te)\b/i)
    expect(visible(out)).toMatch(/\b(votre|vos|vous)\b/i)
    expect(out).toContain("contact@educash.bj")
  })
})

describe("account-closed", () => {
  it("titre et accès coupé", () => {
    const out = html(AccountClosed)
    expect(out).toContain("Votre compte EduCash est fermé")
    expect(out).toContain("L’accès à votre espace est désormais coupé")
  })

  it("date limite reçue en donnée, fuseau du Bénin", () => {
    expect(html(AccountClosed, { reactivationDeadline: "2026-11-01T10:00:00Z" })).toContain("jusqu’au 1 novembre 2026")
    // 23 h UTC : déjà le lendemain à Cotonou (UTC+1)
    expect(html(AccountClosed, { reactivationDeadline: "2026-10-31T23:30:00Z" })).toContain("jusqu’au 1 novembre 2026")
  })

  it("date absente ou illisible : texte sans date", () => {
    for (const reactivationDeadline of [undefined, null, "", "pas une date"]) {
      const out = html(AccountClosed, { reactivationDeadline })
      expect(out).toContain("pendant le délai de grâce")
      expect(out).not.toMatch(/jusqu’au|Invalid/)
    }
  })

  it("dit ce qui est effacé et ce qui est gardé", () => {
    const text = visible(html(AccountClosed))
    expect(text).toMatch(/seront effacées/)
    expect(text).toMatch(/comptables pendant 10 ans/)
    expect(text).toMatch(/demandes\s+d’achats/)
    expect(text).toMatch(/messages/)
    expect(text).toMatch(/avis/)
    expect(text).toContain("« Compte clôturé »")
  })

  it("réactivation sur demande par e-mail, aucun bouton ni lien de connexion", () => {
    const out = html(AccountClosed)
    expect(out).toContain('href="mailto:contact@educash.bj"')
    expect(out).not.toMatch(/<a[^>]*href="(?!mailto:|https?:\/\/[^"]*educash-logo)/)
  })
})

describe("account-reopened", () => {
  it("titre et accès rétabli, sans lien de connexion", () => {
    const out = html(AccountReopened)
    expect(out).toContain("Votre compte EduCash est réactivé")
    expect(out).toContain("vous connecter")
    expect(out).not.toMatch(/<a[^>]*href="https?:/)
  })
})
