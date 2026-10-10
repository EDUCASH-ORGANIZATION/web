import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MissionCard } from "./mission-card"

const base = { id: "m1", title: "Marché du samedi", city: "Cotonou", budget: 5000, urgency: "low" }

describe("MissionCard", () => {
  it("affiche le libellé du type et l'icône de la valeur en base", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Livraison" }} />)
    expect(html).toContain("Marché et achats")
    expect(html).not.toContain("Livraison")
    expect(html).toContain("i-receipt")
  })

  it("affiche Démarches et files d'attente pour la nouvelle valeur", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Démarches" }} />)
    expect(html).toContain("Démarches et files d&#x27;attente")
  })

  it("garde une valeur inconnue telle quelle", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Jardinage" }} />)
    expect(html).toContain("Jardinage")
  })
})
