import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const { StudentApplicationsView, StudentApplicationsSkeleton } = await import("./applications-view")

const COUNTS = { "en-attente": 0, "en-cours": 0, terminees: 0, "non-retenues": 0 }
const row = (over) => ({
  id: "a1", missionId: "m1", title: "Cours de maths", type: "Cours particuliers", city: "Cotonou", budget: 25000, net: 22000,
  deadline: "2026-10-30", missionStatus: "open", status: "pending", appliedAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z", clientName: "Rosine H.", clientFirst: "Rosine", review: null, ...over,
})
const data = (over) => ({ tab: "en-attente", counts: COUNTS, total: 0, rows: [], escrow: { total: 0, count: 0 }, highlight: null, ...over })
// Espaces fines et insécables des montants ramenées à une espace simple pour comparer les textes.
const NOW = new Date("2026-10-08T14:32:00+01:00")
const render = (d, props = {}) =>
  renderToStaticMarkup(<StudentApplicationsView result={{ data: d }} now={NOW} paymentsEnabled {...props} />).replace(/[\u202f\u00a0]/g, " ")
const h1s = (html) => html.match(/<h1\b/g) ?? []

describe("StudentApplicationsView : onglets vides", () => {
  const cases = {
    "en-attente": "Aucune candidature en attente",
    "en-cours": "Aucune mission en cours",
    terminees: "Aucune mission terminée",
    "non-retenues": "Aucune candidature non retenue",
  }
  for (const [tab, title] of Object.entries(cases)) {
    it(`${tab} : texte dédié vouvoyé, un seul h1, quatre onglets`, () => {
      const html = render(data({ tab }))
      expect(h1s(html)).toHaveLength(1)
      expect(html).toContain(title)
      expect(html.match(/class="e2-tab( is-active)?"/g)).toHaveLength(4)
      expect(html).toContain('class="e2-tabs"')
      expect(html).toContain('aria-current="page"')
      // Registre unique (RD-VOUS-01) : le tutoiement est interdit.
      expect(html).not.toMatch(/(?<![\p{L}])(tu|toi|ton|ta|tes)(?![\p{L}])/iu)
    })
  }

  it("aucune candidature : date de l'en-tête et lien Explorer les missions", () => {
    const html = render(data())
    expect(html).toContain("Aucune candidature pour l&#x27;instant")
    expect(html).not.toContain("e2-04-total")
    expect(html).toContain('href="/student/missions"')
  })
})

describe("StudentApplicationsView : en attente", () => {
  const html = render(
    data({ counts: { ...COUNTS, "en-attente": 1 }, total: 1, rows: [row()] }),
  )

  it("ligne : type par libellé, client public, votre part, budget, statut", () => {
    expect(html).toContain("Cours et aide aux devoirs · Rosine H. · Cotonou")
    expect(html).toContain("22 000")
    expect(html).toContain("votre part · budget 25 000")
    expect(html).toContain("En attente")
    expect(html).toContain("Postulée le")
  })

  it("seule action : Voir la mission ; ni écrire, ni noter, ni retirer", () => {
    expect(html).toContain('href="/student/missions/m1"')
    expect(html).not.toContain("Écrire")
    expect(html).not.toContain("Noter")
    expect(html).not.toContain("Retirer")
  })

  it("compteur discret dans l'onglet, lien avec ?onglet=", () => {
    expect(html).toContain('href="/applications?onglet=en-cours"')
    expect(html).toContain("<b>1</b>")
    expect(html).not.toContain("<b>0</b>")
  })
})

describe("StudentApplicationsView : retenue récente", () => {
  const highlight = {
    missionId: "m1", title: "Livraison de colis", city: "Ganhi", deadline: "2026-10-09", net: 5280,
    clientName: "Nadège K.", clientFirst: "Nadège", acceptedAt: "2026-10-07T17:40:00+01:00",
  }
  const attente = data({ counts: { ...COUNTS, "en-attente": 1, "en-cours": 1 }, total: 2, rows: [row()], highlight })

  it("carte blanche avec l'étiquette citron et un seul bouton encre", () => {
    const html = render(attente)
    expect(html).toContain("Retenue hier à 17:40")
    expect(html).toContain("Nadège K. a retenu votre candidature")
    expect(html).toContain("pour « Livraison de colis »")
    expect(html.replace(/<[^>]+>/g, "")).toContain("Avant le ven. 9 oct. à Ganhi. 5 280 FCFA sont bloqués pour vous en séquestre (votre part de 88 %).")
    expect(html.match(/class="flag2"/g)).toHaveLength(1)
    expect(html.match(/btn btn--dark/g)).toHaveLength(1)
    expect(html).toContain("Écrire à Nadège")
    expect(html).toContain('href="/messages/m1"')
    expect(html).toContain("5 280")
    expect(html).not.toContain("commission de 12 %")
  })

  it("paiements en pause : jamais « séquestre », la part reste indicative", () => {
    const html = render(attente, { paymentsEnabled: false })
    expect(html).not.toMatch(/séquestre/i)
    expect(html).toContain("Votre part sera de 5 280 FCFA (commission de 12 % déduite).")
  })

  it("montant invalide : aucune phrase de montant, jamais NaN ni undefined", () => {
    for (const net of [Number.NaN, 0, -5, undefined]) {
      const html = render({ ...attente, highlight: { ...highlight, net } })
      expect(html).not.toMatch(/NaN|undefined|séquestre/)
    }
  })

  it("date d'acceptation : aujourd'hui, ou la date avec l'heure", () => {
    expect(render({ ...attente, highlight: { ...highlight, acceptedAt: "2026-10-08T09:05:00+01:00" } })).toContain("Retenue aujourd&#x27;hui à 9:05")
    expect(render({ ...attente, highlight: { ...highlight, acceptedAt: "2026-10-03T17:40:00+01:00" } })).toMatch(/Retenue le .+ à 17:40/)
  })

  it("pas de doublon dans l'onglet En cours", () => {
    const html = render({ ...attente, tab: "en-cours", rows: [row({ status: "accepted", missionStatus: "in_progress" })] })
    expect(html).not.toContain("a retenu votre candidature")
  })

  it("nom du client absent : formulation neutre", () => {
    const html = render({ ...attente, highlight: { ...highlight, clientName: "", clientFirst: "" } })
    expect(html).toContain("Un client a retenu votre candidature")
    expect(html).toContain("Écrire au client")
  })
})

describe("StudentApplicationsView : actions par statut", () => {
  it("en cours : écrire au client, voir, séquestre total en note", () => {
    const html = render(
      data({
        tab: "en-cours", counts: { ...COUNTS, "en-cours": 2 }, total: 2,
        escrow: { total: 22000, count: 2 },
        rows: [
          row({ id: "a3", missionId: "m3", status: "accepted", missionStatus: "in_progress" }),
          row({ id: "a4", missionId: "m4", status: "accepted", missionStatus: "in_progress" }),
        ],
      }),
    )
    expect(html).toContain('href="/messages/m3"')
    expect(html).toContain('href="/student/missions/m4"')
    expect(html).toContain("en séquestre · budget")
    expect(html).toContain("22 000 FCFA")
    expect(html).toContain("sur 2 missions")
    const paused = render(
      data({
        tab: "en-cours", counts: { ...COUNTS, "en-cours": 1 }, total: 1, escrow: { total: 22000, count: 1 },
        rows: [row({ id: "a3", missionId: "m3", status: "accepted", missionStatus: "in_progress" })],
      }),
      { paymentsEnabled: false },
    )
    expect(paused).not.toMatch(/séquestre/i)
    expect(paused).toContain("votre part · budget")
    expect(html).not.toContain("J&#x27;ai terminé")
  })

  it("terminée sans avis : Noter le client vers l'avis ; avec avis : pas de lien Noter", () => {
    const done = { tab: "terminees", counts: { ...COUNTS, terminees: 1 }, total: 1 }
    const base = row({ status: "accepted", missionStatus: "done" })
    const sans = render(data({ ...done, rows: [base] }))
    expect(sans).toContain("Noter le client")
    expect(sans).toContain('href="/student/review/m1"')
    expect(sans).toContain("Avis à laisser")
    expect(sans).toContain("versés · budget")
    const avec = render(data({ ...done, rows: [{ ...base, review: { rating: 5 } }] }))
    expect(avec).not.toContain("Noter le client")
    expect(avec).toContain("Avis laissé : 5 / 5")
  })

  it("non retenues : refusée, annulée, attribuée, mission illisible sans lien", () => {
    const html = render(
      data({
        tab: "non-retenues", counts: { ...COUNTS, "non-retenues": 4 }, total: 4,
        rows: [
          row({ id: "r1", missionId: "m1", status: "rejected" }),
          row({ id: "r2", missionId: "m2", status: "accepted", missionStatus: "cancelled" }),
          row({ id: "r3", missionId: "m3", status: "pending", missionStatus: "in_progress" }),
          row({ id: "r4", missionId: null, title: "Mission indisponible", net: 0, budget: 0, missionStatus: null }),
        ],
      }),
    )
    expect(html).toContain("Mission annulée par le client")
    expect(html).toContain("Mission attribuée à un autre étudiant")
    expect(html).toContain("Mission attribuée ou retirée")
    expect(html).toContain("Non retenue")
    expect(html).not.toContain("/student/missions/null")
    expect(html.match(/href="\/student\/missions\/m/g)).toHaveLength(3)
  })

  it("liens d'action nommés par la mission (aria-label)", () => {
    const html = render(data({ counts: { ...COUNTS, "en-attente": 1 }, total: 1, rows: [row()] }))
    expect(html).toContain('aria-label="Voir la mission : Cours de maths"')
  })
})

describe("StudentApplicationsView : répondre au client", () => {
  const attente = data({ counts: { ...COUNTS, "en-attente": 2 }, total: 2, rows: [row(), row({ id: "a2", missionId: "m2", clientFirst: "Koffi", clientName: "Koffi H." })] })
  const unreadByMission = { m1: { at: "2026-10-08T09:12:00+01:00" } }

  it("avec des non lus : « Répondre à <prénom> », « Voir » et l'heure du message", () => {
    const html = render(attente, { unreadByMission })
    expect(html).toContain("Répondre à Rosine")
    expect(html).toContain('href="/messages/m1"')
    expect(html).toContain("Rosine vous a écrit à 9:12")
    expect(html).toContain('aria-label="Voir : Cours de maths"')
  })

  it("sans non lus : aucune action « Répondre », « Voir la mission » seul", () => {
    for (const props of [{}, { unreadByMission: {} }, { unreadByMission: { m9: { at: "2026-10-08T09:12:00+01:00" } } }]) {
      const html = render(attente, props)
      expect(html).not.toContain("Répondre")
      expect(html).not.toContain("vous a écrit")
      expect(html).not.toContain('href="/messages/')
    }
  })

  it("heure invalide ou prénom absent : l'action est omise, jamais d'heure vide", () => {
    expect(render(attente, { unreadByMission: { m1: { at: "n'importe quoi" } } })).not.toContain("Répondre")
    const noName = data({ counts: { ...COUNTS, "en-attente": 1 }, total: 1, rows: [row({ clientFirst: "", clientName: "" })] })
    expect(render(noName, { unreadByMission })).not.toContain("Répondre")
  })

  it("prénom trop long : libellé neutre", () => {
    const long = data({ counts: { ...COUNTS, "en-attente": 1 }, total: 1, rows: [row({ clientFirst: "Anne-Marie-Joséphine" })] })
    expect(render(long, { unreadByMission })).toContain("Répondre au client")
  })

  it("aucun « Retirer » (retrait de candidature non codé)", () => {
    expect(render(attente, { unreadByMission })).not.toContain("Retirer")
  })
})

describe("StudentApplicationsView : erreur et chargement", () => {
  it("erreur : alerte vouvoyée, un seul h1, aucune ligne", () => {
    const html = renderToStaticMarkup(<StudentApplicationsView result={{ error: "x" }} />)
    expect(html).toContain('role="alert"')
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Impossible de charger vos candidatures")
    expect(html).not.toContain("e2-04-row")
  })

  it("absence de résultat : même état d'erreur", () => {
    expect(renderToStaticMarkup(<StudentApplicationsView />)).toContain('role="alert"')
  })

  it("squelette : un seul h1", () => {
    const html = renderToStaticMarkup(<StudentApplicationsSkeleton />)
    expect(h1s(html)).toHaveLength(1)
    expect(html).toContain("Mes candidatures")
  })
})

describe("StudentApplicationsView : contenu interdit", () => {
  it("aucun mot banni, aucun tiret cadratin, aucun style en ligne", () => {
    const html = render(
      data({
        counts: { ...COUNTS, "en-attente": 1, "en-cours": 1 }, total: 2, rows: [row()],
        highlight: { missionId: "m1", title: "Cours", city: "Cotonou", deadline: null, net: 100, clientName: "A B.", clientFirst: "A", acceptedAt: "2026-10-07T17:40:00Z" },
      }),
    )
    expect(html).not.toMatch(/livraison|course|saisie|bientôt/i)
    expect(html).not.toMatch(/[\u2013\u2014]/)
    expect(html).not.toContain("style=")
  })
})
