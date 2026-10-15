import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import AdminError from "./error.js"

describe("erreur de l'espace admin", () => {
  const html = renderToStaticMarkup(<AdminError error={{ digest: "abc" }} reset={() => {}} />)

  it("annonce l'erreur, propose de réessayer et de revenir au tableau de bord", () => {
    expect(html).toContain('role="alert"')
    expect(html).toContain("Une erreur est survenue")
    expect(html).toContain("Réessayer")
    expect(html).toContain('href="/admin/dashboard"')
  })

  it("ne promet pas qu'aucune décision n'a été enregistrée, et invite à vérifier la file", () => {
    expect(html).not.toMatch(/Aucune décision/)
    expect(html).toContain("Si vous veniez de décider, rechargez la file pour vérifier.")
  })
})
