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
const rawCss = readFileSync(path.join(import.meta.dirname, "../../../app/design/layouts.css"), "utf8")
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "")
const rulesOf = (selector) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(" ")

// Conditions @media englobant chaque règle d'un sélecteur (blocs imbriqués compris), pour verrouiller les seuils.
const mediaOf = (selector) => {
  const found = []
  const stack = []
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      stack.push(css.slice(start, i).trim())
      start = i + 1
    } else if (css[i] === "}") {
      const prelude = stack.pop()
      if (css.slice(start, i).trim() !== "" && !css.slice(start, i).includes("{") && prelude.split(",").some((sel) => sel.trim() === selector)) {
        found.push(stack.filter((p) => p.startsWith("@media")).join(" | "))
      }
      start = i + 1
    }
  }
  return found
}

const ID = "11111111-1111-4111-8111-111111111111"
const student = applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: true })
const html = renderToStaticMarkup(<ApplyBar cta={student} budget={10000} caption="Vous touchez 8 800 FCFA" />)

describe("barre de candidature mobile : prix, légende et bouton côte à côte", () => {
  it("le bouton est dans une cellule souple, jamais enfant direct de la barre", () => {
    expect(html).toMatch(/class="v03-applybar ds-mob-only"><div class="v03-applybar__info">/)
    expect(html).toMatch(/<div class="v03-applybar__cta"><a href="[^"]*" class="btn btn--accent btn--block">Postuler<\/a><\/div>/)
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

  it("la cellule du bouton ne porte plus ds-grow (écrasé par .v03-applybar__cta)", () => {
    expect(html).not.toContain("ds-grow")
  })
})

// RD-FIX-18 (revue) : en cellule étroite à côté du prix, les libellés longs donnaient des boutons « galet » de 3 à 4
// lignes (visiteur 124 x 97 px à 320 px). Visiteur, mission fermée et client sont donc empilés comme l'étudiant non
// vérifié : prix + légende, puis bouton pleine largeur de 48 px. Seul « Postuler » (étudiant) reste côte à côte ;
// tout autre kind avec bouton est empilé par défaut. Sans bouton (admin), le bloc prix reste seul. L'empilement ne
// vaut que sous 600 px : de 600 à 1023 px, le côte à côte tient sur une ligne (barre de 74 px comme sur la planche).
describe("barre de candidature mobile : disposition empilée selon le cas", () => {
  const barOf = (cta, props = {}) => renderToStaticMarkup(<ApplyBar cta={cta} budget={10000} {...props} />)
  const classOf = (markup) => markup.match(/^<div class="([^"]*)"/)[1]
  const cases = {
    visitor: applyCta({ role: null, missionId: ID, missionType: "Saisie", accepting: true }),
    closed: applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: false }),
    client: applyCta({ role: "client", missionId: ID, missionType: "Saisie", accepting: true }),
    "student-applied": applyCta({ role: "student", missionId: ID, missionType: "Saisie", accepting: true, hasApplied: true }),
  }
  const admin = applyCta({ role: "admin", missionId: ID, missionType: "Saisie", accepting: true })
  const unknown = { kind: "inconnu", primary: { label: "Voir", href: "/missions" }, secondary: null, message: null }

  it("les 6 kinds de applyCta sont couverts par le garde", () => {
    const kinds = [...Object.keys(cases), student.kind, admin.kind].sort()
    expect(kinds).toEqual(["admin", "client", "closed", "student", "student-applied", "visitor"])
    for (const kind of Object.keys(cases)) expect(cases[kind].kind).toBe(kind)
  })

  it.each(Object.keys(cases))("%s : barre empilée (modificateur --stack)", (kind) => {
    expect(classOf(barOf(cases[kind]))).toBe("v03-applybar v03-applybar--stack ds-mob-only")
  })

  it("un kind inconnu avec bouton est empilé par défaut (comme primaryButtonClass le traite en closed)", () => {
    expect(classOf(barOf(unknown))).toBe("v03-applybar v03-applybar--stack ds-mob-only")
  })

  it("étudiant « Postuler » : seul kind côte à côte, sans modificateur", () => {
    expect(classOf(barOf(student))).toBe("v03-applybar ds-mob-only")
  })

  it("admin : pas de bouton, le bloc prix reste seul et n'est pas empilé", () => {
    const markup = barOf(admin)
    expect(classOf(markup)).toBe("v03-applybar ds-mob-only")
    expect(markup).not.toContain("v03-applybar__cta")
  })

  it("étudiant non vérifié : seule la disposition --hint s'applique", () => {
    expect(classOf(barOf(student, { needsVerification: true }))).toBe("v03-applybar v03-applybar--hint ds-mob-only")
  })

  it("la barre empilée met prix et légende sur la première ligne et le bouton pleine largeur dessous", () => {
    expect(rulesOf(".v03-applybar--stack")).toMatch(/flex-wrap:\s*wrap/)
    expect(rulesOf(".v03-applybar--stack .v03-applybar__info")).toMatch(/flex-basis:\s*100%/)
    expect(rulesOf(".v03-applybar--stack .v03-applybar__cta")).toMatch(/flex-basis:\s*100%/)
  })

  it("le libellé reste libre de passer à la ligne et le bouton garde 48 px minimum (jamais de colonne étroite forcée)", () => {
    const btn = rulesOf(".v03-applybar .btn")
    expect(btn).toMatch(/white-space:\s*normal/)
    expect(btn).toMatch(/min-height:\s*var\(--h-btn\)/)
    expect(css).not.toMatch(/\.v03-applybar[^{]*\{[^}]*white-space:\s*nowrap/)
  })

  it("le pied de page réserve 136 px sous la barre empilée (122 px mesurés) et sous l'invitation (143 px mesurés)", () => {
    const reserve = (selector) => Number(rulesOf(selector).match(/calc\(var\(--s-6\) \+ (\d+)px/)?.[1])
    expect(reserve(".ds:has(.v03-applybar--stack) .site-footer")).toBeGreaterThanOrEqual(136)
    expect(reserve(".ds:has(.v03-applybar--hint) .site-footer")).toBeGreaterThanOrEqual(136)
    expect(reserve(".ds:has(.v03-applybar) .site-footer")).toBeGreaterThanOrEqual(112)
  })

  it("l'empilement et sa réserve de 136 px ne valent que sous 600 px, le reste de la barre jusqu'à 1023 px", () => {
    const BELOW_600 = "@media (max-width: 599.98px)"
    const BELOW_1024 = "@media (max-width: 1023.98px)"
    for (const selector of [".v03-applybar--stack", ".v03-applybar--stack .v03-applybar__info", ".v03-applybar--stack .v03-applybar__cta", ".ds:has(.v03-applybar--stack) .site-footer"]) {
      expect(mediaOf(selector)).toEqual([BELOW_600])
    }
    for (const selector of [".v03-applybar", ".v03-applybar__cta", ".v03-applybar--hint", ".ds:has(.v03-applybar) .site-footer", ".ds:has(.v03-applybar--hint) .site-footer"]) {
      expect(mediaOf(selector)).toContain(BELOW_1024)
    }
  })

  it("la réserve sous la barre empilée vient après celle de 112 px (à spécificité égale la dernière gagne)", () => {
    const at = (selector) => css.indexOf(`${selector} {`)
    expect(at(".ds:has(.v03-applybar--stack) .site-footer")).toBeGreaterThan(at(".ds:has(.v03-applybar) .site-footer"))
  })

  it("les libellés de bouton de applyCta (constantes) tiennent sur une ligne à 320 px : sinon revoir les marges du pied de page", () => {
    // 29 caractères (« Publier une mission similaire ») tiennent dans les 288 px de 320 px en Figtree gras 16 px,
    // police de repli Arial comprise. Un libellé plus long ferait grandir la barre empilée au-delà des 136 px réservés.
    const all = [
      ...Object.values(cases),
      student,
      admin,
    ]
    for (const cta of all) if (cta.primary) expect(cta.primary.label.length).toBeLessThanOrEqual(29)
  })

  it("la zone sûre iPhone et le lien avec apply-cta.js sont documentés à côté des marges", () => {
    expect(rawCss).toMatch(/viewport-fit=cover/)
    expect(rawCss).toMatch(/apply-cta\.js/)
  })
})
