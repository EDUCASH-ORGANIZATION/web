import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("@/lib/actions/application.actions", () => ({ apply: vi.fn() }))

const { MissionApplyView } = await import("../apply-view")
const { ApplyPanel, ApplyPanelView, validateMessage, submitApplication, MESSAGE_MAX, MESSAGE_REQUIRED } = await import("./apply-form")
const { GainRecap } = await import("./gain-recap")
const { escrowSplit } = await import("@/lib/app/money")
const { formatAmount } = await import("@/lib/app/format")
const { splitAmount } = await import("@/components/app-ui/amount")

const flags = { postuler: false, paymentsEnabled: false }
const mission = (over) => ({
  id: "m1", title: "Cours de maths niveau 3e", description: "Deux soirs par semaine.", type: "Cours particuliers",
  city: "Cotonou", budget: 20000, urgency: "low", deadline: "2999-01-01", status: "open", createdAt: "2026-10-01T08:00:00Z",
  ...over,
})
const client = { name: "Mawuli A.", avatarUrl: null, city: "Cotonou", rating: 4.7, missionsPublished: 5, isVerified: true }
const VERIFIED = { key: "verified", label: "Compte vérifié", canApply: true, daysLeft: null, action: null }
const open = (over) => ({
  state: "open", mission: mission(), client, application: null, isSelected: false,
  verification: VERIFIED, ledger: [], review: null, similar: [], ...over,
})
const blocked = (key, label, actionLabel) => ({
  key, label, canApply: false, daysLeft: null, action: { label: actionLabel, href: "/profile/verify" },
})
const esc = (s) => s.replace(/'/g, "&#x27;")
const view = (detail = open(), f = flags) => renderToStaticMarkup(<MissionApplyView detail={detail} flags={f} />)
const h1Count = (html) => (html.match(/<h1[\s>]/g) ?? []).length
const deskBlock = (html) => html.slice(html.indexOf('aria-label="Postuler"'), html.indexOf('class="e2-mbar'))

describe("prêt à postuler", () => {
  const html = view()

  it("un seul h1, sous-page de Missions, signalement vers le contact", () => {
    expect(h1Count(html)).toBe(1)
    expect(html).toContain("Cours de maths niveau 3e")
    expect(html).toContain('href="/student/missions"')
    expect(html).toContain('href="/contact?sujet=question"')
    expect(html).toContain("Signaler cette mission")
    expect(html).toContain('class="e2-mtop"')
  })

  it("récapitulatif du gain par escrowSplit (budget, commission, part)", () => {
    const split = escrowSplit(20000)
    expect(html).toContain(formatAmount(split.total))
    expect(html).toContain(formatAmount(split.commission, { sign: "debit" }))
    expect(html).toContain(formatAmount(split.student))
    expect(html).toContain("Commission EduCash (12 %)")
    expect(html).toContain("Vous touchez (88 %)")
  })

  it("bloc de candidature : motivation avec compteur, un seul bouton encre par cadre", () => {
    const desk = deskBlock(html)
    expect(desk).toContain("Votre motivation")
    expect(desk).toContain("0 / 500")
    expect(desk).toContain('maxLength="500"')
    expect(desk.match(/btn--dark/g)).toHaveLength(1)
    expect(desk).toContain("Envoyer ma candidature")
    const bar = html.slice(html.indexOf('class="e2-mbar'))
    expect(bar.match(/btn--dark/g)).toHaveLength(1)
    expect(bar).toContain("Postuler")
  })

  it("aucune feuille ouverte au rendu serveur, même avec ?postuler=1 (rien n'est envoyé)", () => {
    expect(html).not.toContain('role="dialog"')
    expect(view(open(), { postuler: true, paymentsEnabled: false })).not.toContain('role="dialog"')
  })

  it("client public : prénom et initiale, séquestre, aucune donnée privée", () => {
    expect(html).toContain("Mawuli A.")
    expect(html).toContain("Fonds bloqués en séquestre")
    expect(html).toContain("5 missions publiées")
    expect(html).toContain("4,7 / 5")
    expect(html).not.toMatch(/phone|téléphone|@/i)
  })

  it("missions similaires : gain net en montant principal, tout voir vers l'explorateur", () => {
    const similar = [{ id: "s1", title: "Cours d'anglais niveau 6e", type: "Cours particuliers", city: "Godomey", budget: 15000 }]
    const out = view(open({ similar }))
    expect(out).toContain("Missions similaires")
    const { text, unit } = splitAmount(escrowSplit(15000).student)
    expect(out).toContain(`${text}<small>${unit}</small>`)
    expect(out).toContain("budget client")
    expect(out).toContain('href="/student/missions/s1"')
    expect(out).toContain('href="/student/missions?type=Cours+particuliers"')
  })

  it("sans mission similaire, aucune section", () => {
    expect(html).not.toContain("Missions similaires")
  })

  it("montants jusqu'à 10 chiffres rendus sans erreur", () => {
    const out = view(open({ mission: mission({ budget: 9999999999 }) }))
    expect(out).toContain(formatAmount(9999999999))
    expect(out).toContain(formatAmount(escrowSplit(9999999999).student))
  })

  it("description multi-lignes : texte conservé, jamais injecté en HTML", () => {
    const out = view(open({ mission: mission({ description: "<b>gras</b>\nligne 2" }) }))
    expect(out).toContain("&lt;b&gt;gras&lt;/b&gt;")
    expect(out).not.toContain("<b>gras</b>")
  })
})

describe("statuts de vérification", () => {
  it.each([
    ["not_submitted", "Carte à envoyer", "Envoyer ma carte", "Envoyez votre carte étudiante pour postuler"],
    ["rejected", "Carte refusée", "Renvoyer ma carte", "Votre carte a été refusée"],
    ["expired", "Badge expiré", "Renouveler mon badge", "Votre badge a expiré"],
  ])("%s : bouton encre vers la vérification, aucun formulaire", (key, label, actionLabel, title) => {
    const html = view(open({ verification: blocked(key, label, actionLabel) }))
    const desk = deskBlock(html)
    expect(desk).toContain('href="/profile/verify"')
    expect(desk).toContain(actionLabel)
    expect(desk).toContain(esc(title))
    expect(desk).not.toContain("<textarea")
    expect(desk).not.toContain("Envoyer ma candidature")
    expect(desk.match(/btn--dark/g)).toHaveLength(1)
    const bar = html.slice(html.indexOf('class="e2-mbar'))
    expect(bar).toContain("e2-mbar--stack")
    expect(bar).toContain(actionLabel)
    expect(bar).not.toContain(">Postuler<")
    expect(h1Count(html)).toBe(1)
  })

  it("pending : peut candidater, badge neutre", () => {
    const verification = { key: "pending", label: "Carte en cours d'examen", canApply: true, daysLeft: null, action: null }
    const desk = deskBlock(view(open({ verification })))
    expect(desk).toContain(esc("Carte en cours d'examen"))
    expect(desk).toContain("<textarea")
  })

  it("verified : badge Vérifiée, formulaire", () => {
    const desk = deskBlock(view())
    expect(desk).toContain("Vérifiée")
    expect(desk).toContain("<textarea")
  })

  it("expiring : peut candidater, rappel de renouvellement vers la vérification", () => {
    const verification = {
      key: "expiring", label: "Badge à renouveler", canApply: true, daysLeft: 12,
      action: { label: "Renouveler mon badge", href: "/profile/verify" },
    }
    const html = view(open({ verification }))
    const desk = deskBlock(html)
    expect(desk).toContain("<textarea")
    expect(desk).toContain("Votre badge arrive à échéance")
    expect(desk).toContain("Il reste 12 jours.")
    expect(desk).toContain('href="/profile/verify"')
    expect(desk.match(/btn--dark/g)).toHaveLength(1)
  })
})

describe("mission plus ouverte, échéance dépassée, déjà candidat", () => {
  it("plus ouverte : aucun titre, aucun montant, aucune candidature, un seul h1", () => {
    const html = view({ state: "closed", mission: { id: "m1" } })
    expect(h1Count(html)).toBe(1)
    expect(html).toContain(esc("Cette mission n'est plus ouverte"))
    expect(html).toContain('href="/student/missions"')
    expect(html).not.toContain("FCFA")
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("e2-mbar")
  })

  it("échéance dépassée : aucune candidature possible", () => {
    const html = view(open({ mission: mission({ deadline: "2020-01-01" }) }))
    const desk = deskBlock(html)
    expect(desk).toContain(esc("L'échéance est dépassée"))
    expect(desk).not.toContain("<textarea")
    expect(html).not.toContain("e2-mbar")
  })

  it("déjà candidat : statut, message envoyé, lien vers les candidatures, aucun formulaire", () => {
    const application = { id: "a1", status: "pending", message: "Bonjour, je suis libre.", createdAt: "2026-10-02T09:00:00Z", updatedAt: null }
    const html = view(open({ application }))
    const desk = deskBlock(html)
    expect(desk).toContain("En attente")
    expect(desk).toContain("Candidature envoyée")
    expect(desk).toContain("Bonjour, je suis libre.")
    expect(desk).toContain('href="/applications"')
    expect(desk).toContain("Suivre ma candidature")
    expect(desk).not.toContain("<textarea")
    expect(desk.match(/btn--dark/g)).toBeNull()
    const bar = html.slice(html.indexOf('class="e2-mbar'))
    expect(bar).toContain("btn--soft")
    expect(bar).not.toContain("btn--dark")
  })
})

describe("validation et envoi", () => {
  it("même minimum que l'action : non vide une fois épuré, 500 caractères au plus", () => {
    expect(validateMessage("")).toEqual({ ok: false, error: MESSAGE_REQUIRED })
    expect(validateMessage("   \n ")).toEqual({ ok: false, error: MESSAGE_REQUIRED })
    expect(validateMessage(undefined).ok).toBe(false)
    expect(validateMessage("  Bonjour  ")).toEqual({ ok: true, value: "Bonjour" })
    expect(validateMessage("a".repeat(MESSAGE_MAX)).ok).toBe(true)
    expect(validateMessage("a".repeat(MESSAGE_MAX + 1)).ok).toBe(false)
  })

  it("message trop court : aucun appel, verrou libre", async () => {
    const send = vi.fn()
    const guard = { current: false }
    expect(await submitApplication(guard, { missionId: "m1", message: " ", send })).toEqual({ invalid: MESSAGE_REQUIRED })
    expect(send).not.toHaveBeenCalled()
    expect(guard.current).toBe(false)
  })

  it("envoi : l'identifiant de la mission et le message épuré partent, le verrou reste posé", async () => {
    const send = vi.fn().mockResolvedValue({ success: true })
    const guard = { current: false }
    const out = await submitApplication(guard, { missionId: "m1", message: "  Bonjour ", send })
    expect(out).toEqual({ done: true, message: "Bonjour" })
    expect(send).toHaveBeenCalledWith({ missionId: "m1", message: "Bonjour" })
    expect(guard.current).toBe(true)
  })

  it("double envoi : le second appel simultané est ignoré", async () => {
    let release
    const send = vi.fn(() => new Promise((resolve) => { release = resolve }))
    const guard = { current: false }
    const first = submitApplication(guard, { missionId: "m1", message: "Bonjour", send })
    const second = await submitApplication(guard, { missionId: "m1", message: "Bonjour", send })
    expect(second).toEqual({ skipped: true })
    release({ success: true })
    await first
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("erreur de l'action : renvoyée telle quelle, verrou rendu pour réessayer", async () => {
    const send = vi.fn().mockResolvedValue({ error: "Votre carte a été refusée, renvoyez-la pour pouvoir postuler." })
    const guard = { current: false }
    expect(await submitApplication(guard, { missionId: "m1", message: "Bonjour", send })).toEqual({
      error: "Votre carte a été refusée, renvoyez-la pour pouvoir postuler.",
    })
    expect(guard.current).toBe(false)
  })

  it("exception de l'action : erreur neutre vouvoyée, verrou rendu", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom SQL"))
    const guard = { current: false }
    const out = await submitApplication(guard, { missionId: "m1", message: "Bonjour", send })
    expect(out).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
    expect(guard.current).toBe(false)
  })
})

describe("états du bloc de candidature", () => {
  const split = escrowSplit(20000)
  const base = {
    mode: "form", mission: { id: "m1", title: "Cours de maths niveau 3e" }, clientName: "Mawuli A.", split,
    verification: VERIFIED, application: null, sent: false, note: null, message: "", fieldError: "", serverError: "",
    pending: false, sheetOpen: false, textareaRef: { current: null }, onMessage() {}, onSubmit() {}, onOpenSheet() {}, onCloseSheet() {},
  }
  const panel = (over) => renderToStaticMarkup(<ApplyPanelView {...base} {...over} />)

  it("motivation trop courte : erreur sous le champ", () => {
    const html = panel({ fieldError: MESSAGE_REQUIRED })
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("Écrivez quelques mots pour vous présenter au client.")
  })

  it("envoi en cours : bouton désactivé et occupé", () => {
    const desk = deskBlock(panel({ pending: true, message: "Bonjour" }))
    expect(desk).toContain("Envoi en cours")
    expect(desk).toMatch(/<button[^>]*disabled[^>]*>/)
    expect(desk).toContain('aria-busy="true"')
  })

  it("erreur serveur : affichée telle quelle, motivation conservée", () => {
    const html = panel({ serverError: "Vous avez déjà postulé à cette mission.", message: "Ma motivation conservée" })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Vous avez déjà postulé à cette mission.")
    expect(html).toContain("Ma motivation conservée")
  })

  it("confirmé : Candidature envoyée annoncée, lien encre vers les candidatures, plus de formulaire", () => {
    const html = panel({
      mode: "applied", sent: true, message: "Ma motivation",
      application: { status: "pending", createdAt: null, message: "Ma motivation" },
    })
    const desk = deskBlock(html)
    expect(desk).toContain('role="status"')
    expect(desk).toContain("Candidature envoyée")
    expect(desk).toContain("Suivre ma candidature")
    expect(desk).toContain('href="/applications"')
    expect(desk).toContain("btn btn--dark btn--block")
    expect(desk).not.toContain("<textarea")
    const bar = html.slice(html.indexOf('class="e2-mbar'))
    expect(bar).toContain("Candidature envoyée")
    expect(bar).toContain('<span class="sr-only"> ma candidature</span>')
  })

  it("feuille ouverte : dialogue nommé, motivation, récapitulatif, un seul bouton encre, annuler", () => {
    const html = panel({ sheetOpen: true, message: "Bonjour" })
    const dialog = html.slice(html.indexOf('role="dialog"'))
    expect(dialog).toContain('aria-modal="true"')
    expect(dialog).toContain("Postuler")
    expect(dialog).toContain("Cours de maths niveau 3e · Mawuli A.")
    expect(dialog).toContain("Votre motivation")
    expect(dialog).toContain("Vous touchez (88 %)")
    expect(dialog).toContain("Annuler")
    expect(dialog.match(/btn--dark/g)).toHaveLength(1)
  })

  it("feuille jamais ouverte hors mode formulaire", () => {
    expect(panel({ sheetOpen: true, mode: "blocked" })).not.toContain('role="dialog"')
  })

  it("ApplyPanel au rendu serveur : feuille fermée même avec initialSheet", () => {
    const html = renderToStaticMarkup(
      <ApplyPanel mode="form" mission={{ id: "m1", title: "T" }} clientName="M." split={split} verification={VERIFIED} application={null} initialSheet />,
    )
    expect(html).not.toContain('role="dialog"')
    expect(html).toContain("Envoyer ma candidature")
  })
})

describe("textes et sources", () => {
  const states = [
    view(),
    view(open({ verification: blocked("not_submitted", "Carte à envoyer", "Envoyer ma carte") })),
    view(open({ verification: blocked("rejected", "Carte refusée", "Renvoyer ma carte") })),
    view(open({ verification: blocked("expired", "Badge expiré", "Renouveler mon badge") })),
    view(open({ mission: mission({ deadline: "2020-01-01" }) })),
    view(open({ application: { id: "a", status: "pending", message: "Bonjour", createdAt: "2026-10-02T09:00:00Z", updatedAt: null } })),
    view({ state: "closed", mission: { id: "m1" } }),
  ]

  it("vouvoiement, jamais de tiret cadratin ni de promesse non supportée", () => {
    const text = states.join(" ").replace(/<[^>]*>/g, " ")
    expect(text).not.toMatch(/(?<![\p{L}\p{N}_])(?:tu|toi|ton|ta|tes|te)(?![\p{L}\p{N}_])/u)
    expect(text).not.toMatch(/[\u2013\u2014]/)
    expect(text).not.toMatch(/\b(?:séances?|24 à 48|72 h|sous 24)\b/i)
    expect(text).not.toMatch(/retirer ma candidature/i)
  })

  it("aucun 0.88 ni 0.12 en dur, aucun style en ligne, marqueur d'écran présent", () => {
    for (const file of ["apply-view.jsx", "apply/apply-form.jsx", "apply/gain-recap.jsx", "apply/client-card.jsx", "apply/similar-missions.jsx"]) {
      const source = readFileSync(`src/components/student-space/mission/${file}`, "utf8")
      expect(source).not.toMatch(/\b0\.(?:88|12)\b/)
      expect(source).not.toMatch(/style=\{/)
      expect(source).toContain("@ds-screen RD-STUDENT-01")
    }
  })

  it("GainRecap : trois lignes, la part de l'étudiant en dernier", () => {
    const html = renderToStaticMarkup(<GainRecap split={escrowSplit(12000)} />)
    expect(html.match(/e2-kv__row/g)).toHaveLength(4)
    expect(html.lastIndexOf("Vous touchez")).toBeGreaterThan(html.indexOf("Commission"))
  })
})
