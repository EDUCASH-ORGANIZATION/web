import { describe, it, expect } from "vitest"
import { buildDecisions, buildDashboardModel } from "./dashboard-model.js"

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

const opts = (paymentsEnabled = true) => ({ today: TODAY, paymentsEnabled })

describe("buildDecisions : priorités", () => {
  it("ordonne candidatures, échéance dépassée, mission en cours, avis", () => {
    const decisions = buildDecisions(
      data({
        active: [
          mission({ id: "run", title: "En cours", status: "in_progress" }),
          mission({ id: "late", title: "Dépassée", deadline: "2026-10-03" }),
          mission({ id: "apps", title: "Candidats", pendingCount: 2, oldestPendingAt: "2026-10-06T08:00:00Z" }),
        ],
        toReview: [{ id: "rev", title: "Avis", studentName: "Koffi" }],
      }),
      TODAY,
    )
    expect(decisions.map((d) => d.kind)).toEqual(["applications", "overdue", "in_progress", "review"])
  })

  it("met la candidature la plus ancienne d'abord", () => {
    const decisions = buildDecisions(
      data({
        active: [
          mission({ id: "recent", pendingCount: 1, oldestPendingAt: "2026-10-07T08:00:00Z" }),
          mission({ id: "old", pendingCount: 1, oldestPendingAt: "2026-10-02T08:00:00Z" }),
        ],
      }),
      TODAY,
    )
    expect(decisions.map((d) => d.missionId)).toEqual(["old", "recent"])
  })

  it("compte une mission une seule fois : candidatures et échéance dépassée donnent une décision", () => {
    const decisions = buildDecisions(
      data({ active: [mission({ id: "x", deadline: "2026-10-01", pendingCount: 3, oldestPendingAt: "2026-10-02T08:00:00Z" })] }),
      TODAY,
    )
    expect(decisions).toHaveLength(1)
    expect(decisions[0].kind).toBe("applications")
  })

  it("ignore une mission ouverte à échéance du jour ou sans échéance", () => {
    const decisions = buildDecisions(
      data({ active: [mission({ id: "a", deadline: TODAY }), mission({ id: "b", deadline: null })] }),
      TODAY,
    )
    expect(decisions).toEqual([])
  })

  it("une mission en cours demande de confirmer la fin sans prétendre que le travail est livré", () => {
    const [d] = buildDecisions(data({ active: [mission({ id: "r", status: "in_progress", studentName: "Sèna" })] }), TODAY)
    expect(d.action).toEqual({ label: "Confirmer la fin", href: "/client/missions/r?confirmer=1" })
    const text = `${d.hero.title} ${d.hero.text} ${d.subtitle}`
    expect(text).not.toMatch(/livr|terminé le|a terminé/i)
    expect(d.hero.text).toContain("13 200 FCFA des 15 000 FCFA")
    expect(d.hero.text).toContain("commission 12 %")
  })

  it("un avis à laisser mène à l'écran d'avis", () => {
    const [d] = buildDecisions(data({ toReview: [{ id: "rev", title: "Garde", studentName: "Koffi" }] }), TODAY)
    expect(d.action.href).toBe("/client/review/rev")
    expect(d.hero.title).toBe("Laissez un avis à Koffi")
  })

  it("une échéance dépassée formule la décision de façon neutre, avec le remboursement du séquestre", () => {
    const [d] = buildDecisions(data({ active: [mission({ id: "late", title: "Garde", budget: 6000, deadline: "2026-10-03" })] }), TODAY)
    expect(d.subtitle).toContain("examinez-la ou annulez-la")
    expect(d.meta.badge).toEqual({ label: "Échéance dépassée", tone: "erreur" })
    expect(d.hero.text).toContain("6 000 FCFA bloqués reviennent sur votre portefeuille")
  })
})

describe("buildDashboardModel : état et compte de décisions", () => {
  it("compte les décisions et résume par type", () => {
    const model = buildDashboardModel(
      data({
        active: [
          mission({ id: "a", pendingCount: 3, oldestPendingAt: "2026-10-06T08:00:00Z" }),
          mission({ id: "b", deadline: "2026-10-03" }),
          mission({ id: "c", status: "in_progress" }),
        ],
      }),
      opts(),
    )
    expect(model.state).toBe("decisions")
    expect(model.decisionCount).toBe(3)
    expect(model.hero.figure).toBe(3)
    expect(model.hero.metaLines).toEqual([
      { count: 3, text: "candidatures à examiner sur 1 mission" },
      { count: 1, text: "échéance dépassée" },
      { count: 1, text: "mission en cours à clôturer" },
    ])
    expect(model.hero.flag).toEqual({ label: "À décider en premier · 1 sur 3", icon: "i-clock", due: true })
    expect(model.hero.title).toBe("3 candidatures pour « Mission »")
    expect(model.list.kind).toBe("decisions")
    expect(model.list.items.map((d) => d.missionId)).toEqual(["b", "c"])
    expect(model.list.count).toBe(2)
  })

  it("une seule décision : pas de « 1 sur 1 » ni de liste « à traiter ensuite »", () => {
    const model = buildDashboardModel(data({ active: [mission({ status: "in_progress" })] }), opts())
    expect(model.hero.flag.label).toBe("À décider en premier")
    expect(model.list).toBeNull()
  })

  it("limite la liste « à traiter ensuite » à 5 rangées", () => {
    const toReview = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, title: `T${i}`, studentName: null }))
    const model = buildDashboardModel(data({ toReview }), opts())
    expect(model.list.items).toHaveLength(5)
    expect(model.list.count).toBe(8)
  })

  it("tout à jour : aucune décision, étiquette neutre (jamais le citron)", () => {
    const model = buildDashboardModel(data({ active: [mission({ id: "o", deadline: "2026-11-01" })] }), opts())
    expect(model.state).toBe("uptodate")
    expect(model.hero.title).toBe("Tout est à jour")
    expect(model.hero.flag.due).toBe(false)
    expect(model.hero.text).toContain("Votre mission ouverte attend des candidatures.")
    expect(model.list).toBeNull()
  })

  it("nouveau client, paiements ouverts : publier et recharger", () => {
    const model = buildDashboardModel(data({ totalMissions: 0, wallet: { available: 0, escrow: 0 } }), opts(true))
    expect(model.state).toBe("new")
    expect(model.hero.title).toBe("Publiez votre première mission")
    expect(model.hero.flag.due).toBe(false)
    expect(model.hero.action.href).toBe("/client/missions/new")
    expect(model.list).toMatchObject({ kind: "steps", doneCount: 0 })
    expect(model.list.steps.map((s) => s.action?.label)).toEqual(["Recharger", "Publier"])
    expect(model.list.steps[0].action.href).toBe("/client/wallet?recharger=1")
    expect(model.banner).toBeNull()
  })

  it("nouveau client, paiements coupés : publication en cours d'activation, aucun Recharger", () => {
    const model = buildDashboardModel(data({ totalMissions: 0, wallet: { available: 0, escrow: 0 } }), opts(false))
    expect(model.hero.title).toBe("Publication en cours d'activation")
    expect(model.hero.action).toEqual({ label: "Prévenez-moi", href: "/client/missions/new", icon: "i-bell" })
    const labels = model.list.steps.map((s) => s.action?.label)
    expect(labels).not.toContain("Recharger")
    expect(model.money.action).toBeNull()
  })

  it("solde insuffisant : bannière avec recharge directe du montant manquant si ouvert", () => {
    const model = buildDashboardModel(data({ wallet: { available: 500, escrow: 0 }, active: [mission({ deadline: null })] }), opts(true))
    expect(model.banner.title).toBe("Solde insuffisant pour publier")
    expect(model.banner.action).toEqual({ label: "Recharger 1 500 FCFA", href: "/client/wallet?recharger=1&montant=1500" })
  })

  it("solde insuffisant, paiements coupés : texte d'activation, aucune recharge", () => {
    const model = buildDashboardModel(data({ wallet: { available: 0, escrow: 0 }, active: [mission()] }), opts(false))
    expect(model.banner.title).toBe("Publication en cours d'activation")
    expect(model.banner.action.href).toBe("/client/missions/new")
    expect(JSON.stringify(model.banner)).not.toContain("recharger=1")
  })

  it("pas de bannière quand le solde suffit", () => {
    expect(buildDashboardModel(data({ active: [mission()] }), opts()).banner).toBeNull()
  })

  it("carte argent : recharge seulement si les paiements sont ouverts, sinon note d'activation", () => {
    const open = buildDashboardModel(data({ active: [mission()] }), opts(true)).money
    expect(open.action).toEqual({ label: "Recharger", href: "/client/wallet?recharger=1", icon: "i-plus" })
    expect(open.hint).toBeNull()
    const paused = buildDashboardModel(data({ active: [mission()] }), opts(false)).money
    expect(paused.action).toBeNull()
    expect(paused.hint).toContain("Vos fonds restent en sécurité")
    expect(paused.availableNote).toBeUndefined()
  })

  it("carte argent : total, séquestre et nombre de missions financées", () => {
    const money = buildDashboardModel(data({ active: [mission({ id: "a" }), mission({ id: "b", status: "in_progress" })] }), opts()).money
    expect(money.title).toBe("Votre argent · 66 500 FCFA au total")
    expect(money.escrow).toBe(54000)
    expect(money.escrowNote).toBe("bloqués pour 2 missions financées")
  })

  it("missions actives par statut", () => {
    const model = buildDashboardModel(
      data({ active: [mission({ id: "a" }), mission({ id: "b" }), mission({ id: "c", status: "in_progress" })] }),
      opts(),
    )
    expect(model.stats).toEqual({ activeCount: 3, sub: "2 ouvertes · 1 en cours" })
  })

  it("salutation avec prénom, sinon sans", () => {
    expect(buildDashboardModel(data(), opts()).greeting).toBe("Bonjour, Rosine")
    expect(buildDashboardModel(data({ firstName: "" }), opts()).greeting).toBe("Bonjour")
  })

  it("date du jour en français", () => {
    expect(buildDashboardModel(data(), opts()).dateLabel).toBe("Jeudi 8 octobre")
  })
})
