import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect } from "vitest"
import { PAYMENT_WARNING } from "@/lib/purchases/requests"
import PurchaseRequested from "@/lib/email/templates/purchase-requested"
import PurchasePaid from "@/lib/email/templates/purchase-paid"
import PurchaseReported from "@/lib/email/templates/purchase-reported"

// Rendu des trois e-mails des demandes d'achats (RD-ACHATS-01 ST-17).
const IDS = {
  missionId: "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10",
  studentId: "22222222-2222-4222-8222-222222222221",
  requestId: "33333333-3333-4333-8333-333333333331",
}
const props = { missionTitle: "Courses au marché", ...IDS }
const html = (Template, p = props) => renderToStaticMarkup(Template(p))
const visible = (out) => out.replace(/<[^>]*>/g, " ")
const escapeHtml = (t) => t.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;")

// Données qui ne doivent jamais apparaître : numéro, montant exact, nom de vendeur, lien de photo ou signé.
const FORBIDDEN = /\d{6,}|\+?229|FCFA|\b\d[\d\s.]*\s?F\b|token=|signed|supabase\.co|fedapay|vous touchez|\d+\s*(heures?|jours?|minutes?)|livraisons?|coursiers?|\bcourses?\b|saisies?\b|bient[oô]t|\u2014/i

describe.each([
  ["purchase-requested", PurchaseRequested],
  ["purchase-paid", PurchasePaid],
  ["purchase-reported", PurchaseReported],
])("%s", (_name, Template) => {
  it("logo de marque en image, aucun logo retapé en texte", () => {
    const out = html(Template)
    expect(out).toMatch(/<img[^>]*alt="EduCash"/)
    expect(out).toMatch(/educash-logo-bleu\.png/)
    expect(out).not.toMatch(/>\s*Edu\s*<|>Cash</)
  })

  it("titre de mission affiché, sans donnée interdite", () => {
    const out = html(Template, { ...props, missionTitle: "Flyer" })
    expect(out).toContain("« Flyer »")
    expect(visible(out)).not.toMatch(FORBIDDEN)
  })

  it("pas de titre : repli neutre, pas d'undefined", () => {
    const out = html(Template, {})
    expect(out).not.toMatch(/undefined|\[object|null/)
    expect(out.length).toBeGreaterThan(300)
  })

  it("props hostiles : HTML échappé, aucun nom ni numéro injecté dans le lien", () => {
    const evil = "<script>alert(1)</script>"
    const out = html(Template, { missionTitle: evil, missionId: evil, studentId: evil, requestId: evil })
    expect(out).not.toContain("<script>alert")
    expect(out).not.toContain(evil)
  })

  it("vouvoiement", () => {
    const text = visible(html(Template))
    expect(text).not.toMatch(/\b(tu|toi|ton|ta|tes|te)\b/i)
    expect(text).toMatch(/\b(votre|vos|vous)\b/i)
  })
})

describe("purchase-requested", () => {
  it("dit que l'étudiant demande de payer et reprend PAYMENT_WARNING tel quel, paiement hors EduCash", () => {
    const out = html(PurchaseRequested)
    expect(out).toContain("Votre étudiant vous demande de payer")
    expect(out).toContain(escapeHtml(PAYMENT_WARNING))
    expect(out).toContain("hors EduCash")
  })

  it("lien vers la conversation du client dans l'application, jamais un lien signé", () => {
    const out = html(PurchaseRequested)
    expect(out).toContain(`/client/messages/${IDS.missionId}?studentId=${IDS.studentId}&amp;demande=${IDS.requestId}"`)
    expect(out).not.toMatch(/token|signature|Expires/i)
  })
})

describe("purchase-paid", () => {
  it("demande à l'étudiant de confirmer la réception, sans promesse de gain ni de délai", () => {
    const out = html(PurchasePaid)
    expect(out).toContain("indique avoir payé")
    expect(out).toContain("Confirmez la réception")
    expect(out).not.toMatch(/touch|gagn|rémunér/i)
  })

  it("lien vers la conversation de l'étudiant", () => {
    expect(html(PurchasePaid)).toContain(`/messages/${IDS.missionId}?demande=${IDS.requestId}"`)
  })
})

describe("purchase-reported", () => {
  it("texte fixe qui ne désigne ni l'auteur ni le motif", () => {
    const out = html(PurchaseReported, { ...props, reason: "fraude", reportedBy: "Awa", comment: "il a volé" })
    expect(out).toContain("a été signalée")
    expect(out).toContain("L’équipe EduCash examine le signalement.")
    expect(out).not.toMatch(/fraude|Awa|volé/)
  })

  it("lien selon le destinataire : client avec l'étudiant, étudiant sans", () => {
    expect(html(PurchaseReported, { ...props, recipient: "client" })).toContain(`/client/messages/${IDS.missionId}?studentId=${IDS.studentId}&amp;demande=${IDS.requestId}"`)
    const student = html(PurchaseReported, { ...props, recipient: "student" })
    expect(student).toContain(`/messages/${IDS.missionId}?demande=${IDS.requestId}"`)
    expect(student).not.toContain("/client/")
  })
})
