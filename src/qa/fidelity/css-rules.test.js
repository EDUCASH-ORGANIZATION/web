import { describe, expect, it } from "vitest"
import { declarationsOf, rulesOf } from "./css-rules"

const CSS = `
/* commentaire { avec accolade } */
.e2 .e2-06-inbox { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: var(--s-5); }
.a, .e2 .b:hover , .c { color: red }
.e2 .e2-06-inbox { gap: 12px; }
@media (max-width: 1023px) {
  .e2 .e2-06-inbox { grid-template-columns: 1fr; }
  .e2 .e2-07-pane { border-radius: 0; border-left: 0 }
}
@layer components {
  .e2 .layered { background: url("data:image/svg+xml;utf8,<svg a='b'/>") no-repeat; }
}
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(1turn) } }
`

describe("rulesOf", () => {
  it("extrait une règle simple avec ses déclarations", () => {
    const rules = rulesOf(CSS, ".e2 .e2-06-inbox")
    expect(rules).toHaveLength(2)
    expect(rules[0].declarations).toEqual({
      display: "grid",
      "grid-template-columns": "360px minmax(0, 1fr)",
      gap: "var(--s-5)",
    })
    expect(rules[0].media).toBeNull()
  })

  it("retrouve un sélecteur dans une liste", () => {
    expect(rulesOf(CSS, ".e2 .b:hover")[0].selectors).toEqual([".a", ".e2 .b:hover", ".c"])
    expect(rulesOf(CSS, ".c")[0].declarations).toEqual({ color: "red" })
    expect(rulesOf(CSS, ".absent")).toEqual([])
  })

  it("extrait un bloc @media sans le mélanger avec les règles de base", () => {
    const rules = rulesOf(CSS, ".e2 .e2-07-pane", { media: "max-width: 1023px" })
    expect(rules).toHaveLength(1)
    expect(rules[0].declarations).toEqual({ "border-radius": "0", "border-left": "0" })
    expect(rules[0].media).toBe("(max-width: 1023px)")
    expect(rulesOf(CSS, ".e2 .e2-07-pane")).toEqual([])
  })

  it("fusionne les déclarations, la dernière valeur l'emporte", () => {
    expect(declarationsOf(CSS, ".e2 .e2-06-inbox").gap).toBe("12px")
    expect(declarationsOf(CSS, ".e2 .e2-06-inbox", { media: "*" })["grid-template-columns"]).toBe("1fr")
  })

  it("traverse @layer et garde les valeurs avec ; et parenthèses", () => {
    expect(declarationsOf(CSS, ".e2 .layered").background).toBe(
      'url("data:image/svg+xml;utf8,<svg a=\'b\'/>") no-repeat',
    )
  })
})
