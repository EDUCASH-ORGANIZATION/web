import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const css = readFileSync(path.join(import.meta.dirname, "ad02.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

describe("AD02 sous 1024 px avec dossier ouvert", () => {
  it("le titre h1 reste dans l'arbre d'accessibilité : l'en-tête n'est jamais masqué par display none", () => {
    expect(css).not.toMatch(/\.a2-02--open \.a2-02-head \{[^}]*display: none/)
  })

  it("onglets et filtres sont masqués, le bloc de titre est seulement masqué visuellement", () => {
    expect(css).toMatch(/\.a2-02--open \.a2-02-head > :not\(\.head2\) \{ display: none; \}/)
    const rule = css.match(/\.a2-02--open \.a2-02-head \.head2 \{([^}]*)\}/)?.[1] ?? ""
    expect(rule).toMatch(/position: absolute/)
    expect(rule).toMatch(/clip-path: inset\(50%\)/)
    expect(rule).not.toMatch(/display: none|visibility: hidden/)
  })

  it("la règle figée de la liste est inchangée", () => {
    expect(css).toMatch(/\.a2-02--open \.a2-02-master \{ display: none; \}/)
  })
})
