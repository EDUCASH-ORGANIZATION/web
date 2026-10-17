// @ds-screen RD-STUDENT-01
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))
vi.mock("@/lib/actions/mission-completion.actions", () => ({ declareMissionCompletion: vi.fn() }))

const { MissionApplyView } = await import("./apply-view")
const { MissionFollowupView } = await import("./followup-view")
const { netAmount } = await import("@/lib/constants/missions")
const { formatAmount, formatFcfa } = await import("@/lib/app/format")
const { ANONYMOUS_CLIENT_NAME } = await import("@/lib/constants/client-name")
const { rulesOf } = await import("@/qa/fidelity/css-rules")
const { clientFirstName, gainIsValid } = await import("@/lib/student-space/mission-view")
const { safeDateFr } = await import("@/lib/app/format")
const { purchaseTotals: purchaseTotalsOf } = await import("@/lib/purchases/requests")

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

  it("encadré, déroulé autour de la demande de paiement dans la conversation, ligne indicative, note, sans carte Détails", () => {
    expect(h1(html)).toBe(1)
    expect(html).toContain("Mission avec achats")
    expect(html).toContain("Comment se passent les achats")
    expect(html).toContain("Achats estimés · indicatif")
    expect(html).toContain(`≈ ${formatAmount(45000)}`)
    expect(html).toContain("Ni bloqués ni soumis à commission")
    expect(html).toContain("Chez le vendeur, vous envoyez une demande de paiement dans la conversation")
    expect(html).toContain("photo du ticket ou des articles")
    expect(html).toContain("Afiavi paie le vendeur directement par MoMo")
    expect(html).toContain("Hors EduCash")
    expect(html).toContain("Vous confirmez « Reçu par le vendeur »")
    expect(html).not.toContain("Détails")
  })

  it("plus de déroulé en photos seules, ni de phrase affirmant l'absence de demande de paiement", () => {
    expect(html).not.toContain("vous envoyez une photo")
    expect(html).not.toMatch(/jamais par une demande|supprimées par la décision|décision 24/i)
    expect(html).not.toContain("sans passer par vous")
  })

  it("l'estimation d'achats reste hors séquestre, hors total et hors net dans le déroulé et l'encadré", () => {
    expect(html).not.toContain(formatAmount(8000 + 45000))
    expect(html).not.toContain(formatAmount(netAmount(8000) + 45000))
    expect(html).toContain("Ni bloqués ni soumis à commission")
  })

  it("montants : le service et le net viennent de netAmount, jamais d'un taux écrit en dur", () => {
    expect(html).toContain(formatAmount(8000))
    expect(html).toContain(formatAmount(netAmount(8000)))
  })

  it("séquestre cité quand les paiements sont ouverts, jamais quand ils sont coupés (déroulé compris)", () => {
    expect(html.toLowerCase()).toContain("séquestre")
    expect(html).toContain("Seul le service est bloqué en séquestre.")
    const paused = apply(open(), off)
    expect(paused.toLowerCase()).not.toContain("séquestre")
    expect(paused).toContain("Mission avec achats")
    expect(paused).toContain("Comment se passent les achats")
    expect(paused).toContain("Chez le vendeur, vous envoyez une demande de paiement dans la conversation")
    expect(paused).not.toContain("Seul le service est bloqué en séquestre.")
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
  })

  it("fonction indisponible (table ou colonne absente, `purchases.available` faux) : ni liste, ni bouton, ni lien de demande", () => {
    for (const purchases of [undefined, { available: false }, { available: true, requests: null }]) {
      const out = follow(followed("in_progress", { purchases }))
      expect(out).toContain("Achats de la mission")
      expect(out).not.toContain("Demandes de paiement d&#x27;achats")
      expect(out).not.toContain("Demander un paiement d&#x27;achats")
      expect(out).not.toContain("?demande=")
    }
  })

  it("colonne droite : badge En séquestre, budget du service, net par netAmount, écrire au prénom, sans profil client", () => {
    expect(html).toContain("En séquestre")
    expect(html).toContain("Budget du service (100 %)")
    expect(html).toContain(formatFcfa(netAmount(8000)))
    expect(html).toContain("Écrire à Afiavi")
    expect(html).not.toContain("Voir le profil")
    expect(html).toContain("Vous avez fini ?")
  })

  it("colonne de fin absente : ni « J'ai terminé » ni « À confirmer » (rendu d'origine)", () => {
    expect(html).not.toContain("J&#x27;ai terminé")
    expect(html).not.toContain("À confirmer")
  })

  it("aucune date de rétention sans accepted_at (updatedAt ignoré) ni ligne provisoire d'achats", () => {
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

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`
const req = (n, over) => ({ id: uuid(n), seq: n, status: "pending", version: 1, items: null, actions: {}, sentAt: "2026-10-08T10:05:00Z", ...over })
const RECEIVED = req(1, { status: "received", vendorName: "Tantie Awa", items: "céréales", amount: 21500, paidAt: "2026-10-08T09:20:00Z", receivedAt: "2026-10-08T09:24:00Z" })
const PAID = req(2, { status: "paid", vendorName: "Boutique Chez Codjo", amount: 12750, paidAt: "2026-10-08T10:02:00Z", actions: { confirmReceived: true } })
const PENDING = req(3, { status: "pending", vendorName: "Poissonnerie Dossa", amount: 6000 })
const listing = (requests = [RECEIVED, PAID, PENDING], over = {}) => ({
  available: true,
  requests,
  totals: purchaseTotalsOf(requests),
  exceedsEstimate: false,
  canCreate: true,
  ...over,
})
const withListing = (l = listing(), status = "in_progress", flagSet = on) => follow(followed(status, { purchases: l }), flagSet)
const BUTTON = "Demander un paiement d&#x27;achats"

describe("E05 demandes de paiement d'achats (modèle rétabli : le client paie le vendeur hors EduCash)", () => {
  const html = withListing()

  it("liste en tête, avant la chronologie : compteur, une ligne par demande avec numéro, vendeur, statut et montant", () => {
    expect(html).toContain("Demandes de paiement d&#x27;achats<span>3</span>")
    expect(html.indexOf("Demandes de paiement d&#x27;achats")).toBeLessThan(html.indexOf("Où en est la mission"))
    expect(html).toContain("N° 1 · Tantie Awa · céréales")
    expect(html).toContain("N° 2 · Boutique Chez Codjo")
    expect(html).toContain("N° 3 · Poissonnerie Dossa")
    for (const label of ["Reçu par le vendeur", "Payé", "En attente de paiement"]) expect(html).toContain(label)
    for (const amount of [21500, 12750, 6000]) expect(html).toContain(formatFcfa(amount))
    expect(html).not.toContain("Achats de la mission")
  })

  it("chaque ligne mène à la carte de la conversation (?demande=) ; l'étape est dite en vouvoiement", () => {
    for (const n of [1, 2, 3]) expect(html).toContain(`href="/messages/m1?demande=${uuid(n)}"`)
    expect(html).toContain("Payé à 10:20")
    expect(html).toContain("reçu par le vendeur à 10:24")
    expect(html).toContain("confirmez quand le vendeur a reçu")
    expect(html).toContain("Envoyée à 11:05")
  })

  it("total demandé et total payé en direct, hors séquestre ; l'estimation reste à part et n'est jamais additionnée", () => {
    expect(html).toContain("3 demandes · total des achats")
    expect(html).toContain(formatFcfa(40250))
    expect(html).toContain("Payés en direct par le client")
    expect(html).toContain(formatFcfa(34250))
    expect(html).toContain("Estimation de départ (indicative)")
    expect(html).toContain(`≈ ${formatFcfa(45000)}`)
    expect(html).toContain("hors EduCash : ces montants ne sont ni bloqués ni soumis à la commission")
    expect(html).not.toContain(formatFcfa(40250 + 45000))
    expect(clean(html)).not.toContain(formatFcfa(8000 + 40250))
  })

  it("« Ce que vous touchez » inchangé : le net vient de netAmount, aucun achat n'y entre", () => {
    expect(html).toContain("Budget du service (100 %)")
    expect(html).toContain(formatFcfa(8000))
    expect(html).toContain(formatFcfa(netAmount(8000)))
    expect(html).not.toContain(formatFcfa(netAmount(8000) + 40250))
    expect(html).not.toContain(formatFcfa(netAmount(8000) - 40250))
  })

  it("bouton « Demander un paiement d'achats » si canCreate : un pour le bureau, un pour le mobile, tous deux vers la conversation (?achat=nouveau)", () => {
    expect(html.split(BUTTON).length - 1).toBe(2)
    expect(html.split('href="/messages/m1?achat=nouveau"').length - 1).toBe(2)
    expect(html).toContain("ds-desk-only")
    expect(html).toContain("ds-mob-only")
    expect(html).toContain("Vous n&#x27;avancez jamais d&#x27;argent. Chez le vendeur, envoyez une demande : Afiavi paie directement par MoMo. EduCash n&#x27;intervient pas dans ce paiement.")
  })

  it("bouton absent si canCreate est faux, sur une mission terminée ou annulée (liste en lecture seule)", () => {
    expect(withListing(listing(undefined, { canCreate: false }))).not.toContain(BUTTON)
    expect(withListing(listing(undefined, { canCreate: false }))).not.toContain("achat=nouveau")
    const done = withListing(listing(), "done")
    expect(done).toContain("N° 1 · Tantie Awa")
    expect(done).not.toContain(BUTTON)
    expect(done).not.toContain("Vous n&#x27;avancez jamais")
    const cancelled = withListing(listing(undefined, { canCreate: false }), "cancelled")
    expect(cancelled).toContain("N° 2 · Boutique Chez Codjo")
    expect(cancelled).not.toContain(BUTTON)
  })

  it("mission annulée sans aucune demande : plus de bloc ; mission en cours sans demande : liste vide avec le bouton", () => {
    expect(withListing(listing([], { canCreate: false }), "cancelled")).not.toContain("Demandes de paiement")
    const empty = withListing(listing([]))
    expect(empty).toContain("Demandes de paiement d&#x27;achats<span>0</span>")
    expect(empty).toContain(BUTTON)
    expect(empty).toContain("0 demande · total des achats")
    expect(empty).not.toContain("Payés en direct par le client")
  })

  it("demande signalée : badge Signalé, examen en cours puis « examinée par l'équipe EduCash »", () => {
    const flagged = withListing(listing([RECEIVED, req(2, { status: "reported", vendorName: "Chez Codjo", amount: 12750 })]))
    expect(flagged).toContain("Signalé")
    expect(flagged).toContain("Signalée · l&#x27;équipe EduCash l&#x27;examine")
    expect(withListing(listing([req(2, { status: "reported", vendorName: "Chez Codjo", amount: 12750, reviewed: true })]))).toContain("Signalée · examinée par l&#x27;équipe EduCash")
  })

  it("demande annulée : listée avec son badge, jamais comptée dans les totaux", () => {
    const withCancelled = withListing(listing([RECEIVED, req(2, { status: "cancelled", vendorName: "Chez Codjo", amount: 12750 })]))
    expect(withCancelled).toContain("N° 2 · Chez Codjo")
    expect(withCancelled).toContain("Annulée")
    expect(withCancelled).toContain("1 demande · total des achats")
    expect(withCancelled).toContain(formatFcfa(21500))
  })

  it("séquestre : jamais cité par le bloc des demandes, paiements ouverts ou coupés ; aucune coordonnée, aucun style en ligne", () => {
    for (const f of [on, off]) {
      const out = withListing(listing(), "in_progress", f)
      const block = out.slice(out.indexOf("Demandes de paiement d&#x27;achats<span>"), out.indexOf("Où en est la mission"))
      expect(block.toLowerCase()).not.toContain("séquestre")
      expect(block).not.toMatch(/\+229|@|téléphone|phone|style=/i)
      expect(clean(block)).not.toMatch(/(?<![\p{L}])(tu|toi|ton|ta|tes)(?![\p{L}])/iu)
      expect(block).not.toMatch(BROKEN)
    }
  })

  it("estimation absente : aucun bloc achats, même si des demandes sont fournies", () => {
    const out = follow(followed("in_progress", { purchases: listing() }, { purchasesEstimate: null }))
    expect(out).not.toContain("Demandes de paiement")
    expect(out).not.toContain("Achats de la mission")
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
    expect(safeDateFr(0)).toBe("")
    expect(safeDateFr("pas une date")).toBe("")
    expect(safeDateFr("2026-10-08")).toBe("8 octobre 2026")
  })
})

describe("étape Retenue datée par accepted_at seulement, constante du client anonyme, titre masqué", () => {
  it("sans accepted_at, l'étape « retenue » n'a aucun sous-titre de date (updatedAt ignoré), les autres étapes gardent la leur", () => {
    const html = follow(followed())
    expect(html).toContain("Votre candidature a été retenue")
    expect(html).not.toContain("8 octobre 2026")
    expect(html).toContain("7 octobre 2026")
  })

  it("avec accepted_at, l'étape « retenue » porte cette date, pas celle d'updatedAt", () => {
    const html = follow(followed("in_progress", { application: { id: "a1", status: "accepted", message: "Bonjour", createdAt: "2026-10-07T09:00:00Z", updatedAt: "2026-10-09T08:00:00Z", acceptedAt: "2026-10-08T08:00:00Z" } }))
    expect(html).toContain("8 octobre 2026")
    expect(html).not.toContain("9 octobre 2026")
  })

  it("l'action et la vue utilisent la même constante du nom anonyme", () => {
    const read = (f) => readFileSync(f, "utf8")
    for (const f of ["src/lib/actions/student-mission-detail.actions.js", "src/lib/actions/review.actions.js"]) {
      expect(read(f)).toContain('import { ANONYMOUS_CLIENT_NAME } from "@/lib/constants/client-name"')
      expect(read(f)).not.toContain('"Client EduCash"')
    }
    expect(read("src/lib/student-space/mission-view.js")).toContain("ANONYMOUS_CLIENT_NAME")
    expect(ANONYMOUS_CLIENT_NAME).toBe("Client EduCash")
    expect(clientFirstName(ANONYMOUS_CLIENT_NAME)).toBeNull()
  })

  it("h2 « Le client » masqué à l'œil seulement sur mobile (clip, jamais display: none)", () => {
    const css = readFileSync("src/app/design/student/e03.css", "utf8")
    const rules = rulesOf(css, ".e2-03-clientcard .e2-sec__head", { media: "max-width" })
    expect(rules).toHaveLength(1)
    expect(rules[0].declarations["clip-path"]).toBe("inset(50%)")
    expect(rules[0].declarations.display).toBeUndefined()
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
