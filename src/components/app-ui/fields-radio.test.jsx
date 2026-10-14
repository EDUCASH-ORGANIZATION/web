import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { RadioGroupField } from "./fields"

const OPTIONS = [
  { value: "floue", label: "Photo floue" },
  { value: "autre", label: "Autre motif", help: "Précisez le motif." },
]

describe("RadioGroupField", () => {
  it("rend un fieldset avec legend et des radios natives de même nom", () => {
    const html = renderToStaticMarkup(<RadioGroupField id="g" legend="Motif" name="reason" options={OPTIONS} value="" />)
    expect(html).toMatch(/^<fieldset[^>]*id="g"/)
    expect(html).toContain('<legend class="field__label">Motif</legend>')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html.match(/name="reason"/g)).toHaveLength(2)
    expect(html).toContain('for="g-floue"')
  })

  it("une seule valeur cochée", () => {
    const html = renderToStaticMarkup(<RadioGroupField id="g" legend="Motif" name="reason" options={OPTIONS} value="autre" />)
    expect(html.match(/checked=""/g)).toHaveLength(1)
    expect(html).toMatch(/id="g-autre"[^>]*checked=""|checked=""[^>]*id="g-autre"/)
  })

  it("l'erreur est annoncée et reliée au groupe", () => {
    const html = renderToStaticMarkup(
      <RadioGroupField id="g" legend="Motif" name="reason" options={OPTIONS} value="" error="Choisissez un motif." required />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('id="g-error"')
    expect(html).toContain('aria-describedby="g-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("Choisissez un motif.")
  })

  it("l'aide d'une option est reliée à sa radio ; aucun texte figé", () => {
    const html = renderToStaticMarkup(<RadioGroupField id="g" legend="Motif" name="reason" options={OPTIONS} value="" />)
    expect(html).toContain('aria-describedby="g-autre-help"')
    expect(html).toContain('id="g-autre-help"')
    expect(renderToStaticMarkup(<RadioGroupField id="g" legend="L" name="n" options={[]} value="" />)).not.toMatch(/\b(?:vous|votre)\b/i)
  })
})
