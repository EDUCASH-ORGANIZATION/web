import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Ratios largeur / hauteur du viewBox des logos de public/ (charte : pas de logo deforme).
const RATIO = { horizontal: 412.25 / 100, symbole: 104.88 / 100 }
const TOLERANCE = 0.015
const MIN_WIDTH = { horizontal: 150, symbole: 32 }

// Fichiers hors du perimetre de ST-06 qui portent encore un symbole 32 x 32 (ratio 1,00 au lieu de 1,05).
// A corriger en 34 x 32 puis a retirer d'ici : le test refuse une entree devenue inutile.
const PENDING_FIX = [
  "src/components/vitrine/etudiants/etudiants-hero.jsx",
  "src/components/vitrine/etudiants/etudiants-steps.jsx",
]

function ratioError(tag, kind) {
  const w = attr(tag, "width")
  const h = attr(tag, "height")
  if (!w || !h) return Infinity
  return Math.abs(Number(w[1] ?? w[2]) / Number(h[1] ?? h[2]) / RATIO[kind] - 1)
}

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

const IMG_TAG = /<img\b[^>]*?\/?>/gs
const attr = (tag, name) => new RegExp(`\\b${name}=(?:\\{(\\d+(?:\\.\\d+)?)\\}|"(\\d+(?:\\.\\d+)?)")`).exec(tag)

const logos = sources("src").flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(IMG_TAG)]
    .map(([tag]) => tag)
    .filter((tag) => /src=(?:"|\{[^}]*")\/logo-/.test(tag))
    .map((tag) => ({ file, tag })),
)

describe("dimensions des logos <img>", () => {
  it("trouve les logos de la vitrine", () => {
    expect(logos.length).toBeGreaterThanOrEqual(8)
  })

  for (const { file, tag } of logos) {
    const kind = /logo-symbole-/.test(tag) ? "symbole" : "horizontal"
    const pending = PENDING_FIX.includes(file)
    it(`${file} (${kind}) ${pending ? "garde un ratio a corriger" : "respecte le ratio du viewBox"}`, () => {
      const error = ratioError(tag, kind)
      if (pending) {
        expect(error).toBeGreaterThan(TOLERANCE)
        return
      }
      expect(error).toBeLessThanOrEqual(TOLERANCE)
      expect(Number(attr(tag, "width")[1] ?? attr(tag, "width")[2])).toBeGreaterThanOrEqual(MIN_WIDTH[kind])
    })
  }
})
