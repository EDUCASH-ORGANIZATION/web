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

describe("MoneyCard : défauts inchangés et libellé surchargeable", () => {
  // Rendus consignés avant la revue des textes figés (version du sprite normalisée).
  const BEFORE_SIMPLE = "<section class=\"money2\" aria-label=\"Votre argent\"><span class=\"hero2__label\">Votre argent</span><div class=\"hero2__figure\">1 500<small>FCFA</small></div><p class=\"hero2__meta\">n</p></section>"
  const BEFORE_SPLIT = "<section class=\"money2 money2--split\" aria-label=\"Votre argent\"><div class=\"money2__head\"><span>Votre argent</span><a class=\"btn btn--blanc btn--sm\" href=\"/w\">Retirer</a></div><div class=\"stat2\"><span class=\"stat2__label\">Disponible</span><span class=\"stat2__value\">1 000<small>FCFA</small></span></div><div class=\"stat2\"><span class=\"stat2__label\">En séquestre</span><span class=\"stat2__value\">500<small>FCFA</small></span></div><div class=\"money2__foot\"><span class=\"money2__hint\">h</span></div></section>"
  const strip = (html) => html.replace(/\?v=[0-9a-f]+/g, "?v=V")

  it("variante simple sans label : égale au rendu d'avant, libellé « Votre argent »", () => {
    expect(strip(renderToStaticMarkup(<MoneyCard amount={1500} note="n" />))).toBe(BEFORE_SIMPLE)
  })

  it("variante partagée sans label : égale au rendu d'avant", () => {
    const out = renderToStaticMarkup(<MoneyCard available={1000} escrow={500} action={{ label: "Retirer", href: "/w" }} hint="h" />)
    expect(strip(out)).toBe(BEFORE_SPLIT)
  })

  it("le label remplace le défaut dans les deux variantes et dans aria-label", () => {
    const simple = renderToStaticMarkup(<MoneyCard label="Libellé neutre" amount={1500} />)
    expect(simple).toContain('aria-label="Libellé neutre"')
    expect(simple).toContain('<span class="hero2__label">Libellé neutre</span>')
    expect(simple).not.toContain("Votre argent")
    const split = renderToStaticMarkup(<MoneyCard label="Libellé neutre" available={1} escrow={2} />)
    expect(split).toContain("<span>Libellé neutre</span>")
    expect(split).not.toContain("Votre argent")
  })

  it("aucun autre texte vouvoyé figé : seul le défaut du label porte « Votre »", async () => {
    const source = (await import("node:fs")).readFileSync(new URL("./money-card.jsx", import.meta.url), "utf8")
    const code = source.split("\n").filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    const hits = code.filter((line) => /\b(?:vous|votre|vos|veuillez)\b/i.test(line))
    expect(hits).toEqual(['  label = "Votre argent",'])
  })
})
