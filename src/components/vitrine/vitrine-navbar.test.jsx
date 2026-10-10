import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const state = vi.hoisted(() => ({ pathname: "/", session: null }))
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }))
vi.mock("@/hooks/use-vitrine-session", () => ({ useVitrineSession: () => state.session }))

const { VitrineNavbar } = await import("./vitrine-navbar")

const visitor = { user: null, role: null, fullName: null, avatarUrl: null, initials: "?", spaceHref: "/dashboard", signOut: vi.fn() }
const client = { ...visitor, user: { id: "c" }, role: "client", fullName: "Awa Client", initials: "A", spaceHref: "/client/dashboard" }
const student = { ...visitor, user: { id: "s" }, role: "student", fullName: "Koffi Etudiant", initials: "K", spaceHref: "/dashboard" }

function render(props, session = visitor, pathname = "/") {
  state.session = session
  state.pathname = pathname
  return renderToStaticMarkup(<VitrineNavbar {...props} />)
}

describe("VitrineNavbar", () => {
  beforeEach(() => {
    state.session = visitor
    state.pathname = "/"
  })

  it("public clients par défaut : Services et Aide, lien étudiant, connexion et un seul bouton accent", () => {
    const html = render()
    expect(html).toContain('href="/#services"')
    expect(html).toContain('href="/aide"')
    expect(html).toContain("Vous êtes étudiant ?")
    expect(html).toContain('href="/etudiants"')
    expect(html).toContain("Se connecter")
    expect(html.match(/btn--accent/g)).toHaveLength(1)
    expect(html).toContain('href="/client/missions/new"')
    expect(html).toContain("Publier une mission")
    expect(html).not.toContain("Créer un compte")
  })

  it("n'a plus Comment ça marche, ni Missions côté clients, ni Pour les clients, Entreprises, /clients", () => {
    const html = render()
    expect(html).not.toContain("Comment ça marche")
    expect(html).not.toContain("#etapes")
    expect(html).not.toContain('href="/missions"')
    expect(html).not.toContain('href="/clients"')
    expect(html).not.toContain("Pour les clients")
    expect(html).not.toContain("Entreprises")
  })

  it("mobile clients : bouton Publier", () => {
    const html = render()
    expect(html).toContain('class="btn btn--primary btn--sm ds-mob-only">Publier</a>')
  })

  it("public etudiants : Missions et Aide, Se connecter, Créer mon compte, sans lien vers Services", () => {
    const html = render({ audience: "etudiants" }, visitor, "/etudiants")
    expect(html).toContain('href="/missions"')
    expect(html).toContain('href="/aide"')
    expect(html).not.toContain('href="/#services"')
    expect(html).not.toContain("Comment ça marche")
    expect(html).toContain("Se connecter")
    expect(html).toContain("Créer mon compte")
    expect(html).toContain("S’inscrire")
    expect(html).toContain('href="/auth/register?role=student"')
    expect(html).not.toContain("Publier une mission")
    expect(html).not.toContain("Vous êtes étudiant ?")
    expect(html.match(/btn--accent/g)).toHaveLength(1)
  })

  it("public etudiants : Missions est actif sur /missions", () => {
    const html = render({ audience: "etudiants" }, visitor, "/missions")
    expect(html).toMatch(/<a href="\/missions"[^>]*aria-current="page"[^>]*>Missions<\/a>/)
  })

  it("public etudiants : Missions reste actif sur le détail d'une mission, pas sur /aide ni /missionsx", () => {
    const detail = render({ audience: "etudiants" }, visitor, "/missions/abc")
    expect(detail).toMatch(/<a href="\/missions"[^>]*aria-current="page"[^>]*>Missions<\/a>/)
    const aide = render({ audience: "etudiants" }, visitor, "/aide")
    expect(aide).not.toMatch(/<a href="\/missions"[^>]*aria-current/)
    expect(aide).toMatch(/<a href="\/aide"[^>]*aria-current="page"/)
    const other = render({ audience: "etudiants" }, visitor, "/missionsx")
    expect(other).not.toMatch(/<a href="\/missions"[^>]*aria-current/)
  })

  // Extrait les libellés du bloc de navigation principale, dans l'ordre d'affichage.
  function navLabels(html) {
    const nav = html.match(/<nav class="site-header__nav[^>]*>(.*?)<\/nav>/)[1]
    return [...nav.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1])
  }

  it("clients : Services, Aide, À propos, Contact dans cet ordre", () => {
    const html = render({}, visitor, "/")
    expect(navLabels(html)).toEqual(["Services", "Aide", "À propos", "Contact"])
    expect(html).toContain('href="/about"')
    expect(html).toContain('href="/contact"')
  })

  it("étudiants : Missions, Aide, À propos, Contact dans cet ordre", () => {
    const html = render({ audience: "etudiants" }, visitor, "/etudiants")
    expect(navLabels(html)).toEqual(["Missions", "Aide", "À propos", "Contact"])
  })

  it("À propos et Contact sont actifs sur leur page seulement", () => {
    const about = render({}, visitor, "/about")
    expect(about).toMatch(/<a href="\/about"[^>]*aria-current="page"[^>]*>À propos<\/a>/)
    expect(about).not.toMatch(/<a href="\/contact"[^>]*aria-current/)
    const contact = render({ audience: "etudiants" }, visitor, "/contact")
    expect(contact).toMatch(/<a href="\/contact"[^>]*aria-current="page"[^>]*>Contact<\/a>/)
    expect(contact).not.toMatch(/<a href="\/about"[^>]*aria-current/)
  })

  it("client connecté : Publier une mission puis Mon espace", () => {
    const html = render({}, client)
    expect(html.indexOf("Publier une mission")).toBeGreaterThan(-1)
    expect(html.indexOf("Publier une mission")).toBeLessThan(html.indexOf("Mon espace"))
    expect(html).not.toContain("Se connecter")
    expect(html).not.toContain("Voir les missions pour moi")
  })

  it("étudiant connecté : Voir les missions pour moi vers /student/missions", () => {
    const html = render({}, student)
    expect(html).toContain("Voir les missions pour moi")
    expect(html).toContain('href="/student/missions"')
    expect(html).not.toContain("Publier une mission")
    expect(html.indexOf("Voir les missions pour moi")).toBeLessThan(html.indexOf("Mon espace"))
  })
})
