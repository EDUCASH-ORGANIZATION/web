import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }))
vi.mock("@/lib/actions/mission.actions", () => ({ confirmMission: vi.fn() }))

const { MissionFollowupView } = await import("../followup-view")
const { ConfirmEndDialogView, ConfirmEndSuccess, releaseOnce, refreshAndClose } = await import("./confirm-end-dialog")
const { buildTimeline } = await import("./timeline")
const { missionView } = await import("@/lib/client-space/mission-view")
const { readFileSync } = await import("node:fs")
const { declarationsOf } = await import("@/qa/fidelity/css-rules")
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
    expect(html).toMatch(/Publiée, 25\s000\sFCFA en séquestre/)
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

  it("échec générique : texte neutre sans jamais dire que rien n'a été versé, avec Réessayer", () => {
    const out = view({ checked: true, error: "Impossible de libérer les fonds pour cette mission.", errorCode: "generic" })
    expect(out).toContain('role="dialog"')
    expect(out).toContain("Le paiement n'a pas pu être confirmé. Vérifiez l'état de la mission avant de réessayer.")
    expect(out).not.toMatch(/rien n'a été versé|restent en séquestre/)
    expect(out).toContain("Réessayer")
    expect(out).not.toContain("Actualiser")
    expect(out).not.toContain("Libérer le paiement")
  })

  it("already_done : mission déjà payée, Actualiser et pas de Réessayer", () => {
    const out = view({ checked: true, error: "Cette mission est déjà terminée.", errorCode: "already_done" })
    expect(out).toContain("Cette mission a déjà été payée. Actualisez la page pour voir le reçu.")
    expect(out).toContain("Actualiser")
    expect(out).not.toContain("Réessayer")
    expect(out).not.toMatch(/rien n'a été versé|restent en séquestre/)
  })

  it("already_released : paiement libéré, lien d'aide, Actualiser et pas de Réessayer", () => {
    const out = view({ checked: true, error: "Libération faite.", errorCode: "already_released" })
    const plain = out.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "")
    expect(plain).toContain("Le paiement a déjà été libéré. Si la mission n'apparaît pas terminée après actualisation, contactez l'aide.")
    expect(out).toMatch(/<a [^>]*href="\/contact\?sujet=question"[^>]*>contactez l'aide<\/a>/)
    expect(out).not.toContain("a déjà été payée")
    expect(out).toContain("Actualiser")
    expect(out).not.toContain("Réessayer")
  })

  it("Actualiser recharge puis ferme la modale", () => {
    const calls = []
    refreshAndClose(() => calls.push("refresh"), () => calls.push("close"))
    expect(calls).toEqual(["refresh", "close"])
  })

  it("not_in_progress : texte neutre avec Réessayer", () => {
    const out = view({ checked: true, error: "Cette mission n'est pas en cours.", errorCode: "not_in_progress" })
    expect(out).toContain("Le paiement n'a pas pu être confirmé")
    expect(out).toContain("Réessayer")
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
    expect(await releaseOnce(lock, confirm, "m1")).toEqual({ error: "Impossible de libérer les fonds pour cette mission.", code: "generic" })
    expect(await releaseOnce(lock, confirm, "m1")).toEqual({ amount: 22000 })
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it("transmet le code de l'action", async () => {
    const confirm = async () => ({ error: "Cette mission est déjà terminée.", code: "already_done" })
    expect(await releaseOnce({ busy: false }, confirm, "m1")).toEqual({ error: "Cette mission est déjà terminée.", code: "already_done" })
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
    expect(out).toContain('href="/client/review/m1"')
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
    expect(out).toContain('href="/client/review/m1"')
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

  it("le reçu lit le prélevé (release brut) et le versé (release moins commission) au grand livre", () => {
    const odd = DONE_LEDGER.map((m) => (m.type === "release" ? { ...m, amount: 30000 } : m))
    const out = render(detailOf("done", { ledger: odd }))
    const receipt = out.slice(out.indexOf('aria-label="Reçu"'))
    expect(receipt).toMatch(/30\s000/)
    expect(receipt).toMatch(/27\s000/)
    expect(receipt).not.toMatch(/22\s000/)
  })

  it("sans ligne de commission au grand livre, seul Prélevé s'affiche, sans commission ni versé", () => {
    const noCommission = DONE_LEDGER.filter((m) => m.type !== "commission")
    const out = render(detailOf("done", { ledger: noCommission }))
    const receipt = out.slice(out.indexOf('aria-label="Reçu"'))
    expect(receipt).toContain("Prélevé du séquestre")
    expect(receipt).toMatch(/25\s000/)
    expect(receipt).not.toContain("Commission")
    expect(receipt).not.toContain("Versé à")
    expect(receipt).not.toMatch(/22\s000|3\s000/)
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
      expect.stringMatching(/^Publiée, 25\s000\sFCFA en séquestre$/),
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

describe("le séquestre reste le budget seul (estimation d'achats jamais ajoutée)", () => {
  const withPurchases = (status, over) => {
    const base = detailOf(status, over)
    return { ...base, mission: { ...base.mission, budget: 8000, purchasesEstimate: 15000 } }
  }
  const section = (out, label) => {
    const from = out.slice(out.indexOf(`aria-label="${label}"`))
    return from.slice(0, from.indexOf("</section>"))
  }

  it("C08 en cours : 8 000 en séquestre, ni 23 000 ni 15 000", () => {
    const out = render(withPurchases("in_progress", { ledger: [{ type: "reserve", amount: 8000, createdAt: "2026-10-02T10:14:00Z" }] }))
    const escrow = section(out, "Séquestre")
    expect(escrow).toMatch(/8\s000/)
    expect(escrow).not.toMatch(/23\s000|15\s000/)
    expect(out).not.toMatch(/23\s000/)
  })

  it("C11 terminée : le reçu ne montre ni 23 000 ni 15 000", () => {
    const ledger = [
      { type: "reserve", amount: 8000, createdAt: "2026-10-02T10:14:00Z" },
      { type: "release", amount: 8000, createdAt: "2026-10-08T09:02:00Z" },
      { type: "commission", amount: 960, createdAt: "2026-10-08T09:02:00Z" },
    ]
    const out = render(withPurchases("done", { ledger }))
    const receipt = section(out, "Reçu du service")
    expect(receipt).toMatch(/8\s000/)
    expect(receipt).not.toMatch(/23\s000|15\s000/)
    expect(out).not.toMatch(/23\s000/)
  })

  it("C11 annulée : le remboursement ne montre ni 23 000 ni 15 000", () => {
    const ledger = [
      { type: "reserve", amount: 8000, createdAt: "2026-10-02T10:14:00Z" },
      { type: "refund", amount: 8000, createdAt: "2026-10-05T16:20:00Z" },
    ]
    const out = render(withPurchases("cancelled", { selectedStudent: null, ledger }))
    const refund = section(out, "Remboursement")
    expect(refund).toMatch(/8\s000/)
    expect(refund).not.toMatch(/23\s000|15\s000/)
    expect(out).not.toMatch(/23\s000/)
  })
})

describe("achats pour votre compte (C08, C11), estimation seule", () => {
  const withEstimate = (status, over = {}, estimate = 15000) => {
    const base = detailOf(status, over)
    return { ...base, mission: { ...base.mission, budget: 8000, purchasesEstimate: estimate } }
  }
  const RESERVE = [{ type: "reserve", amount: 8000, createdAt: "2026-10-02T10:14:00Z" }]
  const DONE = [
    ...RESERVE,
    { type: "release", amount: 8000, createdAt: "2026-10-08T09:02:00Z" },
    { type: "commission", amount: 960, createdAt: "2026-10-08T09:02:00Z" },
  ]
  const section = (out, label) => {
    const from = out.slice(out.indexOf(`aria-label="${label}"`))
    return from.slice(0, from.indexOf("</section>"))
  }
  const at = (out, label) => out.indexOf(`aria-label="${label}"`)
  const PAYS = { ...FLAGS, paymentsEnabled: true }

  it("C08 avec estimation : carte achats, Hors EduCash, estimation seule, étudiant et séquestre à droite", () => {
    const out = render(withEstimate("in_progress", { ledger: RESERVE }), PAYS)
    const card = section(out, "Achats pour votre compte")
    expect(card).toContain("Hors EduCash")
    expect(card).toMatch(/Estimation donnée à la publication/)
    expect(card).toMatch(/15\s000/)
    expect(card).toContain("directement par MoMo")
    expect(card).not.toMatch(/Demande de paiement|Payé en direct|vendeur\s:/)
    expect(at(out, "Mission en cours")).toBeLessThan(at(out, "Achats pour votre compte"))
    expect(at(out, "Achats pour votre compte")).toBeLessThan(at(out, "Chronologie"))
    expect(at(out, "Chronologie")).toBeLessThan(at(out, "Étudiant retenu"))
    expect(at(out, "Étudiant retenu")).toBeLessThan(at(out, "Séquestre"))
    expect(out.match(/Hors EduCash/g)).toHaveLength(1)
  })

  it("C08 : le séquestre reste le budget seul, ni 23 000 ni 15 000 dans la carte Séquestre", () => {
    const out = render(withEstimate("in_progress", { ledger: RESERVE }), PAYS)
    const escrow = section(out, "Séquestre")
    expect(escrow).toMatch(/8\s000/)
    expect(escrow).not.toMatch(/23\s000|15\s000/)
    expect(escrow).toContain("pour le service seulement")
    expect(out).not.toMatch(/23\s000/)
  })

  it("C08 : la ligne provisoire de l'en-tête migre vers la carte, une seule mention de l'estimation", () => {
    const out = render(withEstimate("in_progress", { ledger: RESERVE }), PAYS)
    expect(out).not.toContain("Achats estimés")
    expect(out.match(/15\s000/g)).toHaveLength(1)
    expect(out).toContain("Avec achats")
  })

  it("le mot séquestre dans la carte achats dépend de la réserve, pas du drapeau des paiements", () => {
    for (const flags of [FLAGS, PAYS]) {
      expect(section(render(withEstimate("in_progress", { ledger: RESERVE }), flags), "Achats pour votre compte")).toContain("séquestre")
      expect(section(render(withEstimate("done", { ledger: DONE }), flags), "Achats pour votre compte")).toContain("séquestre")
      expect(section(render(withEstimate("in_progress", { ledger: [] }), flags), "Achats pour votre compte")).not.toMatch(/séquestre/i)
    }
  })

  it("jamais « vous touchez » côté client", () => {
    const all = [render(withEstimate("in_progress", { ledger: RESERVE }), PAYS), render(withEstimate("done", { ledger: DONE }), PAYS)].join("")
    expect(all).not.toMatch(/vous touchez/i)
  })

  it("sans estimation ou estimation invalide : aucune carte achats, étudiant à gauche", () => {
    for (const estimate of [null, 0, -5, "abc"]) {
      const out = render(withEstimate("in_progress", { ledger: RESERVE }, estimate), PAYS)
      expect(out).not.toContain("Achats pour votre compte")
      expect(out).not.toContain("Hors EduCash")
      expect(at(out, "Étudiant retenu")).toBeLessThan(at(out, "Chronologie"))
      expect(at(out, "Chronologie")).toBeLessThan(at(out, "Séquestre"))
    }
  })

  it("C08 sans estimation : l'emplacement de Confirmer la fin reste actif (aucune déclaration de l'étudiant)", () => {
    const out = render(detailOf("in_progress"), PAYS)
    expect(section(out, "Séquestre")).toMatch(/<button[^>]*btn--dark[^>]*>/)
    expect(out).not.toMatch(/à confirmer|Disponible quand/i)
  })

  it("C11 terminée non notée avec estimation : À faire, achats, chronologie, Reçu du service puis Réalisée par, sans Coût total", () => {
    const out = render(withEstimate("done", { ledger: DONE }), PAYS)
    expect(at(out, "Votre avis")).toBeLessThan(at(out, "Achats pour votre compte"))
    expect(at(out, "Achats pour votre compte")).toBeLessThan(at(out, "Chronologie"))
    expect(at(out, "Chronologie")).toBeLessThan(at(out, "Reçu du service"))
    expect(at(out, "Reçu du service")).toBeLessThan(at(out, "Réalisée par"))
    expect(out).not.toContain("Coût total")
    expect(out).toContain("Avis à laisser")
    const receipt = section(out, "Reçu du service")
    expect(receipt).toMatch(/8\s000/)
    expect(receipt).not.toMatch(/23\s000|15\s000/)
    expect(receipt).toContain("Libéré le")
    expect(out).not.toContain("Achats estimés")
  })

  it("C11 terminée notée avec estimation : la carte achats et l'avis donné cohabitent", () => {
    const out = render(
      withEstimate("done", { ledger: DONE, review: { id: "r1", rating: 5, comment: null, createdAt: "2026-10-09T08:00:00Z" } }),
      PAYS,
    )
    expect(out).toContain("Achats pour votre compte")
    expect(out).toContain("Votre avis")
    expect(out).not.toContain("Avis à laisser")
  })

  it("C11 sans estimation : titre Reçu, Réalisée par avant le reçu, aucune carte achats", () => {
    const out = render(detailOf("done", { ledger: DONE_LEDGER }), PAYS)
    expect(out).not.toContain("Achats pour votre compte")
    expect(out).not.toContain("Reçu du service")
    expect(at(out, "Réalisée par")).toBeLessThan(at(out, "Reçu"))
  })

  it("C11 annulée avec estimation : la ligne de l'en-tête reste, aucune carte achats", () => {
    const ledger = [...RESERVE, { type: "refund", amount: 8000, createdAt: "2026-10-05T16:20:00Z" }]
    const out = render(withEstimate("cancelled", { selectedStudent: null, ledger }), PAYS)
    expect(out).toContain("Achats estimés")
    expect(out).not.toContain("Achats pour votre compte")
  })

  it("un seul h1 par page", () => {
    for (const status of ["in_progress", "done", "cancelled"]) {
      expect(render(withEstimate(status, { ledger: status === "done" ? DONE : RESERVE }), PAYS).match(/<h1/g)).toHaveLength(1)
    }
  })

  it("la modale et Libérer le paiement restent inchangées avec une estimation", () => {
    const out = render(withEstimate("in_progress", { ledger: RESERVE }), { ...PAYS, confirmer: true })
    expect(out).toContain('role="dialog"')
    expect(out).toContain("Libérer le paiement")
  })
})

describe("feuilles C08 et C11 (planches mobiles)", () => {
  const c08 = readFileSync(new URL("../../../../app/design/client/c08.css", import.meta.url), "utf8")
  const c11 = readFileSync(new URL("../../../../app/design/client/c11.css", import.meta.url), "utf8")
  const mobile = "max-width: 1023.98px"

  it("sous 1024 px, les colonnes s'effacent et les cartes suivent l'ordre des planches", () => {
    expect(declarationsOf(c08, ".fup2 .fup2__split > .col2", { media: mobile }).display).toBe("contents")
    const order = (selector, css = c08) => declarationsOf(css, selector, { media: mobile }).order
    expect([".fup2 .fup2__status", ".fup2 .fup2__student", ".fup2 .fup2__purchases", ".fup2 .fup2__money", ".fup2 .fup2__timeline"].map((s) => order(s)))
      .toEqual(["1", "2", "3", "4", "5"])
    expect(order(".fup2 .fup2__split--done .fup2__money", c11)).toBe("3")
    expect(order(".fup2 .fup2__split--done .fup2__purchases", c11)).toBe("4")
  })

  it("la méta de l'en-tête descend de 10 px (8 px sur mobile) et les cartes mobiles gardent 20 px à 390 px", () => {
    expect(declarationsOf(c08, ".fup2 > header .meta2")["margin-top"]).toBe("10px")
    expect(declarationsOf(c08, ".fup2 > header .meta2", { media: "max-width: 767.98px" })["margin-top"]).toBe("8px")
    expect(declarationsOf(c08, ".fup2 .card2", { media: "max-width: 480px" }).padding).toBe("var(--s-5)")
  })
})

describe("carte étudiant compacte sous 1024 px et ordre mobile de C11", () => {
  const c08 = readFileSync(new URL("../../../../app/design/client/c08.css", import.meta.url), "utf8")
  const c11 = readFileSync(new URL("../../../../app/design/client/c11.css", import.meta.url), "utf8")
  const mobile = "max-width: 1023.98px"
  const doneWith = (estimate, extra = {}) => {
    const base = detailOf("done", { ledger: DONE_LEDGER, ...extra })
    return { ...base, mission: { ...base.mission, purchasesEstimate: estimate } }
  }

  it("la version compacte garde le profil et la discussion, avec des libellés nommés", () => {
    const out = render(detailOf("in_progress"))
    const mini = out.slice(out.indexOf('class="fup2__mini"'), out.indexOf("</section>", out.indexOf('class="fup2__mini"')))
    expect(mini).toContain('aria-label="Voir le profil de Sèna"')
    expect(mini).toContain('href="/talents/s1"')
    expect(mini).toContain('aria-label="Discuter avec Sèna"')
    expect(mini).toContain('href="/client/messages/m1?studentId=s1"')
    expect(mini).toMatch(/4,9 \/ 5 · 23 missions/)
  })

  it("le détail est masqué et la version compacte affichée sous 1024 px seulement", () => {
    expect(declarationsOf(c08, ".fup2 .fup2__full").display).toBe("contents")
    expect(declarationsOf(c08, ".fup2 .fup2__mini").display).toBe("none")
    expect(declarationsOf(c08, ".fup2 .fup2__full", { media: mobile }).display).toBe("none")
    expect(declarationsOf(c08, ".fup2 .fup2__mini", { media: mobile }).display).toBe("flex")
    expect(declarationsOf(c08, ".fup2 .fup2__mini .iconbtn2", { media: mobile }).width).toBe("44px")
  })

  it("C11 avec achats sur mobile : reçu, achats, étudiant, chronologie, et la carte À faire masquée (Noter est dans la barre)", () => {
    const o = (sel) => declarationsOf(c11, sel, { media: mobile })
    expect([o(".fup2 .fup2__split--done .fup2__money").order, o(".fup2 .fup2__split--done .fup2__purchases").order,
      o(".fup2 .fup2__split--purchases .fup2__student").order, o(".fup2 .fup2__split--purchases .fup2__timeline").order]).toEqual(["3", "4", "5", "6"])
    expect(o(".fup2 .fup2__split--purchases .fup2__status--todo").display).toBe("none")
  })

  it("la carte À faire masquable n'existe que si Noter est dans la barre ; elle est absente de la classe sans estimation", () => {
    const withEst = render(doneWith(15000))
    expect(withEst).toContain("fup2__split--purchases")
    expect(withEst).toContain("fup2__status--todo")
    expect(withEst).toMatch(/mbar2[\s\S]*Noter Sèna/)
    const noEst = render(doneWith(null))
    expect(noEst).not.toContain("fup2__split--purchases")
    const rated = render(doneWith(15000, { review: { rating: 5, comment: null, createdAt: "2026-10-09T00:00:00Z" } }))
    expect(rated).not.toContain("fup2__status--todo")
  })
})

