import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { user: null, role: null }
const seen = { hero: null, navbar: null, page: null }

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null }) }),
      }),
    }),
  }),
}))
vi.mock("@/components/vitrine/shared/vitrine-page", () => ({
  VitrinePage: ({ children, navbar, before, ...rest }) => {
    seen.page = rest
    return <div>{navbar}{before}<main>{children}</main></div>
  },
}))
vi.mock("@/components/vitrine/vitrine-navbar", () => ({
  VitrineNavbar: (props) => {
    seen.navbar = props
    return <nav />
  },
}))
vi.mock("@/components/vitrine/home/home-hero", () => ({
  HomeHero: (props) => {
    seen.hero = props
    return <div data-hero />
  },
}))
vi.mock("@/components/vitrine/home/home-proofs", () => ({ HomeProofs: () => <div data-proofs /> }))
vi.mock("@/components/vitrine/home/home-catalog", () => ({ HomeCatalog: () => <section id="services" /> }))
vi.mock("@/components/vitrine/home/home-achats", () => ({ HomeAchats: () => <section id="achats" /> }))
vi.mock("@/components/vitrine/shared/hash-scroll", () => ({ HashScroll: () => null }))

const { default: HomePage, metadata } = await import("./page")

async function render(user, role) {
  state.user = user
  state.role = role
  return renderToStaticMarkup(await HomePage())
}

beforeEach(() => {
  seen.hero = null
  seen.navbar = null
  seen.page = null
})

describe("accueil clients", () => {
  it("visiteur : rôle null transmis au hero, audience clients, inscription client", async () => {
    const html = await render(null, null)
    expect(seen.hero).toEqual({ role: null })
    expect(seen.page.audience).toBe("clients")
    expect(seen.navbar).toMatchObject({ tone: "bleu", audience: "clients" })
    expect(html).toContain('href="/auth/register?role=client"')
  })

  it("client : rôle transmis et publication directe", async () => {
    const html = await render({ id: "u1" }, "client")
    expect(seen.hero).toEqual({ role: "client" })
    expect(html).toContain('href="/client/missions/new"')
    expect(html).not.toContain("/auth/register?role=client")
  })

  it("étudiant : rôle transmis, le bloc étudiant mène à /etudiants", async () => {
    const html = await render({ id: "u2" }, "student")
    expect(seen.hero).toEqual({ role: "student" })
    expect(html).toContain('href="/etudiants"')
  })

  it("rend les sections attendues et les ancres figées", async () => {
    const html = await render(null, null)
    for (const id of ["services", "achats", "etapes", "confiance"]) expect(html).toContain(`id="${id}"`)
    expect(html).not.toContain('id="entreprises"')
    expect(html.match(/id="achats"/g)).toHaveLength(1)
  })

  it("FAQ de 5 questions et bloc étudiant vouvoyé", async () => {
    const html = await render(null, null)
    expect(html.match(/<summary class="v-faq__q">/g)).toHaveLength(5)
    expect(html).toContain("Vous êtes étudiant")
    expect(html).toContain("encaissez")
    expect(html).not.toMatch(/Tu es étudiant|encaisse\./)
  })

  it("aucun lien /clients, aucun mot banni, aucun prestataire nommé", async () => {
    const html = await render(null, null)
    expect(html).not.toMatch(/href="\/clients/)
    expect(html).not.toMatch(/livraison|coursier|saisie|FedaPay/i)
    expect(html).not.toMatch(/\bcourses?\b/i)
    expect(html).not.toContain("—")
  })

  it("métadonnées vouvoyées sans prestataire", () => {
    const text = JSON.stringify(metadata)
    expect(metadata.title.absolute).toBe("EduCash - Des étudiants vérifiés pour vos petites missions au Bénin")
    expect(text).not.toMatch(/FedaPay|ta fac|ton MoMo/)
  })
})
