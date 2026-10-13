import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

let actionState = null

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useActionState: (action) => [actionState, action, false] }
})
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("@/hooks/use-vitrine-session", () => ({
  useVitrineSession: () => ({ user: null, role: null, fullName: null, avatarUrl: null, initials: "?", spaceHref: "/dashboard", signOut: vi.fn() }),
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({
  Select: ({ id, name }) => <select id={id} name={name} />,
}))
vi.mock("@/lib/actions/publish-waitlist.actions", () => ({ notifyPublishOpening: vi.fn() }))

const { PublishNotifyForm } = await import("./publish-notify-form")
const { PublishPaused } = await import("./publish-paused")
const { HomeHero } = await import("@/components/vitrine/home/home-hero")
const { HomeCatalog } = await import("@/components/vitrine/home/home-catalog")
const { VitrineNavbar } = await import("@/components/vitrine/vitrine-navbar")
const { VitrineFooter } = await import("@/components/vitrine/vitrine-footer")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&rsquo;|\u2019/g, "'").replace(/\s+/g, " ")
const BANNED = /livraison|course|coursier|saisie|bientôt|fedapay/i

beforeEach(() => {
  actionState = null
  vi.stubEnv("PAYMENTS_ENABLED", "false")
})
afterEach(() => vi.unstubAllEnvs())

describe("PublishNotifyForm", () => {
  it("rend un formulaire à action serveur avec champ email, honeypot et bouton inactif au rendu serveur", () => {
    const html = renderToStaticMarkup(<PublishNotifyForm />)
    expect(html).not.toMatch(/method="get"/i)
    expect(html).toContain('name="email"')
    expect(html).toContain('name="website"')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
    expect(html).toContain("Prévenez-moi")
  })

  it("variante espace connecté : Tailwind, sans classes du système", () => {
    const html = renderToStaticMarkup(<PublishNotifyForm variant="app" />)
    expect(html).toContain("rounded-xl")
    expect(html).not.toContain('class="field"')
    expect(html).not.toContain("auth__form")
  })

  it("affiche l'erreur de format sous le champ", () => {
    actionState = { fieldErrors: { email: "Cette adresse email n'est pas valide." } }
    const html = renderToStaticMarkup(<PublishNotifyForm />)
    expect(html).toContain("input is-error")
    expect(text(html)).toContain("n'est pas valide")
  })

  it("affiche la limite atteinte sans durée", () => {
    actionState = { code: "rate_limited", formError: "Trop de demandes. Réessayez dans quelques minutes." }
    expect(text(renderToStaticMarkup(<PublishNotifyForm />))).toContain("Trop de demandes")
  })

  it("confirme l'envoi, vouvoie et ne montre plus le formulaire", () => {
    actionState = { status: "sent" }
    const html = renderToStaticMarkup(<PublishNotifyForm />)
    expect(text(html)).toContain("Merci, c'est noté")
    expect(text(html)).toMatch(/vous écrivons/)
    expect(html).not.toContain("<form")
  })

  it("aucun tutoiement", () => {
    for (const state of [null, { status: "sent" }, { fieldErrors: { email: "x" } }]) {
      actionState = state
      expect(text(renderToStaticMarkup(<PublishNotifyForm />))).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
    }
  })
})

describe("PublishPaused", () => {
  const html = renderToStaticMarkup(<PublishPaused />)

  it("annonce la publication en cours d'activation avec le formulaire Prévenez-moi", () => {
    expect(text(html)).toContain("en cours d'activation")
    expect(html).toContain('name="email"')
    expect(text(html)).toContain("Prévenez-moi")
  })

  it("garde la promesse du séquestre, formulée comme le fonctionnement à l'ouverture", () => {
    expect(text(html)).toMatch(/À l'ouverture, le budget est bloqué en séquestre/)
    expect(text(html)).toMatch(/bloqué jusqu'à ce que vous validiez/)
  })

  it("vouvoie, sans mot banni ni tiret cadratin", () => {
    expect(text(html)).not.toMatch(BANNED)
    expect(text(html)).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
    expect(html).not.toContain("\u2014")
  })
})

describe("vitrine, paiements coupés", () => {
  it("le hero envoie ses formulaires et ses idées vers l'écran de pause", () => {
    const html = renderToStaticMarkup(<HomeHero role={null} />)
    const forms = [...html.matchAll(/<form[^>]*>/g)].map((m) => m[0])
    expect(forms).toHaveLength(2)
    for (const f of forms) expect(f).toContain('action="/publication"')
    expect(html).not.toContain("/client/missions/new")
    expect(html).toContain('href="/publication" class="chip chip--sm">Marché et achats<')
    expect(html).toContain('name="besoin"')
  })

  it("les cartes de services mènent à l'écran de pause, ancre conservée", () => {
    const html = renderToStaticMarkup(<HomeCatalog />)
    expect(html).toContain('id="services"')
    expect(html).not.toContain("/client/missions/new")
    const links = [...html.matchAll(/<a href="([^"]*)"[^>]*class="v-cat/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(5)
    expect(new Set(links)).toEqual(new Set(["/publication"]))
    expect(text(html)).toContain("en cours d'activation")
    expect(text(html)).not.toMatch(BANNED)
  })

  it("l'en-tête et le pied de page mènent à l'écran de pause", () => {
    const navbar = renderToStaticMarkup(<VitrineNavbar />)
    expect(navbar).toContain('href="/publication"')
    expect(navbar).not.toContain("/client/missions/new")
    expect(navbar.match(/href="\/publication"/g)).toHaveLength(2)
    const footer = renderToStaticMarkup(<VitrineFooter />)
    expect(footer).toContain('<a href="/publication">Publier une mission</a>')
  })
})

describe("vitrine, paiements ouverts", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", "true"))

  it("rend le comportement actuel avec pré-remplissage", () => {
    const hero = renderToStaticMarkup(<HomeHero role={null} />)
    expect(hero).toContain('action="/client/missions/new"')
    expect(hero).toContain('href="/client/missions/new?type=Livraison"')
    expect(renderToStaticMarkup(<HomeCatalog />)).toContain('href="/client/missions/new?type=Cours+particuliers"')
    expect(renderToStaticMarkup(<VitrineNavbar />)).toContain('href="/client/missions/new"')
    expect(renderToStaticMarkup(<VitrineFooter />)).toContain('<a href="/client/missions/new">Publier une mission</a>')
  })
})
