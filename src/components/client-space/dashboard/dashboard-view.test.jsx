import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { ClientDashboardView } = await import("./client-dashboard-view")

const TODAY = "2026-10-08"

const mission = (over) => ({
  id: "m",
  title: "Mission",
  status: "open",
  budget: 15000,
  deadline: null,
  createdAt: "2026-10-01T08:00:00Z",
  studentName: null,
  pendingCount: 0,
  oldestPendingAt: null,
  ...over,
})

const data = (over = {}) => ({
  firstName: "Rosine",
  wallet: { available: 12500, escrow: 54000 },
  totalMissions: 4,
  active: [],
  toReview: [],
  ...over,
})

const WITH_DECISIONS = data({
  active: [
    mission({ id: "a", title: "Traduire un flyer", pendingCount: 3, oldestPendingAt: "2026-10-06T08:00:00Z" }),
    mission({ id: "b", title: "Garde de deux enfants", budget: 6000, deadline: "2026-10-03" }),
    mission({ id: "c", title: "Cours de maths", status: "in_progress", studentName: "Sèna" }),
  ],
  toReview: [{ id: "d", title: "Livraison de documents", studentName: "Koffi" }],
})

const render = (props) => renderToStaticMarkup(<ClientDashboardView today={TODAY} paymentsEnabled {...props} />)
const h1s = (html) => html.match(/<h1\b/g) ?? []

describe("ClientDashboardView : avec décisions", () => {
  const html = render({ data: WITH_DECISIONS })

  it("affiche un seul h1, la salutation et la date", () => {
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Bonjour, Rosine")
    expect(html).toContain("Jeudi 8 octobre")
  })

  it("affiche le héros : nombre de décisions, décision prioritaire, bouton vers l'action", () => {
    expect(html).toContain("En attente de votre décision")
    expect(html).toContain('<div class="hero2__figure">4</div>')
    expect(html).toContain("À décider en premier · 1 sur 4")
    expect(html).toContain("3 candidatures pour « Traduire un flyer »")
    expect(html).toMatch(/<a class="btn btn--dark" href="\/client\/missions\/a">/)
  })

  it("une seule étiquette citron, aucune autre carte colorée que l'argent", () => {
    expect(html.match(/class="flag2"/g)).toHaveLength(1)
    expect(html.match(/class="money2 /g)).toHaveLength(1)
  })

  it("liste « À traiter ensuite » avec les autres décisions et leurs actions", () => {
    expect(html).toContain("À traiter ensuite")
    expect(html).toContain("Garde de deux enfants")
    expect(html).toContain("Échéance dépassée")
    expect(html).toContain('href="/client/missions/c?confirmer=1"')
    expect(html).toContain('href="/review/d"')
    expect(html).not.toContain("Traduire un flyer</div>")
  })

  it("affiche la carte argent et les missions actives", () => {
    expect(html).toContain("Votre argent · 66 500 FCFA au total")
    expect(html).toContain("Missions actives")
    expect(html).toContain("2 ouvertes · 1 en cours")
  })

  it("n'affiche ni emoji, ni bouton flottant, ni total dépensé", () => {
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(html).not.toContain("Total dépensé")
    expect(html).not.toMatch(/fixed|aria-label="Poster une mission"/)
  })
})

describe("ClientDashboardView : paiements", () => {
  it("coupés : aucun bouton Recharger ni Retirer, note d'activation", () => {
    const html = render({ data: WITH_DECISIONS, paymentsEnabled: false })
    expect(html).not.toMatch(/>Recharger</)
    expect(html).not.toContain("Retirer")
    expect(html).not.toContain("recharger=1")
    expect(html).toContain("Vos fonds restent en sécurité sur votre portefeuille EduCash")
  })

  it("ouverts : Recharger mène à /client/wallet?recharger=1", () => {
    const html = render({ data: WITH_DECISIONS, paymentsEnabled: true })
    expect(html).toMatch(/<a class="btn btn--blanc btn--sm" href="\/client\/wallet\?recharger=1">/)
    expect(html).not.toContain("Retirer")
  })
})

describe("ClientDashboardView : états", () => {
  it("nouveau client, paiements ouverts : publier et recharger", () => {
    const html = render({ data: data({ totalMissions: 0, wallet: { available: 0, escrow: 0 } }) })
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Publiez votre première mission")
    expect(html).toContain("Premiers pas")
    expect(html).toContain("Recharger votre portefeuille")
    expect(html).toContain('href="/client/wallet?recharger=1"')
    expect(html).not.toContain("class=\"flag2\"")
  })

  it("nouveau client, paiements coupés : publication en cours d'activation, lien vers la publication, aucun Recharger", () => {
    const html = render({ data: data({ totalMissions: 0, wallet: { available: 0, escrow: 0 } }), paymentsEnabled: false })
    expect(html).toContain("Publication en cours d&#x27;activation")
    expect(html).toContain('href="/client/missions/new"')
    expect(html).toContain("Prévenez-moi")
    expect(html).not.toContain("recharger=1")
    expect(html).not.toMatch(/>Recharger</)
  })

  it("solde insuffisant : bannière et recharge directe", () => {
    const html = render({ data: data({ wallet: { available: 500, escrow: 0 }, active: [mission()] }) })
    expect(html).toContain("Solde insuffisant pour publier")
    expect(html).toContain('href="/client/wallet?recharger=1&amp;montant=1500"')
  })

  it("tout est à jour : étiquette neutre, pas de citron", () => {
    const html = render({ data: data({ active: [mission({ deadline: "2026-11-01" })] }) })
    expect(html).toContain("Tout est à jour")
    expect(html).toContain("flag2 flag2--neutre")
    expect(html).not.toContain('class="flag2"')
    expect(html).not.toContain("À traiter ensuite")
  })

  it("échéance dépassée en tête : message neutre sans annulation automatique annoncée", () => {
    const html = render({ data: data({ active: [mission({ title: "Garde", budget: 6000, deadline: "2026-10-03" })] }) })
    expect(html).toContain("« Garde » a dépassé son échéance")
    expect(html).toContain("prolongez ou annulez la mission")
    expect(html).not.toMatch(/annulée automatiquement|automatiquement/)
  })

  it("erreur : bloc distinct du vide, un seul h1, message neutre", () => {
    const html = render({ error: "Impossible de charger votre tableau de bord." })
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain('role="alert"')
    expect(html).toContain("Impossible de charger votre tableau de bord")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("Tout est à jour")
    expect(html).not.toContain("Publiez votre première mission")
  })

  it("aucune mention d'une fonction hors périmètre", () => {
    const html = render({ data: WITH_DECISIONS })
    expect(html).not.toMatch(/livré|livraison à confirmer|libération automatique|achats/i)
  })
})
