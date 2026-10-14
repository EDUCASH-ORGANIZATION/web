import { describe, it, expect } from "vitest"
import { buildDashboardModel, buildDecisions } from "./dashboard-model"
import { formatAmount } from "../app/format"
import { escrowSplit } from "../app/money"

const TODAY = "2026-10-08"
const VERIFIED = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: 200, action: null }
const VERIFS = {
  not_submitted: { key: "not_submitted", label: "Carte à envoyer", canApply: false, daysLeft: null, action: { label: "Envoyer ma carte", href: "/profile/verify" } },
  pending: { key: "pending", label: "Carte en cours d'examen", canApply: true, daysLeft: null, action: null },
  verified: VERIFIED,
  expiring: { key: "expiring", label: "Badge à renouveler", canApply: true, daysLeft: 12, action: { label: "Renouveler mon badge", href: "/profile/verify" } },
  expired: { key: "expired", label: "Badge expiré", canApply: false, daysLeft: -3, action: { label: "Renouveler mon badge", href: "/profile/verify" } },
  rejected: { key: "rejected", label: "Carte refusée", canApply: false, daysLeft: null, action: { label: "Renvoyer ma carte", href: "/profile/verify" } },
}

const data = (over = {}) => ({
  firstName: "Sèna",
  wallet: { available: 47600, escrowToCome: 0, earnedThisMonth: 0 },
  verification: VERIFIED,
  inProgress: [],
  unread: [],
  pendingApplications: { count: 0, lastAt: null },
  rating: { value: 0, reviewsCount: 0 },
  toReview: [],
  hasActivity: true,
  ...over,
})

const mission = (over) => ({ id: "m1", title: "Cours de maths", clientName: "Rosine", budget: 15000, ...over })
const opts = { today: TODAY, paymentsEnabled: true }

describe("buildDecisions : priorités", () => {
  it("vérification, puis message, puis avis, puis mission en cours", () => {
    const d = data({
      verification: VERIFS.expired,
      unread: [{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 2 }],
      toReview: [{ id: "d1", title: "Flyer", clientName: "Koffi" }],
      inProgress: [mission(), mission({ id: "m2", title: "Saisie" })],
    })
    expect(buildDecisions(d).map((x) => x.kind)).toEqual(["verification", "unread", "review", "in_progress"])
  })

  it("une mission avec un message non lu n'apparaît pas aussi comme mission en cours", () => {
    const d = data({
      unread: [{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 1 }],
      inProgress: [mission()],
    })
    expect(buildDecisions(d).map((x) => x.key)).toEqual(["unread-m1"])
  })

  it("compte vérifié ou carte en cours d'examen : aucune action de vérification", () => {
    expect(buildDecisions(data({ verification: VERIFS.verified }))).toEqual([])
    expect(buildDecisions(data({ verification: VERIFS.pending }))).toEqual([])
  })
})

describe("buildDashboardModel : états", () => {
  it("nouvel inscrit : 0 FCFA, trouve votre première mission, premiers pas, aucune étiquette citron", () => {
    const m = buildDashboardModel(data({ hasActivity: false, verification: VERIFS.pending }), opts)
    expect(m.state).toBe("new")
    expect(m.hero.title).toBe("Trouvez votre première mission")
    expect(m.hero.flag.due).toBe(false)
    expect(m.hero.text).toContain("en cours d'examen")
    expect(m.money.noteLines).toEqual([{ strong: null, text: "Vos gains arriveront ici après votre première mission." }])
    expect(m.list.kind).toBe("steps")
    expect(m.list.steps[0].done).toBe(true)
  })

  it("nouvel inscrit sans carte : la vérification est l'action prioritaire (citron)", () => {
    const m = buildDashboardModel(data({ hasActivity: false, verification: VERIFS.not_submitted }), opts)
    expect(m.state).toBe("todo")
    expect(m.hero.title).toBe("Envoyez votre carte étudiante")
    expect(m.hero.flag.due).toBe(true)
    expect(m.hero.action.href).toBe("/profile/verify")
  })

  it.each([
    ["not_submitted", "Envoyez votre carte étudiante", "Carte à envoyer"],
    ["rejected", "Renvoyez votre carte étudiante", "Carte refusée"],
    ["expired", "Votre badge a expiré", "Badge expiré"],
    ["expiring", "Renouvelez votre badge vérifié", "Expire dans 12 jours"],
  ])("statut %s : action due avec bouton vers la vérification", (key, title, badge) => {
    const m = buildDashboardModel(data({ verification: VERIFS[key] }), opts)
    expect(m.hero.title).toBe(title)
    expect(m.hero.badge.label).toBe(badge)
    expect(m.hero.flag.due).toBe(true)
    expect(m.hero.action.href).toBe("/profile/verify")
  })

  it("compte vérifié sans rien à faire : tout est à jour, étiquette neutre, liste vide", () => {
    const m = buildDashboardModel(data(), opts)
    expect(m.state).toBe("uptodate")
    expect(m.hero.flag).toEqual({ label: "Rien d'urgent", icon: "i-check", due: false })
    expect(m.list).toMatchObject({ kind: "empty", count: 0 })
  })

  it("message non lu : réponse au client, étiquette due", () => {
    const m = buildDashboardModel(
      data({ unread: [{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 1 }], inProgress: [mission()] }),
      opts,
    )
    expect(m.hero.title).toBe("Répondez à Rosine")
    expect(m.hero.action.href).toBe("/messages/m1")
    expect(m.hero.flag.due).toBe(true)
  })

  it("mission en cours seule : prévenez le client, votre part par escrowSplit, étiquette neutre", () => {
    const m = buildDashboardModel(data({ inProgress: [mission({ budget: 15000 })] }), opts)
    expect(m.hero.title).toBe("Prévenez Rosine quand c'est fini")
    expect(m.hero.text).toContain(formatAmount(escrowSplit(15000).student))
    expect(m.hero.text).not.toMatch(/livré|à confirmer/i)
    expect(m.hero.flag.due).toBe(false)
  })

  it("liste « Ensuite » : les autres actions, au plus 5, la première étant dans la carte", () => {
    const toReview = Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, title: `Mission ${i}`, clientName: "Koffi" }))
    const m = buildDashboardModel(data({ toReview }), opts)
    expect(m.hero.title).toBe("Notez Koffi")
    expect(m.list.count).toBe(7)
    expect(m.list.items).toHaveLength(5)
    expect(m.list.items[0].action.href).toBe("/review/d1")
  })
})

describe("buildDashboardModel : argent et indicateurs", () => {
  it("note de la carte : gains du mois et séquestre à venir (part nette)", () => {
    const m = buildDashboardModel(data({ wallet: { available: 47600, escrowToCome: 40480, earnedThisMonth: 29040 } }), opts)
    expect(m.money.amount).toBe(47600)
    expect(m.money.noteLines[0].text).toBe("gagnés ce mois-ci")
    expect(m.money.noteLines[1].text).toContain("commission de 12 % déduite")
  })

  it("gains du mois illisibles (null) : la ligne est omise", () => {
    const m = buildDashboardModel(data({ wallet: { available: 100, escrowToCome: 500, earnedThisMonth: null } }), opts)
    expect(m.money.noteLines).toHaveLength(1)
    expect(m.money.noteLines[0].text).toContain("séquestre")
  })

  it("paiements ouverts : bouton Retirer vers le retrait, pas de note", () => {
    const m = buildDashboardModel(data(), { today: TODAY, paymentsEnabled: true })
    expect(m.money.action).toMatchObject({ label: "Retirer sur Mobile Money", href: "/wallet?retrait=1" })
    expect(m.money.hint).toBeNull()
  })

  it("paiements coupés : aucun bouton Retirer, note d'activation vouvoyée", () => {
    const m = buildDashboardModel(data(), { today: TODAY, paymentsEnabled: false })
    expect(m.money.action).toBeNull()
    expect(m.money.hint).toContain("Vos gains restent en sécurité")
  })

  it("indicateurs : en cours, candidatures, note et avis", () => {
    const m = buildDashboardModel(
      data({
        inProgress: [mission(), mission({ id: "m2" })],
        pendingApplications: { count: 3, lastAt: "2026-10-07T10:00:00Z" },
        rating: { value: 4.9, reviewsCount: 12 },
      }),
      opts,
    )
    expect(m.stats.inProgress.value).toBe(2)
    expect(m.stats.pending.value).toBe(3)
    expect(m.stats.pending.sub).toContain("dernière envoyée le")
    expect(m.stats.rating).toMatchObject({ hasRating: true, value: 4.9, sub: "12 avis · compte vérifié" })
  })

  it("aucun avis : pas de note affichée", () => {
    expect(buildDashboardModel(data(), opts).stats.rating.hasRating).toBe(false)
  })

  it("salutation et date", () => {
    const m = buildDashboardModel(data(), opts)
    expect(m.greeting).toBe("Bonjour, Sèna")
    expect(m.dateLabel).toBe("Jeudi 8 octobre")
    expect(buildDashboardModel(data({ firstName: "" }), opts).greeting).toBe("Bonjour")
  })
})
