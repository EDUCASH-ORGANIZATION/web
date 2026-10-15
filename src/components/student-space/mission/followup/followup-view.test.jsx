// @ds-screen RD-STUDENT-01
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")
const { escrowSplit } = await import("@/lib/app/money")
const { formatFcfa } = await import("@/lib/app/format")

const flags = { postuler: false, paymentsEnabled: false }
const client = { name: "Rosine H.", avatarUrl: null, city: "Cotonou", rating: 4.8, missionsPublished: 3, isVerified: true }
const detail = (status, over = {}, missionOver = {}) => ({
  state: "selected",
  mission: {
    id: "m1", title: "Cours de maths niveau 3e", description: "Deux soirs par semaine.", type: "Cours particuliers",
    city: "Cotonou", budget: 25000, urgency: "low", deadline: "2999-01-01", status, createdAt: "2026-09-30T10:14:00Z",
    ...missionOver,
  },
  client,
  application: { id: "a1", status: "accepted", message: "Hello", createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-02T18:02:00Z" },
  isSelected: true,
  verification: null,
  ledger: [],
  review: null,
  similar: [],
  ...over,
})
const render = (d, f = flags) => renderToStaticMarkup(<MissionFollowupView detail={d} flags={f} />)
const paymentsOn = { postuler: false, paymentsEnabled: true }
const text = (html) => html.replace(/<[^>]+>/g, " ")
const release = [{ type: "release", amount: 22000, createdAt: "2026-10-20T10:00:00Z" }]

describe("MissionFollowupView (E05)", () => {
  it("en cours : suivi neutre, anneau sur l'etape en cours, votre part par escrowSplit, badge en sequestre", () => {
    const html = render(detail("in_progress"))
    const split = escrowSplit(25000)
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1)
    expect(html).toContain("e2-track")
    expect(html).toContain("e2-step--now")
    expect(html).toContain('aria-current="step"')
    expect(html).toContain("Candidature envoy")
    expect(html).not.toContain("En séquestre")
    expect(html).not.toContain("bloqué en séquestre")
    expect(html).toContain("Commission EduCash (12 %)")
    expect(html).toContain(formatFcfa(split.total))
    expect(html).toContain(formatFcfa(split.commission))
    expect(html).toContain(formatFcfa(split.student))
    expect(html).toContain("Quand c&#x27;est fini, prévenez le client dans la messagerie : il confirme la fin et votre part est versée sur votre portefeuille.")
  })

  it("le sequestre reste le seul budget : l'estimation d'achats n'est jamais ajoutee", () => {
    const html = render(detail("in_progress", {}, { budget: 8000, purchasesEstimate: 15000 }))
    expect(html).toContain(formatFcfa(escrowSplit(8000).total))
    expect(html).not.toContain(formatFcfa(23000))
    expect(html).toContain("Achats estimés : environ")
  })

  it("en cours, paiements ouverts : badge et phrase du sequestre", () => {
    const html = render(detail("in_progress"), paymentsOn)
    expect(html).toContain("En séquestre")
    expect(html).toContain("Le budget est bloqué en séquestre.")
    expect(html).not.toContain("indicatifs")
  })

  it("en cours, paiements coupes : texte neutre, aucune promesse de fonds bloques", () => {
    const html = render(detail("in_progress"), flags)
    expect(html).toContain("Ces montants sont indicatifs")
    expect(html).not.toMatch(/séquestre/)
  })

  it("annulee : vouvoiement, aucun montant, quel que soit le drapeau", () => {
    for (const f of [flags, paymentsOn]) {
      const html = render(detail("cancelled"), f)
      expect(html).toContain("aucun montant ne vous est dû")
      expect(html).not.toContain("En séquestre")
    }
  })

  it("en cours : ecrire au client, signaler un probleme, aucun bouton J'ai terminé, pas de citron ni de carte bleue", () => {
    const html = render(detail("in_progress"))
    expect(html).toContain('href="/messages/m1"')
    expect(html).toContain("Écrire au client")
    expect(html).toContain('href="/contact?sujet=question"')
    expect(html).not.toMatch(/ai termin/)
    expect(html).not.toContain("flag2")
    expect(html).not.toContain("money2")
    expect(html).not.toContain("<button")
    expect(html).toContain('href="/applications"')
  })

  it("terminee non notee : recu egal a la ligne release (NET), date et lien pour noter", () => {
    const html = render(detail("done", { ledger: release }))
    expect(html).toContain("Reçu")
    expect(html).toContain("Payé")
    expect(html).toContain(formatFcfa(22000))
    expect(html).toContain("Noter le client")
    expect(html).toContain("/student/review/m1")
    expect(html).not.toContain("En séquestre")
    expect(html).not.toContain("Tu as fini")
  })

  it("terminee notee : avis donne, plus de lien pour noter", () => {
    const review = { id: "r1", rating: 5, comment: null, createdAt: "2026-10-21T00:00:00Z" }
    const html = render(detail("done", { ledger: release, review }))
    expect(html).toContain("Avis donné")
    expect(html).not.toContain("Noter le client")
  })

  it("terminee sans ligne de grand livre : paiement en cours, aucun montant de part invente", () => {
    const html = render(detail("done"))
    expect(html).toContain("Paiement en cours de traitement")
    expect(html).not.toContain(formatFcfa(escrowSplit(25000).student))
    expect(html).not.toContain("Payé")
    expect(html).not.toContain("Versé sur votre portefeuille")
  })

  it("annulee : explication, aucun montant, ni ecrire ni signaler", () => {
    const html = render(detail("cancelled"))
    expect(html).toContain("a été annulée")
    expect(html).not.toContain("FCFA")
    expect(html).not.toContain("En séquestre")
    expect(html).not.toContain("Écrire au client")
    expect(html).not.toContain("Signaler")
  })

  it("10 chiffres : montants complets, pas de troncature", () => {
    const html = render(detail("in_progress", {}, { budget: 9999999999 }))
    expect(html).toContain(formatFcfa(9999999999))
    expect(html).toContain(formatFcfa(escrowSplit(9999999999).student))
  })

  it("client public seulement : prenom et ville, aucune donnee privee", () => {
    const html = render(detail("in_progress"))
    expect(html).toContain("Rosine H.")
    expect(html).not.toMatch(/@|\+229|phone|email/i)
  })

  it("aucune mention d'achats, de 72 h, de liberation automatique, d'avis croises differes ni de tutoiement", () => {
    for (const d of [detail("in_progress"), detail("done", { ledger: release }), detail("cancelled")]) {
      const t = text(render(d))
      expect(t).not.toMatch(/achat|72 ?h|automatique|croisé|séance|À confirmer/i)
      expect(t).not.toMatch(/(?<![\p{L}])(tu|toi|ton|ta|tes)(?![\p{L}])/iu)
      expect(t).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    }
  })

  it("fichiers de l'ecran : marqueur, aucune couleur en dur ni style en ligne", () => {
    for (const f of ["followup-view.jsx", "followup/track.jsx", "followup/earning-lines.jsx", "followup/receipt.jsx"]) {
      const src = readFileSync(`src/components/student-space/mission/${f}`, "utf8")
      expect(src).toContain("@ds-screen RD-STUDENT-01")
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|style=\{|0\.88|0\.12/)
    }
  })
})
