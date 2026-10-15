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
  it("la sidebar est collee a la fenetre, 100dvh, avec defilement interne", () => {
    const r = rulesOf(".shell--v2 .sidebar")
    expect(r).toMatch(/position:\s*sticky/)
    expect(r).toMatch(/top:\s*calc\(/)
    expect(r).toMatch(/height:\s*calc\(100dvh/)
    expect(r).toMatch(/align-self:\s*start/)
    expect(r).toMatch(/overflow-y:\s*auto/)
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

  it("les colonnes collantes de page sont bornees a la fenetre avec defilement interne, et liberees sous 1024", () => {
    for (const [file, sel] of [["student/e02.css", ".e2-02-filters"], ["student/e03.css", ".e2-03-aside"], ["student/e05.css", ".e2-05-aside"]]) {
      const r = sheetRules(file).find((x) => x.selector === sel && /position:\s*sticky/.test(x.body))
      expect(r, sel).toBeTruthy()
      expect(r.body).toContain("top: var(--shell-sticky-top);")
      expect(r.body).toContain("max-height: calc(100vh - var(--shell-sticky-top) - var(--s-4)); max-height: calc(100dvh - var(--shell-sticky-top) - var(--s-4));")
      expect(r.body).toMatch(/overflow-y:\s*auto/)
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
})
