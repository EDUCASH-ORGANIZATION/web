import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ResumePublishLink, ResumePublishView } from "./resume-publish-link"

describe("ResumePublishLink", () => {
  it("ne rend rien tant que rien de valide n'est stocké (rendu serveur)", () => {
    expect(renderToStaticMarkup(<ResumePublishLink mode="show" />)).toBe("")
    expect(renderToStaticMarkup(<ResumePublishLink mode="store" href="/client/missions/new?besoin=x" />)).toBe("")
  })

  it("rend le lien de reprise vouvoyé pour une valeur valide", () => {
    const html = renderToStaticMarkup(
      <ResumePublishView href="/client/missions/new?besoin=Repas&ville=Cotonou" onForget={() => {}} />,
    )
    expect(html).toContain("Reprendre la publication de votre mission")
    expect(html).toContain('href="/client/missions/new?besoin=Repas&amp;ville=Cotonou"')
    expect(html).toContain("Oublier la publication en cours")
  })

  it("ne rend rien sans lien", () => {
    expect(renderToStaticMarkup(<ResumePublishView href={null} onForget={() => {}} />)).toBe("")
  })
})
