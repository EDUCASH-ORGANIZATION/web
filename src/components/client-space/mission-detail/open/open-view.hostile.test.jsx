import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const nav = vi.hoisted(() => ({ query: "" }))
const actions = vi.hoisted(() => ({
  acceptApplication: vi.fn(),
  rejectApplication: vi.fn(),
  updateMissionStatus: vi.fn(),
}))
const replace = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace, push: vi.fn() }),
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
const { AcceptDialog } = await import("./accept-dialog")
const { RejectDialog } = await import("./reject-dialog")
const { CancelDialog, CancelDialogView, cancelSteps } = await import("./cancel-dialog")
const { MESSAGE_CLAMP_CHARS } = await import("./candidate-row")
const { missionView } = await import("@/lib/client-space/mission-view")
const { escrowSplit } = await import("@/lib/app/money")

const noop = () => {}
const SEQUESTRE = /s[ée]questre/i

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
    skills: ["Traduction"],
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

function detailOf({ applications = [], budget = 10000, deadline = "2099-12-31", ledger, ...mission } = {}) {
  return {
    mission: {
      id: "m1",
      title: "Traduire un flyer",
      description: "Flyer A5.",
      type: "Livraison",
      city: "Cotonou",
      budget,
      urgency: "high",
      deadline,
      status: "open",
      createdAt: "2026-10-01T08:12:00Z",
      selectedStudentId: null,
      ...mission,
    },
    applications,
    selectedStudent: null,
    ledger: ledger ?? [{ type: "reserve", amount: typeof budget === "number" ? budget : 0, createdAt: "2026-10-01T08:12:00Z" }],
    review: null,
  }
}

function profileOf(extra = {}, student = {}) {
  return {
    studentId: "s1",
    applicationId: "a-s1",
    applicationStatus: "pending",
    message: "Je peux le faire.",
    appliedAt: "2026-10-06T17:12:00Z",
    student: studentOf("s1", student),
    reviewsTotal: 0,
    reviews: [],
    ...extra,
  }
}

function render({ detail = detailOf(), candidate = null, flags = { paymentsEnabled: true }, query = "" } = {}) {
  nav.query = query
  return renderToStaticMarkup(
    <ToastProvider>
      <MissionOpenView detail={detail} candidate={candidate} flags={flags} />
    </ToastProvider>,
  )
}

const count = (html, needle) => html.split(needle).length - 1

beforeEach(() => {
  vi.clearAllMocks()
  nav.query = ""
})

describe("ARGENT : estimation d'achats", () => {
  it.each([[0], [-5], [Number.NaN], [Infinity], [-Infinity], ["abc"], [null], [undefined], [""], [true], [{}], [[]], [1e12]])(
    "n'affiche aucune carte Achats estimés pour %s",
    (raw) => {
      const html = render({ detail: detailOf({ purchasesEstimate: raw, applications: [applicationOf("s1")] }) })
      expect(html).not.toContain("Achats estimés")
      expect(html).not.toContain("Hors EduCash")
      expect(html).not.toContain("Estimation indicative")
    },
  )

  it("affiche la carte pour une estimation valide, y compris chaîne numérique", () => {
    expect(render({ detail: detailOf({ purchasesEstimate: 4000 }) })).toContain("Achats estimés")
    expect(render({ detail: detailOf({ purchasesEstimate: "4000" }) })).toContain("Achats estimés")
  })

  it("n'ajoute jamais l'estimation au budget, au versement ni au remboursement", () => {
    const base = missionView(detailOf({ purchasesEstimate: null }))
    const withEstimate = missionView(detailOf({ purchasesEstimate: 4000 }))
    expect(withEstimate.receipt.reserved).toBe(10000)
    expect(withEstimate.split).toEqual(base.split)
    expect(withEstimate.split).toEqual(escrowSplit(10000))
  })

  it("la modale d'annulation rembourse le budget seul, estimation présente", () => {
    const view = missionView(detailOf({ purchasesEstimate: 4000 }))
    const html = renderToStaticMarkup(
      <CancelDialog
        open
        mission={{ id: "m1", title: "T" }}
        refundAmount={view.receipt.reserved}
        pendingNames={["Awa"]}
        applicationsCount={1}
        onClose={noop}
        onConfirm={noop}
      />,
    )
    expect(html).toMatch(/10[\s  ]000/)
    expect(html).not.toMatch(/14[\s  ]000/)
    expect(html).not.toMatch(/4[\s  ]000/)
  })

  it.each([[Number.NaN], ["abc"], [null], [undefined], [-1], [Infinity]])("budget invalide (%s) : ni NaN ni undefined ni null affichés", (budget) => {
    let html
    try {
      html = render({ detail: detailOf({ budget, ledger: [] }), flags: { paymentsEnabled: true } })
    } catch (e) {
      throw new Error(`rendu en exception pour budget ${String(budget)} : ${e.message}`)
    }
    expect(html).not.toMatch(/NaN|undefined|Infinity|>null</)
  })
})

describe("ARGENT : le mot séquestre selon l'état des paiements", () => {
  const apps = [applicationOf("s1"), applicationOf("s2")]
  const overdue = "2020-01-01"

  function everything(flags, { deadline = "2099-12-31" } = {}) {
    const detail = detailOf({ applications: apps, purchasesEstimate: 3000, deadline })
    const paymentsEnabled = flags?.paymentsEnabled === true
    const page = render({ detail, flags, query: "candidat=s1", candidate: profileOf() })
    const view = missionView(detail)
    const dialogProps = { applicant: { id: "a-s1", studentId: "s1", student: studentOf("s1") }, mission: detail.mission, onClose: noop, onConfirm: noop }
    const accept = renderToStaticMarkup(
      <AcceptDialog {...dialogProps} open split={view.split} othersNames={["Ulrich"]} paymentsEnabled={paymentsEnabled} />,
    )
    const reject = renderToStaticMarkup(<RejectDialog {...dialogProps} open />)
    const cancel = renderToStaticMarkup(
      <CancelDialog open mission={detail.mission} refundAmount={paymentsEnabled ? view.receipt.reserved : 0} pendingNames={["Awa"]} applicationsCount={2} onClose={noop} onConfirm={noop} />,
    )
    return { page, accept, reject, cancel }
  }

  it.each([
    ["paymentsEnabled faux", { paymentsEnabled: false }],
    ["paymentsEnabled absent", {}],
    ["flags null", null],
    ["paymentsEnabled chaîne \"true\"", { paymentsEnabled: "true" }],
    ["paymentsEnabled 1", { paymentsEnabled: 1 }],
  ])("paiements fermés (%s) : aucun séquestre dans la page, le tiroir et les 3 modales", (_label, flags) => {
    const out = everything(flags)
    for (const [where, html] of Object.entries(out)) expect(html, where).not.toMatch(SEQUESTRE)
  })

  it("paiements fermés ET échéance dépassée : toujours aucun séquestre", () => {
    const out = everything({ paymentsEnabled: false }, { deadline: overdue })
    expect(out.page).toContain("L&#x27;échéance est dépassée")
    expect(out.page).not.toMatch(SEQUESTRE)
  })

  it("paiements ouverts : le séquestre est présent", () => {
    const out = everything({ paymentsEnabled: true })
    expect(out.page).toMatch(SEQUESTRE)
    expect(out.accept).toMatch(SEQUESTRE)
  })

  it("jamais de promesse « vous touchez » côté client, paiements ouverts ou fermés", () => {
    for (const flags of [{ paymentsEnabled: true }, { paymentsEnabled: false }]) {
      for (const html of Object.values(everything(flags))) expect(html).not.toMatch(/vous touchez/i)
    }
  })
})

describe("CANDIDATS HOSTILES", () => {
  const XSS = '<script>alert("x")</script>'

  it("échappe le nom et le message contenant du HTML ou des guillemets", () => {
    const hostile = applicationOf("s1", { message: `${XSS} "double" 'simple' & <img src=x onerror=alert(1)>` }, { fullName: `${XSS} "Zoé" O'Neil` })
    const html = render({ detail: detailOf({ applications: [hostile] }) })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<img src=x")
    expect(html).toContain("&lt;script&gt;")
  })

  it("échappe aussi dans le tiroir et les modales", () => {
    const student = { fullName: `${XSS} "Zoé"` }
    const html = render({ query: "candidat=s1", candidate: profileOf({ message: XSS }, student), detail: detailOf({ applications: [applicationOf("s1", {}, student)] }) })
    expect(html).not.toContain("<script>")
    const applicant = { id: "a-s1", studentId: "s1", student: studentOf("s1", student) }
    for (const node of [
      <AcceptDialog key="a" open applicant={applicant} mission={{ title: XSS, budget: 100 }} split={escrowSplit(100)} onClose={noop} onConfirm={noop} />,
      <RejectDialog key="r" open applicant={applicant} mission={{ title: XSS }} onClose={noop} onConfirm={noop} />,
      <CancelDialog key="c" open mission={{ title: XSS }} pendingNames={[XSS]} onClose={noop} onConfirm={noop} />,
    ]) {
      expect(renderToStaticMarkup(node)).not.toContain("<script>")
    }
  })

  it("supporte un message de 5000 caractères sans casser la rangée", () => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1", { message: "a".repeat(5000) })] }) })
    expect(count(html, 'role="listitem"')).toBe(1)
    expect(html).toContain("Lire la suite")
    expect(count(html, "<h1")).toBe(1)
  })

  it("supporte un nom de 5000 caractères", () => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1", {}, { fullName: "N".repeat(5000) })] }) })
    expect(count(html, 'role="listitem"')).toBe(1)
  })

  it("message vide, espaces ou absent : pas de paragraphe ni de Lire la suite", () => {
    for (const message of ["", "   \n ", null, undefined, 42]) {
      const html = render({ detail: detailOf({ applications: [applicationOf("s1", { message })] }) })
      expect(html, String(message)).not.toContain("cand2__msg")
      expect(html, String(message)).not.toContain("Lire la suite")
    }
  })

  it("Lire la suite seulement si le texte dépasse le seuil de rognage", () => {
    const short = render({ detail: detailOf({ applications: [applicationOf("s1", { message: "a".repeat(MESSAGE_CLAMP_CHARS) })] }) })
    const long = render({ detail: detailOf({ applications: [applicationOf("s1", { message: "a".repeat(MESSAGE_CLAMP_CHARS + 1) })] }) })
    expect(short).not.toContain("Lire la suite")
    expect(long).toContain("Lire la suite")
  })

  it.each([[""], ["   "], [null], [undefined], [7]])("nom vide (%j) : libellé neutre, jamais « Accepter undefined »", (fullName) => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1", {}, { fullName })] }) })
    expect(html).toContain("Étudiant EduCash")
    expect(html).not.toMatch(/Accepter\s*<span[^>]*>\s*<\/span>/)
    expect(html).not.toMatch(/undefined|null|NaN/)
    expect(html).not.toContain('ds-desk-only"> ')
    const drawer = render({ query: "candidat=s1", candidate: profileOf({}, { fullName }), detail: detailOf({ applications: [applicationOf("s1", {}, { fullName })] }) })
    expect(drawer).toContain(">Accepter<")
    expect(drawer).not.toMatch(/undefined|null|NaN/)
    const accept = renderToStaticMarkup(
      <AcceptDialog open applicant={{ id: "a", studentId: "s1", student: studentOf("s1", { fullName }) }} mission={{ title: "T", budget: 100 }} split={escrowSplit(100)} onClose={noop} onConfirm={noop} />,
    )
    expect(accept).toContain("Retenir ce candidat")
    expect(accept).not.toMatch(/undefined|null/)
  })
})

describe("PRIVACY", () => {
  it("n'expose ni e-mail ni téléphone d'un candidat, même présents dans les données", () => {
    const leaky = { email: "secret@exemple.test", phone: "+22997000000", telephone: "+22997000001", card_url: "https://x.test/card" }
    const app = applicationOf("s1", { ...leaky }, { ...leaky })
    const html = render({
      detail: detailOf({ applications: [app] }),
      query: "candidat=s1",
      candidate: profileOf({ ...leaky }, { ...leaky }),
    })
    for (const secret of ["secret@exemple.test", "+22997000000", "+22997000001", "card_url", "mailto:", "tel:", "wa.me", "whatsapp"]) {
      expect(html, secret).not.toContain(secret)
    }
  })

  it("les seuls liens sortants du candidat sont la conversation interne et le profil public", () => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1")] }), query: "candidat=s1", candidate: profileOf() })
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true)
  })
})

describe("ACTIONS : aucune mutation au rendu ni par GET", () => {
  it("?candidat= ouvre le tiroir sans appeler aucune action", () => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1")] }), query: "candidat=s1", candidate: profileOf() })
    expect(html).toContain('role="dialog"')
    expect(actions.acceptApplication).not.toHaveBeenCalled()
    expect(actions.rejectApplication).not.toHaveBeenCalled()
    expect(actions.updateMissionStatus).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("drapeaux d'URL confirmer et publiee : aucune action appelée", () => {
    render({ detail: detailOf({ applications: [applicationOf("s1")] }), flags: { confirmer: true, publiee: true, paymentsEnabled: true }, query: "confirmer=1&publiee=1&accepter=s1&annuler=1&refuser=s1" })
    expect(actions.acceptApplication).not.toHaveBeenCalled()
    expect(actions.rejectApplication).not.toHaveBeenCalled()
    expect(actions.updateMissionStatus).not.toHaveBeenCalled()
  })

  it("id inconnu ou d'une autre mission : état neutre, aucune donnée, aucune exception, aucune action", () => {
    for (const query of ["candidat=inconnu", "candidat=", "candidat=%00", "candidat=" + "z".repeat(5000)]) {
      const html = render({ detail: detailOf({ applications: [applicationOf("s1")] }), query, candidate: null })
      expect(html, query).not.toContain("Awa Kouassi</h2>")
      expect(html, query).not.toMatch(/undefined|NaN/)
    }
    const unknown = render({ detail: detailOf({ applications: [applicationOf("s1")] }), query: "candidat=autre", candidate: null })
    expect(unknown).toContain("Candidature retirée ou introuvable")
    expect(unknown.slice(unknown.indexOf('role="dialog"'))).not.toContain("Accepter")
    expect(actions.acceptApplication).not.toHaveBeenCalled()
  })

  it("aucune modale n'est rendue à l'ouverture de la page (aucune action possible sans clic)", () => {
    const html = render({ detail: detailOf({ applications: [applicationOf("s1")] }) })
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain("Confirmer l&#x27;annulation")
  })

  it("rien n'est appelé au rendu d'une modale ouverte", () => {
    const applicant = { id: "a-s1", studentId: "s1", student: studentOf("s1") }
    const onConfirm = vi.fn()
    renderToStaticMarkup(<AcceptDialog open applicant={applicant} mission={{ title: "T", budget: 100 }} split={escrowSplit(100)} onClose={noop} onConfirm={onConfirm} />)
    renderToStaticMarkup(<RejectDialog open applicant={applicant} mission={{ title: "T" }} onClose={noop} onConfirm={onConfirm} />)
    renderToStaticMarkup(<CancelDialog open mission={{ title: "T" }} onClose={noop} onConfirm={onConfirm} />)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("le tiroir ne propose Accepter et Refuser que pour une candidature en attente", () => {
    for (const applicationStatus of ["accepted", "rejected"]) {
      const html = render({ query: "candidat=s1", candidate: profileOf({ applicationStatus }), detail: detailOf({ applications: [applicationOf("s1", { status: applicationStatus })] }) })
      expect(html).not.toContain("Accepter")
      expect(html).not.toContain("Refuser")
    }
  })

  it("l'annulation commence à l'étape 1 sans bouton rouge ni appel", () => {
    const html = renderToStaticMarkup(<CancelDialog open mission={{ title: "T" }} refundAmount={5000} onClose={noop} onConfirm={noop} />)
    expect(html).toContain("Annuler cette mission ?")
    expect(html).not.toContain("btn--danger")
    expect(html).not.toContain("Confirmer l&#x27;annulation")
  })

  it("cancelSteps : deux étapes, la seconde seule est destructrice et ne parle pas de séquestre à 0", () => {
    const steps = cancelSteps({ title: "T", refundAmount: 0, pendingNames: [] })
    expect(steps).toHaveLength(2)
    expect(JSON.stringify(steps)).not.toMatch(SEQUESTRE)
    expect(steps[1].confirmLabel).toBe("Oui, annuler la mission")
  })

  it("l'erreur affichée vient du texte renvoyé et porte role=alert", () => {
    const html = renderToStaticMarkup(
      <CancelDialogView steps={cancelSteps({ title: "T", refundAmount: 0 })} step={1} refundAmount={0} subtitle="" pending={false} error="Une erreur est survenue. Veuillez réessayer." onClose={noop} onSecondary={noop} onConfirm={noop} cancelRef={{ current: null }} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).not.toMatch(/SQL|syntax|relation|PGRST|violates/i)
  })
})

describe("STRUCTURE : candidatures 0, 1, 100", () => {
  it.each([[0], [1], [100]])("%i candidature(s) : un seul h1, compteur juste, pas de NaN", (n) => {
    const applications = Array.from({ length: n }, (_, i) => applicationOf(`s${i}`, { createdAt: `2026-10-${String((i % 27) + 1).padStart(2, "0")}T08:00:00Z` }, { fullName: `Étudiant ${i}` }))
    const html = render({ detail: detailOf({ applications }) })
    expect(count(html, "<h1")).toBe(1)
    expect(count(html, 'role="listitem"')).toBe(n)
    expect(html).not.toMatch(/NaN|undefined/)
    if (n === 0) expect(html).toContain("Aucune candidature pour l&#x27;instant")
    else expect(html).toContain(`<span>${n}</span>`)
    if (n > 1) expect(html).toContain("Trier les candidatures")
    else expect(html).not.toContain("Trier les candidatures")
  })

  it("le tiroir ouvert ne crée pas de second h1", () => {
    const html = render({ query: "candidat=s1", candidate: profileOf(), detail: detailOf({ applications: [applicationOf("s1")] }) })
    expect(count(html, "<h1")).toBe(1)
  })
})

describe("MODALES : rôle et hydratation", () => {
  it("chaque modale et le tiroir portent role=dialog, aria-modal et un titre accessible", () => {
    const applicant = { id: "a-s1", studentId: "s1", student: studentOf("s1") }
    const nodes = [
      <AcceptDialog key="a" open applicant={applicant} mission={{ title: "T", budget: 100 }} split={escrowSplit(100)} onClose={noop} onConfirm={noop} />,
      <RejectDialog key="r" open applicant={applicant} mission={{ title: "T" }} onClose={noop} onConfirm={noop} />,
      <CancelDialog key="c" open mission={{ title: "T" }} onClose={noop} onConfirm={noop} />,
    ]
    for (const node of nodes) {
      const html = renderToStaticMarkup(node)
      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toMatch(/aria-labelledby="[^"]+"/)
    }
    const drawer = render({ query: "candidat=s1", candidate: profileOf(), detail: detailOf({ applications: [applicationOf("s1")] }) })
    expect(drawer).toContain('aria-modal="true"')
    expect(drawer).toMatch(/aria-labelledby="[^"]+"/)
  })

  it("rendu serveur : useIsCompact est faux (variante bureau), identique d'un rendu à l'autre", () => {
    const detail = detailOf({ applications: [applicationOf("s1")] })
    const first = render({ detail, query: "candidat=s1", candidate: profileOf() })
    const second = render({ detail, query: "candidat=s1", candidate: profileOf() })
    // les identifiants useId diffèrent d'un rendu statique à l'autre : on les neutralise
    const norm = (h) => h.replace(/[:«»_]r?[0-9a-z]*[:«»_]/g, "ID")
    expect(norm(first)).toBe(norm(second))
    expect(first).not.toContain("ds-drawer--full")
    const modal = renderToStaticMarkup(<CancelDialog open mission={{ title: "T" }} onClose={noop} onConfirm={noop} />)
    expect(modal).not.toContain("sheet")
    expect(modal).not.toContain("scrim--bottom")
  })
})
