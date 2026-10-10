import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({
  Select: ({ id, name }) => <select id={id} name={name} />,
}))

const { EtudiantsHero } = await import("./etudiants-hero")

const html = renderToStaticMarkup(<EtudiantsHero live={false} openMissions={0} role={null} />)

describe("EtudiantsHero", () => {
  it("titre tutoyé", () => {
    expect(html).toContain("Bosse entre")
    expect(html).toContain("deux cours.")
    expect(html).toContain("Encaisse.")
  })

  it("photo de l'étudiante : source 1024, dimensions 644 x 1100, aplat citron", () => {
    expect(html).toContain('class="photo-ph"')
    expect(html).toContain('media="(min-width: 1024px)"')
    expect(html).toContain('srcSet="/images/hero/portrait-hero.webp"')
    expect(html).toContain('width="644"')
    expect(html).toContain('height="1100"')
  })

  it("recherche GET vers /missions avec q et ville", () => {
    expect(html).toContain('action="/missions"')
    expect(html).toContain('method="get"')
    expect(html).toContain('name="q"')
    expect(html).toContain('name="ville"')
  })

  it("puces populaires : libellé affiché, valeur en base dans le lien", () => {
    expect(html).toContain('href="/missions?type=Livraison"')
    expect(html).toContain(">Marché et achats<")
    expect(html).toContain('href="/missions?type=Babysitting"')
    expect(html).toContain(">Garde d&#x27;enfants<")
    expect(html).not.toContain(">Livraison<")
    expect(html).not.toContain(">Saisie<")
  })

  it("trois opérateurs cités, pas de prestataire de paiement nommé", () => {
    expect(html).toContain("MTN MoMo")
    expect(html).toContain("Moov Money")
    expect(html).toContain("Celtiis Cash")
    expect(html).not.toMatch(/fedapay/i)
  })

  it("visiteur : Créer mon compte en principal, Voir les missions en secondaire", () => {
    expect(html).toContain("Créer mon compte")
    expect(html).toContain("Voir les missions")
  })

  it("étudiant connecté : pas de création de compte", () => {
    const logged = renderToStaticMarkup(<EtudiantsHero live openMissions={7} role="student" />)
    expect(logged).toContain("Voir les missions pour moi")
    expect(logged).not.toContain("Créer mon compte")
    expect(logged).toContain("<b>7</b>missions ouvertes en ce moment")
  })
})
