import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/hooks/use-modal-focus", () => ({ useModalFocus: () => {} }))

const { SiteMenu } = await import("./site-menu")

const session = { user: null, fullName: null, spaceHref: "/dashboard", signOut: vi.fn() }

function render(audience, links) {
  return renderToStaticMarkup(
    <SiteMenu
      id="site-menu"
      links={links}
      isActive={() => false}
      session={session}
      audience={audience}
      publishHref="/client/missions/new"
      onClose={() => {}}
      returnFocusRef={{ current: null }}
    />,
  )
}

describe("SiteMenu", () => {
  it("clients : liens reçus, lien étudiant, sans Comment ça marche", () => {
    const html = render("clients", [
      { label: "Services", href: "/#services" },
      { label: "Aide", href: "/aide" },
      { label: "Vous êtes étudiant ?", href: "/etudiants", switchAudience: true },
    ])
    expect(html).toContain("Vous êtes étudiant ?")
    expect(html).toContain("Publier une mission")
    expect(html).not.toContain("Comment ça marche")
    expect(html).not.toContain("Vous avez une mission ?")
  })

  it("étudiants : lien de retour vers les clients, sans Comment ça marche", () => {
    const html = render("etudiants", [
      { label: "Missions", href: "/missions" },
      { label: "Aide", href: "/aide" },
      { label: "Vous avez une mission ?", href: "/", switchAudience: true },
    ])
    expect(html).toContain("Vous avez une mission ?")
    expect(html).toContain("Créer mon compte")
    expect(html).not.toContain("Comment ça marche")
    expect(html).not.toContain("Vous êtes étudiant ?")
  })
})
