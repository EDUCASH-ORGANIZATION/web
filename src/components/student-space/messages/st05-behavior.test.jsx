// @ds-screen RD-STUDENT-01
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/actions/message.actions", () => ({
  sendStudentMessage: vi.fn(),
  markStudentConversationRead: vi.fn(),
  getStudentConversation: vi.fn(),
  getStudentMessageMedia: vi.fn(async () => ({ media: {} })),
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages, append: vi.fn(), refreshMedia: vi.fn() }),
  useMessageMediaUpload: () => vi.fn(),
}))

const { StudentConversationView } = await import("./conversation-view")
const { StatusBanner } = await import("./status-banner")
const { Composer, SendOrMic } = await import("./composer")

const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "44444444-4444-4444-8444-444444444444"
const conversation = (over = {}) => ({
  userId: "22222222-2222-4222-8222-222222222221",
  missionId: M1,
  clientId: "33333333-3333-4333-8333-333333333331",
  client: { id: "c", name: "Rosine H.", avatarUrl: null },
  mission: { title: "Cours de maths", status: "open" },
  state: "in_progress",
  canWrite: true,
  messages: [],
  ...over,
})
const view = (over, paymentsEnabled = true) =>
  renderToStaticMarkup(<StudentConversationView conversation={conversation(over)} now="2026-10-13T12:00:00Z" paymentsEnabled={paymentsEnabled} />)
const banner = (mission, paymentsEnabled = true, state = "in_progress") =>
  renderToStaticMarkup(<StatusBanner state={state} missionId={M1} mission={mission} paymentsEnabled={paymentsEnabled} />)
const clean = (html) => {
  expect(html).not.toContain("NaN")
  expect(html).not.toContain("undefined")
  expect(html).not.toContain("null")
}
const fallbackText = "Mission en cours. Prévenez le client par message quand c&#x27;est terminé."
// Le texte saisi pilote SendOrMic par `hasText` (même calcul que le compositeur : texte non blanc).
const composer = (text) => renderToStaticMarkup(<SendOrMic hasText={Boolean(text.trim())} onRecord={vi.fn()} />)

describe("ST-05 bandeau : montants", () => {
  it("budget et net valides, paiements ouverts : « en séquestre » et le net", () => {
    const html = banner({ budget: 15000, net: 13500 })
    expect(html).toContain("en séquestre")
    expect(html.replace(/[  \s]/g, "")).toContain("13500")
    clean(html)
  })

  it("paiements fermés : jamais « séquestre »", () => {
    const html = banner({ budget: 15000, net: 13500 }, false)
    expect(html.toLowerCase()).not.toContain("séquestre")
    expect(html.toLowerCase()).not.toContain("sequestre")
    clean(html)
  })

  it.each([
    ["absent", undefined],
    ["objet vide", {}],
    ["budget chaîne", { budget: "15000", net: "13500" }],
    ["budget NaN", { budget: NaN, net: NaN }],
    ["net manquant", { budget: 15000 }],
    ["budget Infinity", { budget: Infinity, net: 10 }],
  ])("budget %s : texte d'état, sans NaN ni undefined ni montant séquestre", (_n, mission) => {
    const html = banner(mission)
    clean(html)
    expect(html).toContain(fallbackText)
    expect(html).not.toContain("en séquestre")
  })

  it.each([
    ["budget 0", { budget: 0, net: 0 }],
    ["budget négatif", { budget: -500, net: -450 }],
    ["net négatif", { budget: 500, net: -10 }],
  ])("budget %s : retombe sur le texte d'état", (_n, mission) => {
    const html = banner(mission)
    expect(html).toContain(fallbackText)
    expect(html).not.toContain("en séquestre")
  })

  it("estimation d'achats valide : badge « Avec achats » ; absente ou nulle : pas de badge", () => {
    expect(banner({ budget: 15000, net: 13500, purchasesEstimate: 4000 })).toContain("Avec achats")
    expect(banner({ budget: 15000, net: 13500, purchasesEstimate: 0 })).not.toContain("Avec achats")
    expect(banner({ budget: 15000, net: 13500, purchasesEstimate: "abc" })).not.toContain("Avec achats")
    expect(banner({ budget: 15000, net: 13500 })).not.toContain("Avec achats")
  })

  it("aucun montant hors mission en cours (candidature, terminée)", () => {
    for (const state of ["candidate", "done", "cancelled", "rejected", "closed"]) {
      const html = banner({ budget: 15000, net: 13500 }, true, state)
      expect(html).not.toContain("vous touchez")
      expect(html).not.toContain("séquestre")
    }
  })
})

describe("ST-05 composeur", () => {
  it.each(["", "   ", "\n\t  "])("texte vide ou blanc %j : micro, pas d'envoi", (t) => {
    const html = composer(t)
    expect(html).toContain('aria-label="Enregistrer un message vocal"')
    expect(html).not.toContain('aria-label="Envoyer"')
  })

  it("texte non vide : bouton d'envoi actif, micro absent", () => {
    const html = composer("Bonjour")
    expect(html).toContain('aria-label="Envoyer"')
    expect(html).not.toContain('aria-label="Enregistrer un message vocal"')
    const btn = html.match(/<button[^>]*aria-label="Envoyer"[^>]*>/)[0]
    expect(btn).not.toContain("disabled")
  })

  it("message de 2000+ caractères : bouton d'envoi présent, champ borné par maxlength", () => {
    const html = composer("a".repeat(2500))
    expect(html).toContain('aria-label="Envoyer"')
    expect(html).not.toMatch(/<button[^>]*aria-label="Envoyer"[^>]*disabled/)
    expect(renderToStaticMarkup(<Composer onSend={vi.fn()} />)).toMatch(/maxLength="\d+"|maxlength="\d+"/i)
  })
})

describe("ST-05 vue : lecture seule, titres, liens, montants", () => {
  it.each(["done", "cancelled"])("mission %s : aucune saisie", (state) => {
    const html = view({ state, canWrite: false })
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("<form")
    expect(html).not.toContain('aria-label="Envoyer"')
    expect(html).not.toContain("Enregistrer un message vocal")
    expect(html).toContain("lecture seule")
  })

  it("un seul h2 et aucun h1, même avec des messages et des montants", () => {
    const html = view({ messages: [{ id: "m", mine: false, type: "text", content: "Salut", createdAt: "2026-10-13T09:00:00Z", read: false }], mission: { title: "T", budget: 100, net: 90 } })
    expect((html.match(/<h2[\s>]/g) ?? []).length).toBe(1)
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(0)
  })

  it("« Voir la mission » pointe vers la mission de la conversation uniquement", () => {
    const html = view({ missionId: M2 })
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*Voir la mission/g)].map((m) => m[1])
    expect(links).toEqual([`/student/missions/${M2}`])
    expect(html).not.toContain(M1)
  })

  it("« vous touchez » n'apparaît que sur une mission en cours avec montants valides", () => {
    expect(view({ mission: { title: "T", budget: 100, net: 90 } })).toContain("vous touchez")
    expect(view({ state: "candidate", mission: { title: "T", budget: 100, net: 90 } })).not.toContain("vous touchez")
    expect(view({ state: "done", canWrite: false, mission: { title: "T", budget: 100, net: 90 } })).not.toContain("vous touchez")
  })
})

describe("ST-05 vue côté client : montants jamais montrés à l'autre partie", () => {
  it("les composants du côté client ne contiennent pas le texte « vous touchez »", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs")
    const { join } = await import("node:path")
    const root = join(process.cwd(), "src/components")
    const hits = []
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(jsx|js)$/.test(f) && !/\.test\./.test(f) && /vous touchez/.test(readFileSync(p, "utf8"))) hits.push(p.replace(process.cwd() + "/", ""))
      }
    }
    walk(root)
    expect(hits.filter((p) => /client-space/.test(p))).toEqual([])
  })
})
