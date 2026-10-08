import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Select } from "./select"

const options = [
  { value: "", label: "Toutes les villes" },
  { value: "c", label: "Cotonou" },
  { value: "p", label: "Porto-Novo" },
]

const render = (props) => renderToStaticMarkup(<Select options={options} aria-label="Ville" {...props} />)

describe("rendu du Select", () => {
  it("expose un combobox fermé relié à sa liste", () => {
    const html = render({})
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    const controls = html.match(/aria-controls="([^"]+)"/)[1]
    expect(html).toContain(`id="${controls}"`)
    expect(html).toContain('role="listbox"')
  })

  it("marque l'option courante avec aria-selected", () => {
    const html = render({ defaultValue: "c" })
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html.match(/aria-selected="false"/g)).toHaveLength(2)
    const selected = html.match(/<div[^>]*aria-selected="true"[^>]*>(.*?)<\/div>/)[0]
    expect(selected).toContain("Cotonou")
  })

  it("rend un input caché avec le nom et la valeur, non contrôlé", () => {
    const html = render({ name: "ville", defaultValue: "p" })
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="ville"')
    expect(html).toContain('value="p"')
  })

  it("rend un input caché avec le nom et la valeur, contrôlé", () => {
    const html = render({ name: "ville", value: "c", onChange: () => {} })
    expect(html).toContain('value="c"')
    expect(html).toContain('name="ville"')
    expect(html).toContain("Cotonou")
  })

  it("propage disabled au déclencheur et à l'input caché", () => {
    const html = render({ name: "ville", disabled: true })
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  it("génère des ids distincts pour deux instances", () => {
    const html = renderToStaticMarkup(
      <>
        <Select options={options} aria-label="A" />
        <Select options={options} aria-label="B" />
      </>,
    )
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
