import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import path from "node:path"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { ApplyBar } = await import("./apply-bar")
const { applyCta } = await import("@/lib/vitrine/apply-cta")

// RD-FIX-18 : sur mobile, le bouton « Postuler » (.btn--block, width: 100 %) était posé directement dans la barre
// flex .v03-applybar. Sa base de 100 % ne laissait que l'espace du gap au bloc prix : « Vous touchez 8 800 FCFA »
// était écrasé sur une colonne de 0 px et le bouton le recouvrait. La maquette V03 (.action-bar) place le bouton
// dans une cellule souple (.grow) à côté du bloc prix.
const css = readFileSync(path.join(import.meta.dirname, "../../../app/design/layouts.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const rulesOf = (selector) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(" ")

const ID = "11111111-1111-4111-8111-111111111111"
const student = applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: true })
const html = renderToStaticMarkup(<ApplyBar cta={student} budget={10000} caption="Vous touchez 8 800 FCFA" />)

describe("barre de candidature mobile : prix, légende et bouton côte à côte", () => {
  it("le bouton est dans une cellule souple, jamais enfant direct de la barre", () => {
    expect(html).toMatch(/class="v03-applybar ds-mob-only"><div class="v03-applybar__info">/)
    expect(html).toMatch(/<div class="ds-grow v03-applybar__cta"><a href="[^"]*" class="btn btn--accent btn--block">Postuler<\/a><\/div>/)
    expect(html).toContain("Vous touchez 8 800 FCFA")
  })

  it("la cellule du bouton garde au moins la largeur de son libellé et le bloc prix cède la place", () => {
    expect(rulesOf(".v03-applybar__cta")).toMatch(/min-width:\s*min-content/)
    expect(rulesOf(".v03-applybar__cta")).toMatch(/flex:\s*1 1 0/)
    expect(rulesOf(".v03-applybar__info")).toMatch(/flex:\s*0 1 auto/)
  })

  it("le libellé du bouton peut passer à la ligne et la cible tactile reste d'au moins 44 px", () => {
    const btn = rulesOf(".v03-applybar .btn")
    expect(btn).toMatch(/white-space:\s*normal/)
    expect(btn).toMatch(/min-height:\s*var\(--h-btn\)/)
  })

  it("le montant en petit (FCFA) reste lisible, en jeton du design système", () => {
    expect(rulesOf(".v03-applybar .amount small")).toMatch(/font-size:\s*var\(--t-caption\)/)
  })

  it("le pied de page laisse la place de la barre fixe (zone sûre iPhone comprise)", () => {
    expect(css).not.toMatch(/\.v03-with-bar/)
    expect(rulesOf(".ds:has(.v03-applybar) .site-footer")).toMatch(/padding-bottom:\s*calc\(var\(--s-6\) \+ \d+px \+ env\(safe-area-inset-bottom/)
    expect(rulesOf(".ds:has(.v03-applybar--hint) .site-footer")).toMatch(/padding-bottom:\s*calc\(var\(--s-6\) \+ \d+px \+ env\(safe-area-inset-bottom/)
  })

  it("aucune couleur en dur dans les règles de la barre", () => {
    const all = [".v03-applybar__cta", ".v03-applybar__info", ".v03-applybar .btn", ".v03-applybar--hint"].map(rulesOf).join(" ")
    expect(all).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i)
  })

  it("étudiant non vérifié : l'invitation occupe la première ligne, le bouton passe dessous", () => {
    const hint = renderToStaticMarkup(<ApplyBar cta={student} budget={10000} needsVerification />)
    expect(hint).toContain('class="v03-applybar v03-applybar--hint ds-mob-only"')
    expect(rulesOf(".v03-applybar--hint")).toMatch(/flex-wrap:\s*wrap/)
    expect(rulesOf(".v03-applybar--hint .v03-applybar__info")).toMatch(/flex-basis:\s*100%/)
  })
})
