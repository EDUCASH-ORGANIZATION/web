import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

const nav = vi.hoisted(() => ({ query: "" }))
const actions = vi.hoisted(() => ({
  acceptApplication: vi.fn(),
  rejectApplication: vi.fn(),
  updateMissionStatus: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/client/missions/m1",
  useSearchParams: () => new URLSearchParams(nav.query),
}))
vi.mock("@/lib/actions/application.actions", () => ({
  acceptApplication: actions.acceptApplication,
  rejectApplication: actions.rejectApplication,
}))
vi.mock("@/lib/actions/mission.actions", () => ({ updateMissionStatus: actions.updateMissionStatus }))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { MissionOpenView } = await import("../open-view")
const { CandidateRow } = await import("./candidate-row")
const { CandidateDrawer } = await import("./candidate-drawer")
const { AcceptDialog, AcceptDialogView, submitOnce } = await import("./accept-dialog")
const { RejectDialog } = await import("./reject-dialog")
const { CancelDialog, CancelDialogView, cancelSteps } = await import("./cancel-dialog")
const { joinNames } = await import("./names")
const { orderApplications } = await import("./candidate-list")
const { escrowSplit } = await import("@/lib/app/money")
const { formatAmount } = await import("@/lib/app/format")

const { declarationsOf, rulesOf } = await import("@/qa/fidelity/css-rules")
const css = (name) => readFileSync(join(process.cwd(), "src", "app", "design", "client", name), "utf8")

const noop = () => {}
const LONG_MESSAGE = "Bonjour, je traduis déjà des supports pour une ONG. ".repeat(4)

function studentOf(id, extra = {}) {
  return {
    id,
    fullName: "Awa Kouassi",
    avatarUrl: null,
    city: "Cotonou",
    rating: 4.8,
    missionsDone: 14,
    isVerified: true,
    verifiedUntil: "2099-06-30",
    school: "UAC",
    level: "Licence 3",
    skills: ["Traduction", "Livraison"],
    ...extra,
  }
}

function applicationOf(id, extra = {}, student = {}) {
  return {
    id: `a-${id}`,
    studentId: id,
    status: "pending",
    message: "Disponible dès ce soir.",
    createdAt: "2026-10-02T08:30:00Z",
    student: studentOf(id, student),
    ...extra,
  }
}

function detailOf({ status = "open", applications = [], ledger, budget = 10000, deadline = "2099-12-31", ...mission } = {}) {
  return {
    mission: {
      id: "m1",
      title: "Traduire un flyer en anglais",
      description: "Flyer A5 recto verso.\nEnviron 180 mots.",
      type: "Livraison",
      city: "Cotonou",
      budget,
      urgency: "high",
      deadline,
      status,
      createdAt: "2026-10-01T08:12:00Z",
      selectedStudentId: null,
      ...mission,
    },
    applications,
    selectedStudent: null,
    ledger: ledger ?? [{ type: "reserve", amount: budget, createdAt: "2026-10-01T08:12:00Z" }],
    review: null,
  }
}

const FLAGS = { confirmer: false, publiee: false, paymentsEnabled: true }

function profileOf(extra = {}, student = {}) {
  return {
    studentId: "s1",
    applicationId: "a-s1",
    applicationStatus: "pending",
    message: "Je peux vous rendre le flyer sous 24 h.",
    appliedAt: "2026-10-06T17:12:00Z",
    student: studentOf("s1", student),
    reviewsTotal: 2,
    reviews: [
      { id: "r1", rating: 5, comment: "Très soignée.", createdAt: "2026-09-12T10:00:00Z", authorFirstName: "Marie" },
      { id: "r2", rating: 4, comment: null, createdAt: "2026-08-03T10:00:00Z", authorFirstName: "Koffi" },
    ],
    ...extra,
  }
}

function render({ detail = detailOf(), candidate = null, flags = FLAGS, query = "" } = {}) {
  nav.query = query
  return renderToStaticMarkup(
    <ToastProvider>
      <MissionOpenView detail={detail} candidate={candidate} flags={flags} />
    </ToastProvider>,
  )
}

const count = (html, needle) => html.split(needle).length - 1
const TWO = [applicationOf("s1"), applicationOf("s2", { createdAt: "2026-10-03T08:30:00Z" }, { fullName: "Ulrich Zinsou", rating: 4.5 })]

beforeEach(() => {
  vi.clearAllMocks()
  nav.query = ""
})

describe("C04 sans candidature", () => {
  const html = render()

  it("rend un seul h1, l'état vide honnête et aucun drapeau citron ni tri", () => {
    expect(count(html, "<h1")).toBe(1)
    expect(html).toContain("Aucune candidature pour l&#x27;instant")
    expect(html).not.toContain("flag2")
    expect(html).not.toContain("Trier les candidatures")
  })

  it("propose l'annulation d'une mission ouverte et aucune modification ni prolongation", () => {
    expect(html).toContain("Annuler la mission")
    expect(html).not.toContain("Modifier")
    expect(html).not.toContain("Prolonger")
  })

  it("n'a aucun bouton encre ni rouge hors modales", () => {
    expect(html).not.toContain("btn--dark")
    expect(html).not.toContain("btn--danger")
    expect(html).not.toContain('role="dialog"')
  })
})

describe("C04 avec plusieurs candidatures", () => {
  const html = render({ detail: detailOf({ applications: [...TWO, applicationOf("s3", { status: "rejected" })] }) })

  it("annonce le nombre à examiner (citron) et propose le tri", () => {
    expect(html).toContain("2 à examiner")
    expect(html).toContain("flag2")
    expect(html).toContain("Trier les candidatures")
    expect(html).toContain("Plus récentes")
  })

  it("affiche vérification, note, missions et ville de chaque candidat", () => {
    expect(html).toContain("Awa Kouassi")
    expect(html).toContain("Vérifié")
    expect(html).toContain("4,8")
    expect(html).toContain("14 missions")
    expect(html).toContain("Cotonou")
    expect(html).toContain("Licence 3 · UAC")
  })

  it("ouvre le tiroir par ?candidat=, mène à la conversation et propose Refuser et Accepter", () => {
    expect(html).toContain('href="/client/missions/m1?candidat=s1"')
    expect(html).toContain('href="/client/messages/m1?studentId=s1"')
    expect(html).toContain('Accepter<span class="ds-desk-only"> Awa</span>')
    expect(html).toContain("Refuser")
    expect(html).toContain('aria-label="Refuser la candidature de Awa Kouassi"')
  })

  it("garde le drapeau publiee dans l'adresse du tiroir", () => {
    const out = render({ detail: detailOf({ applications: TWO }), flags: { ...FLAGS, publiee: true } })
    expect(out).toContain("candidat=s1&amp;publiee=1")
  })

  it("range une candidature refusée en retrait, sans Accepter ni Refuser", () => {
    const row = renderToStaticMarkup(
      <CandidateRow
        application={applicationOf("s3", { status: "rejected" })}
        profileHref="/p"
        chatHref="/c"
        onAccept={noop}
        onReject={noop}
      />,
    )
    expect(row).toContain("cand2--muted")
    expect(row).toContain("Non retenue")
    expect(row).not.toContain("Accepter")
    expect(row).not.toContain("Refuser")
    expect(row).toContain("Voir le profil")
  })

  it("trie : en attente d'abord, par date ou par note, puis les candidatures traitées", () => {
    const apps = [
      applicationOf("a", { createdAt: "2026-10-01T00:00:00Z" }, { rating: 5 }),
      applicationOf("b", { createdAt: "2026-10-05T00:00:00Z" }, { rating: 3 }),
      applicationOf("c", { createdAt: "2026-10-09T00:00:00Z", status: "rejected" }, { rating: 5 }),
    ]
    expect(orderApplications(apps, "recent").map((a) => a.studentId)).toEqual(["b", "a", "c"])
    expect(orderApplications(apps, "rated").map((a) => a.studentId)).toEqual(["a", "b", "c"])
  })

  it("n'a toujours aucun bouton encre ni rouge sur l'écran", () => {
    expect(html).not.toContain("btn--dark")
    expect(html).not.toContain("btn--danger")
  })
})

describe("message de candidature", () => {
  const props = { profileHref: "/p", chatHref: "/c", onAccept: noop, onReject: noop }

  it("replie un long message et propose de le lire en entier", () => {
    const html = renderToStaticMarkup(<CandidateRow {...props} application={applicationOf("s1", { message: LONG_MESSAGE })} />)
    expect(html).toContain("cand2__msg--clamp")
    expect(html).toContain("Lire la suite")
    expect(html).toContain('aria-expanded="false"')
  })

  it("déplié : plus de repli et un bouton pour réduire", () => {
    const html = renderToStaticMarkup(
      <CandidateRow {...props} defaultExpanded application={applicationOf("s1", { message: LONG_MESSAGE })} />,
    )
    expect(html).not.toContain("cand2__msg--clamp")
    expect(html).toContain("Réduire le message")
    expect(html).toContain('aria-expanded="true"')
  })

  it("un message court n'a pas de bouton (le repli sur 2 lignes ne le rogne pas)", () => {
    const html = renderToStaticMarkup(<CandidateRow {...props} application={applicationOf("s1")} />)
    expect(html).not.toContain("Lire la suite")
    expect(html).toContain("cand2__msg--clamp")
  })

  it("« Lire la suite » et la fiche de la planche mobile : bureau seulement, résumé sous le nom", () => {
    const html = renderToStaticMarkup(<CandidateRow {...props} application={applicationOf("s1", { message: LONG_MESSAGE })} />)
    expect(html).toContain('class="link2 cand2__link ds-desk-only"')
    expect(html).toContain('class="person2__sub ds-mob-only">4,8 / 5 · 14 missions<')
    expect(html).toContain('class="facts2 ds-desk-only"')
    expect(html).toContain('<span class="ds-mob-only">Profil</span>')
  })

  it("sans avis, le résumé mobile ne montre que les missions", () => {
    const html = renderToStaticMarkup(
      <CandidateRow {...props} application={applicationOf("s1", {}, { rating: 0, missionsDone: 0 })} />,
    )
    expect(html).toContain('class="person2__sub ds-mob-only">0 mission<')
  })

  it("affiche le texte tel quel, échappé", () => {
    const html = renderToStaticMarkup(
      <CandidateRow {...props} application={applicationOf("s1", { message: "<script>alert(1)</script>" })} />,
    )
    expect(html).not.toContain("<script>")
  })
})

describe("onglet Détails et séquestre (commission par escrowSplit)", () => {
  const html = render({ detail: detailOf({ applications: TWO, budget: 10000 }) })
  const split = escrowSplit(10000)

  it("affiche budget, commission et versé calculés, jamais en dur", () => {
    expect(html).toContain(formatAmount(split.total).replace(/ /g, "&#x202F;") ? "Budget bloqué" : "")
    expect(html).toContain(`Commission EduCash 12 %`)
    expect(html).toContain(formatAmount(split.student))
    expect(html).toContain(formatAmount(split.commission))
  })

  it("le séquestre reste le seul budget : l'estimation d'achats n'y est jamais ajoutée", () => {
    const out = render({ detail: detailOf({ applications: TWO, budget: 8000, purchasesEstimate: 15000 }) })
    const card = out.slice(out.indexOf('aria-label="Séquestre"'))
    const escrow = card.slice(0, card.indexOf("</section>"))
    expect(escrow).toContain(formatAmount(8000))
    expect(escrow).not.toContain(formatAmount(23000))
    expect(escrow).not.toContain(formatAmount(15000))
    expect(out).not.toContain(formatAmount(23000))
    expect(out).toContain("Achats estimés : environ")
  })

  it("affiche le type par son libellé, jamais la valeur brute", () => {
    expect(html).toContain("Marché et achats")
    expect(html).not.toContain(">Livraison<")
  })

  it("donne le lieu, l'urgence et la chronologie fondée sur les données", () => {
    expect(html).toContain("Urgent")
    expect(html).toContain("2 candidatures reçues")
    expect(html).toContain("Choisir un étudiant")
    expect(html).toContain("Bloqués à la publication le 1 oct. Si vous annulez")
  })

  it("sans grand livre, ne prétend pas que les fonds sont bloqués", () => {
    const out = render({ detail: detailOf({ applications: TWO, ledger: [] }) })
    expect(out).not.toContain("Budget bloqué")
    expect(out).not.toContain("Bloqués à la publication")
  })

  it("expose deux onglets mobiles reliés à leurs panneaux", () => {
    expect(html).toContain('role="tablist"')
    expect(count(html, 'role="tab"')).toBe(2)
    expect(count(html, 'role="tabpanel"')).toBe(2)
  })
})

describe("paiements en pause : jamais de séquestre", () => {
  const off = render({ detail: detailOf({ applications: TWO }), flags: { ...FLAGS, paymentsEnabled: false } })

  it("la carte s'appelle Budget, sans badge ni mot « séquestre » nulle part sur la page", () => {
    expect(off).toContain('aria-label="Budget"')
    expect(off).not.toContain('aria-label="Séquestre"')
    expect(off).not.toContain("En séquestre")
    expect(off).toContain("Montants indicatifs : les paiements ne sont pas encore actifs.")
    expect(off.toLowerCase()).not.toContain("séquestre")
  })

  it("la chronologie ne cite aucun montant bloqué", () => {
    expect(off).toContain("Publiée")
    expect(off).not.toMatch(/Publiée, /)
  })

  it("l'échéance dépassée ne parle pas de séquestre, ouverte elle le fait", () => {
    const overdue = (flags) => render({ detail: detailOf({ applications: TWO, deadline: "2020-01-01" }), flags })
    const closed = overdue({ ...FLAGS, paymentsEnabled: false })
    expect(closed).toContain("Rien ne se passe automatiquement")
    expect(closed).toContain("examinez les candidatures ou annulez la mission.")
    expect(closed.toLowerCase()).not.toContain("séquestre")
    expect(overdue({ confirmer: false, publiee: false }).toLowerCase()).not.toContain("séquestre")
    expect(overdue(FLAGS)).toContain("annulez la mission pour récupérer le séquestre.")
  })

  it("avec le drapeau absent, même comportement (jamais vrai par défaut)", () => {
    const missing = render({ detail: detailOf({ applications: TWO }), flags: { confirmer: false, publiee: false } })
    expect(missing.toLowerCase()).not.toContain("séquestre")
  })

  it("ouvert, la carte Séquestre et son badge reviennent", () => {
    const on = render({ detail: detailOf({ applications: TWO }) })
    expect(on).toContain('aria-label="Séquestre"')
    expect(on).toContain("En séquestre")
    expect(on).toContain("Publiée, ")
  })
})

describe("carte Achats estimés (mission avec achats)", () => {
  it("affiche l'estimation hors EduCash sous le séquestre, sans l'ajouter au budget", () => {
    const out = render({ detail: detailOf({ applications: TWO, budget: 8000, purchasesEstimate: 7450 }) })
    const card = out.slice(out.indexOf('aria-label="Achats estimés"'))
    const purchases = card.slice(0, card.indexOf("</section>"))
    expect(purchases).toContain("Hors EduCash")
    expect(purchases).toContain(formatAmount(7450))
    expect(purchases).toContain("directement au vendeur par MoMo")
    expect(out.indexOf('aria-label="Séquestre"')).toBeLessThan(out.indexOf('aria-label="Achats estimés"'))
    expect(out).not.toContain(formatAmount(15450))
  })

  it("sans estimation ou avec une estimation invalide, aucune carte ni NaN", () => {
    for (const purchasesEstimate of [undefined, null, 0, -5, Number.NaN, "abc"]) {
      const out = render({ detail: detailOf({ applications: TWO, purchasesEstimate }) })
      expect(out).not.toContain("Achats estimés")
      expect(out).not.toContain("NaN")
      expect(out).not.toContain("undefined")
    }
  })

  it("la carte Mission donne la date limite avec une majuscule", () => {
    const out = render({ detail: detailOf({ applications: TWO, deadline: "2099-12-31" }) })
    expect(out).toMatch(/Date limite<\/span><b>[A-Z]/)
  })
})

describe("échéance dépassée", () => {
  it("dit que rien n'est automatique et invite à examiner ou annuler", () => {
    const out = render({ detail: detailOf({ applications: TWO, deadline: "2020-01-01" }) })
    expect(out).toContain("Échéance dépassée")
    expect(out).toContain("Rien ne se passe automatiquement")
  })
})

describe("règle RD-SEC-01", () => {
  it("ne propose aucune annulation pour une mission en cours", () => {
    const out = render({ detail: detailOf({ status: "in_progress", applications: TWO }) })
    expect(out).not.toContain("Annuler la mission")
  })
})

describe("bannière de publication", () => {
  it("s'affiche avec ?publiee=1 sans rien exécuter", () => {
    const out = render({ flags: { ...FLAGS, publiee: true } })
    expect(out).toContain("Votre mission est publiée")
    expect(out).toContain('role="status"')
    expect(actions.updateMissionStatus).not.toHaveBeenCalled()
    expect(actions.acceptApplication).not.toHaveBeenCalled()
  })

  it("est absente sans le drapeau", () => {
    expect(render()).not.toContain("Votre mission est publiée")
  })

  it("les drapeaux confirmer et publiee n'ouvrent aucune boîte ni n'appellent aucune action", () => {
    const out = render({ detail: detailOf({ applications: TWO }), flags: { ...FLAGS, confirmer: true, publiee: true } })
    expect(out).not.toContain('role="dialog"')
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled()
  })
})

describe("C05 tiroir du candidat (5 états)", () => {
  const withQuery = (candidate, flags = FLAGS) =>
    render({ detail: detailOf({ applications: TWO }), candidate, flags, query: "candidat=s1" })

  it("reste fermé sans ?candidat=", () => {
    const out = render({ detail: detailOf({ applications: TWO }), candidate: profileOf() })
    expect(out).not.toContain('role="dialog"')
  })

  it("état vérifié : sceau, note, motivation, compétences, avis par prénom, lien vers le profil public", () => {
    const out = withQuery(profileOf())
    expect(out).toContain('role="dialog"')
    expect(out).toContain("Vérifié jusqu&#x27;en juin 2099")
    expect(out).toContain("Motivation pour cette mission")
    expect(out).toContain("Je peux vous rendre le flyer sous 24 h.")
    expect(out).toContain("Envoyée le")
    expect(out).toContain("Traduction")
    expect(out).toContain("Marché et achats")
    expect(out).toContain("Marie")
    expect(out).toContain("Très soignée.")
    expect(out).toContain('href="/talents/s1"')
    expect(out).toContain("Discuter")
    expect(out).toContain("Accepter Awa")
  })

  it("le tiroir est le seul endroit d'un bouton encre", () => {
    const out = withQuery(profileOf())
    expect(count(out, "btn--dark")).toBe(1)
    expect(out).not.toContain("btn--danger")
  })

  it("état non vérifié : dit non vérifié, ne bloque pas l'acceptation", () => {
    const out = withQuery(profileOf({}, { isVerified: false, verifiedUntil: null }))
    expect(out).toContain("Non vérifié")
    expect(out).not.toContain("Vérifié jusqu")
    expect(out).toContain("Accepter Awa")
  })

  it("vérification expirée : traitée comme non vérifiée", () => {
    const out = withQuery(profileOf({}, { verifiedUntil: "2020-01-01" }))
    expect(out).toContain("Non vérifié")
  })

  it("état aucun avis : le dit clairement, sans note inventée", () => {
    const out = withQuery(profileOf({ reviewsTotal: 0, reviews: [] }, { rating: 0, missionsDone: 0 }))
    expect(out).toContain('<span class="stat2__label">Avis</span><span class="stat2__value">Aucun</span>')
    expect(out).toContain("n&#x27;a pas encore d&#x27;avis sur EduCash")
    expect(out).not.toContain("0,0")
  })

  it("état candidature retirée ou introuvable : aucune action, jamais un profil vide", () => {
    const out = withQuery(null)
    const drawer = out.slice(out.indexOf('role="dialog"'))
    expect(drawer).toContain("Candidature retirée ou introuvable")
    expect(drawer).not.toContain("Accepter")
    expect(drawer).not.toContain("btn--dark")
  })

  it("état profil indisponible (candidateError) : message et Réessayer, la page reste affichée", () => {
    const out = withQuery(null, { ...FLAGS, candidateError: true })
    expect(out).toContain("Profil indisponible")
    expect(out).toContain("Réessayer")
    expect(out).toContain("Traduire un flyer en anglais")
    expect(out).toContain("Awa Kouassi")
  })

  it("une candidature déjà refusée n'a plus Refuser ni Accepter, seulement Discuter", () => {
    const out = withQuery(profileOf({ applicationStatus: "rejected" }))
    const drawer = out.slice(out.indexOf('role="dialog"'))
    expect(drawer).toContain("Non retenue")
    expect(drawer).toContain("Discuter")
    expect(drawer).not.toContain("Accepter")
    expect(drawer).not.toContain("Refuser")
  })

  it("rend le tiroir autonome avec titre relié, bouton Fermer et pied d'actions", () => {
    const out = renderToStaticMarkup(
      <CandidateDrawer open candidate={profileOf()} missionId="m1" onClose={noop} onRetry={noop} onAccept={noop} onReject={noop} />,
    )
    expect(out).toContain('aria-modal="true"')
    expect(out).toContain('aria-label="Fermer"')
    expect(out).toContain("drawer__foot")
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})

describe("modale d'acceptation", () => {
  const applicant = { id: "a-s1", studentId: "s1", student: studentOf("s1") }
  const mission = detailOf().mission
  const split = escrowSplit(mission.budget)
  const props = { applicant, mission, split, onClose: noop, onConfirm: noop }

  it("ne rend rien fermée", () => {
    expect(renderToStaticMarkup(<AcceptDialog {...props} open={false} />)).toBe("")
  })

  it("dit les conséquences, le versé par escrowSplit et porte le seul bouton encre", () => {
    const out = renderToStaticMarkup(<AcceptDialog {...props} open />)
    expect(out).toContain('role="dialog"')
    expect(out).toContain("Retenir Awa pour cette mission ?")
    expect(out).toContain("La mission passe « En cours » et une conversation s&#x27;ouvre avec Awa")
    expect(out).toContain(formatAmount(split.student))
    expect(out).toContain("btn--dark")
    expect(out).toContain("Accepter Awa")
    expect(out).not.toContain("btn--danger")
    expect(out).toContain("Licence 3 · UAC · 4,8 / 5")
  })

  it("prévient les autres candidats en attente et promet le séquestre seulement quand les paiements sont ouverts", () => {
    const on = renderToStaticMarkup(<AcceptDialog {...props} open othersNames={["Ulrich", "Codjo"]} paymentsEnabled />)
    expect(on).toContain("Ulrich et Codjo sont prévenus que leur candidature n&#x27;est pas retenue")
    expect(on).toContain(`Les ${formatAmount(mission.budget)} restent en séquestre : rien de plus à payer`)
    const off = renderToStaticMarkup(<AcceptDialog {...props} open othersNames={["Ulrich"]} />)
    expect(off).toContain("Ulrich est prévenu que sa candidature n&#x27;est pas retenue")
    expect(off).not.toMatch(/séquestre/i)
    expect(off).toContain("Montants indicatifs : les paiements ne sont pas encore actifs.")
    expect(on).not.toContain("Montants indicatifs")
    expect(renderToStaticMarkup(<AcceptDialog {...props} open />)).not.toContain("prévenu")
  })

  it("affiche l'erreur de l'action telle quelle et bloque les boutons pendant l'envoi", () => {
    const error = "Cette candidature n'est plus disponible."
    const out = renderToStaticMarkup(
      <AcceptDialogView {...props} pending={false} error={error} onCancel={noop} onConfirm={noop} cancelRef={{ current: null }} />,
    )
    expect(out).toContain('role="alert"')
    expect(out).toContain("Cette candidature n&#x27;est plus disponible.")
    const sending = renderToStaticMarkup(
      <AcceptDialogView {...props} pending error={null} onCancel={noop} onConfirm={noop} cancelRef={{ current: null }} />,
    )
    expect(sending).toContain('aria-busy="true"')
    expect(count(sending, "disabled")).toBeGreaterThanOrEqual(2)
  })

  it("un double clic n'appelle l'action qu'une fois", async () => {
    const guard = { current: false }
    const onConfirm = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 5)))
    const [first, second] = await Promise.all([submitOnce(guard, onConfirm), submitOnce(guard, onConfirm)])
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ done: true })
    expect(second).toEqual({ skipped: true })
  })

  it("une erreur est renvoyée telle quelle et autorise une nouvelle tentative", async () => {
    const guard = { current: false }
    const onConfirm = vi.fn().mockResolvedValueOnce({ error: "Cette mission n'est plus disponible." }).mockResolvedValueOnce({ success: true })
    expect(await submitOnce(guard, onConfirm)).toEqual({ error: "Cette mission n'est plus disponible." })
    expect(await submitOnce(guard, onConfirm)).toEqual({ done: true })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it("une exception donne un message neutre vouvoyé", async () => {
    const out = await submitOnce({ current: false }, () => Promise.reject(new Error("SQL boom")))
    expect(out).toEqual({ error: "Une erreur est survenue. Veuillez réessayer." })
  })
})

describe("modale de refus", () => {
  const applicant = { id: "a-s1", studentId: "s1", student: studentOf("s1") }
  const mission = detailOf().mission

  it("confirme par une boîte sans motif ni annulation différée, sans rouge plein", () => {
    const out = renderToStaticMarkup(<RejectDialog open applicant={applicant} mission={mission} onClose={noop} onConfirm={noop} />)
    expect(out).toContain("Refuser la candidature de Awa ?")
    expect(out).toContain("Traduire un flyer en anglais")
    expect(out).toContain("Awa sera prévenu que sa candidature n&#x27;est pas retenue")
    expect(out).toContain("Garder")
    expect(out).toContain("btn--dark")
    expect(out).not.toContain("btn--danger")
    expect(out).not.toContain("Motif")
    expect(out).not.toContain("10 secondes")
  })

  it("ne rend rien fermée", () => {
    expect(renderToStaticMarkup(<RejectDialog open={false} applicant={applicant} mission={mission} onClose={noop} onConfirm={noop} />)).toBe("")
  })
})

describe("C07 annulation en deux étapes", () => {
  const mission = detailOf().mission
  const names = ["Afiavi", "Ulrich", "Codjo"]
  const steps = cancelSteps({ title: mission.title, refundAmount: 10000, pendingNames: names })
  const view = (step, { error = null, refundAmount = 10000, pending = false } = {}) =>
    renderToStaticMarkup(
      <CancelDialogView
        steps={cancelSteps({ title: mission.title, refundAmount, pendingNames: names })}
        step={step}
        refundAmount={refundAmount}
        subtitle={`${mission.title} · 3 candidatures`}
        pending={pending}
        error={error}
        onClose={noop}
        onSecondary={noop}
        onConfirm={noop}
        cancelRef={{ current: null }}
      />,
    )

  it("étape 1 : conséquences, candidats prévenus et remboursement intégral, bouton encre, pas de rouge", () => {
    const out = renderToStaticMarkup(
      <CancelDialog
        open
        mission={mission}
        refundAmount={10000}
        pendingNames={names}
        applicationsCount={3}
        onClose={noop}
        onConfirm={noop}
      />,
    )
    expect(out).toContain("Annuler cette mission ?")
    expect(out).toContain("Traduire un flyer en anglais · 3 candidatures")
    expect(out).toContain("La mission sort tout de suite des recherches")
    expect(out).toContain("Afiavi, Ulrich et Codjo sont prévenus que la mission est annulée")
    expect(out).toContain(`Les ${formatAmount(10000)} reviennent sur votre portefeuille, en entier`)
    expect(out).toContain("Votre portefeuille EduCash")
    expect(out).toContain("Immédiat")
    expect(out).toContain("Continuer")
    expect(out).toContain("Garder la mission")
    expect(out).toContain("btn--dark")
    expect(out).not.toContain("btn--danger")
    expect(out).not.toContain("Motif")
  })

  it("étape 2 : seul le rouge plein, avec le montant remboursé", () => {
    const out = view(1)
    expect(out).toContain("Confirmer l&#x27;annulation")
    expect(out).toContain("Étape 2 sur 2")
    expect(out).toContain("C&#x27;est définitif")
    expect(out).toContain("Remboursé maintenant")
    expect(out).toContain(`Oui, annuler et rembourser ${formatAmount(10000)}`)
    expect(out).toContain("Retour")
    expect(out).toContain("btn--danger")
    expect(out).not.toContain("btn--dark")
  })

  it("affiche l'échec tel quel dans la boîte restée ouverte", () => {
    const out = view(1, { error: "Cette mission ne peut plus être annulée." })
    expect(out).toContain('role="alert"')
    expect(out).toContain("Cette mission ne peut plus être annulée.")
  })

  it("bloque les boutons pendant l'envoi", () => {
    const out = view(1, { pending: true })
    expect(out).toContain('aria-busy="true"')
  })

  it("sans montant connu (ou paiements en pause), ne promet aucun montant ni séquestre", () => {
    const unknown = cancelSteps({ title: "T", refundAmount: 0 })
    expect(unknown[0].consequences).toEqual(["La mission sort tout de suite des recherches"])
    expect(unknown[1].confirmLabel).toBe("Oui, annuler la mission")
    const out = view(0, { refundAmount: 0 })
    expect(out).not.toMatch(/FCFA|séquestre|Remboursement/i)
    expect(view(1, { refundAmount: 0 })).not.toContain("Remboursé maintenant")
  })

  it("accorde le verbe avec le nombre de candidats prévenus", () => {
    expect(steps[0].consequences[1]).toBe("Afiavi, Ulrich et Codjo sont prévenus que la mission est annulée")
    expect(cancelSteps({ title: "T", refundAmount: 0, pendingNames: ["Awa"] })[0].consequences[1]).toBe(
      "Awa est prévenu que la mission est annulée",
    )
    expect(joinNames(["A", "B"])).toBe("A et B")
    expect(joinNames([])).toBe("")
    expect(joinNames(["A", "B", "C"])).toBe("A, B et C")
    expect(joinNames(["A", "B", "C", "D"])).toBe("A, B, C et 1 autre")
    expect(joinNames(Array.from({ length: 15 }, (_, i) => `N${i}`))).toBe("N0, N1, N2 et 12 autres")
    expect(joinNames(["Awa", "Awa"])).toBe("Awa et Awa")
  })

  it("ne rend rien fermée", () => {
    expect(renderToStaticMarkup(<CancelDialog open={false} mission={mission} refundAmount={0} onClose={noop} onConfirm={noop} />)).toBe("")
  })
})

describe("feuilles C04 et C05 (planches mobile et tiroir)", () => {
  const c04 = css("c04.css")
  const MOBILE = "max-width: 1023.98px"

  it("sous 1024 px : plus d'en-tête de liste, le badge se pose sous le nom", () => {
    // le tri reste disponible (pas de display: none) et le titre n'est masqué que visuellement
    const head = declarationsOf(c04, ".c2 .cand2__list .list2__head", { media: MOBILE })
    expect(head.display).toBeUndefined()
    expect(head["justify-content"]).toBe("flex-end")
    const title = declarationsOf(c04, ".c2 .cand2__list .list2__title", { media: MOBILE })
    expect(title.display).toBeUndefined()
    expect(title["clip-path"]).toBe("inset(50%)")
    expect(declarationsOf(c04, ".cand2__top", { media: MOBILE }).display).toBe("contents")
    expect(declarationsOf(c04, ".cand2__top > .badge", { media: MOBILE })["align-self"]).toBe("flex-start")
  })

  it("le DOM suit l'ordre mobile ; le bureau seul réordonne Voir le profil avant Discuter", () => {
    const order = (n, media) => declarationsOf(c04, `.cand2__acts > :nth-child(${n})`, { media }).order
    expect([1, 2, 3, 4].map((n) => order(n))).toEqual(["2", "1", "3", "4"])
    expect(declarationsOf(c04, ".cand2__acts > :nth-child(n)", { media: MOBILE }).order).toBe("0")
    const row = renderToStaticMarkup(<CandidateRow {...{ profileHref: "/p", chatHref: "/c", onAccept: noop, onReject: noop }} application={applicationOf("s1")} />)
    const at = (needle) => row.indexOf(needle)
    expect(at("Discuter avec")).toBeLessThan(at("Voir le profil de"))
    expect(at("Voir le profil de")).toBeLessThan(at("Refuser la candidature de"))
    expect(at("Refuser la candidature de")).toBeLessThan(at("Accepter la candidature de"))
  })

  it("le bouton Accepter garde un nom accessible complet quand le prénom est masqué (mobile)", () => {
    const row = renderToStaticMarkup(<CandidateRow {...{ profileHref: "/p", chatHref: "/c", onAccept: noop, onReject: noop }} application={applicationOf("s1")} />)
    expect(row).toContain('aria-label="Accepter la candidature de Awa Kouassi"')
  })

  it("la méta des détails de mission est posée par base.css (un seul propriétaire)", () => {
    expect(declarationsOf(css("base.css"), ".c2 .head2 + .meta2")["margin-top"]).toBe("10px")
    expect(rulesOf(c04, ".c2 .head2 + .meta2", { media: "*" })).toEqual([])
  })

  it("le bouton Accepter garde sa largeur à 480 px (une seule ligne d'actions)", () => {
    const narrow = rulesOf(c04, ".cand2__acts .btn", { media: "max-width: 480px" })
    expect(narrow).toEqual([])
  })

  it("le tiroir a l'avatar de 56 px de la planche", () => {
    const decl = declarationsOf(css("c05.css"), ".c2 .drawer__head .av2")
    expect([decl.width, decl.height]).toEqual(["56px", "56px"])
  })
})
