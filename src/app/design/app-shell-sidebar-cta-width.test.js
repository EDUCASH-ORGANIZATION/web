import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// RD-FIX-13 (client) : le CTA « Publier une mission » (seul CTA de sidebar, espace client) portait
// .btn--block (width: 100%) ET .sidebar__cta (margin: 0 4px). Sa boite de marge depassait la zone de contenu
// de la sidebar de 8 px : sur origin/main (overflow-y: auto => overflow-x auto) la sidebar client defilait
// horizontalement de 8 px (barre en bas), et le bouton etait decale (16 px a gauche, 8 px a droite).
const read = (f) => readFileSync(path.join(import.meta.dirname, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const rulesOf = (css, selector) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(" ")

describe("coquille connectee : CTA de sidebar sans debordement horizontal", () => {
  it("le CTA garde ses marges laterales mais ne prend plus 100 % de largeur en plus (largeur auto, etiree par la colonne flex)", () => {
    // Prerequis du defaut : marges laterales du CTA et pleine largeur de .btn--block.
    expect(rulesOf(read("layouts.css"), ".sidebar__cta")).toMatch(/margin:\s*0 4px/)
    expect(rulesOf(read("components.css"), ".btn--block")).toMatch(/width:\s*100%/)
    // Correctif : dans la coquille v2, la largeur revient a auto ; l'etirement flex retire les marges.
    expect(rulesOf(read("app-shell.css"), ".shell--v2 .sidebar__cta")).toMatch(/width:\s*auto/)
  })
})
