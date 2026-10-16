// @ds-screen RD-STUDENT-01
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))

const { MissionApplyView } = await import("./apply-view")
const { MissionFollowupView } = await import("./followup-view")
const { netAmount } = await import("@/lib/constants/missions")
const { formatAmount, formatFcfa } = await import("@/lib/app/format")
const { clientFirstName, gainIsValid } = await import("@/lib/student-space/mission-view")

const on = { postuler: false, paymentsEnabled: true }
const off = { postuler: false, paymentsEnabled: false }
const client = { name: "Afiavi D.", avatarUrl: null, city: "Cadjèhoun", rating: 4.6, missionsPublished: 5, isVerified: true }
const mission = (over = {}) => ({
  id: "m1", title: "Courses du mois", description: "Courses au marché.", type: "Livraison", city: "Cotonou",
  budget: 8000, purchasesEstimate: 45000, urgency: "low", deadline: "2999-10-10", status: "open",
  createdAt: "2026-10-07T08:00:00Z", ...over,
})
const VERIFIED = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null }
const open = (over = {}) => ({
  state: "open", mission: mission(), client, application: null, isSelected: false, verification: VERIFIED,
  ledger: [], review: null, similar: [], ...over,
})
const followed = (status = "in_progress", over = {}, missionOver = {}) => ({
  state: "selected", mission: mission({ status, ...missionOver }), client,
  application: { id: "a1", status: "accepted", message: "Bonjour", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-08T08:00:00Z" },
  isSelected: true, verification: null, ledger: [], review: null, similar: [], ...over,
})
const apply = (d, f = on) => renderToStaticMarkup(<MissionApplyView detail={d} flags={f} />)
const follow = (d, f = on) => renderToStaticMarkup(<MissionFollowupView detail={d} flags={f} />)
const h1 = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const clean = (html) => html.replace(/<[^>]+>/g, " ")
const BROKEN = /NaN|undefined|null|Infinity/

describe("clientFirstName et gainIsValid", () => {
  it("prénom du nom public, null pour un nom absent ou anonyme", () => {
    expect(clientFirstName("Afiavi D.")).toBe("Afiavi")
    expect(clientFirstName("Client EduCash")).toBeNull()
    expect(clientFirstName("")).toBeNull()
    expect(clientFirstName(undefined)).toBeNull()
  })

  it("gain valide : budget fini > 0 et net >= 0", () => {
    expect(gainIsValid({ total: 8000, student: 7040 })).toBe(true)
    expect(gainIsValid({ total: 0, student: 0 })).toBe(false)
    expect(gainIsValid({ total: NaN, student: NaN })).toBe(false)
    expect(gainIsValid({ total: 8000, student: -1 })).toBe(false)
    expect(gainIsValid(undefined)).toBe(false)
  })
})

describe("E03 mission avec achats", () => {
  const html = apply(open())

  it("encadré, déroulé en photos, ligne indicative, note, sans demande de paiement ni carte Détails", () => {
    expect(h1(html)).toBe(1)
    expect(html).toContain("Mission avec achats")
    expect(html).toContain("Comment se passent les achats")
    expect(html).toContain("Achats estimés · indicatif")
    expect(html).toContain(`≈ ${formatAmount(45000)}`)
    expect(html).toContain("Ni bloqués ni soumis à commission")
    expect(html).toContain("photo")
    expect(html).toContain("Afiavi paie le vendeur directement par MoMo")
    expect(html).not.toMatch(/demande de paiement/i)
    expect(html).not.toContain("Détails")
  })

  it("montants : le service et le net viennent de netAmount, jamais d'un taux écrit en dur", () => {
    expect(html).toContain(formatAmount(8000))
    expect(html).toContain(formatAmount(netAmount(8000)))
  })

  it("séquestre cité quand les paiements sont ouverts, jamais quand ils sont coupés", () => {
    expect(html.toLowerCase()).toContain("séquestre")
    const paused = apply(open(), off)
    expect(paused.toLowerCase()).not.toContain("séquestre")
    expect(paused).toContain("Mission avec achats")
    expect(paused).toContain("Comment se passent les achats")
  })

  it("aucune coordonnée du client", () => {
    expect(html).not.toMatch(/\+229|@|téléphone|phone/i)
  })

  it("sans estimation : ni encadré, ni déroulé, ni ligne achats", () => {
    const plain = apply(open({ mission: mission({ purchasesEstimate: null }) }))
    expect(plain).not.toContain("Mission avec achats")
    expect(plain).not.toContain("Comment se passent les achats")
    expect(plain).not.toContain("Achats estimés")
    expect(plain).toContain("Vous touchez (88 %)")
  })

  it.each([[0], [-5], [NaN], ["abc"], [1e12]])("estimation invalide %s : aucun bloc achats", (purchasesEstimate) => {
    const plain = apply(open({ mission: mission({ purchasesEstimate }) }))
    expect(plain).not.toContain("Comment se passent les achats")
    expect(plain).not.toMatch(BROKEN)
  })

  it.each([[0], [NaN], [undefined], [-100]])("budget invalide %s : aucun montant, jamais NaN ni undefined", (budget) => {
    const broken = apply(open({ mission: mission({ budget }) }))
    expect(broken).not.toMatch(BROKEN)
    expect(clean(broken)).not.toContain("Vous touchez (88 %)")
    expect(clean(broken)).not.toContain("Budget du client")
  })

  it("nombre de candidats seulement s'il est fourni", () => {
    expect(apply(open({ mission: mission({ applicationsCount: 3 }) }))).toContain("3 candidats")
    expect(html).not.toContain("candidat<")
    expect(html).not.toMatch(/\d+ candidats?</)
  })

  it("candidature déjà envoyée : le déroulé reste, aucune mutation par lecture", () => {
    const sent = apply(open({ application: { id: "a1", status: "pending", message: "Bonjour", createdAt: "2026-10-08T08:00:00Z", updatedAt: null } }))
    expect(sent).toContain("Candidature envoyée")
    expect(sent).toContain("Comment se passent les achats")
  })
})

describe("E05 suivi d'une mission avec achats", () => {
  const html = follow(followed())

  it("bloc achats réduit en tête, avant la chronologie, hors EduCash", () => {
    expect(h1(html)).toBe(1)
    expect(html).toContain("Achats de la mission")
    expect(html).toContain("Hors EduCash")
    expect(html).toContain(`≈ ${formatFcfa(45000)}`)
    expect(html.indexOf("Achats de la mission")).toBeLessThan(html.indexOf("Où en est la mission"))
    expect(html).not.toMatch(/demande de paiement/i)
  })

  it("colonne droite : badge En séquestre, budget du service, net par netAmount, écrire au prénom, sans profil client", () => {
    expect(html).toContain("En séquestre")
    expect(html).toContain("Budget du service (100 %)")
    expect(html).toContain(formatFcfa(netAmount(8000)))
    expect(html).toContain("Écrire à Afiavi")
    expect(html).not.toContain("Voir le profil")
    expect(html).toContain("Vous avez fini ?")
  })

  it("ne code ni « J'ai terminé » ni « À confirmer »", () => {
    expect(html).not.toContain("J&#x27;ai terminé")
    expect(html).not.toContain("À confirmer")
  })

  it("date de rétention transmise à l'en-tête, jamais une candidature non retenue", () => {
    expect(html).toContain("retenue le")
    const pending = follow(followed("in_progress", { application: { id: "a1", status: "pending", message: "x", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-08T08:00:00Z" } }))
    expect(pending).not.toContain("retenue le")
  })

  it("paiements coupés : le mot séquestre disparaît, les achats restent expliqués", () => {
    const paused = follow(followed(), off)
    expect(paused.toLowerCase()).not.toContain("séquestre")
    expect(paused).toContain("Achats de la mission")
    expect(paused).toContain("indicatifs")
  })

  it("mission annulée : plus de bloc achats ; sans estimation : jamais de bloc", () => {
    expect(follow(followed("cancelled"))).not.toContain("Achats de la mission")
    expect(follow(followed("in_progress", {}, { purchasesEstimate: null }))).not.toContain("Achats de la mission")
  })

  it("budget invalide : aucun montant du gain, jamais NaN ni undefined", () => {
    const broken = follow(followed("in_progress", {}, { budget: NaN }))
    expect(broken).not.toMatch(BROKEN)
    expect(clean(broken)).not.toContain("Votre part")
  })

  it("client anonyme : « Écrire au client »", () => {
    const anon = follow(followed("in_progress", { client: { ...client, name: "Client EduCash" } }))
    expect(anon).toContain("Écrire au client")
    expect(anon).not.toContain("Écrire à Client")
  })

  it("en-tête mobile de sous-page : retour aux candidatures et écrire au client", () => {
    expect(html).toContain('class="e2-mtop"')
    expect(html).toContain("Mission en cours")
    expect(html).toContain('aria-label="Retour aux candidatures"')
    expect(html).toContain('aria-label="Écrire au client"')
  })
})
