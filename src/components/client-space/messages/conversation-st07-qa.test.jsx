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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: vi.fn(),
}))
vi.mock("@/lib/actions/message.actions", () => ({
  sendClientMessage: vi.fn(),
  markClientConversationRead: vi.fn(),
  getClientMessageMedia: vi.fn(async () => ({ media: {} })),
  getClientConversation: vi.fn(),
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { ConversationView } = await import("./conversation-view")
const { StatusBanner } = await import("./status-banner")
const { Composer, SendOrMic, hasSendableText } = await import("./composer")
const { MESSAGE_MAX_LENGTH } = await import("@/lib/client-space/conversations")
const { getClientConversation } = await import("@/lib/actions/message.actions")

const M1 = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const NOW = "2026-10-13T12:00:00Z"
const nbsp = /[  \s]/g

const conversation = (over = {}) => ({
  userId: "client-1",
  missionId: M1,
  studentId: S1,
  student: { id: S1, name: "Ulrich Z.", avatarUrl: null },
  mission: { title: "Courses", status: "in_progress", budget: 5000, purchasesEstimate: 7450, net: 4400 },
  relation: "selected",
  state: "in_progress",
  canWrite: true,
  net: 4400,
  messages: [],
  ...over,
})
const view = (over, paymentsEnabled = true) =>
  renderToStaticMarkup(<ConversationView conversation={conversation(over)} now={NOW} paymentsEnabled={paymentsEnabled} />)
const banner = (mission, opts = {}) => {
  const { paymentsEnabled = true, state = "in_progress" } = opts
  const studentName = "studentName" in opts ? opts.studentName : "Ulrich Z."
  return renderToStaticMarkup(
    <StatusBanner state={state} missionId={M1} studentId={S1} studentName={studentName} mission={mission} paymentsEnabled={paymentsEnabled} />,
  )
}
const clean = (html) => {
  expect(html).not.toContain("NaN")
  expect(html).not.toContain("undefined")
  expect(html).not.toContain("null")
  expect(html).not.toContain("Infinity")
}

const STATES = [
  ["candidate", "candidate"],
  ["in_progress", "selected"],
  ["done", "selected"],
  ["cancelled", "selected"],
  ["rejected", "candidate"],
  ["closed", "candidate"],
]

describe("QA ST-07 confidentialité : jamais le net côté client", () => {
  it.each(STATES)("état %s, props avec net : ni « vous touchez » ni le montant net", (state, relation) => {
    for (const pe of [true, false]) {
      const html = view({ state, relation, canWrite: state === "in_progress" || state === "candidate" }, pe)
      const low = html.toLowerCase()
      expect(low).not.toContain("vous touchez")
      expect(low).not.toContain("touchez")
      expect(low).not.toContain("net")
      expect(html.replace(nbsp, "")).not.toContain("4400")
    }
  })

  it.each(STATES)("bandeau seul, état %s, mission.net 4400", (state) => {
    const html = banner({ budget: 5000, net: 4400, studentNet: 4400, purchasesEstimate: 7450 }, { state })
    expect(html.toLowerCase()).not.toContain("touchez")
    expect(html.replace(nbsp, "")).not.toContain("4400")
  })
})

describe("QA ST-07 bandeau : budget et paiements", () => {
  it("budget valide + paiements ouverts : « en séquestre »", () => {
    for (const state of ["in_progress", "candidate"]) {
      expect(banner({ budget: 5000 }, { state }).replace(nbsp, " ")).toContain("en séquestre")
    }
  })

  it("paiements fermés : ni séquestre ni nom de prestataire", () => {
    for (const state of ["in_progress", "candidate", "done", "cancelled", "rejected", "closed"]) {
      const low = banner({ budget: 5000, purchasesEstimate: 7450 }, { state, paymentsEnabled: false }).toLowerCase()
      expect(low).not.toContain("séquestre")
      expect(low).not.toContain("sequestre")
      for (const p of ["kkiapay", "fedapay", "mtn", "moov", "celtiis", "stripe", "paydunya", "cinetpay", "momo"]) {
        expect(low).not.toContain(p)
      }
    }
    expect(view({}, false).toLowerCase()).not.toContain("séquestre")
  })

  it.each([
    ["absent", undefined],
    ["null", null],
    ["vide", {}],
    ["0", { budget: 0 }],
    ["négatif", { budget: -1 }],
    ["NaN", { budget: NaN }],
    ["Infinity", { budget: Infinity }],
    ["-Infinity", { budget: -Infinity }],
    ["chaîne", { budget: "5000" }],
    ["booléen", { budget: true }],
    ["objet", { budget: {} }],
  ])("budget %s, états en cours et candidat : texte d'état propre", (_n, mission) => {
    for (const state of ["in_progress", "candidate"]) {
      const html = banner(mission, { state })
      clean(html)
      expect(html).not.toContain("FCFA")
      expect(html).not.toContain("séquestre")
      expect(html).not.toContain("chat-status--amounts")
    }
  })

  it.each([
    ["0", 0],
    ["négatif", -300],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["chaîne", "7450"],
    ["null", null],
    ["objet", {}],
  ])("estimation d'achats %s : pas de ligne d'achats", (_n, purchasesEstimate) => {
    const html = banner({ budget: 5000, purchasesEstimate })
    clean(html)
    expect(html).not.toContain("achats")
    expect(html).toContain("séquestre")
    const closed = banner({ budget: 5000, purchasesEstimate }, { paymentsEnabled: false })
    expect(closed).not.toContain("achats")
  })

  it("budget minuscule positif et très grand : pas de notation scientifique ni de NaN", () => {
    for (const budget of [1, 0.5, 1e21, Number.MAX_SAFE_INTEGER]) {
      const html = banner({ budget })
      expect(html).not.toContain("NaN")
      expect(html).not.toContain("undefined")
    }
  })
})

describe("QA ST-07 candidat : lien et échappement", () => {
  it("« Accepter <prénom> » est un lien <a href> vers ?candidat=, pas un bouton ni un formulaire", () => {
    const html = banner({ budget: 8000 }, { state: "candidate", studentName: "Afiavi D." })
    expect(html).toMatch(/<a [^>]*href="\/client\/missions\/[^"]+\?candidat=[^"]+"[^>]*>Accepter Afiavi/)
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("onclick")
  })

  it("prénoms hostiles : échappés", () => {
    const hostile = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      "O'Brien \"x\" & <b>",
    ]
    for (const name of hostile) {
      const html = banner({ budget: 8000 }, { state: "candidate", studentName: name })
      expect(html).not.toContain("<script")
      expect(html).not.toContain("<img")
      expect(html).not.toMatch(/<b>[^<]*<\/b>[^<]*Accepter/)
      const full = view({ student: { id: S1, name, avatarUrl: null }, state: "candidate", relation: "candidate" })
      expect(full).not.toContain("<script")
      expect(full).not.toContain("<img src=x")
      expect(full).not.toContain("onerror=alert(1)>")
    }
  })

  it("prénom très long : rendu sans exception, une seule fois dans le libellé", () => {
    const name = `${"A".repeat(5000)} Z.`
    const html = banner({ budget: 8000 }, { state: "candidate", studentName: name })
    expect(html).toContain(`Accepter ${"A".repeat(5000)}`)
    clean(html)
  })

  it.each(["", "   ", "\n\t", undefined, null, 42, {}])("nom %j : « Voir la candidature »", (studentName) => {
    const html = banner({ budget: 8000 }, { state: "candidate", studentName })
    expect(html).toContain("Voir la candidature")
    expect(html).not.toContain("Accepter")
    clean(html)
  })

  it("page détail mission : aucune mutation déclenchée par ?candidat= ou ?confirmer= en GET", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(client)/client/missions/[id]/page.js"), "utf8")
    const imports = [...src.matchAll(/import \{([^}]*)\} from "(@\/lib\/actions\/[^"]+)"/g)]
    const names = imports.flatMap((m) => m[1].split(",").map((s) => s.trim()))
    expect(names.sort()).toEqual(["getCandidateProfile", "getClientMissionDetail"])
    expect(src).not.toMatch(/\b(accept|select|confirm|complete|cancel|reject|release)\w*\s*\(/i)
    const actions = readFileSync(join(process.cwd(), "src/lib/actions/client-mission-detail.actions.js"), "utf8")
    expect(actions).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
  })

  it("page conversation : aucune mutation, aucun usage de candidat/confirmer", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(client)/client/messages/[missionId]/page.js"), "utf8")
    expect(src).not.toMatch(/candidat|confirmer/)
    expect(src).not.toMatch(/send|accept|mark/i)
  })
})

describe("QA ST-07 « Voir le profil »", () => {
  it.each([
    ["../", "..%2F"],
    ["../../admin", "..%2F..%2Fadmin"],
    ["?x=1", "%3Fx%3D1"],
    ["a b", "a%20b"],
    ["a#b", "a%23b"],
    ['"><x', "%22%3E%3Cx"],
  ])("id hostile %j encodé", (id, enc) => {
    const html = view({ student: { id, name: "Ulrich Z.", avatarUrl: null } })
    expect(html).toContain(`href="/talents/${enc}"`)
    expect(html).not.toMatch(/href="\/talents\/[^"]*[ ?#<>]/)
    expect(html).not.toContain('href="/talents/../')
  })
})

describe("QA ST-07 composeur", () => {
  it.each(["", " ", "   ", "\n", "\t", "\n\t ", " ", "​".repeat(0)])("texte %j : micro, pas d'envoi", (text) => {
    expect(hasSendableText(text)).toBe(false)
    const html = renderToStaticMarkup(<SendOrMic hasText={hasSendableText(text)} onRecord={() => {}} />)
    expect(html).toContain("Enregistrer un message vocal")
    expect(html).not.toContain("Envoyer")
  })

  it.each(["a", " a ", "\nb", "é", "0", "😀"])("texte %j : envoi, jamais désactivé", (text) => {
    expect(hasSendableText(text)).toBe(true)
    const html = renderToStaticMarkup(<SendOrMic hasText={hasSendableText(text)} onRecord={() => {}} />)
    expect(html).toContain('aria-label="Envoyer"')
    expect(html).not.toContain("disabled")
    expect(html).not.toContain("Enregistrer")
  })

  it("2500 caractères : envoyable côté bouton, la limite est portée par maxLength du champ", () => {
    expect(hasSendableText("x".repeat(2500))).toBe(true)
    expect(MESSAGE_MAX_LENGTH).toBeLessThanOrEqual(2500)
    const html = renderToStaticMarkup(<Composer onSend={() => {}} />)
    expect(html).toContain(`maxLength="${MESSAGE_MAX_LENGTH}"`)
    expect(html).toContain("Enregistrer un message vocal")
    expect(html).not.toMatch(/<button[^>]*composer__send[^>]*disabled/)
  })

  it("le composeur complet n'a plus de bouton d'envoi désactivé dans la source", () => {
    const src = readFileSync(join(process.cwd(), "src/components/client-space/messages/composer.jsx"), "utf8")
    expect(src).not.toMatch(/composer__send[^>]*disabled/)
  })

  it.each(["done", "cancelled", "rejected", "closed"])("lecture seule (%s) : pas de champ de saisie, pas de micro ni d'envoi", (state) => {
    const html = view({ state, canWrite: false })
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("Enregistrer un message vocal")
    expect(html).not.toContain('aria-label="Envoyer"')
  })

  it("en cours : champ de saisie présent", () => {
    const html = view()
    expect(html).toContain("<textarea")
  })
})

describe("QA ST-07 structure et page d'erreur", () => {
  it.each(STATES)("état %s : un seul h2, aucun h1", (state, relation) => {
    const html = view({ state, relation, canWrite: state === "in_progress" })
    expect(html.match(/<h2[\s>]/g) ?? []).toHaveLength(1)
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(0)
  })

  it("nom hostile : toujours un seul h2", () => {
    const html = view({ student: { id: S1, name: "<h1>x</h1><h2>y</h2>", avatarUrl: null } })
    expect(html.match(/<h2[\s>]/g) ?? []).toHaveLength(1)
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(0)
  })

  it.each([
    [{ error: "Boom" }],
    [{}],
    [{ conversation: null }],
  ])("page erreur %j : h2 et lien de retour /client/messages, sans h1", async (result) => {
    getClientConversation.mockResolvedValueOnce(result)
    const { default: Page } = await import("@/app/(client)/client/messages/[missionId]/page")
    const el = await Page({ params: Promise.resolve({ missionId: M1 }), searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(el)
    expect(html).toContain("<h2")
    expect(html).not.toContain("<h1")
    expect(html).toContain('href="/client/messages"')
    expect(html).toContain("Retour aux messages")
  })

  it("page nominale : transmet paymentsEnabled et rend la conversation", async () => {
    getClientConversation.mockResolvedValueOnce({ conversation: conversation() })
    const { default: Page } = await import("@/app/(client)/client/messages/[missionId]/page")
    const el = await Page({ params: Promise.resolve({ missionId: M1 }), searchParams: Promise.resolve({ studentId: ["x", "y"] }) })
    expect(getClientConversation).toHaveBeenLastCalledWith({ missionId: M1, studentId: undefined })
    expect(typeof el.props.paymentsEnabled).toBe("boolean")
  })
})

describe("QA ST-07 feuille c13.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/design/client/c13.css"), "utf8")
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))

  it("white-space: nowrap du bandeau seulement sous la classe des montants (--amounts) et pour les textes courts", () => {
    for (const r of rules) {
      if (/\.chat-status/.test(r.sel) && /nowrap/.test(r.body)) {
        expect(r.sel).toMatch(/--amounts/)
      }
    }
  })

  it("le bandeau sans montants peut passer à la ligne : pas de nowrap sur .chat-status__text seul", () => {
    const base = rules.filter((r) => /\.chat-status__text\s*$/.test(r.sel))
    for (const r of base) {
      expect(r.body).not.toMatch(/nowrap|ellipsis/)
    }
  })

  it("hauteur mobile bornée : calc(100dvh ...) et min-height, pas de hauteur fixe en px seule", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 1023.98px)"))
    expect(mobile).toMatch(/> \.conv2 \{[^}]*height: calc\(100dvh - var\(--s-2\)\)/)
    expect(mobile).toMatch(/> \.conv2 \{[^}]*min-height: 320px/)
  })

  it("env(safe-area-inset-bottom) : jamais dans la hauteur du volet ; les 2 occurrences visent des saisies exclusives", () => {
    const hits = css.match(/env\(safe-area-inset-bottom/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(1)
    const withSafe = rules.filter((r) => /safe-area/.test(r.body))
    expect(withSafe.map((r) => r.sel)).toEqual([
      ".c2 .conv2 .composer:not(.is-locked)",
      ".c2 .conv2 .composer.is-locked",
    ])
  })
})
