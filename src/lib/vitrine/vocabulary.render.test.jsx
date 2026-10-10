import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MISSION_TYPE_LABELS } from "@/lib/constants/missions"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal()), preload: vi.fn() }))
vi.mock("@/components/design/select", () => ({
  Select: ({ id, name }) => <select id={id} name={name} />,
}))

const { HomeHero } = await import("@/components/vitrine/home/home-hero")
const { HomeProofs } = await import("@/components/vitrine/home/home-proofs")
const { HomeCatalog } = await import("@/components/vitrine/home/home-catalog")
const { HomeAchats } = await import("@/components/vitrine/home/home-achats")
const { HomeSteps } = await import("@/components/vitrine/home/home-steps")
const { HomeTrust } = await import("@/components/vitrine/home/home-trust")
const { EtudiantsHero } = await import("@/components/vitrine/etudiants/etudiants-hero")
const { EtudiantsProofs } = await import("@/components/vitrine/etudiants/etudiants-proofs")
const { EtudiantsPreview } = await import("@/components/vitrine/etudiants/etudiants-preview")
const { EtudiantsGains } = await import("@/components/vitrine/etudiants/etudiants-gains")
const { EtudiantsSteps } = await import("@/components/vitrine/etudiants/etudiants-steps")
const { EtudiantsRetrait } = await import("@/components/vitrine/etudiants/etudiants-retrait")
const { EtudiantsServices } = await import("@/components/vitrine/etudiants/etudiants-services")
const { EtudiantsFaq } = await import("@/components/vitrine/etudiants/etudiants-faq")
const { EtudiantsClosing } = await import("@/components/vitrine/etudiants/etudiants-closing")
const { VitrineFooter } = await import("@/components/vitrine/vitrine-footer")

// Mission dont la valeur en base est "Livraison" : seul le libellé du dictionnaire doit s'afficher.
const MISSION = { id: "m1", title: "Faire le marché", type: "Livraison", city: "Cotonou", budget: 3000, urgency: "normal", deadline: null, created_at: "2026-10-01T10:00:00Z" }

// Texte visible : balises et attributs retirés (les valeurs en base des URL type=Livraison restent hors périmètre).
function text(node) {
  return renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/&rsquo;|&#x27;/g, "'").replace(/\s+/g, " ")
}

const BANNED = /livraisons?|coursiers?|\bcourses?\b|saisies?\b|fedapay|bient[ôo]t/i

const PAGES = {
  "accueil": [
    <HomeHero key="a" role={null} />,
    <HomeProofs key="b" />,
    <HomeCatalog key="c" />,
    <HomeAchats key="d" />,
    <HomeSteps key="e" />,
    <HomeTrust key="f" />,
  ],
  "etudiants": [
    <EtudiantsHero key="a" live={false} openMissions={0} role={null} />,
    <EtudiantsProofs key="b" rating={null} />,
    <EtudiantsPreview key="c" missions={[MISSION]} openCount={1} error={false} cta={{ href: "/auth/register?role=student", label: "Créer mon compte" }} />,
    <EtudiantsGains key="d" />,
    <EtudiantsSteps key="e" />,
    <EtudiantsRetrait key="f" />,
    <EtudiantsServices key="g" />,
    <EtudiantsFaq key="h" />,
    <EtudiantsClosing key="i" role={null} />,
  ],
  "pied de page": [<VitrineFooter key="a" />, <VitrineFooter key="b" audience="etudiants" />],
}

describe("vocabulaire rendu de la vitrine", () => {
  it.each(Object.entries(PAGES))("%s : aucun mot banni dans le texte rendu", (_name, nodes) => {
    const rendered = nodes.map(text).join(" ")
    expect(rendered.length).toBeGreaterThan(500)
    expect(rendered.match(BANNED)).toBeNull()
  })

  it("une mission Livraison s'affiche avec son libellé dans l'aperçu de /etudiants", () => {
    const rendered = text(PAGES.etudiants[2])
    expect(rendered).toContain(MISSION_TYPE_LABELS.Livraison)
    expect(rendered).toContain("Marché et achats")
  })

  it("l'accueil propose Marché et achats", () => {
    expect(text(PAGES.accueil[2])).toContain("Marché et achats")
  })

  it("Celtiis Cash est listé avec les autres opérateurs, sans 'Bientôt'", () => {
    for (const node of [PAGES.accueil[1], PAGES.etudiants[1], PAGES.etudiants[5]]) {
      const rendered = renderToStaticMarkup(node)
      expect(rendered).toMatch(/Celtiis/)
    }
  })
})
