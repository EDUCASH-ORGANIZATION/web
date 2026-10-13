import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MoneyCard } from "./money-card"

describe("MoneyCard titre", () => {
  const html = renderToStaticMarkup(<MoneyCard title="Votre argent · 66 500 FCFA au total" available={1} escrow={2} />)

  it("colle le séparateur au mot suivant sans changer le texte rendu", () => {
    expect(html).toContain('<span class="money2__glue">· 66</span>')
    expect(html.replace(/<[^>]+>/g, "")).toContain("Votre argent · 66 500 FCFA au total")
  })

  it("laisse un titre sans séparateur intact", () => {
    const out = renderToStaticMarkup(<MoneyCard title="Votre argent" available={1} escrow={2} />)
    expect(out).not.toContain("money2__glue")
    expect(out).toContain("Votre argent")
  })

  it("accepte un titre qui n'est pas une chaîne sans lever d'erreur", () => {
    const out = renderToStaticMarkup(<MoneyCard title={<b>Total</b>} available={1} escrow={2} />)
    expect(out).toContain("<b>Total</b>")
    expect(out).not.toContain("money2__glue")
    expect(renderToStaticMarkup(<MoneyCard title={12} available={1} escrow={2} />)).toContain(">12<")
  })
})
