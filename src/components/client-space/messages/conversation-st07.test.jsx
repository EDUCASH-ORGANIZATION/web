import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(),
  getClientMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { ConversationView } = await import("./conversation-view")
const { StatusBanner } = await import("./status-banner")
const { SendOrMic, hasSendableText } = await import("./composer")

const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const NOW = "2026-10-13T12:00:00Z"
const nbsp = /[  \s]/g
const plain = (html) => html.replace(/<[^>]*>/g, "").replace(nbsp, "")

const conversation = (over = {}) => ({
  userId: "client-1",
  missionId: M1,
  studentId: S1,
  student: { id: S1, name: "Ulrich Z.", avatarUrl: null },
  mission: { title: "Courses au marché Dantokpa", status: "in_progress", budget: 5000, purchasesEstimate: 7450 },
  relation: "selected",
  state: "in_progress",
  canWrite: true,
  messages: [],
  ...over,
})
const view = (over, paymentsEnabled = true) =>
  renderToStaticMarkup(<ConversationView conversation={conversation(over)} now={NOW} paymentsEnabled={paymentsEnabled} />)
const banner = (mission, { paymentsEnabled = true, state = "in_progress", studentName = "Ulrich Z." } = {}) =>
  renderToStaticMarkup(
    <StatusBanner state={state} missionId={M1} studentId={S1} studentName={studentName} mission={mission} paymentsEnabled={paymentsEnabled} />,
  )
const clean = (html) => {
  expect(html).not.toContain("NaN")
  expect(html).not.toContain("undefined")
  expect(html).not.toContain("null")
}

describe("ST-07 en-tête", () => {
  it("nom en h2 (le layout porte l'unique h1), sous-titre relationnel, « Voir le profil » vers la vitrine", () => {
    const html = view()
    expect((html.match(/<h2[\s>]/g) ?? []).length).toBe(1)
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(0)
    expect(html).toContain("Retenu sur « Courses au marché Dantokpa »")
    expect(html).toContain(`href="/talents/${S1}"`)
    expect(html).toContain("Voir le profil")
    expect(html).toContain('href="/client/messages"')
  })

  it("candidat : « Candidat sur « titre »»", () => {
    expect(view({ relation: "candidate", state: "candidate" })).toContain("Candidat sur « Courses au marché Dantokpa »")
  })

  it.each([
    ["done", "Mission terminée : « Courses au marché Dantokpa »"],
    ["cancelled", "Mission annulée : « Courses au marché Dantokpa »"],
    ["rejected", "Candidature refusée sur « Courses au marché Dantokpa »"],
  ])("état %s : l'issue remplace le lien", (state, text) => {
    expect(view({ state, canWrite: false })).toContain(text)
  })

  it("aucun drapeau ni menu d'actions (fonctions non codées)", () => {
    const html = view()
    expect(html).not.toContain("i-flag")
    expect(html).not.toContain("i-more-v")
    expect(html).not.toContain("Signaler")
  })

  it("l'identifiant de l'étudiant est encodé dans le lien de profil", () => {
    expect(view({ student: { id: "a/b?c", name: "Ulrich Z.", avatarUrl: null } })).toContain('href="/talents/a%2Fb%3Fc"')
  })
})

describe("ST-07 bandeau en cours", () => {
  it("avec estimation : séquestre, achats estimés, Confirmer la fin vers ?confirmer=1", () => {
    const html = banner({ budget: 5000, purchasesEstimate: 7450 })
    const text = plain(html)
    expect(text).toContain("5000FCFAenséquestrepourleservice")
    expect(text).toContain("achatsestimés:environ7450FCFA")
    expect(html).toContain(`href="/client/missions/${M1}?confirmer=1"`)
    expect(html).toContain("chat-status--amounts")
    clean(html)
  })

  it("sans estimation : pas de partie achats", () => {
    for (const mission of [{ budget: 5000 }, { budget: 5000, purchasesEstimate: 0 }, { budget: 5000, purchasesEstimate: "abc" }]) {
      const html = banner(mission)
      expect(html).toContain("en séquestre pour le service")
      expect(html).not.toContain("achats estimés")
      clean(html)
    }
  })

  it("jamais le gain de l'étudiant côté client", () => {
    for (const state of ["in_progress", "candidate", "done"]) {
      const html = banner({ budget: 5000, net: 4400, purchasesEstimate: 7450 }, { state })
      expect(html.toLowerCase()).not.toContain("touch")
      expect(html.replace(nbsp, "")).not.toContain("4400")
    }
  })

  it("paiements fermés : jamais « séquestre »", () => {
    for (const state of ["in_progress", "candidate"]) {
      const html = banner({ budget: 5000, purchasesEstimate: 7450 }, { paymentsEnabled: false, state })
      expect(html.toLowerCase()).not.toContain("séquestre")
      expect(html.toLowerCase()).not.toContain("sequestre")
      expect(html.replace(nbsp, "")).toContain("5000FCFA")
    }
  })

  it.each([
    ["absent", undefined],
    ["objet vide", {}],
    ["budget chaîne", { budget: "5000" }],
    ["budget NaN", { budget: NaN }],
    ["budget Infinity", { budget: Infinity }],
    ["budget 0", { budget: 0 }],
    ["budget négatif", { budget: -500 }],
  ])("budget %s : texte d'état, sans montant", (_n, mission) => {
    const html = banner(mission)
    clean(html)
    expect(html).toContain("Mission en cours")
    expect(html).not.toContain("séquestre")
    expect(html).not.toContain("chat-status--amounts")
  })
})

describe("ST-07 bandeau candidat", () => {
  it("« Accepter <prénom> » ouvre le tiroir de la candidature, montant en séquestre", () => {
    const html = banner({ budget: 8000 }, { state: "candidate", studentName: "Afiavi D." })
    expect(html).toContain("Accepter Afiavi")
    expect(html).not.toContain("Afiavi D.")
    expect(html).toContain(`href="/client/missions/${M1}?candidat=${S1}"`)
    expect(html).toContain("Candidature en attente")
    expect(plain(html)).toContain("8000FCFAenséquestre")
    expect(html).toContain("badge--alerte")
  })

  it("budget absent : « Candidature en attente de votre réponse », aucun montant", () => {
    const html = banner({}, { state: "candidate", studentName: "Afiavi D." })
    expect(html).toContain("Candidature en attente de votre réponse")
    expect(html).not.toContain("FCFA")
  })

  it("nom vide : « Voir la candidature », jamais « Accepter » seul", () => {
    const html = banner({ budget: 8000 }, { state: "candidate", studentName: "" })
    expect(html).toContain("Voir la candidature")
    expect(html).not.toContain("Accepter")
  })

  it("le lien n'exécute rien : simple adresse de mission avec ?candidat=", () => {
    const html = banner({ budget: 8000 }, { state: "candidate" })
    expect(html).not.toMatch(/accepter=|action=|confirm=/)
  })
})

describe("ST-07 bandeau autres états", () => {
  it.each(["done", "cancelled", "rejected", "closed"])("état %s : texte d'état et lien vers la mission, aucun montant", (state) => {
    const html = banner({ budget: 5000, purchasesEstimate: 7450 }, { state })
    expect(html).toContain(`href="/client/missions/${M1}"`)
    expect(html).not.toContain("FCFA")
    expect(html).not.toContain("séquestre")
  })
})

describe("ST-07 saisie", () => {
  const composer = (text) => renderToStaticMarkup(<SendOrMic hasText={hasSendableText(text)} onRecord={vi.fn()} />)

  it.each(["", "   ", "\n\t "])("texte vide ou blanc %j : micro, pas d'envoi", (text) => {
    const html = composer(text)
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).not.toContain('aria-label="Envoyer"')
  })

  it("texte non vide : l'envoi remplace le micro", () => {
    const html = composer("Bonjour")
    expect(html).toContain('type="submit" class="composer__send" aria-label="Envoyer"')
    expect(html).not.toContain("Enregistrer un message vocal")
  })

  it("lecture seule : aucune saisie", () => {
    const html = view({ state: "done", canWrite: false })
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("<form")
    expect(html).toContain("lecture seule")
  })
})

describe("ST-07 feuille de style C13", () => {
  const css = readFileSync(join(process.cwd(), "src/app/design/client/c13.css"), "utf8")
  const mobile = css.slice(css.indexOf("@media (max-width: 1023.98px)"))

  it("le retour n'existe que sous 1024 et la barre de coquille est masquée sur la conversation", () => {
    expect(css).toMatch(/\.c2 \.conv2__back \{ display: none; \}/)
    expect(mobile).toMatch(/\.c2 \.conv2__back \{ display: inline-grid; \}/)
    expect(mobile).toMatch(/\.c2:has\(\.conv2__head\) \.mtop2 \{ display: none; \}/)
  })

  it("en-tête mobile de 60 px et volet de hauteur explicite bornée", () => {
    expect(mobile).toMatch(/\.conv2__head \{ height: 60px;/)
    expect(mobile).toMatch(/> \.conv2 \{[^}]*height: calc\(100dvh - var\(--s-2\)\);/)
  })

  it("zone sûre comptée une seule fois : dans la saisie, jamais dans la hauteur du volet ni la coquille", () => {
    expect(mobile.match(/env\(safe-area-inset-bottom/g) ?? []).toHaveLength(2)
    expect(mobile).toMatch(/\.composer:not\(\.is-locked\) \{ padding-bottom: calc\(10px \+ env\(safe-area-inset-bottom/)
    expect(mobile).not.toMatch(/\.conv2 \{[^}]*safe-area/)
    expect(mobile).not.toMatch(/\.shell__main \{[^}]*safe-area/)
  })

  it("bandeau : une ligne sur mobile quand des montants s'affichent, texte court seulement alors", () => {
    expect(css).toMatch(/\.chat-status__text--short \{ display: none; \}/)
    expect(mobile).toMatch(/\.chat-status--amounts \{ flex-wrap: nowrap; \}/)
    expect(mobile).toMatch(/\.chat-status--amounts \.chat-status__text--long \{ display: none; \}/)
    expect(mobile).toMatch(/\.chat-status--amounts \.chat-status__text--short \{ display: inline; \}/)
  })

  it("le fil ne rogne pas le volet à marge négative en mobile", () => {
    expect(mobile).toMatch(/\[data-view="conversation"\] > \.c-inbox__thread \{ overflow: visible; \}/)
    expect(mobile).toMatch(/margin-inline: calc\(-1 \* var\(--s-4\)\)/)
  })

  it("chaque montant du bandeau est insécable (jamais « 7 450 | FCFA » coupé)", () => {
    expect(css).toMatch(/\.c2 \.conv2__amount \{ white-space: nowrap; \}/)
    const html = banner({ budget: 5000, purchasesEstimate: 7450 })
    expect(html).toMatch(/<b class="conv2__amount">5\s000\sFCFA<\/b>/)
    expect(html).toMatch(/<b class="conv2__amount">7\s450\sFCFA<\/b>/)
  })

  it("aucune hauteur minimale réservée pour un futur bouton", () => {
    expect(css).not.toMatch(/\.chat-status[^{]*\{[^}]*min-height: (?!44px)/)
  })
})
