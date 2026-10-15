import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const refresh = vi.fn()
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace, push: vi.fn() }) }))
vi.mock("@/lib/actions/admin-verifications.actions", () => ({
  approveStudentCard: vi.fn(),
  rejectStudentCard: vi.fn(),
  resetStudentRejection: vi.fn(),
  revokeStudentBadge: vi.fn(),
}))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { VerificationsView, queueSubtitle, dossierNeighbors } = await import("./verifications-view")
const { runDecision, dossierCaption, DecisionTimeline } = await import("./dossier-panel")
const { RejectDialog, RejectFields, rejectFormError } = await import("./reject-dialog")
const { ApproveDialog } = await import("./approve-dialog")
const { ResetDialog, ReasonField, reasonError } = await import("./reset-dialog")
const { RevokeDialog } = await import("./revoke-dialog")
const { CardViewer, nextZoom, nextRotation } = await import("./card-viewer")
const { QueueList, rowSubtitle } = await import("./queue-list")

const ID1 = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
const SIGNED = "https://storage.example/sign/cards/u1.jpg?token=SECRET"

const row = (over = {}) => ({
  userId: ID1,
  name: "Codjo Ahouansou",
  avatarUrl: null,
  school: "EPAC",
  level: "Licence 3",
  tab: "a-examiner",
  kind: "premiere",
  overdue48h: false,
  age: "Hier",
  ...over,
})

const dossier = (over = {}) => ({
  userId: ID1,
  name: "Codjo Ahouansou",
  avatarUrl: null,
  school: "EPAC",
  level: "Licence 3",
  tab: "a-examiner",
  kind: "premiere",
  overdue48h: true,
  ageDays: 3,
  age: "3 j",
  today: "2026-10-15",
  submittedOn: "2026-10-12",
  submittedAt: "2026-10-12T09:12:00Z",
  createdAt: "2026-10-10T18:40:00Z",
  verifiedUntil: null,
  rejectionReason: null,
  hasCard: true,
  cardView: { kind: "image", url: SIGNED },
  actions: ["approve", "reject"],
  ...over,
})

const data = (over = {}) => ({
  now: "2026-10-15T10:00:00Z",
  today: "2026-10-15",
  onglet: "a-examiner",
  q: "",
  ecole: "",
  counts: { "a-examiner": 4, incomplets: 3, refuses: 1, verifies: 58, expires: 2 },
  oldestAgeDays: 3,
  rows: [row(), row({ userId: ID2, name: "Nadège Kpadonou", school: "ENEAM", overdue48h: true })],
  total: 4,
  page: 1,
  pageCount: 1,
  pageSize: 25,
  schools: ["ENEAM", "EPAC"],
  dossier: null,
  dossierNotFound: false,
  ...over,
})

const render = (props) =>
  renderToStaticMarkup(
    <ToastProvider>
      <VerificationsView {...props} />
    </ToastProvider>,
  )
const listHtml = (html) => html.match(/<nav aria-label="Dossiers à traiter"[\s\S]*?<\/nav>/)?.[0] ?? ""
const buttonLabels = (html) =>
  [...html.matchAll(/<button[^>]*class="btn [^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim())

describe("VerificationsView : file avec dossier ouvert", () => {
  const html = render({ data: data({ dossier: dossier() }) })

  it("un seul titre h1 « Vérifications » et sous-titre avec ancienneté", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('<h1 class="page__title">Vérifications</h1>')
    expect(html).toContain('<p class="page__sub">4 dossiers à examiner · le plus ancien attend depuis 3 jours</p>')
    expect(html).not.toMatch(/head2|a2-filters|search2|empty2|hero2__link/)
    expect(html).toContain("Vérifications")
    expect(html).toContain("4 dossiers à examiner")
    expect(html).toContain("le plus ancien attend depuis 3 jours")
  })

  it("cinq onglets avec compteurs, l'onglet courant est aria-current, liens dans l'URL", () => {
    for (const label of ["À examiner", "Incomplets", "Refusés", "Vérifiés", "Expirés"]) expect(html).toContain(label)
    expect(html).toMatch(/aria-current="page"[^>]*>À examiner/)
    expect(html).toContain('href="/admin/verifications?onglet=incomplets"')
    expect(html).toContain('<span class="count">58</span>')
  })

  it("recherche en GET vers la file, établissement en liste fermée", () => {
    expect(html).toContain('action="/admin/verifications"')
    expect(html).toContain('method="get"')
    expect(html).toContain('class="filterbar"')
    expect(html).toContain('<label class="search">')
    expect(html).toContain('class="filterbar__count"')
    expect(html).toContain('name="q"')
    expect(html).toContain('name="ecole"')
    expect(html).toContain("4 dossiers")
  })

  it("liste : nom, établissement, ancienneté, ligne ouverte en aria-current, aucune URL signée ni e-mail", () => {
    const list = listHtml(html)
    expect(list).toContain("Codjo Ahouansou")
    expect(list).toContain("EPAC · première demande")
    expect(list).toContain("+48 h")
    expect(list).toMatch(/aria-current="true"/)
    expect(list).not.toContain("token=")
    expect(list).not.toContain("@")
    expect(list).not.toContain("<img")
  })

  it("dossier : en-tête (avatar, soumis le, état), carte (image sans référent), décisions Valider et Refuser seulement", () => {
    expect(html).toContain("a2-02-avatar")
    expect(html).toContain("Licence 3 · EPAC · soumis le 12 oct. (3 jours)")
    expect(html).toContain("En cours d&#x27;examen")
    expect(html).not.toContain("Délai de 48 h dépassé")
    expect(html).toContain('<img class="a2-02-img"')
    expect(html).toMatch(/<img[^>]*referrerPolicy="no-referrer"/)
    expect(html).toContain('alt="Carte étudiante de Codjo Ahouansou"')
    expect(buttonLabels(html).filter((l) => /^(Valider|Refuser|Réinitialiser|Révoquer)/.test(l))).toEqual([
      "RefuserR",
      "ValiderV",
      "Refuser",
      "Valider",
    ])
    expect(html).not.toContain("Réinitialiser le refus")
    expect(html).not.toContain("Révoquer le badge")
  })

  it("liste de contrôle à trois cases non enregistrées, bascule, lien vers la fiche, frise d'historique", () => {
    expect(html.match(/type="checkbox"/g)).toHaveLength(3 + 1)
    expect(html).toContain("Contrôle")
    expect(html).toContain("Elles ne sont pas enregistrées.")
    expect(html).toContain(`href="/admin/users/${ID1}"`)
    expect(html).toContain("Ouvrir la fiche")
    expect(html).toContain("Historique des décisions")
    expect(html).toContain("Compte créé")
    expect(html).toContain("Carte envoyée")
    expect(html).not.toContain("Historique :")
  })

  it("bascule « Passer au dossier suivant après décision » cochée par défaut", () => {
    expect(html).toMatch(/<label class="switch"><input type="checkbox" checked=""[^>]*\/>Passer au dossier suivant après décision<\/label>/)
  })

  it("mobile : en-tête de sous-page avec retour, barre d'action fixe, liste masquée par la classe d'état", () => {
    expect(html).toContain('class="a2-02 a2-02--open"')
    expect(html).toContain("Dossier 1 sur 2")
    expect(html).toContain('aria-label="Retour à la liste des dossiers"')
    expect(html).toContain('class="a2-mbar"')
  })

  it("un seul bouton bleu a2-02-cta par barre côté bureau, aucune carte colorée", () => {
    const start = html.indexOf('class="a2-02-actions"')
    const desktop = html.slice(start, html.indexOf('class="a2-mbar"'))
    expect(desktop.match(/a2-02-cta/g)).toHaveLength(1)
    expect(desktop).not.toContain("btn--dark")
    expect(desktop).toContain("btn btn--danger-outline")
    expect(html).not.toMatch(/card--(lavande|citron|menthe|rose|peche)/)
  })

  it("aucun e-mail dans le HTML hors aperçu de refus (ouvert à la demande)", () => {
    expect(html).not.toContain("codjo@example.com")
  })
})

describe("VerificationsView : décisions selon l'onglet", () => {
  const actionsOf = (tab, actions, over = {}) => {
    const html = render({ data: data({ onglet: tab, dossier: dossier({ tab, actions, overdue48h: false, ...over }) }) })
    return { html, labels: buttonLabels(html).filter((l) => /^(Valider|Refuser|Réinitialiser|Révoquer)/.test(l)) }
  }

  it("à examiner : valider et refuser", () => {
    expect(actionsOf("a-examiner", ["approve", "reject"]).labels).toContain("Refuser")
  })

  it("incomplets : aucune décision, note d'attente", () => {
    const { html, labels } = actionsOf("incomplets", [], { hasCard: false, cardView: { kind: "none", url: null } })
    expect(labels).toEqual([])
    expect(html).toContain("Aucune carte fournie")
    expect(html).toContain("Validation impossible sans carte")
    expect(html).not.toContain("a2-mbar")
    expect(html).not.toContain("Contrôle")
  })

  it("refusés : seulement réinitialiser, avec le motif affiché", () => {
    const { html, labels } = actionsOf("refuses", ["reset"], { rejectionReason: "Photo floue ou illisible" })
    expect(labels).toEqual(["Réinitialiser le dossier", "Réinitialiser le dossier"])
    expect(html).toContain("Photo floue ou illisible")
  })

  it("vérifiés : seulement révoquer", () => {
    const { labels } = actionsOf("verifies", ["revoke"], { verifiedUntil: "2027-10-01" })
    expect(labels).toEqual(["Révoquer le badge", "Révoquer le badge"])
  })

  it("expirés : consultation seulement", () => {
    const { html, labels } = actionsOf("expires", [], { verifiedUntil: "2026-09-01" })
    expect(labels).toEqual([])
    expect(html).toContain("nouvelle carte")
  })
})

describe("VerificationsView : états", () => {
  it("file vide : message, nombre d'étudiants sans carte et lien vers les incomplets", () => {
    const html = render({ data: data({ rows: [], total: 0, counts: { ...data().counts, "a-examiner": 0 }, oldestAgeDays: null }) })
    expect(html).toContain('<div class="empty">')
    expect(html).toContain('<span class="ic-sq ic-sq--menthe">')
    expect(html).toContain('<div class="empty__title">Aucun dossier à examiner</div>')
    expect(html).toContain("Tout est à jour. 3 étudiants n&#x27;ont pas encore envoyé de carte : ils sont dans « Incomplets ».")
    expect(html).toMatch(/<a class="btn btn--secondary btn--sm" href="\/admin\/verifications\?onglet=incomplets">Voir les incomplets<\/a>/)
    expect(html).toContain("Aucun dossier à examiner</p>")
  })

  it("file vide sans incomplets : tout est à jour", () => {
    const html = render({ data: data({ rows: [], total: 0, counts: { ...data().counts, "a-examiner": 0, incomplets: 0 } }) })
    expect(html).toContain('<p class="empty__text">Tout est à jour.</p>')
    expect(html).not.toContain("Voir les incomplets")
  })

  it("recherche sans résultat et onglet vide", () => {
    expect(render({ data: data({ rows: [], total: 0, q: "zzz" }) })).toContain("ne correspond à cette recherche")
    expect(render({ data: data({ rows: [], total: 0, onglet: "refuses" }) })).toContain("Aucun dossier dans cet onglet.")
  })

  it("erreur de chargement distincte de la file vide, annoncée", () => {
    const html = render({ data: null, error: "Les dossiers n'ont pas pu être chargés. Réessayez dans un instant." })
    expect(html).toContain('class="empty empty--erreur empty--sm" role="alert"')
    expect(html).toContain("Impossible de charger la file")
    expect(html).toMatch(/<a class="btn btn--primary btn--sm" href="\/admin\/verifications">[\s\S]*Réessayer<\/a>/)
    expect(html).not.toContain("Aucun dossier à examiner.")
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })

  it("aucun dossier ouvert : invite bureau seulement, pas d'en-tête de sous-page ni de barre fixe", () => {
    const html = render({ data: data() })
    expect(html).toContain("Choisissez un dossier dans la liste")
    expect(html).not.toContain("a2-mtop")
    expect(html).not.toContain("a2-mbar")
    expect(html).not.toContain("token=")
  })

  it("dossier introuvable : note et vue plein écran mobile", () => {
    const html = render({ data: data({ dossierNotFound: true }) })
    expect(html).toContain("Ce dossier est introuvable.")
    expect(html).toContain("a2-02--open")
  })

  it("pagination : liens précédent et suivant dans l'URL", () => {
    const html = render({ data: data({ page: 2, pageCount: 3, q: "ko" }) })
    expect(html).toContain('aria-label="Pagination des dossiers"')
    expect(html).toContain('href="/admin/verifications?q=ko"')
    expect(html).toContain('href="/admin/verifications?q=ko&amp;page=3"')
    expect(html).toContain('aria-current="page"')
    expect(render({ data: data() })).not.toContain("Pagination des dossiers")
  })

  it("pagination : plage « 1 à 20 sur 58 »", () => {
    const rows = Array.from({ length: 20 }, (_, n) => row({ userId: `${n}`.padStart(8, "0") + ID1.slice(8) }))
    const html = render({ data: data({ rows, total: 58, page: 1, pageCount: 3, pageSize: 20 }) })
    expect(html).toContain('<span class="pagination__info">1 à 20 sur 58</span>')
  })

  it("onglet autre que le défaut : champ caché pour garder l'onglet dans la recherche", () => {
    expect(render({ data: data({ onglet: "verifies" }) })).toContain('name="onglet" value="verifies"')
    expect(render({ data: data() })).not.toContain('name="onglet"')
  })
})

describe("carte", () => {
  const view = (cardView) => renderToStaticMarkup(<CardViewer cardView={cardView} name="Codjo" />)

  it("PDF : lien vers un nouvel onglet, sans référent, aucune image", () => {
    const html = view({ kind: "pdf", url: SIGNED })
    expect(html).toContain("Ouvrir le PDF")
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain("<img")
  })

  it("carte absente ou URL expirée : message et bouton Recharger", () => {
    for (const cardView of [{ kind: "none", url: null }, null, { kind: "image", url: null }]) {
      const html = view(cardView)
      expect(html).toContain("La carte n&#x27;est pas disponible")
      expect(html).toContain("Recharger")
      expect(html).not.toContain("<img")
    }
  })

  it("image : zoom de 100 %, commandes nommées, état porté par des attributs", () => {
    const html = view({ kind: "image", url: SIGNED })
    expect(html).toContain("Zoom 100 %")
    for (const label of ["Zoom arrière", "Zoom avant", "Pivoter de 90 degrés"]) expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain('data-zoom="100"')
    expect(html).toContain('data-rot="0"')
    expect(html).not.toContain("style=")
  })

  it("paliers de zoom bornés et rotation par 90 degrés", () => {
    expect(nextZoom(100, 1)).toBe(150)
    expect(nextZoom(300, 1)).toBe(300)
    expect(nextZoom(100, -1)).toBe(100)
    expect(nextZoom(200, -1)).toBe(150)
    expect(nextZoom(999, 1)).toBe(150)
    expect(nextRotation(0)).toBe(90)
    expect(nextRotation(270)).toBe(0)
  })
})

describe("boîtes de dialogue", () => {
  it("refus : sept motifs en radios, message, aperçu de l'e-mail vouvoyé toujours visible, rouge plein", () => {
    const html = renderToStaticMarkup(<RejectDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo Ahouansou" />)
    expect(html.match(/type="radio"/g)).toHaveLength(7)
    for (const reason of ["Photo floue ou illisible", "Autre motif", "Établissement non reconnu"]) expect(html).toContain(reason)
    expect(html).toContain("Aperçu de l&#x27;e-mail")
    expect(html).toContain("Bonjour Codjo,")
    expect(html).toContain("votre carte étudiante")
    expect(html).toContain("btn btn--danger")
    expect(html).toContain('role="dialog"')
  })

  it("refus fermé : rien n'est rendu", () => {
    expect(renderToStaticMarkup(<RejectDialog open={false} onClose={() => {}} onConfirm={() => {}} name="X" />)).toBe("")
  })

  it("validation : récapitulatif de la date du badge et libellé d'action", () => {
    const html = renderToStaticMarkup(<ApproveDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" badgeUntil="2027-10-15" />)
    expect(html).toContain("Valider la carte de Codjo ?")
    expect(html).toContain("15 octobre 2027")
    expect(html).toContain("Valider et passer au suivant")
    expect(html).toContain("btn btn--primary a2-02-cta")
  })

  it("validation : libellé « Valider la carte » quand le passage au suivant est désactivé", () => {
    const html = renderToStaticMarkup(
      <ApproveDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" badgeUntil="2027-10-15" advance={false} />,
    )
    expect(html).toContain("Valider la carte")
    expect(html).not.toContain("Valider et passer au suivant")
  })

  it("réinitialisation et révocation : motif obligatoire, la révocation est en ton danger", () => {
    const reset = renderToStaticMarkup(<ResetDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" />)
    const revoke = renderToStaticMarkup(<RevokeDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" />)
    expect(reset).toContain("Réinitialiser le refus")
    expect(reset).toContain("required")
    expect(reset).not.toContain("btn btn--danger")
    expect(revoke).toContain("Révoquer le badge")
    expect(revoke).toContain("btn btn--danger")
  })

  it("consigne du motif : visible de l'étudiant (refus, retrait de badge), jamais de coordonnées personnelles", () => {
    const reject = renderToStaticMarkup(<RejectDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" />)
    const revoke = renderToStaticMarkup(<RevokeDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" />)
    const reset = renderToStaticMarkup(<ResetDialog open onClose={() => {}} onConfirm={() => {}} name="Codjo" />)
    for (const html of [reject, revoke]) expect(html).toContain("Le motif est visible de l&#x27;étudiant.")
    for (const html of [reject, revoke, reset]) expect(html).toContain("N&#x27;indiquez pas de coordonnées personnelles.")
    expect(reset).not.toContain("visible de l&#x27;étudiant")
  })

  it("refus : l'erreur du motif est reliée au groupe de radios, pas à une alerte séparée", () => {
    const html = renderToStaticMarkup(
      <RejectFields reason="" message="" error={{ field: "reason", text: "Choisissez un motif de la liste." }} onReason={() => {}} onMessage={() => {}} />,
    )
    const fieldset = html.match(/<fieldset[^>]*>/)[0]
    const errorId = html.match(/<div id="([^"]+)" class="field__error" role="alert"/)[1]
    expect(fieldset).toContain(`aria-describedby="${errorId}"`)
    expect(fieldset).toContain('aria-invalid="true"')
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).toContain("Choisissez un motif de la liste.")
    expect(html.match(/<textarea[^>]*>/)[0]).not.toContain("aria-invalid")
  })

  it("refus : « Précisez le motif » est relié à la zone de texte", () => {
    const html = renderToStaticMarkup(
      <RejectFields reason="Autre motif" message="" error={{ field: "message", text: "Précisez le motif du refus." }} onReason={() => {}} onMessage={() => {}} />,
    )
    const textarea = html.match(/<textarea[^>]*>/)[0]
    const errorId = html.match(/<div id="([^"]+)" class="field__error" role="alert"/)[1]
    expect(textarea).toContain('aria-invalid="true"')
    expect(textarea.match(/aria-describedby="([^"]*)"/)[1].split(" ")).toContain(errorId)
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html.match(/<fieldset[^>]*>/)[0]).not.toContain("aria-invalid")
  })

  it("motif de réinitialisation ou de révocation : l'erreur est reliée à la zone de texte", () => {
    const html = renderToStaticMarkup(<ReasonField reason="ab" error="Le motif doit contenir au moins 5 caractères." onChange={() => {}} />)
    const textarea = html.match(/<textarea[^>]*>/)[0]
    const errorId = html.match(/<div id="([^"]+)" class="field__error" role="alert"/)[1]
    expect(textarea).toContain('aria-invalid="true"')
    expect(textarea.match(/aria-describedby="([^"]*)"/)[1].split(" ")).toContain(errorId)
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<ReasonField reason="" error="" onChange={() => {}} />)).not.toContain('role="alert"')
  })

  it("refus sans erreur : aucune alerte", () => {
    const html = renderToStaticMarkup(<RejectFields reason="" message="" error={null} onReason={() => {}} onMessage={() => {}} />)
    expect(html).not.toContain('role="alert"')
  })

  it("validation des saisies avant l'envoi", () => {
    expect(rejectFormError({ reason: "", message: "" })).toMatch(/Choisissez un motif/)
    expect(rejectFormError({ reason: "Autre motif", message: "  " })).toMatch(/Précisez/)
    expect(rejectFormError({ reason: "Autre motif", message: "Carte coupée" })).toBe("")
    expect(rejectFormError({ reason: "Photo floue ou illisible", message: "" })).toBe("")
    expect(reasonError("ab")).toMatch(/au moins 5/)
    expect(reasonError("     ")).toMatch(/au moins 5/)
    expect(reasonError("Erreur de saisie")).toBe("")
  })
})

describe("runDecision", () => {
  const setup = (result) => {
    const router = { refresh: vi.fn(), replace: vi.fn() }
    const notify = vi.fn()
    const run = vi.fn().mockResolvedValue(result)
    return { router, notify, run, args: { run, title: "Codjo vérifié(e)", router, notify, afterHref: "/admin/verifications?id=x" } }
  }

  it("succès : toast, dossier suivant, rechargement", async () => {
    const { router, notify, args } = setup({ success: true, emailSent: true })
    expect(await runDecision(args)).toEqual({ done: true })
    expect(notify).toHaveBeenCalledWith("Codjo vérifié(e)", undefined)
    expect(router.replace).toHaveBeenCalledWith("/admin/verifications?id=x")
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it("e-mail non envoyé : la décision est confirmée et le toast le dit", async () => {
    const { notify, args } = setup({ success: true, emailSent: false })
    await runDecision(args)
    expect(notify).toHaveBeenCalledWith("Codjo vérifié(e)", "E-mail non envoyé")
  })

  it("déjà traité : message renvoyé à la boîte, liste rechargée, aucune navigation ni toast", async () => {
    const message = "Ce dossier a déjà été traité ou a changé. Rechargez la page."
    const { router, notify, args } = setup({ error: message })
    expect(await runDecision(args)).toEqual({ error: message })
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})

describe("aides pures", () => {
  it("sous-titre : pluriel, singulier, aujourd'hui, vide", () => {
    expect(queueSubtitle(4, 3)).toEqual({ strong: "4 dossiers à examiner", rest: "le plus ancien attend depuis 3 jours" })
    expect(queueSubtitle(1, 1)).toEqual({ strong: "1 dossier à examiner", rest: "le plus ancien attend depuis 1 jour" })
    expect(queueSubtitle(2, 0).rest).toBe("le plus ancien attend depuis aujourd'hui")
    expect(queueSubtitle(2, null).rest).toBe("")
    expect(queueSubtitle(0, null)).toEqual({ strong: "Aucun dossier à examiner", rest: "" })
  })

  it("voisins : précédent, suivant et destination après décision", () => {
    const d = data({ dossier: dossier({ userId: ID1 }) })
    const first = dossierNeighbors(d)
    expect(first.hrefs.prev).toBeNull()
    expect(first.hrefs.next).toBe(`/admin/verifications?id=${ID2}`)
    expect(first.hrefs.afterDecision).toBe(first.hrefs.next)
    expect(first.position).toEqual({ index: 0, total: 2 })
    const last = dossierNeighbors(data({ dossier: dossier({ userId: ID2 }) }))
    expect(last.hrefs.next).toBeNull()
    expect(last.hrefs.afterDecision).toBe(`/admin/verifications?id=${ID1}`)
    const alone = dossierNeighbors(data({ rows: [row()], dossier: dossier() }))
    expect(alone.hrefs.afterDecision).toBe("/admin/verifications")
    // Bascule « Passer au dossier suivant » désactivée : le détail reste sur le même dossier.
    expect(first.hrefs.self).toBe(`/admin/verifications?id=${ID1}`)
    expect(last.hrefs.self).toBe(`/admin/verifications?id=${ID2}`)
    expect(alone.hrefs.self).toBe(`/admin/verifications?id=${ID1}`)
    expect(dossierNeighbors(data({ dossier: null })).hrefs.self).toBe("/admin/verifications")
    expect(dossierNeighbors(data({ dossier: dossier({ userId: "autre" }) })).position).toBeNull()
  })

  it("sous-titres de ligne, légende d'en-tête et frise", () => {
    expect(rowSubtitle(row({ kind: "renouvellement" }))).toBe("EPAC · renouvellement du badge")
    expect(rowSubtitle(row({ kind: null, tab: "refuses", school: null }))).toBe("Établissement non renseigné · Carte refusée")
    expect(rowSubtitle(row({ kind: null, tab: "xyz" }))).toBe("EPAC")
    expect(dossierCaption(dossier())).toBe("Licence 3 · EPAC · soumis le 12 oct. (3 jours)")
    expect(dossierCaption(dossier({ ageDays: 0 }))).toContain("(aujourd'hui)")
    expect(dossierCaption(dossier({ ageDays: 1 }))).toContain("(1 jour)")
    expect(dossierCaption(dossier({ submittedOn: null, level: null, school: null }))).toBe("Profil étudiant")
  })

  it("frise : une étape par date connue, état porté par la classe", () => {
    const html = renderToStaticMarkup(<DecisionTimeline dossier={dossier()} />)
    expect(html).toContain("tl-item is-done")
    expect(html).toContain("tl-item is-current")
    expect(html).toContain("première demande")
    expect(renderToStaticMarkup(<DecisionTimeline dossier={{ tab: "incomplets" }} />)).toBe("")
  })

  it("liste : jamais d'URL signée même si la ligne en portait une par erreur de données", () => {
    const html = renderToStaticMarkup(<QueueList rows={[row({ cardUrl: SIGNED })]} openId={null} onglet="a-examiner" q="" ecole="" page={1} />)
    expect(html).not.toContain("token=")
    expect(html).toContain(`href="/admin/verifications?id=${ID1}"`)
  })
})
