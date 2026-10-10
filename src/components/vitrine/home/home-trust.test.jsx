import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { HomeTrust } from "./home-trust"

const html = renderToStaticMarkup(<HomeTrust />)

describe("HomeTrust", () => {
  it("rend quatre garanties avec la médiation via Contact", () => {
    expect(html.match(/class="v05-g /g)).toHaveLength(4)
    expect(html).toContain("page Contact")
    expect(html).toContain("médiation")
  })

  it("ne promet aucun délai, aucune facture ni confidentialité", () => {
    expect(html).not.toMatch(/\d+\s?h\b|24 h|sous \d|facture|confidentialit/i)
  })
})
