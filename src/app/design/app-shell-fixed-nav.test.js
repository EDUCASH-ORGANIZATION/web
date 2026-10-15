import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// RD-FIX-11 : la navigation de la coquille reste fixe pendant que le contenu défile.
const css = readFileSync(path.join(import.meta.dirname, "app-shell.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const rulesOf = (selector) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(",").some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(" ")

describe("coquille connectee : navigation fixe", () => {
  it("la sidebar est collee a la fenetre, 100dvh, sans aucun defilement interne (RD-FIX-13)", () => {
    const r = rulesOf(".shell--v2 .sidebar")
    expect(r).toMatch(/position:\s*sticky/)
    expect(r).toMatch(/top:\s*calc\(/)
    expect(r).toMatch(/height:\s*calc\(100dvh/)
    expect(r).toMatch(/align-self:\s*start/)
    // overflow-y: auto rendait aussi overflow-x auto : la sidebar defilait dans les deux sens.
    expect(r).not.toMatch(/overflow(?:-[xy])?:\s*(?:auto|scroll)/)
    expect(r).not.toMatch(/overscroll-behavior/)
    expect(r).toContain("overflow: hidden; overflow: clip;")
  })

  it("le contenu de la sidebar est compact par construction : espacements et entrees se resserrent avec la hauteur de fenetre", () => {
    const fluid = /clamp\([^;]*100dvh[^;]*\)/
    // Marge haute, bas du logo, titres de groupe et entrees : valeur fixe en repli puis clamp() sur 100dvh.
    expect(rulesOf(".shell--v2 .sidebar")).toMatch(new RegExp(`padding-top: var\\(--s-6\\); padding-top: ${fluid.source}`))
    expect(rulesOf(".shell--v2 .sidebar__brand")).toMatch(new RegExp(`padding-bottom: ${fluid.source}`))
    expect(rulesOf(".shell--v2 .sidebar__group")).toMatch(new RegExp(`padding-top: ${fluid.source}`))
    const item = rulesOf(".shell--v2 .nav-item")
    expect(item).toContain("height: 42px; height: clamp(32px, calc((100dvh - 600px) / 8 + 34px), 42px);")
    expect(item).toMatch(/flex:\s*none/)
    // La liste prend la place restante et se rogne (jamais de defilement) ; logo, CTA et identite ne retrecissent pas.
    const nav = rulesOf(".shell--v2 .sidebar__nav")
    expect(nav).toMatch(/flex:\s*1 1 auto/)
    expect(nav).toMatch(/min-height:\s*0/)
    expect(nav).toContain("overflow: hidden; overflow: clip;")
    // Marge de 6 px pour les anneaux de focus (5 px) des entrees, alignement inchange.
    expect(nav).toContain("margin: -6px; padding: 6px;")
    for (const sel of [".shell--v2 .sidebar__brand", ".shell--v2 .sidebar__cta", ".shell--v2 .sidebar__me"]) {
      expect(rulesOf(sel), sel).toMatch(/flex:\s*none/)
    }
  })

  it("budget de hauteur : 8 entrees et un titre (etudiant) tiennent a 1024 x 600 et jusqu'a 520 px de haut", () => {
    // Valeurs des clamp() de la feuille, a hauteur de fenetre h (px). Disponible : h - 2 * (16 + 2 + 12).
    // Lignes de 13 px a line-height 1.5 herite de .ds (19,5 px) ; .iconbtn2 de 40 px (app-shell.css).
    const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v))
    const used = (h, items, groups) => {
      const padTop = clamp(12, (h - 600) / 4 + 12, 24)
      const brand = 40 + 6 + 19.5 + clamp(8, (h - 600) / 4 + 8, 24)
      const group = clamp(8, (h - 600) / 4 + 8, 20) + 19.5 + 6
      const item = clamp(32, (h - 600) / 8 + 34, 42)
      const nav = items * item + groups * group + (items + groups - 1) * 2
      const me = 12 + 40 + 2 + 2
      return padTop + brand + 2 + nav + 2 + me + 12
    }
    // A 520 px le contenu deborde de 3 a 5 px au plus : tolere, car le padding bas de .sidebar__nav (6 px) absorbe ce debord.
    const NAV_PAD_BOTTOM = 6
    for (const h of [900, 700, 600, 520]) {
      const slack = h === 520 ? NAV_PAD_BOTTOM : 0
      expect(used(h, 8, 1), `etudiant a ${h}`).toBeLessThanOrEqual(h - 60 + slack)
      expect(used(h, 7, 2), `admin a ${h}`).toBeLessThanOrEqual(h - 60 + slack)
    }
    for (const h of [900, 700, 600]) {
      expect(used(h, 8, 1), `etudiant strict a ${h}`).toBeLessThanOrEqual(h - 60)
    }
  })

  it("le cadre ne bloque pas le sticky (overflow: clip, jamais hidden/auto/scroll)", () => {
    const r = rulesOf(".shell--v2 .shell__frame")
    expect(r).toMatch(/overflow:\s*clip/)
    expect(r).not.toMatch(/overflow(?:-[xy])?:\s*(?:hidden|auto|scroll)/)
  })

  it("la barre du haut bureau reste en haut avec un fond et un filet bas", () => {
    const r = rulesOf(".shell--v2 .top2")
    expect(r).toMatch(/position:\s*sticky/)
    expect(r).toMatch(/top:\s*0/)
    expect(r).toMatch(/background:\s*var\(--c-/)
    expect(r).toMatch(/box-shadow:\s*0 1px 0 var\(--c-ligne\)/)
  })

  it("l'en-tete mobile reste en haut, la barre du bas est fixed avec safe-area", () => {
    const m = rulesOf(".shell--v2 .mtop2")
    expect(m).toMatch(/position:\s*sticky/)
    expect(m).toMatch(/top:\s*0/)
    const b = rulesOf(".bottom-nav.bottom-nav--v2")
    expect(b).toMatch(/position:\s*fixed/)
    expect(b).toMatch(/safe-area-inset-bottom/)
  })

  it("aucun ancetre de la coquille ne pose de transform", () => {
    for (const sel of [".shell", ".shell--v2", ".shell__main", ".app2", ".main2"]) {
      expect(rulesOf(sel)).not.toMatch(/\btransform\s*:/)
    }
  })

  it("le decalage de la sidebar suit la coquille de layouts.css (padding --s-4, bordure 2px, padding --s-3)", () => {
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "")
    const layouts = strip(readFileSync(path.join(import.meta.dirname, "layouts.css"), "utf8"))
    const tokens = strip(readFileSync(path.join(import.meta.dirname, "tokens.css"), "utf8"))
    expect(layouts).toMatch(/\.shell \{[^}]*padding: var\(--s-4\);/)
    expect(layouts).toMatch(/\.shell__frame \{[^}]*padding: var\(--s-3\);[^}]*border: var\(--b-encre\);/)
    expect(tokens).toMatch(/--b-encre: 2px solid/)
    const r = rulesOf(".shell--v2 .sidebar")
    expect(r).toContain("top: calc(var(--s-4) + 2px + var(--s-3));")
    expect(r).toMatch(/height: calc\(100vh - 2 \* \(var\(--s-4\) \+ 2px \+ var\(--s-3\)\)\); height: calc\(100dvh - 2 \* \(var\(--s-4\) \+ 2px \+ var\(--s-3\)\)\);/)
  })

  it("le jeton --shell-sticky-top vaut la hauteur de la barre du haut (56 px) plus --s-3", () => {
    expect(rulesOf(".shell--v2 .top2")).toMatch(/height:\s*56px/)
    expect(rulesOf(".shell--v2")).toContain("--shell-sticky-top: calc(56px + var(--s-3));")
  })

  it("scroll-padding-top : focus et ancres ne finissent pas sous les barres collees (bureau et sous 1024)", () => {
    expect(css).toMatch(/html:has\(\.shell--v2\) \{ scroll-padding-top: calc\(56px \+ var\(--s-3\)\); \}/)
    const mobile = css.slice(css.indexOf("@media (max-width: 1023.98px)"))
    expect(mobile).toMatch(/html:has\(\.shell--v2\) \{ scroll-padding-top: calc\(60px \+ var\(--s-3\)\); \}/)
  })

  // Feuilles portees par la coquille : app-shell.css et les espaces .e2, .c2, .a2 (vitrine et auth exclues).
  const shellSheets = [
    "app-shell.css",
    ...["student", "client", "admin"].flatMap((dir) =>
      readdirSync(path.join(import.meta.dirname, dir)).filter((f) => f.endsWith(".css")).map((f) => `${dir}/${f}`),
    ),
  ]
  const sheetRules = (file) =>
    [...readFileSync(path.join(import.meta.dirname, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      file,
      selector: m[1].trim(),
      body: m[2],
    }))
  const BARS = [".shell--v2 .top2", ".shell--v2 .mtop2", ".e2-mtop", ".a2-mtop"]

  it("aucun contenu collant de page ne garde top: 0 ni ne manque du decalage --shell-sticky-top", () => {
    const sticky = shellSheets.flatMap(sheetRules).filter((r) => /position:\s*sticky/.test(r.body))
    expect(sticky.length).toBeGreaterThan(0)
    const offenders = sticky
      .filter((r) => !BARS.includes(r.selector) && r.selector !== ".shell--v2 .sidebar")
      .filter((r) => !/(?:^|;)\s*bottom:/.test(r.body) || /(?:^|;)\s*top:/.test(r.body))
      .filter((r) => !/top:\s*var\(--shell-sticky-top\)/.test(r.body))
      .map((r) => `${r.file} ${r.selector}`)
    expect(offenders).toEqual([])
  })

  it("les colonnes collantes de page sont bornees a la fenetre, defilent seulement en vertical, et liberees sous 1024", () => {
    for (const [file, sel] of [["student/e02.css", ".e2-02-filters"], ["student/e03.css", ".e2-03-aside"], ["student/e05.css", ".e2-05-aside"]]) {
      const r = sheetRules(file).find((x) => x.selector === sel && /position:\s*sticky/.test(x.body))
      expect(r, sel).toBeTruthy()
      expect(r.body).toContain("top: var(--shell-sticky-top);")
      expect(r.body).toContain("max-height: calc(100vh - var(--shell-sticky-top) - var(--s-4)); max-height: calc(100dvh - var(--shell-sticky-top) - var(--s-4));")
      expect(r.body).toContain("overflow-x: hidden; overflow-y: auto;")
      expect(r.body).not.toMatch(/overflow-x:\s*(?:auto|scroll)/)
    }
    const base = readFileSync(path.join(import.meta.dirname, "student/base.css"), "utf8")
    const tablet = base.slice(base.indexOf("@media (max-width: 1023.98px)"))
    expect(tablet).toContain(".e2 .e2-02-filters, .e2 .e2-03-aside, .e2 .e2-05-aside { max-height: none; overflow: visible; }")
  })

  it("les en-tetes de sous-page .e2-mtop et .a2-mtop restent en haut comme .mtop2", () => {
    for (const [file, sel] of [["student/base.css", ".e2-mtop"], ["admin/base.css", ".a2-mtop"]]) {
      const r = sheetRules(file).filter((x) => x.selector === sel).map((x) => x.body).join(" ")
      expect(r).toMatch(/position:\s*sticky/)
      expect(r).toMatch(/top:\s*0/)
      expect(r).toMatch(/z-index:\s*var\(--z-sticky\)/)
      expect(r).toMatch(/background:\s*var\(--c-givre\)/)
    }
  })
  it("aucune barre de la coquille ne defile ni ne deborde en interne (sidebar, top2, mtop2, e2-mtop, a2-mtop, barre du bas, site-header)", () => {
    const BAR_CLASSES = ["sidebar", "sidebar__nav", "top2", "mtop2", "e2-mtop", "a2-mtop", "bottom-nav--v2", "site-header"]
    const all = [...shellSheets, "layouts.css"].flatMap(sheetRules)
    // Selecteur dont le dernier compose vise la barre elle-meme (pas un descendant).
    const targetsBar = (selector) =>
      selector.split(",").some((part) => {
        const last = part.trim().split(/[\s>+~]+/).pop()
        return BAR_CLASSES.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(last))
      })
    const bars = all.filter((r) => targetsBar(r.selector))
    expect(bars.length).toBeGreaterThan(5)
    const offenders = bars
      .filter((r) => /overflow(?:-[xy])?:\s*(?:auto|scroll)/.test(r.body))
      .map((r) => `${r.file} ${r.selector}`)
    expect(offenders).toEqual([])
  })
})
