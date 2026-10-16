// @ds-screen RD-STUDENT-01
// Tests de comportement indépendants (TESTER ST-10) : confidentialité, montants, estimation, prénom hostile,
// date de rétention, ?postuler=1, h1 unique, paragraphe provisoire de l'en-tête.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const applyMock = vi.fn()
vi.mock("@/lib/actions/application.actions", () => ({ apply: (...args) => applyMock(...args) }))
const detailMock = vi.fn()
vi.mock("@/lib/actions/student-mission-detail.actions", () => ({ getStudentMissionDetail: (...a) => detailMock(...a) }))
const paymentsMock = vi.fn(() => true)
vi.mock("@/lib/constants/payments", () => ({ paymentsEnabled: () => paymentsMock() }))

const { MissionApplyView } = await import("./apply-view")
const { MissionFollowupView } = await import("./followup-view")
const { MissionHeader } = await import("./mission-header")
const { netAmount } = await import("@/lib/constants/missions")
const { formatAmount, formatFcfa } = await import("@/lib/app/format")
const page = (await import("@/app/(student)/student/missions/[id]/page")).default

const on = { postuler: false, paymentsEnabled: true }
const off = { postuler: false, paymentsEnabled: false }
const SECRETS = {
  email: "afiavi.dossou@secret-mail.test",
  phone: "+22997001122",
  phoneLocal: "97001122",
  userId: "11111111-2222-3333-4444-555555555555",
  clientId: "99999999-8888-7777-6666-555555555555",
  surname: "Dossou-Gbenou",
}
const client = (over = {}) => ({
  name: "Afiavi D.", avatarUrl: null, city: "Cadjèhoun", rating: 4.6, missionsPublished: 5, isVerified: true,
  // Champs que la lecture ne devrait jamais fournir : la vue ne doit de toute façon jamais les écrire.
  email: SECRETS.email, phone: SECRETS.phone, id: SECRETS.userId, user_id: SECRETS.userId, fullName: `Afiavi ${SECRETS.surname}`,
  ...over,
})
const mission = (over = {}) => ({
  id: "m1", title: "Courses du mois", description: "Courses au marché.", type: "Livraison", city: "Cotonou",
  budget: 8000, purchasesEstimate: 45000, urgency: "low", deadline: "2999-10-10", status: "open",
  createdAt: "2026-10-07T08:00:00Z", client_id: SECRETS.clientId, ...over,
})
const VERIFIED = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null }
const open = (over = {}) => ({
  state: "open", mission: mission(), client: client(), application: null, isSelected: false, verification: VERIFIED,
  ledger: [], review: null, similar: [], ...over,
})
const accepted = { id: "a1", status: "accepted", message: "Bonjour", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-08T08:00:00Z" }
const followed = (status = "in_progress", over = {}, missionOver = {}) => ({
  state: "selected", mission: mission({ status, ...missionOver }), client: client(), application: accepted,
  isSelected: true, verification: null, ledger: [], review: null, similar: [], ...over,
})
const apply = (d, f = on) => renderToStaticMarkup(<MissionApplyView detail={d} flags={f} />)
const follow = (d, f = on) => renderToStaticMarkup(<MissionFollowupView detail={d} flags={f} />)
const h1 = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const text = (html) => html.replace(/<[^>]+>/g, " ")
const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
const BROKEN = /NaN|undefined|null|Infinity/

beforeEach(() => {
  applyMock.mockReset()
  detailMock.mockReset()
  paymentsMock.mockReturnValue(true)
})

describe("(1) confidentialité : coordonnées et identité du client", () => {
  const cases = [
    ["E03 candidat, avec achats", () => apply(open())],
    ["E03 candidat, sans achats", () => apply(open({ mission: mission({ purchasesEstimate: null }) }))],
    ["E03 candidat, paiements coupés", () => apply(open(), off)],
    ["E03 candidature envoyée", () => apply(open({ application: { id: "a", status: "pending", message: "x", createdAt: "2026-10-08T08:00:00Z", updatedAt: null } }))],
    ["E05 retenu, avec achats", () => follow(followed())],
    ["E05 retenu, sans achats", () => follow(followed("in_progress", {}, { purchasesEstimate: null }))],
    ["E05 retenu, terminé", () => follow(followed("done"))],
    ["E05 retenu, paiements coupés", () => follow(followed(), off)],
  ]
  it.each(cases)("%s : ni e-mail, ni téléphone, ni identifiant, ni nom complet", (_label, render) => {
    const html = render()
    for (const secret of Object.values(SECRETS)) expect(html).not.toContain(secret)
    expect(html).not.toMatch(/mailto:|tel:|\+229|@/i)
    for (const href of hrefs(html)) {
      expect(href).not.toContain(SECRETS.clientId)
      expect(href).not.toContain(SECRETS.userId)
      expect(href).not.toMatch(/mailto:|tel:|email|phone/i)
    }
  })

  it("le nom public « Prénom N. » seul est montré", () => {
    expect(apply(open())).toContain("Afiavi D.")
    expect(follow(followed())).toContain("Afiavi D.")
  })
})

describe("(2) montants invalides : aucun montant, aucun NaN ni undefined", () => {
  const budgets = [0, -8000, NaN, "abc", Infinity, -Infinity, undefined, null]
  it.each(budgets.map((b) => [String(b), b]))("E03 budget %s", (_l, budget) => {
    const html = apply(open({ mission: mission({ budget }) }))
    expect(html).not.toMatch(BROKEN)
    expect(text(html)).not.toContain("Vous touchez (88 %)")
    expect(text(html)).not.toContain("Budget du client")
    expect(text(html)).not.toContain("Commission EduCash")
    expect(html).not.toMatch(/Seul le service \(/)
  })
  it.each(budgets.map((b) => [String(b), b]))("E03 budget %s, état bloqué (carte à envoyer)", (_l, budget) => {
    const blocked = { key: "not_submitted", label: "Carte", canApply: false, daysLeft: null, action: null }
    const html = apply(open({ mission: mission({ budget }), verification: blocked }))
    expect(html).not.toMatch(BROKEN)
    expect(text(html)).not.toContain("Commission EduCash")
  })
  it.each(budgets.map((b) => [String(b), b]))("E05 budget %s", (_l, budget) => {
    const html = follow(followed("in_progress", {}, { budget }))
    expect(html).not.toMatch(BROKEN)
    expect(text(html)).not.toContain("Votre part")
    expect(text(html)).not.toContain("Commission EduCash")
  })
  it("E05 terminé, budget invalide avec reçu : seul le versé est montré", () => {
    const html = follow(followed("done", { ledger: [{ type: "release", amount: 7040, createdAt: "2026-10-09T08:00:00Z" }] }, { budget: NaN }))
    expect(html).not.toMatch(BROKEN)
    expect(html).toContain(formatFcfa(7040))
    expect(text(html)).not.toContain("Commission EduCash")
  })

  const estimates = [0, -1, -45000, NaN, "abc", Infinity, undefined, null, "", true]
  it.each(estimates.map((e) => [String(e), e]))("estimation %s : aucun bloc achats (E03 et E05)", (_l, purchasesEstimate) => {
    const a = apply(open({ mission: mission({ purchasesEstimate }) }))
    const f = follow(followed("in_progress", {}, { purchasesEstimate }))
    for (const html of [a, f]) {
      expect(html).not.toMatch(BROKEN)
      expect(html).not.toContain("Mission avec achats")
      expect(html).not.toContain("Comment se passent les achats")
      expect(html).not.toContain("Achats de la mission")
      expect(html).not.toContain("Achats estimés")
      expect(html).not.toContain("Avec achats")
    }
  })

  it("le « vous touchez » vient de netAmount : 8000 -> 7 040, jamais un taux en dur", () => {
    expect(netAmount(8000)).toBe(7040)
    const html = apply(open())
    expect(html).toContain(formatAmount(netAmount(8000)))
    expect(text(html)).toContain("7")
    expect(html).not.toMatch(/0[.,]12\b/)
    expect(follow(followed())).toContain(formatFcfa(netAmount(8000)))
  })
  it.each([[1000], [12345], [999999999]])("net cohérent avec netAmount pour %s", (budget) => {
    expect(apply(open({ mission: mission({ budget }) }))).toContain(formatAmount(netAmount(budget)))
    expect(follow(followed("in_progress", {}, { budget }))).toContain(formatFcfa(netAmount(budget)))
  })

  it("« séquestre » absent partout si les paiements sont coupés (E03 : cartes, barre, déroulé, modale ; E05 : badge)", () => {
    const states = [
      apply(open(), off),
      apply(open({ mission: mission({ purchasesEstimate: null }) }), off),
      apply(open({ verification: { key: "not_submitted", label: "Carte", canApply: false, daysLeft: null, action: null } }), off),
      apply(open({ application: { id: "a", status: "pending", message: "x", createdAt: "2026-10-08T08:00:00Z", updatedAt: null } }), off),
      renderToStaticMarkup(<MissionApplyView detail={open()} flags={{ postuler: true, paymentsEnabled: false }} />),
      follow(followed(), off),
      follow(followed("in_progress", {}, { purchasesEstimate: null }), off),
      follow(followed("done"), off),
      follow(followed("cancelled"), off),
    ]
    for (const html of states) {
      expect(html.toLowerCase()).not.toContain("séquestre")
      expect(html.toLowerCase()).not.toContain("sequestre")
      expect(html).not.toContain("bloqués par EduCash")
    }
  })
  it("« séquestre » présent quand les paiements sont ouverts (garde-fou du test précédent)", () => {
    expect(apply(open()).toLowerCase()).toContain("séquestre")
    expect(follow(followed()).toLowerCase()).toContain("séquestre")
  })

  it("budget numérique en chaîne « 8000 » : pas de NaN, cohérence entre cartes", () => {
    const html = apply(open({ mission: mission({ budget: "8000" }) }))
    expect(html).not.toMatch(BROKEN)
  })
})

describe("(3) l'estimation des achats n'est jamais ajoutée au gain ni au séquestre", () => {
  const forbidden = [23000, 21000, 22440].flatMap((n) => [formatAmount(n), formatFcfa(n)])
  it("budget 8000 + estimation 15000 : ni 23 000, ni 21 000, ni 22 440", () => {
    const m = { budget: 8000, purchasesEstimate: 15000 }
    const htmls = [
      apply(open({ mission: mission(m) })),
      apply(open({ mission: mission(m) }), off),
      follow(followed("in_progress", {}, m)),
      follow(followed("in_progress", {}, m), off),
      follow(followed("done", {}, m)),
    ]
    for (const html of htmls) {
      for (const bad of forbidden) expect(html).not.toContain(bad)
      for (const bad of ["23 000", "21 000", "22 440", "23000", "21000", "22440", "23 000", "23 000", "22 440", "22 440", "21 000", "21 000"]) {
        expect(html).not.toContain(bad)
      }
    }
    const html = apply(open({ mission: mission(m) }))
    expect(html).toContain(formatAmount(7040))
    expect(html).toContain(`≈ ${formatAmount(15000)}`)
    expect(html).toContain("Ni bloqués ni soumis à commission")
  })
})

describe("(4) prénom du client hostile", () => {
  const hostile = [
    ["script", "<script>alert(1)</script> X."],
    ["balise img", "<img src=x onerror=alert(1)> Z."],
    ["guillemets", '"><svg/onload=alert(1)> Q.'],
    ["200 caractères", `${"A".repeat(200)} B.`],
  ]
  it.each(hostile)("%s : échappé, jamais de balise injectée", (_l, name) => {
    for (const html of [follow(followed("in_progress", { client: client({ name }) })), apply(open({ client: client({ name }) }))]) {
      expect(html).not.toContain("<script>alert")
      expect(html).not.toMatch(/<img src=x/)
      expect(html).not.toMatch(/<svg\/onload/)
    }
    const html = follow(followed("in_progress", { client: client({ name }) }))
    expect(html).toContain("Écrire à ")
  })
  it("repli « Écrire au client » : nom vide, espaces, anonyme, absent", () => {
    for (const name of ["", "   ", "Client EduCash", undefined, null]) {
      const html = follow(followed("in_progress", { client: client({ name }) }))
      expect(html).toContain("Écrire au client")
      expect(html).not.toContain("Écrire à Client")
      expect(html).not.toMatch(/Écrire à (undefined|null)/)
    }
  })
  it("déroulé et note achats : repli « Le client », jamais undefined", () => {
    for (const name of ["", "Client EduCash"]) {
      const a = apply(open({ client: client({ name }) }))
      const f = follow(followed("in_progress", { client: client({ name }) }))
      expect(a).toContain("Le client paie le vendeur directement par MoMo")
      expect(f).toContain("Le client paie les vendeurs directement")
      expect(a).not.toMatch(BROKEN)
      expect(f).not.toMatch(BROKEN)
    }
  })
})

describe("(5) date de rétention : omise, aucune date fiable (applications.updated_at change à toute mise à jour)", () => {
  const withApp = (status, updatedAt) => followed("in_progress", { application: { ...accepted, status, updatedAt } })
  it("jamais de « retenue le », quel que soit le statut de la candidature", () => {
    for (const status of ["accepted", "pending", "rejected", "withdrawn", "cancelled"]) {
      expect(follow(withApp(status, "2026-10-08T08:00:00Z"))).not.toContain("retenue le")
    }
  })
  it("date absente : aucune ligne, jamais Invalid Date", () => {
    for (const bad of [null, undefined, ""]) {
      const html = follow(withApp("accepted", bad))
      expect(html).not.toContain("Invalid Date")
      expect(html).not.toMatch(BROKEN)
      expect(html).not.toContain("retenue le")
    }
  })
  // Corrigé en ST-10b : trackSteps, le reçu, l'en-tête et le bloc de candidature passent par safeDateFr (jamais de RangeError).
  it("date invalide : aucune ligne, aucune exception, l'étape s'affiche sans date", () => {
    for (const bad of ["pas une date", "2026-13-45", "NaN"]) {
      const html = follow(withApp("accepted", bad))
      expect(html).not.toContain("Invalid Date")
      expect(html).not.toContain("retenue le")
      expect(html).toContain("Votre candidature a été retenue")
    }
  })
  it("pas de candidature du tout : aucune ligne", () => {
    const html = follow(followed("in_progress", { application: null }))
    expect(html).not.toContain("retenue le")
    expect(html).not.toMatch(BROKEN)
  })
})

describe("(6) ?postuler=1 ouvre seulement la modale", () => {
  it("le rendu avec postuler:true n'appelle jamais apply", () => {
    renderToStaticMarkup(<MissionApplyView detail={open()} flags={{ postuler: true, paymentsEnabled: true }} />)
    expect(applyMock).not.toHaveBeenCalled()
  })
  it("la page convertit ?postuler=1 en drapeau et n'exécute aucune action", async () => {
    detailMock.mockResolvedValue(open())
    const el = await page({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve({ postuler: "1" }) })
    expect(el.props.flags).toEqual({ postuler: true, paymentsEnabled: true })
    renderToStaticMarkup(el)
    expect(applyMock).not.toHaveBeenCalled()
  })
  it.each([[undefined], ["0"], ["true"], ["2"], [["1", "1"]]])("valeur %j : drapeau faux", async (value) => {
    detailMock.mockResolvedValue(open())
    const el = await page({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve({ postuler: value }) })
    expect(el.props.flags.postuler).toBe(false)
  })
  it("page sans searchParams : pas d'erreur", async () => {
    detailMock.mockResolvedValue(open())
    const el = await page({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve(undefined) })
    expect(el.props.flags.postuler).toBe(false)
  })
  it("?postuler=1 sur une mission retenue : vue de suivi, aucune action", async () => {
    detailMock.mockResolvedValue(followed())
    const el = await page({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve({ postuler: "1" }) })
    renderToStaticMarkup(el)
    expect(applyMock).not.toHaveBeenCalled()
  })
})

describe("(7) un seul h1", () => {
  it("E03 et E05, tous états", () => {
    const views = [
      apply(open()),
      apply(open({ mission: mission({ purchasesEstimate: null }) })),
      apply(open({ mission: mission({ status: "closed" }) })),
      apply({ state: "closed", mission: { id: "m1" } }),
      apply(open({ application: { id: "a", status: "pending", message: "x", createdAt: "2026-10-08T08:00:00Z", updatedAt: null } })),
      apply(open({ mission: mission({ budget: NaN, purchasesEstimate: NaN }) })),
      follow(followed("in_progress")),
      follow(followed("done")),
      follow(followed("cancelled")),
      follow(followed("in_progress", {}, { purchasesEstimate: null })),
    ]
    for (const html of views) expect(h1(html)).toBe(1)
  })
})

describe("(8) ligne provisoire « Achats estimés » de mission-header.jsx", () => {
  const props = { back: { href: "/x", label: "Retour" } }
  it("présente par défaut (classe body-s, enfant direct de l'en-tête)", () => {
    for (const variant of ["03", "05"]) {
      const html = renderToStaticMarkup(<MissionHeader mission={mission()} variant={variant} {...props} />)
      expect(html).toContain(`<header class="e2-${variant}-top">`)
      expect(html).toMatch(/<p class="body-s">Achats estimés : environ [^<]+, non bloqués<\/p>/)
    }
  })
  it("coupée par withPurchasesLine={false}, et absente des vues E03 et E05", () => {
    const html = renderToStaticMarkup(<MissionHeader mission={mission()} withPurchasesLine={false} {...props} />)
    expect(html).not.toContain("non bloqués")
    expect(html).toContain("Avec achats")
    expect(apply(open())).not.toContain("non bloqués")
    expect(follow(followed("in_progress"))).not.toContain("non bloqués")
  })
  it("plus aucune règle CSS de masquage", () => {
    const css = (f) => readFileSync(join(process.cwd(), "src/app/design/student", f), "utf8")
    expect(css("e03.css")).not.toContain(".body-s")
    expect(css("e05.css")).not.toContain(".body-s")
  })
  it("absente sans estimation valide", () => {
    const html = renderToStaticMarkup(<MissionHeader mission={mission({ purchasesEstimate: 0 })} {...props} />)
    expect(html).not.toContain("body-s")
    expect(html).not.toContain("Achats estimés")
  })
})
