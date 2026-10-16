// @ds-screen RD-STUDENT-01
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))

const { MissionApplyView } = await import("./apply-view")
const { MissionFollowupView } = await import("./followup-view")
const { netAmount } = await import("@/lib/constants/missions")
const { formatAmount, formatFcfa } = await import("@/lib/app/format")
const { rulesOf } = await import("@/qa/fidelity/css-rules")
const { clientFirstName, gainIsValid, safeDateFr } = await import("@/lib/student-space/mission-view")

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

  it("prénom tronqué à 40 caractères", () => {
    const long = "A".repeat(200)
    expect(clientFirstName(`${long} B.`)).toBe(`${"A".repeat(40)}…`)
    expect(follow(followed("in_progress", { client: { ...client, name: `${long} B.` } }))).toContain(`Écrire à ${"A".repeat(40)}…`)
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

  it("jamais de nombre de candidats, même si la donnée est fournie, ni de ligne provisoire d'achats", () => {
    const out = clean(apply(open({ mission: mission({ applicationsCount: 3 }) })))
    expect(out).not.toMatch(/\d+ candidats?/)
    expect(out).not.toContain("non bloqués")
  })

  it("paiements fermés : le montant du service est le budget réel, formulation indicative", () => {
    const paused = clean(apply(open({ mission: mission({ budget: 12345 }) }), off))
    expect(paused).toContain(`Seul le service (${formatAmount(12345)}) passera par EduCash ; montants indicatifs tant que les paiements ne sont pas ouverts.`)
    expect(paused).not.toContain(formatAmount(8000))
  })

  it("candidature déjà envoyée : le déroulé reste affiché", () => {
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

  it("aucune date de rétention affichée (applications.updated_at n'est pas fiable) ni ligne provisoire d'achats", () => {
    expect(html).not.toContain("retenue le")
    expect(html).not.toContain("non bloqués")
  })

  it("badge En cours dans la carte de suivi seulement pour une mission en cours", () => {
    expect(html).toContain("En cours")
    expect(follow(followed("done"))).not.toContain(">En cours<")
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

describe("dates invalides : jamais de plantage", () => {
  it.each(["pas une date", "2026-13-45", "NaN"])("E05 et E03, date %s", (bad) => {
    expect(() => follow(followed("done", { ledger: [{ type: "release", amount: 7040, createdAt: bad }], application: { id: "a", status: "accepted", message: "x", createdAt: bad, updatedAt: bad } }, { createdAt: bad, deadline: bad }))).not.toThrow()
    expect(() => apply(open({ mission: mission({ createdAt: bad, deadline: bad }) }))).not.toThrow()
  })

  it("safeDateFr : vide pour absent ou invalide, date lisible sinon", () => {
    expect(safeDateFr(null)).toBe("")
    expect(safeDateFr("")).toBe("")
    expect(safeDateFr("pas une date")).toBe("")
    expect(safeDateFr("2026-10-08")).toBe("8 octobre 2026")
  })
})

describe("légende du séquestre masquée en mobile", () => {
  const css = readFileSync("src/app/design/student/e05.css", "utf8")

  it("la règle mobile ne vise que la classe dédiée", () => {
    const rules = rulesOf(css, ".e2-05-caption--seq", { media: "max-width" })
    expect(rules).toHaveLength(1)
    expect(rules[0].declarations.display).toBe("none")
    expect(rulesOf(css, ".e2-05-caption", { media: "*" }).some((r) => r.declarations.display === "none")).toBe(false)
    expect(rulesOf(css, ".e2-05-lines--p .e2-05-caption", { media: "*" })).toHaveLength(0)
  })

  it("classe posée seulement avec achats, paiements ouverts, mission non annulée", () => {
    expect(follow(followed(), on)).toContain("e2-05-caption e2-05-caption--seq")
  })

  it("paiements fermés : la légende indicative est rendue, sans classe de masquage", () => {
    const paused = follow(followed(), off)
    expect(paused).toContain("Ces montants sont indicatifs")
    expect(paused).not.toContain("e2-05-caption--seq")
  })

  it("mission annulée : la ligne d'annulation est rendue, sans classe de masquage", () => {
    const cancelled = follow(followed("cancelled"), on)
    expect(cancelled).toContain("Cette mission a été annulée : aucun montant ne vous est dû.")
    expect(cancelled).not.toContain("e2-05-caption--seq")
  })

  it("sans estimation : aucune classe de masquage", () => {
    expect(follow(followed("in_progress", {}, { purchasesEstimate: null }), on)).not.toContain("e2-05-caption--seq")
  })
})
