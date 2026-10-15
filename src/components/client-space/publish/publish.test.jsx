import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"

let actionState = null
const push = vi.fn()

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useActionState: (action) => [actionState, action, false] }
})
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock("@/lib/actions/mission.actions", () => ({ createMission: vi.fn() }))
vi.mock("@/lib/actions/publish-waitlist.actions", () => ({ notifyPublishOpening: vi.fn() }))

const { PublishWizard, PublishWizardView, runPublish } = await import("./publish-wizard")
const { StepNeed, StepDetails, StepBudget, TipsAside, BudgetAside } = await import("./steps")
const { RecapBody, PreviewCard, WalletImpact, LiveSummary } = await import("./publish-recap")
const { InsufficientDialog } = await import("./insufficient-dialog")
const { PublishPausedView } = await import("./publish-paused-view")
const { DESCRIPTION_MIN, emptyValues } = await import("@/lib/client-space/publish-schema")
const { formatAmount } = await import("@/lib/app/format")
const { PAYMENTS_PENDING_COPY } = await import("@/lib/constants/payments")

const TODAY = "2026-10-13"
const DESC = "Trois publications par semaine pendant quatre semaines, avec réponses aux messages."
const full = {
  type: "Livraison",
  title: "Faire le marché du samedi",
  description: DESC,
  city: "Cotonou",
  budget: 10000,
  urgency: "medium",
  deadline: "2026-10-31",
}
const noop = () => {}
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ")
const nb = (s) => s.replace(/ /g, " ")
// Montant tel que le voit `text()` : les espaces insécables y sont ramenées à une espace simple.
const f = (n, o) => formatAmount(n, o).replace(/\s+/g, " ")
const BANNED = /livraison|course|saisie|bientôt|fedapay/i

beforeEach(() => {
  actionState = null
  push.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

const wizard = (over = {}) =>
  renderToStaticMarkup(<PublishWizard initial={emptyValues()} available={12500} today={TODAY} {...over} />)

describe("assistant, étape 1 (état initial)", () => {
  it("n'a qu'un seul h1 et annonce l'étape 1 sur 4", () => {
    const html = wizard()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Publier une mission")
    expect(html).toContain('aria-label="Étape 1 sur 4"')
    expect(text(html)).toContain("Étape 1 sur 4 · Le besoin")
  })

  it("montre les quatre étapes dont une seule est en cours", () => {
    const html = wizard()
    for (const label of ["Le besoin", "Détails", "Budget et échéance", "Récapitulatif"]) expect(html).toContain(label)
    expect(html.match(/step is-current/g)).toHaveLength(1)
    expect(html).toContain('aria-current="step"')
  })

  it("annonce que rien n'est bloqué avant la publication et offre une sortie", () => {
    const html = text(wizard())
    expect(html).toContain("Rien n'est bloqué avant la publication")
    expect(html).toContain("Quitter sans publier")
    expect(wizard()).toContain('href="/client/missions"')
  })

  it("rédige sans écran bloquant : aucun solde exigé, aucun bouton de recharge", () => {
    const html = wizard({ available: 0 })
    expect(html).not.toContain("Recharger")
    expect(html).not.toContain("recharger=1")
    expect(html).toContain("Continuer")
  })

  it("propose les types par leurs libellés et jamais la valeur brute de Livraison", () => {
    const html = wizard()
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Cours et aide aux devoirs")
    expect(html).toContain("Garde d&#x27;enfants")
    expect(html).toContain("Travaux sur ordinateur")
    expect(text(html)).not.toMatch(BANNED)
  })

  it("les types sont un groupe radio avec un seul arrêt de tabulation", () => {
    const html = wizard()
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="radio"/g)).toHaveLength(8)
    expect(html.match(/role="radio"[^>]*tabindex="0"|tabindex="0"[^>]*role="radio"/g)).toHaveLength(1)
    expect(html).toContain('aria-required="true"')
  })

  it("part sans erreur affichée tant que l'étape n'a pas été tentée", () => {
    const html = wizard()
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-invalid="true"')
  })

  it("préremplit le titre, la ville et le type reçus", () => {
    const html = wizard({ initial: { ...emptyValues(), title: "Faire le marché", type: "Livraison", city: "Cotonou" } })
    expect(html).toContain('value="Faire le marché"')
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Marché et achats/)
  })

  it("offre la barre d'action mobile (mbar2) pour passer en écran de détail, sans Retour à l'étape 1", () => {
    const html = wizard()
    expect(html).toContain('class="mbar2"')
    expect(html).toContain('class="mbar2__row"')
    expect(html).not.toContain("Retour")
    expect(html.match(/type="submit"/g)).toHaveLength(2)
  })

  it("le compteur du titre part de la valeur reçue", () => {
    const html = text(wizard({ initial: { ...emptyValues(), title: "Garder" } }))
    expect(html).toContain("6 / 120")
  })

  it("une erreur de chargement garde un seul h1 et un bouton Réessayer", () => {
    const html = wizard({ error: "x" })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Impossible de charger la publication")
    expect(html).toContain("Réessayer")
    expect(html).not.toContain("Continuer")
  })
})

describe("étapes (champs et erreurs)", () => {
  it("étape 1 vide en erreur : un message par champ, champs marqués invalides", () => {
    const html = renderToStaticMarkup(
      <StepNeed
        values={emptyValues()}
        errors={{ type: "Choisissez le type de mission.", title: "Indiquez le titre de votre mission." }}
        onChange={noop}
      />,
    )
    expect(text(html)).toContain("Choisissez le type de mission.")
    expect(text(html)).toContain("Indiquez le titre de votre mission.")
    expect(html.match(/role="alert"/g)).toHaveLength(2)
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('data-invalid="true"')
    expect(html).toContain('maxLength="120"')
  })

  it("étape 2 : description avec compteur et ville par le sélecteur du système", () => {
    const html = renderToStaticMarkup(<StepDetails values={{ ...emptyValues(), description: "abc" }} errors={{}} onChange={noop} />)
    expect(text(html)).toContain("3 / 3 000")
    expect(text(html)).toContain(`${DESCRIPTION_MIN} caractères minimum`)
    expect(html).toContain("Choisissez une ville")
    expect(html).toContain('maxLength="3000"')
  })

  it("étape 2 en erreur : description trop courte et ville absente", () => {
    const html = renderToStaticMarkup(
      <StepDetails
        values={emptyValues()}
        errors={{ description: "Décrivez votre mission en au moins 50 caractères.", city: "Choisissez la ville de la mission." }}
        onChange={noop}
      />,
    )
    expect(text(html)).toContain("au moins 50 caractères")
    expect(text(html)).toContain("Choisissez la ville de la mission.")
  })

  it("étape 3 : budget en FCFA, date limite bornée, trois urgences", () => {
    const html = renderToStaticMarkup(<StepBudget values={{ ...emptyValues(), budget: 10000 }} errors={{}} today={TODAY} onChange={noop} />)
    expect(html).toContain(nb("10 000"))
    expect(html).toContain("FCFA")
    expect(html).toContain('type="date"')
    expect(html).toContain(`min="${TODAY}"`)
    expect(html).toContain('max="2028-12-31"')
    for (const label of ["Standard", "Urgent", "Critique"]) expect(html).toContain(label)
    expect(text(html)).toContain(`Minimum ${f(2000)}`)
  })

  it("étape 3 en erreur : budget minimum et date passée", () => {
    const html = renderToStaticMarkup(
      <StepBudget
        values={{ ...emptyValues(), budget: 500, deadline: "2020-01-01" }}
        errors={{ budget: "Le budget minimum est de 2 000 FCFA.", deadline: "La date limite ne peut pas être passée." }}
        today={TODAY}
        onChange={noop}
      />,
    )
    expect(text(html)).toContain("Le budget minimum est de 2 000 FCFA.")
    expect(text(html)).toContain("La date limite ne peut pas être passée.")
    expect(html.match(/aria-invalid="true"/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("l'urgence choisie est la seule cochée", () => {
    const html = renderToStaticMarkup(<StepBudget values={{ ...emptyValues(), urgency: "high" }} errors={{}} today={TODAY} onChange={noop} />)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toMatch(/choice is-selected[^>]*>\s*<span><span class="choice__title">Critique/)
  })

  it("les conseils des étapes 1 et 2 n'affichent rien pour les autres étapes", () => {
    expect(renderToStaticMarkup(<TipsAside step={1} />)).toContain("Un bon titre")
    expect(renderToStaticMarkup(<TipsAside step={2} />)).toContain("Ce que les étudiants regardent")
    expect(renderToStaticMarkup(<TipsAside step={3} />)).toBe("")
  })
})

describe("récapitulatif en direct (escrowSplit)", () => {
  it("10 000 FCFA : 10 000 bloqués, 1 200 de commission, 8 800 pour l'étudiant", () => {
    const html = text(renderToStaticMarkup(<BudgetAside budget={10000} />))
    expect(html).toContain("Commission EduCash 12 %")
    expect(html).toContain(f(10000))
    expect(html).toContain(f(1200))
    expect(html).toContain(f(8800))
    expect(html).toContain(`${f(10000)} seront bloqués à la publication, l'étudiant recevra ${f(8800)}.`)
    expect(html).toContain("Rien n'est bloqué avant la publication.")
  })

  it("arrondit comme escrowSplit (2 500 : 300 de commission, 2 200 pour l'étudiant)", () => {
    const html = text(renderToStaticMarkup(<LiveSummary budget={2500} />))
    expect(html).toContain(f(300))
    expect(html).toContain(f(2200))
  })

  it.each([null, undefined, 0, -5, 2500.5])("sans budget valide (%j) : aucune répartition inventée", (budget) => {
    const html = text(renderToStaticMarkup(<LiveSummary budget={budget} />))
    expect(html).toContain("Indiquez un budget")
    expect(html).not.toContain("FCFA")
  })

  it("tient un budget à 9 chiffres sans casser le format", () => {
    const html = text(renderToStaticMarkup(<LiveSummary budget={999999999} />))
    expect(html).toContain(f(999999999))
    expect(html).toContain(f(879999999))
  })
})

describe("étape 4 : récapitulatif", () => {
  const recap = (props = {}) => renderToStaticMarkup(<RecapBody values={full} onEdit={noop} {...props} />)

  it("affiche chaque réponse, le type par son libellé", () => {
    const html = text(recap())
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Faire le marché du samedi")
    expect(html).toContain("Cotonou")
    expect(html).toContain(DESC)
    expect(html).toContain(f(10000))
    expect(html).toContain("Urgent")
    expect(html).toContain("sam. 31 oct.")
    expect(html).not.toMatch(BANNED)
  })

  it("propose Modifier pour chacun des trois blocs, avec un nom accessible", () => {
    const html = recap()
    expect(html.match(/class="link2"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Modifier : Le besoin"')
    expect(html).toContain('aria-label="Modifier : Détails"')
    expect(html).toContain('aria-label="Modifier : Budget et échéance"')
  })

  it("désactive Modifier pendant la publication", () => {
    expect(recap({ disabled: true }).match(/disabled=""/g)).toHaveLength(3)
  })

  it("détaille ce qui se passe à la publication avec escrowSplit, jamais 0.88 ni 0.12", () => {
    const html = text(recap())
    expect(html).toContain("Ce qui se passe à la publication")
    expect(html).toContain(`Bloqué aujourd'hui sur votre portefeuille ${f(10000)}`)
    expect(html).toContain("Commission EduCash 12 %, prélevée à la fin")
    expect(html).toContain(`Versé à l'étudiant quand vous confirmez la fin ${f(8800)}`)
    expect(html).not.toMatch(/0[.,]88|0[.,]12/)
  })

  it("garde « 12 % » et « FCFA » insécables : aucune coupure possible entre le nombre et son unité", () => {
    const raw = recap()
    expect(raw).toContain("Commission EduCash 12\u00A0%, prélevée à la fin")
    expect(raw).not.toMatch(/12 %/)
    expect(raw).not.toMatch(/\d FCFA/)
    expect(raw).toMatch(/\d\u00A0FCFA/)
  })

  it("n'affirme que ce que le service tient (un seul paiement, annulation avant sélection)", () => {
    const html = text(recap())
    expect(html).toContain("Un seul paiement")
    expect(html).toContain("Annulation libre tant qu'aucun étudiant n'est retenu")
    expect(html).not.toContain("vérifiés")
  })

  it("le texte libre reste du texte : une balise saisie est échappée", () => {
    const html = renderToStaticMarkup(
      <RecapBody values={{ ...full, title: "<img src=x onerror=alert(1)>", description: "<script>x</script>" }} onEdit={noop} />,
    )
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;img")
  })

  it("aperçu côté étudiant : type libellé, ville, échéance, part de l'étudiant", () => {
    const html = text(renderToStaticMarkup(<PreviewCard values={full} />))
    expect(html).toContain("Aperçu côté étudiant")
    expect(html).toContain("Marché et achats")
    expect(html).toContain("Ouverte")
    expect(html).toContain("Avant le sam. 31 oct.")
    expect(html).toContain("Fonds en séquestre")
    expect(html).toContain(`L'étudiant touche ${f(8800)}`)
    expect(html).not.toMatch(/\bTu\b/)
  })

  it("impact sur le portefeuille : disponible, bloqué, disponible après", () => {
    const html = text(renderToStaticMarkup(<WalletImpact available={12500} budget={10000} />))
    expect(html).toContain(`Disponible aujourd'hui ${f(12500)}`)
    expect(html).toContain(`Bloqué en séquestre à la publication ${f(10000, { sign: "debit" })}`)
    expect(html).toContain(`Disponible après publication ${f(2500)}`)
  })

  it("impact sur le portefeuille : annonce ce qui manque sans bloquer", () => {
    const html = text(renderToStaticMarkup(<WalletImpact available={4000} budget={10000} />))
    expect(html).toContain(`Il manque pour publier ${f(6000)}`)
    expect(html).toContain("vous pourrez recharger au moment de publier")
  })

  it("impact sur le portefeuille : rien si le solde est illisible", () => {
    expect(renderToStaticMarkup(<WalletImpact available={null} budget={10000} />)).toBe("")
    expect(renderToStaticMarkup(<WalletImpact available={5000} budget={null} />)).toBe("")
  })
})

describe("solde insuffisant", () => {
  const dialog = (over = {}) =>
    renderToStaticMarkup(<InsufficientDialog open shortfall={6000} available={4000} required={10000} onClose={noop} {...over} />)

  it("n'affiche rien tant qu'elle est fermée", () => {
    expect(renderToStaticMarkup(<InsufficientDialog open={false} shortfall={1} available={0} required={1} onClose={noop} />)).toBe("")
  })

  it("annonce le montant manquant dans une modale accessible", () => {
    const html = dialog()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(text(html)).toContain(`Il manque ${f(6000)}`)
    expect(text(html)).toContain(`Budget à bloquer ${f(10000)}`)
    expect(text(html)).toContain(`Disponible sur votre portefeuille ${f(4000)}`)
  })

  it("propose de recharger exactement le manque, vers la page du portefeuille", () => {
    const html = dialog()
    expect(html).toContain('href="/client/wallet?recharger=1&amp;montant=6000"')
    expect(text(html)).toContain(`Recharger ${f(6000)}`)
  })

  it("dit que rien n'est publié ni bloqué, et permet de revenir à la mission", () => {
    const html = text(dialog())
    expect(html).toContain("Votre mission n'est pas publiée et rien n'a été bloqué")
    expect(html).toContain("Revenir à ma mission")
  })

  it("sans disponible connu, la ligne du disponible est omise", () => {
    expect(text(dialog({ available: null }))).not.toContain("Disponible sur votre portefeuille")
  })

  it("ne nomme aucun prestataire de paiement", () => {
    expect(text(dialog())).not.toMatch(BANNED)
  })
})

describe("envoi (runPublish)", () => {
  const lock = () => ({ current: false })
  const deferred = () => {
    let resolve
    const promise = new Promise((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it("valide avant d'appeler le serveur et renvoie la première étape en erreur", async () => {
    const create = vi.fn()
    const out = await runPublish({ values: { ...full, description: "court" }, today: TODAY, create, lock: lock() })
    expect(out).toMatchObject({ kind: "invalid", step: 2 })
    expect(out.errors.description).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it("une date passée n'atteint jamais le serveur", async () => {
    const create = vi.fn()
    const out = await runPublish({ values: { ...full, deadline: "2020-01-01" }, today: TODAY, create, lock: lock() })
    expect(out).toMatchObject({ kind: "invalid", step: 3 })
    expect(create).not.toHaveBeenCalled()
  })

  it("envoie les seuls champs de la mission, nettoyés", async () => {
    const create = vi.fn().mockResolvedValue({ id: "m-1" })
    await runPublish({ values: { ...full, title: "  Titre  ", client_id: "autre", status: "done" }, today: TODAY, create, lock: lock() })
    expect(create).toHaveBeenCalledWith({
      title: "Titre",
      description: DESC,
      type: "Livraison",
      city: "Cotonou",
      budget: 10000,
      urgency: "medium",
      deadline: "2026-10-31",
    })
  })

  it("succès : renvoie l'identifiant et garde le verrou pris", async () => {
    const l = lock()
    const out = await runPublish({ values: full, today: TODAY, create: vi.fn().mockResolvedValue({ id: "m-1" }), lock: l })
    expect(out).toEqual({ kind: "success", id: "m-1" })
    expect(l.current).toBe(true)
  })

  it("double clic : une seule mission est créée", async () => {
    const gate = deferred()
    const create = vi.fn(() => gate.promise)
    const l = lock()
    const first = runPublish({ values: full, today: TODAY, create, lock: l })
    const second = runPublish({ values: full, today: TODAY, create, lock: l })
    const third = runPublish({ values: full, today: TODAY, create, lock: l })
    expect(await second).toEqual({ kind: "busy" })
    expect(await third).toEqual({ kind: "busy" })
    gate.resolve({ id: "m-1" })
    expect(await first).toEqual({ kind: "success", id: "m-1" })
    expect(create).toHaveBeenCalledTimes(1)
    // Après le succès, un nouveau clic reste refusé.
    expect(await runPublish({ values: full, today: TODAY, create, lock: l })).toEqual({ kind: "busy" })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("wallet_insufficient : renvoie le manque, libère le verrou et ne publie rien", async () => {
    const l = lock()
    const create = vi.fn().mockResolvedValue({ error: "wallet_insufficient", available: 4000, required: 10000, shortfall: 6000 })
    const out = await runPublish({ values: full, today: TODAY, create, lock: l })
    expect(out).toEqual({ kind: "insufficient", shortfall: 6000, available: 4000, required: 10000 })
    expect(l.current).toBe(false)
  })

  it("wallet_insufficient sans manque lisible : message de solde, pas de modale vide", async () => {
    const create = vi.fn().mockResolvedValue({ error: "wallet_insufficient" })
    const out = await runPublish({ values: full, today: TODAY, create, lock: lock() })
    expect(out.kind).toBe("error")
    expect(out.error).toContain("solde")
  })

  it("affiche l'erreur du serveur telle quelle et permet de réessayer", async () => {
    const l = lock()
    const create = vi.fn().mockResolvedValue({ error: "Impossible de réserver les fonds. Vérifiez votre solde et réessayez." })
    const out = await runPublish({ values: full, today: TODAY, create, lock: l })
    expect(out).toEqual({ kind: "error", error: "Impossible de réserver les fonds. Vérifiez votre solde et réessayez." })
    expect(l.current).toBe(false)
    create.mockResolvedValue({ id: "m-2" })
    expect(await runPublish({ values: full, today: TODAY, create, lock: l })).toEqual({ kind: "success", id: "m-2" })
  })

  it("publication refusée en pause : l'erreur d'activation est affichée, rien n'est créé", async () => {
    const create = vi.fn().mockResolvedValue({ error: "La publication de missions est en cours d'activation." })
    const out = await runPublish({ values: full, today: TODAY, create, lock: lock() })
    expect(out.kind).toBe("error")
    expect(out.error).toMatch(/en cours d'activation/)
  })

  it("une exception réseau invite à vérifier Mes missions avant de réessayer, sans affirmer que rien n'est bloqué", async () => {
    const l = lock()
    const out = await runPublish({ values: full, today: TODAY, create: vi.fn().mockRejectedValue(new Error("fetch failed")), lock: l })
    expect(out.kind).toBe("error")
    expect(out.error).toContain("Mes missions")
    expect(out.error).not.toContain("fetch failed")
    expect(out.error).not.toMatch(/aucun débit|rien n'a été|non bloqué/i)
    expect(l.current).toBe(false)
  })

  it("une réponse sans identifiant ni erreur n'est pas un succès", async () => {
    const out = await runPublish({ values: full, today: TODAY, create: vi.fn().mockResolvedValue({}), lock: lock() })
    expect(out.kind).toBe("error")
  })
})

describe("publication en pause", () => {
  const paused = (props = {}) => renderToStaticMarkup(<PublishPausedView {...props} />)

  it("affiche le titre et le texte partagés, un seul h1", () => {
    const html = paused()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(text(html)).toContain(PAYMENTS_PENDING_COPY.publish.title)
    expect(text(html)).toContain(PAYMENTS_PENDING_COPY.publish.lead)
  })

  it("propose « Prévenez-moi » avec le formulaire du système, honeypot compris", () => {
    const html = paused()
    expect(text(html)).toContain("Prévenez-moi")
    expect(html).toContain('name="email"')
    expect(html).toContain('name="website"')
    expect(html).toContain("auth__form")
    expect(html).not.toContain("rounded-xl")
  })

  it("ne permet aucune publication : ni assistant, ni bouton de publication, ni barre d'action", () => {
    const html = paused({ resumeHref: "/client/missions/new?besoin=Garder" })
    expect(html).not.toContain("Publier et bloquer")
    expect(html).not.toContain("stepper")
    expect(html).not.toContain("mbar2")
    expect(html).not.toContain('role="radiogroup"')
    expect(html).not.toContain("Continuer")
  })

  it("rappelle le séquestre au vouvoiement et renvoie vers les missions", () => {
    const html = text(paused())
    expect(html).toContain("le budget est bloqué en séquestre")
    expect(html).toContain("vous validiez le travail")
    expect(html).toContain("Voir mes missions")
    expect(paused()).toContain('href="/client/missions"')
    expect(html).not.toMatch(BANNED)
    expect(html).not.toMatch(/(?<![\p{L}\p{N}_])(?:tu|ton|ta|tes|toi)(?![\p{L}\p{N}_])/iu)
  })
})

describe("feuille c03.css : pièges de spécificité", () => {
  const css = readFileSync(new URL("../../../app/design/client/c03.css", import.meta.url), "utf8")
  const base = readFileSync(new URL("../../../app/design/client/base.css", import.meta.url), "utf8")

  it("rend son anneau de focus à une carte de choix sélectionnée (base.css la mettait à none en 0,3,0)", () => {
    expect(base).toMatch(/\.c2 \.choice\.is-selected \{[^}]*box-shadow: none/)
    expect(css).toMatch(/\.c2 \.choice\.is-selected:focus-visible \{ box-shadow: var\(--sh-focus\); \}/)
  })

  it("une puce de type sélectionnée garde sa bordure encre malgré .c2 .chip", () => {
    expect(css).toMatch(/\.form2 \.chips \.chip\.is-selected \{[^}]*border-color: var\(--c-encre\)/)
  })

  it("ne touche ni la couleur, ni l'ombre, ni le transform des composants du système hors ces deux cas", () => {
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    const touching = rules
      .filter(([, , body]) => /(?:^|[;\s])(?:color|box-shadow|transform)\s*:/.test(body))
      .map(([, sel]) => sel.trim())
    expect(touching.sort()).toEqual(
      [
        ".c2 .checklist li.is-ok",
        ".c2 .choice.is-selected:focus-visible",
        ".form2 .chips .chip.is-selected",
        ".preview2__top",
        ".preview2__price span",
        ".eyebrow2",
        ".review2 dt",
        ".mstep2",
        ".wizard2 .link2:focus-visible",
        ".wizard2 .link2:disabled",
      ].sort(),
    )
  })

  it("garde une barre d'action mobile qui laisse passer un montant à 9 chiffres (retour à la ligne)", () => {
    expect(css).toMatch(/\.wizard2 \.btn--dark \{[^}]*white-space: normal/)
    expect(css).toMatch(/\.wizard2 \.mbar2__row \.btn--dark \{ flex: 1; min-width: 0; \}/)
    expect(css).toMatch(/\.preview2__price \{[^}]*flex-wrap: wrap/)
  })

  it("n'écrit aucune couleur en dur ni de seuil de media query nouveau", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
    const conditions = [...css.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    expect(conditions.every((c) => ["(max-width: 1023.98px)", "(max-width: 480px)"].includes(c))).toBe(true)
  })
})

describe("vue de l'assistant (états)", () => {
  const view = (over = {}) =>
    renderToStaticMarkup(
      <PublishWizardView
        step={4}
        values={full}
        errors={{}}
        available={12500}
        today={TODAY}
        pending={false}
        serverError={null}
        insufficient={null}
        resumeHref="/client/missions/new?besoin=x"
        formId="f"
        onChange={noop}
        onSubmit={noop}
        onBack={noop}
        onEdit={noop}
        onCloseInsufficient={noop}
        {...over}
      />,
    )

  it("étape 4 : bouton « Publier et bloquer X », Retour, aperçu et impact", () => {
    const html = view()
    expect(text(html)).toContain(`Publier et bloquer ${f(10000)}`)
    expect(html).toContain("Retour")
    expect(text(html)).toContain("Aperçu côté étudiant")
    expect(text(html)).toContain("Impact sur votre portefeuille")
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it("envoi en cours : boutons inactifs, aria-busy, Retour et Modifier verrouillés", () => {
    const html = view({ pending: true })
    expect(text(html)).toContain("Publication en cours")
    expect(html.match(/aria-busy="true"/g)).toHaveLength(2)
    expect(html.match(/<button[^>]*type="submit"[^>]*disabled=""/g)).toHaveLength(2)
    expect(html).not.toMatch(/<button[^>]*type="button"[^>]*class="btn btn--soft"(?![^>]*disabled)/)
  })

  it("erreur serveur : affichée telle quelle, la saisie reste dans le récapitulatif", () => {
    const html = view({ serverError: "Impossible de réserver les fonds. Vérifiez votre solde et réessayez." })
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain("Impossible de réserver les fonds. Vérifiez votre solde et réessayez.")
    expect(text(html)).toContain("Faire le marché du samedi")
  })

  it("solde insuffisant : modale ouverte, aucune publication affichée", () => {
    const html = view({ insufficient: { shortfall: 6000, available: 4000, required: 10000 } })
    expect(html).toContain('role="dialog"')
    expect(text(html)).toContain(`Il manque ${f(6000)}`)
    expect(html).toContain("recharger=1&amp;montant=6000")
  })

  it("étape 3 avec erreurs : message de champ et récapitulatif en direct", () => {
    const html = view({ step: 3, values: { ...full, budget: 500 }, errors: { budget: "Le budget minimum est de 2 000 FCFA." } })
    expect(text(html)).toContain("Le budget minimum est de 2 000 FCFA.")
    expect(text(html)).toContain("Récapitulatif en direct")
    expect(text(html)).toContain("Étape 3 sur 4 · Budget et échéance")
  })
})

describe("mission avec achats", () => {
  const checked = { ...full, avecAchats: true, estimationAchats: 15000 }
  const details = (values, errors = {}) =>
    renderToStaticMarkup(<StepDetails values={values} errors={errors} onChange={noop} />)
  const budgetStep = (values, errors = {}) =>
    renderToStaticMarkup(<StepBudget values={values} errors={errors} today={TODAY} onChange={noop} />)

  it("étape 2 : une vraie case à cocher, avec son libellé et son aide", () => {
    const html = details({ ...full, avecAchats: false })
    expect(html).toMatch(/<input[^>]*type="checkbox"/)
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*class="check|<label[^>]*class="check[^"]*"[^>]*for=/)
    expect(text(html)).toContain("Mission avec achats")
    expect(text(html)).toContain("L'étudiant achète des articles pour vous")
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked/)
  })

  it("la case est proposée quel que soit le type de mission", () => {
    for (const type of ["Babysitting", "Livraison", "Traduction", "Autre", ""]) {
      expect(details({ ...full, type })).toMatch(/type="checkbox"/)
    }
  })

  it("la case est reliée à une région annoncée (aria-controls, aria-expanded)", () => {
    const off = details({ ...full, avecAchats: false })
    const on = details(checked)
    const controls = on.match(/aria-controls="([^"]+)"/)?.[1]
    expect(controls).toBeTruthy()
    expect(on).toContain(`id="${controls}"`)
    expect(on).toContain('aria-expanded="true"')
    expect(off).toContain('aria-expanded="false"')
    expect(on).toContain('aria-live="polite"')
    expect(text(on)).toContain("estimation des achats à l'étape suivante")
    expect(text(off)).not.toContain("estimation des achats à l'étape suivante")
    expect(on).toMatch(/<input[^>]*type="checkbox"[^>]*checked/)
  })

  it("étape 3 : l'estimation n'apparaît que si la case est cochée", () => {
    expect(text(budgetStep({ ...full, avecAchats: false }))).not.toContain("Estimation des achats")
    const on = text(budgetStep(checked))
    expect(on).toContain("Estimation des achats")
    expect(on).toContain("n'est pas bloqué")
    expect(on).not.toContain("Vous payez ce montant, rien de plus")
    expect(text(budgetStep({ ...full, avecAchats: false }))).toContain("Vous payez ce montant, rien de plus")
  })

  it("étape 3 : l'erreur d'estimation est annoncée sur le champ", () => {
    const html = budgetStep({ ...checked, estimationAchats: null }, { estimationAchats: "Indiquez l'estimation des achats." })
    expect(html).toContain('aria-invalid="true"')
    expect(text(html)).toContain("Indiquez l'estimation des achats.")
  })

  it("étape 3 : le résumé en direct rappelle que les achats ne sont pas bloqués", () => {
    const html = text(renderToStaticMarkup(<BudgetAside budget={10000} purchases={15000} />))
    expect(html).toContain(`Les achats (environ ${f(15000)}) ne sont pas bloqués : prévoyez-les sur votre MoMo`)
    expect(html).toContain(f(10000))
    const without = text(renderToStaticMarkup(<BudgetAside budget={10000} />))
    expect(without).not.toContain("achats")
  })

  it("étape 4 : le récapitulatif liste l'estimation, sans toucher au montant bloqué", () => {
    const html = text(renderToStaticMarkup(<RecapBody values={checked} onEdit={noop} />))
    expect(html).toContain(`environ ${f(15000)}`)
    expect(html).toContain("ne sont pas bloqués : prévoyez-les sur votre MoMo")
    expect(html).toContain(f(10000))
    expect(html).not.toContain("Un seul paiement")
    // Aucune commission ni répartition n'est calculée sur les achats (12 % de 15 000 = 1 800).
    expect(html).not.toContain(f(1800))
  })

  it("étape 4 : sans la case, ou avec une estimation inutilisable, aucune ligne d'achats", () => {
    for (const values of [full, { ...full, avecAchats: false, estimationAchats: 15000 }, { ...full, avecAchats: true, estimationAchats: 0 }]) {
      const html = text(renderToStaticMarkup(<RecapBody values={values} onEdit={noop} />))
      expect(html).not.toContain("Achats estimés")
      expect(html).toContain("Un seul paiement")
    }
  })

  it("aperçu : pastille « Avec achats » et estimation seulement si la case est cochée", () => {
    expect(text(renderToStaticMarkup(<PreviewCard values={checked} />))).toContain("Avec achats")
    expect(text(renderToStaticMarkup(<PreviewCard values={checked} />))).toContain(`Achats estimés : environ ${f(15000)}, non bloqués`)
    const plain = text(renderToStaticMarkup(<PreviewCard values={full} />))
    expect(plain).not.toContain("Avec achats")
    expect(plain).not.toContain("Achats estimés")
  })

  it("le texte reste au vouvoiement, sans tiret cadratin, sans fournisseur de paiement", () => {
    const all = [
      details(checked),
      budgetStep(checked),
      renderToStaticMarkup(<RecapBody values={checked} onEdit={noop} />),
      renderToStaticMarkup(<BudgetAside budget={10000} purchases={15000} />),
    ]
      .map(text)
      .join(" ")
    expect(all).not.toMatch(/(?<![\p{L}\p{N}_])(?:tu|ton|ta|tes|toi)(?![\p{L}\p{N}_])/iu)
    expect(all).not.toMatch(new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`))
    expect(all).not.toMatch(/fedapay/i)
  })

  it("envoi : case cochée, l'estimation part avec le drapeau", async () => {
    const create = vi.fn().mockResolvedValue({ id: "m-1" })
    await runPublish({ values: checked, today: TODAY, create, lock: { current: false } })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ with_purchases: true, purchases_estimate: 15000, budget: 10000 }))
  })

  it("envoi : case décochée avec une estimation restée en état, rien n'est envoyé", async () => {
    const create = vi.fn().mockResolvedValue({ id: "m-1" })
    await runPublish({ values: { ...full, avecAchats: false, estimationAchats: 15000 }, today: TODAY, create, lock: { current: false } })
    const sent = create.mock.calls[0][0]
    expect(sent).not.toHaveProperty("with_purchases")
    expect(sent).not.toHaveProperty("purchases_estimate")
  })

  it("envoi : case cochée sans estimation valable, refus avant l'appel serveur", async () => {
    const create = vi.fn()
    for (const estimationAchats of [null, 0, -3, Number.NaN, 1e12]) {
      const out = await runPublish({ values: { ...full, avecAchats: true, estimationAchats }, today: TODAY, create, lock: { current: false } })
      expect(out.kind).toBe("invalid")
      expect(out.step).toBe(3)
    }
    expect(create).not.toHaveBeenCalled()
  })
})
