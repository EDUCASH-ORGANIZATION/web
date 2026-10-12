import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const PUBLIC = join(ROOT, "public")
const KIT = "/Users/brandonmedehou/Desktop/EDUCASH/design-rebrand/logo-final"

const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex")

// Lit largeur, hauteur et type de couleur dans l'en-tete IHDR d'un PNG.
function ihdr(file) {
  const b = readFileSync(file)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] }
}

const KIT_COPIES = [
  ["logo-horizontal-blanc.svg", "svg/educash-lockup-horizontal-blanc.svg"],
  ["logo-horizontal-bleu.svg", "svg/educash-lockup-horizontal-bleu.svg"],
  ["logo-horizontal-encre.svg", "svg/educash-lockup-horizontal-encre.svg"],
  ["logo-symbole-bleu.svg", "svg/educash-symbole-bleu.svg"],
  ["logo-symbole-blanc.svg", "svg/educash-symbole-blanc.svg"],
  ["logo.svg", "svg/educash-symbole-bleu.svg"],
  ["favicon.svg", "icons/favicon.svg"],
  ["favicon-16.png", "icons/favicon-16.png"],
  ["favicon-32.png", "icons/favicon-32.png"],
  ["favicon-48.png", "icons/favicon-48.png"],
  ["apple-touch-icon.png", "icons/apple-touch-icon.png"],
  ["og-image.png", "icons/og-image.png"],
  ["icons/icon-192.png", "icons/icon-192.png"],
  ["icons/icon-512.png", "icons/icon-512.png"],
  ["icons/icon-maskable-512.png", "icons/icon-maskable-512.png"],
]

describe("brand assets : empreintes du kit", () => {
  it.skipIf(!existsSync(KIT))("chaque fichier public/ est identique a sa source du kit", () => {
    for (const [target, source] of KIT_COPIES) {
      expect(sha(join(PUBLIC, target)), target).toBe(sha(join(KIT, source)))
    }
  })
})

describe("brand assets : PNG", () => {
  const SIZES = {
    "favicon-16.png": [16, 16],
    "favicon-32.png": [32, 32],
    "favicon-48.png": [48, 48],
    "apple-touch-icon.png": [180, 180],
    "icons/icon-192.png": [192, 192],
    "icons/icon-512.png": [512, 512],
    "icons/icon-maskable-512.png": [512, 512],
    "og-image.png": [1200, 630],
  }

  it("respecte les dimensions attendues", () => {
    for (const [file, [width, height]] of Object.entries(SIZES)) {
      const d = ihdr(join(PUBLIC, file))
      expect([d.width, d.height], file).toEqual([width, height])
    }
  })

  it("apple-touch-icon et icon-maskable sont opaques (sans canal alpha)", () => {
    for (const file of ["apple-touch-icon.png", "icons/icon-maskable-512.png"]) {
      expect([0, 2], file).toContain(ihdr(join(PUBLIC, file)).colorType)
    }
  })

  it("les logos email font 480 px de large", () => {
    for (const file of ["email/educash-logo-bleu.png", "email/educash-logo-blanc.png"]) {
      expect(ihdr(join(PUBLIC, file)).width, file).toBe(480)
    }
  })
})

describe("brand assets : favicon.ico", () => {
  it("contient 3 images 16, 32 et 48", () => {
    const b = readFileSync(join(ROOT, "src/app/favicon.ico"))
    expect(b.readUInt16LE(2)).toBe(1)
    const count = b.readUInt16LE(4)
    expect(count).toBe(3)
    const sizes = Array.from({ length: count }, (_, i) => b[6 + i * 16] || 256)
    expect(sizes.sort((a, c) => a - c)).toEqual([16, 32, 48])
  })
})

describe("brand assets : manifest", () => {
  const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.json"), "utf8"))

  it("utilise les couleurs de la charte", () => {
    expect(manifest.theme_color).toBe("#1028F0")
    expect(manifest.background_color).toBe("#F3F5FC")
  })

  it("reference des icones existantes", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(PUBLIC, icon.src)), icon.src).toBe(true)
    }
  })
})

describe("brand assets : SVG", () => {
  it("logo.svg reste un symbole leger (ancien fichier : 918 Ko)", () => {
    expect(statSync(join(PUBLIC, "logo.svg")).size).toBeLessThan(10 * 1024)
  })

  it("aucun SVG racine de public/ ne contient l'ancienne palette", () => {
    const old = /#2F3BED|#C8F03C|#0E0F1A|#F4F5FA|%230E0F1A/i
    const svgs = readdirSync(PUBLIC).filter((f) => f.endsWith(".svg") && f !== "sprite.svg")
    for (const f of svgs) {
      expect(readFileSync(join(PUBLIC, f), "utf8"), f).not.toMatch(old)
    }
  })
})
