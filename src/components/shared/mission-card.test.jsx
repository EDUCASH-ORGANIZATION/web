import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MissionCard } from "./mission-card"

const base = {
  id: "m1",
  title: "Faire le marché",
  city: "Cotonou",
  budget: 5000,
  urgency: "low",
  created_at: new Date().toISOString(),
}

describe("MissionCard", () => {
  it("affiche le libellé du type et non la valeur en base", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Livraison" }} />)
    expect(html).toContain("Marché et achats")
    expect(html).not.toContain(">Livraison<")
  })

  it("affiche le libellé de Démarches avec la couleur de repli", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Démarches" }} />)
    expect(html).toContain("Démarches et files d&#x27;attente")
    expect(html).toContain("bg-gray-100 text-gray-600")
  })

  it("laisse l'urgence haute prendre le badge", () => {
    const html = renderToStaticMarkup(<MissionCard mission={{ ...base, type: "Livraison", urgency: "high" }} />)
    expect(html).toContain("Urgent")
    expect(html).not.toContain("Marché et achats")
  })
})
