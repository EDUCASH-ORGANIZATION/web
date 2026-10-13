import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")
const { ConfirmEndDialogView, ConfirmEndSuccess, releaseOnce } = await import("./confirm-end-dialog")
const { buildTimeline } = await import("./timeline")
const { missionView } = await import("@/lib/client-space/mission-view")
const { escrowSplit } = await import("@/lib/app/money")

const student = {
  id: "s1", fullName: "Sèna Agossou", avatarUrl: null, city: "Cotonou", rating: 4.9, missionsDone: 23,
  isVerified: true, verifiedUntil: "2099-01-01", school: "IFRI", level: "Licence 2", skills: [],
}

function detailOf(status, extra = {}) {
  return {
    mission: {
      id: "m1", title: "Cours de maths niveau 3e", description: "x", type: "Cours particuliers", city: "Cotonou", budget: 25000,
      urgency: "low", deadline: "2099-12-31", status, createdAt: "2026-10-02T10:14:00Z", selectedStudentId: "s1",
    },
    applications: [{ id: "a1", studentId: "s1", status: "accepted", message: null, createdAt: "2026-10-03T00:00:00Z", student }],
    selectedStudent: student,
    ledger: [{ type: "reserve", amount: 25000, createdAt: "2026-10-02T10:14:00Z" }],
    review: null,
    ...extra,
  }
}

const FLAGS = { confirmer: false, publiee: false, paymentsEnabled: false }
const text = (html) => html.replaceAll("&#x27;", "'")
const render = (detail, flags = FLAGS) => text(renderToStaticMarkup(<MissionFollowupView detail={detail} flags={flags} />))
const SPLIT = escrowSplit(25000)
const NB = /[\s  ]/

const DONE_LEDGER = [
  { type: "reserve", amount: 25000, createdAt: "2026-10-02T10:14:00Z" },
  { type: "release", amount: 25000, createdAt: "2026-10-08T09:02:00Z" },
  { type: "commission", amount: 3000, createdAt: "2026-10-08T09:02:00Z" },
]

describe("C08 mission en cours", () => {
  const html = render(detailOf("in_progress"))

  it("affiche un seul h1, l'étudiant retenu, Discuter et Voir le profil", () => {
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Étudiant retenu")
    expect(html).toContain("Sèna Agossou")
    expect(html).toContain("Discuter avec Sèna")
    expect(html).toContain('href="/talents/s1"')
    expect(html).toContain('href="/client/messages/m1?studentId=s1"')
  })

  it("affiche séquestre, commission et versé calculés par escrowSplit", () => {
    expect(html).toContain("Budget bloqué")
    expect(html).toMatch(/25\s000/)
    expect(html).toMatch(/−\s?3\s000/)
    expect(html).toMatch(/22\s000/)
    expect(html).toContain("Versé à Sèna")
  })

  it("propose Confirmer la fin et Signaler un problème, jamais d'annulation ni de libération automatique", () => {
    expect(html).toContain("Confirmer la fin")
    expect(html).toContain('href="/contact?sujet=question"')
    expect(html).not.toMatch(/Annuler la mission|Demander l'annulation|Confirmer la fin et payer/)
    expect(html).toContain("passe par notre équipe")
    expect(html).not.toMatch(/automatique|72\s?h|achat|avis croisés/i)
  })

  it("garde une chronologie fondée sur les dates connues", () => {
    expect(html).toContain("Mission publiée")
    expect(html).toContain("placés en séquestre")
    expect(html).toContain("Candidature de Sèna acceptée")
  })

  it("n'ouvre pas la modale sans le drapeau, et la modale n'est pas rendue", () => {
    expect(html).not.toContain('role="dialog"')
  })

  it("ouvre la modale d'office avec confirmer=1, bouton de libération inactif", () => {
    const open = render(detailOf("in_progress"), { ...FLAGS, confirmer: true })
    expect(open).toContain('role="dialog"')
    expect(open).toContain("Confirmer la fin de la mission")
    expect(open).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(<svg.*?<\/svg>)?Libérer le paiement/)
  })

  it("ignore confirmer=1 hors mission en cours", () => {
    expect(render(detailOf("done", { ledger: DONE_LEDGER }), { ...FLAGS, confirmer: true })).not.toContain('role="dialog"')
  })
})

describe("C09 modale de confirmation", () => {
  const base = {
    title: "Cours de maths", studentName: "Sèna", split: SPLIT, since: "jeu. 2 oct.",
    checked: false, pending: false, error: null, onCheck() {}, onSubmit() {}, onCancel() {}, checkRef: { current: null },
  }
  const view = (over) => text(renderToStaticMarkup(<ConfirmEndDialogView {...base} {...over} />))

  it("garde le bouton inactif tant que la case n'est pas cochée, puis l'active", () => {
    const off = view({})
    expect(off).toContain("J'ai reçu le travail et il me convient")
    expect(off).toContain("Aucun nouveau paiement")
    expect(off).toMatch(/disabled=""[^>]*>(<svg[^>]*>.*?<\/svg>)?Libérer le paiement/)
    const on = view({ checked: true })
    expect(on).not.toMatch(/disabled=""[^>]*>(<svg[^>]*>.*?<\/svg>)?Libérer le paiement/)
    expect(on).toContain('checked=""')
  })

  it("affiche séquestre, commission et versé, sans 0.88 ni 0.12", () => {
    const out = view({})
    expect(out).toMatch(/25\s000/)
    expect(out).toMatch(/−\s?3\s000/)
    expect(out).toMatch(/22\s000/)
    expect(out).toContain("Commission EduCash 12 %")
    expect(out).toContain("depuis le jeu. 2 oct.")
  })

  it("pendant l'envoi, bouton occupé et inactif", () => {
    const out = view({ checked: true, pending: true })
    expect(out).toContain('aria-busy="true"')
    expect(out).toContain("Libération en cours")
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-busy="true"/)
  })

  it("en cas d'échec, la modale reste ouverte avec les fonds en séquestre et Réessayer", () => {
    const out = view({ checked: true, error: "Impossible de libérer les fonds pour cette mission." })
    expect(out).toContain('role="dialog"')
    expect(out).toContain("Les fonds restent en séquestre")
    expect(out).toContain("Impossible de libérer les fonds")
    expect(out).toContain("Réessayer")
    expect(out).not.toContain("Libérer le paiement")
  })

  it("propose Signaler un problème vers /contact?sujet=question", () => {
    expect(view({})).toContain('href="/contact?sujet=question"')
  })
})

describe("releaseOnce (double clic et erreurs)", () => {
  it("n'appelle l'action qu'une fois pour deux clics rapprochés", async () => {
    let resolve
    const confirm = vi.fn(() => new Promise((r) => { resolve = r }))
    const lock = { busy: false }
    const first = releaseOnce(lock, confirm, "m1")
    const second = await releaseOnce(lock, confirm, "m1")
    expect(second).toEqual({ skipped: true })
    resolve({ success: true, amountStudent: 22000 })
    expect(await first).toEqual({ amount: 22000 })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(lock.busy).toBe(false)
  })

  it("renvoie l'erreur de l'action et libère le verrou pour Réessayer", async () => {
    const confirm = vi.fn().mockResolvedValueOnce({ error: "Impossible de libérer les fonds pour cette mission." })
      .mockResolvedValueOnce({ success: true, amountStudent: 22000 })
    const lock = { busy: false }
    expect(await releaseOnce(lock, confirm, "m1")).toEqual({ error: "Impossible de libérer les fonds pour cette mission." })
    expect(await releaseOnce(lock, confirm, "m1")).toEqual({ amount: 22000 })
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it("traite une exception et une réponse vide comme une erreur neutre", async () => {
    expect((await releaseOnce({ busy: false }, async () => { throw new Error("boom") }, "m1")).error).toMatch(/Réessayez/)
    expect((await releaseOnce({ busy: false }, async () => ({}), "m1")).error).toMatch(/Réessayez/)
  })
})

describe("C09 succès", () => {
  it("affiche le montant renvoyé par l'action et Noter vers l'écran d'avis", () => {
    const out = renderToStaticMarkup(
      <ConfirmEndSuccess missionId="m1" studentName="Sèna" split={SPLIT} paid={22000} onBack={() => {}} />,
    )
    expect(out).toContain("Paiement libéré")
    expect(out).toMatch(/Sèna reçoit <b>22\s000/)
    expect(out).toContain("Noter Sèna")
    expect(out).toContain('href="/review/m1"')
    expect(out).toContain("Retour à la mission")
  })

  it("préfère le montant de l'action à celui du calcul", () => {
    const out = renderToStaticMarkup(
      <ConfirmEndSuccess missionId="m1" studentName="Sèna" split={SPLIT} paid={21000} onBack={() => {}} />,
    )
    expect(out).toMatch(/Sèna reçoit <b>21\s000/)
  })
})

describe("C11 mission terminée", () => {
  it("non notée : À faire, Noter, reçu depuis le grand livre, Republier", () => {
    const out = render(detailOf("done", { ledger: DONE_LEDGER }))
    expect(out.match(/<h1/g)).toHaveLength(1)
    expect(out).toContain("Noter Sèna")
    expect(out).toContain('href="/review/m1"')
    expect(out).toContain("Reçu")
    expect(out).toMatch(/Prélevé du séquestre/)
    expect(out).toMatch(/−\s?3\s000/)
    expect(out).toMatch(/22\s000/)
    expect(out).toContain("Libéré le")
    expect(out).toContain("Republier une mission similaire")
    expect(out).toContain("Réalisée par")
    expect(out).not.toContain("Confirmer la fin")
  })

  it("notée : l'avis donné s'affiche et Noter disparaît", () => {
    const out = render(detailOf("done", {
      ledger: DONE_LEDGER,
      review: { id: "r1", rating: 5, comment: "Très ponctuelle", createdAt: "2026-10-09T08:00:00Z" },
    }))
    expect(out).toContain("Votre avis")
    expect(out).toContain("Très ponctuelle")
    expect(out).not.toContain("Noter Sèna")
  })

  it("le versé vient d'escrowSplit, pas d'une ligne du grand livre", () => {
    const odd = DONE_LEDGER.map((m) => (m.type === "release" ? { ...m, amount: 99999 } : m))
    const out = render(detailOf("done", { ledger: odd }))
    expect(out).toMatch(/22\s000/)
    expect(out).not.toMatch(/99\s999/)
  })

  it("sans grand livre (mission héritée), le reçu ne montre que le budget", () => {
    const out = render(detailOf("done", { ledger: [] }))
    expect(out).toContain("Budget de la mission")
    expect(out).toContain("Le détail du paiement n'est pas disponible")
  })
})

describe("C11 mission annulée", () => {
  const ledger = [
    { type: "reserve", amount: 25000, createdAt: "2026-10-02T10:14:00Z" },
    { type: "refund", amount: 25000, createdAt: "2026-10-05T16:20:00Z" },
  ]
  const out = render(detailOf("cancelled", { selectedStudent: null, ledger }))

  it("affiche le remboursement (montant et date) et Dupliquer", () => {
    expect(out).toContain("Remboursement")
    expect(out).toContain("Remboursé sur votre portefeuille")
    expect(out).toMatch(/25\s000/)
    expect(out).toContain("5 oct. · 17:20")
    expect(out).toContain("Dupliquer la mission")
    expect(out).toContain("duplicate=m1")
    expect(out).toContain("Rien n'a été prélevé")
  })

  it("ne propose ni confirmation ni annulation", () => {
    expect(out).not.toMatch(/Confirmer la fin|Annuler la mission|Noter/)
  })

  it("sans mouvement refund, n'invente aucun montant", () => {
    const none = render(detailOf("cancelled", { selectedStudent: null, ledger: [] }))
    expect(none).toContain("Aucun remboursement n'est enregistré")
    expect(none).not.toContain("Remboursé sur votre portefeuille")
  })
})

describe("chronologie", () => {
  it("ne contient aucune étape inventée pour une mission en cours", () => {
    const d = detailOf("in_progress")
    const titles = buildTimeline(d, missionView(d), "Sèna").map((i) => i.title)
    expect(titles).toEqual([
      "Mission publiée",
      expect.stringContaining("placés en séquestre"),
      "Candidature de Sèna acceptée",
      "Mission en cours",
      "Votre validation de la fin",
      "Fonds versés à Sèna",
    ])
  })
})

describe("règles transverses", () => {
  const all = [
    render(detailOf("in_progress"), { ...FLAGS, confirmer: true }),
    render(detailOf("done", { ledger: DONE_LEDGER })),
    render(detailOf("cancelled", { ledger: [] })),
  ].join("")

  it("n'a ni tiret cadratin, ni ancien libellé, ni mot banni", () => {
    expect(all).not.toMatch(/[\u2013\u2014]/)
    expect(all).not.toContain("Confirmer la fin et payer")
    expect(all).not.toMatch(/livraison|course|coursier|Bientôt/i)
    expect(NB.test(all)).toBe(true)
  })
})
