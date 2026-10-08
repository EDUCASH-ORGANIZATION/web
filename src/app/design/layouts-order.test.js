import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Les blocs media de layouts.css ont la même spécificité : c'est leur ordre qui décide.
// Les règles « une colonne » (.v-figures, .v-cats, .v05-guar) doivent donc venir APRÈS
// le dernier bloc 1023.98 qui les redéfinit en 2 colonnes, sinon elles sont annulées.
const css = readFileSync(path.join(__dirname, "layouts.css"), "utf8")

function mediaStarts(query) {
  const found = []
  const re = new RegExp(`@media \\(max-width: ${query.replace(".", "\\.")}(?:px)?\\) \\{`, "g")
  for (const m of css.matchAll(re)) found.push(m.index)
  return found
}

function blockAt(start) {
  let depth = 0
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++
    if (css[i] === "}" && --depth === 0) return css.slice(start, i)
  }
  return ""
}

describe("ordre des media queries de layouts.css", () => {
  it("place les règles une colonne après le dernier bloc 1023.98 qui touche les mêmes grilles", () => {
    const grids = [".v-figures {", ".v-cats {", ".v05-guar {"]
    const tablet = mediaStarts("1023.98").filter((s) => grids.some((g) => blockAt(s).includes(g)))
    const mobile = mediaStarts("767.98").filter((s) => blockAt(s).includes("grid-template-columns: minmax(0, 1fr); gap: var(--s-3)"))
    expect(tablet.length).toBeGreaterThan(0)
    expect(mobile.length).toBeGreaterThan(0)
    expect(Math.min(...mobile)).toBeGreaterThan(Math.max(...tablet))
  })
})
