import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
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

  it("la barre du haut bureau reste en haut avec un fond", () => {
    const r = rulesOf(".shell--v2 .top2")
    expect(r).toMatch(/position:\s*sticky/)
    expect(r).toMatch(/top:\s*0/)
    expect(r).toMatch(/background:\s*var\(--c-/)
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
})
