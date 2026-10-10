import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({
  Select: ({ id, name }) => <select id={id} name={name} />,
}))

const { HomeHero } = await import("./home-hero")

const html = renderToStaticMarkup(<HomeHero role={null} />)
const visual = html.slice(html.indexOf('class="v-hero__visual"'))

// Texte visible et attributs de libellé : les valeurs en base des URL (type=Livraison) sont hors périmètre.
function visibleText(markup) {
  return markup.replace(/ (href|src|srcSet|action|id|for|name)="[^"]*"/g, "").replace(/<[^>]+>/g, " ")
}

function forms(markup) {
  return [...markup.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0])
}

describe("HomeHero visuel", () => {
  it("l'aplat citron contient le picture, et le push vient après", () => {
    const flat = visual.indexOf('class="photo-ph"')
    const picture = visual.indexOf('<picture class="v-hero__picture">')
    const push = visual.indexOf("v-hero__push")
    expect(flat).toBeGreaterThan(-1)
    expect(picture).toBeGreaterThan(flat)
    expect(push).toBeGreaterThan(picture)
  })

  it("charge le portrait client, réservé aux écrans larges, avec un pixel de repli", () => {
    expect(visual).toContain('media="(min-width: 1024px)"')
    expect(visual).toContain('srcSet="/images/clients/portrait-client.webp"')
    expect(visual).toContain('src="data:image/gif;base64,')
    expect(visual).toContain('width="562"')
    expect(visual).toContain('height="920"')
    expect(visual).toContain('fetchPriority="high"')
    expect(html).not.toContain("portrait-hero")
  })

  it("garde la notification, la carte, la pastille tournante et l'étincelle", () => {
    expect(visual).toContain("Afiavi a terminé votre marché")
    expect(visual).toContain("Vérifiez, puis validez pour la payer")
    expect(visual).toContain("Bloqué jusqu’à votre validation")
    expect(visual).toContain("Cours de maths 3e")
    expect(visual).toContain("#roundel")
    expect(visual).toContain("#sc-burst")
  })
})

describe("HomeHero texte", () => {
  it("porte le titre, vouvoie et n'emploie aucun mot banni", () => {
    expect(html).toContain("Votre temps")
    expect(html).toContain("est précieux.")
    expect(html).toContain("Déléguez.")
    const text = visibleText(html)
    expect(text).not.toMatch(/livraison|course|coursier|saisie/i)
    expect(text).not.toMatch(/(?<![\p{L}])(ton|ta|tes|tu|toi)(?![\p{L}])/iu)
  })
})

describe("HomeHero formulaires", () => {
  const found = forms(html)

  it("y a un formulaire bureau et un formulaire mobile", () => {
    expect(found).toHaveLength(2)
  })

  it.each([0, 1])("le formulaire %i envoie besoin et ville vers la publication", (i) => {
    expect(found[i]).toContain('action="/client/missions/new"')
    expect(found[i]).toContain('method="get"')
    expect(found[i]).toContain('name="besoin"')
    expect(found[i]).toContain('maxLength="80"')
    expect(found[i]).toContain('name="ville"')
    expect(found[i]).toContain(">Publier</button>")
  })

  it("ne cherche plus dans /missions", () => {
    expect(html).not.toContain('action="/missions"')
  })

  it("nomme le champ « De quoi avez-vous besoin ? »", () => {
    expect(html).toContain("De quoi avez-vous besoin")
  })
})

describe("HomeHero liens", () => {
  it("les idées ouvrent la publication avec le type, libellé du dictionnaire", () => {
    expect(html).toContain('href="/client/missions/new?type=Livraison" class="chip chip--sm">Marché et achats<')
    expect(html).toContain('type=Cours+particuliers" class="chip chip--sm">Cours et aide aux devoirs<')
    expect(html).toContain('type=Babysitting" class="chip chip--sm">Garde d&#x27;enfants<')
    expect(html).toContain('type=Saisie" class="chip chip--sm">Travaux sur ordinateur<')
  })

  it("invite les étudiants vers /etudiants", () => {
    expect(html).toContain('href="/etudiants"')
    expect(html).toContain("Vous êtes étudiant")
    expect(html).not.toContain("/student/missions")
  })

  it("propose aux étudiants connectés de voir leurs missions", () => {
    const student = renderToStaticMarkup(<HomeHero role="student" />)
    expect(student).toContain('href="/student/missions"')
    expect(student).toContain("Voir les missions pour moi")
  })
})
