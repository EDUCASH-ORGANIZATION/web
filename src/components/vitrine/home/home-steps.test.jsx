import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { HomeSteps } from "./home-steps"

const html = renderToStaticMarkup(<HomeSteps />)

describe("HomeSteps", () => {
  it("garde l'ancre etapes et les trois étapes client", () => {
    expect(html).toContain('id="etapes"')
    expect(html).toContain("Publiez votre besoin")
    expect(html).toContain("Choisissez un étudiant vérifié")
    expect(html).toContain("Validez pour payer")
    expect(html).toContain("Aucune avance.")
    expect(html).toContain("rechargé par Mobile Money")
  })

  it("n'a plus d'onglets, ne nomme pas le prestataire et ne promet rien d'automatique", () => {
    expect(html).not.toContain('role="tab')
    expect(html).not.toContain("segmented")
    expect(html).not.toMatch(/FedaPay|Je suis étudiant/)
    expect(html).toContain("Rien d’automatique")
  })
})
