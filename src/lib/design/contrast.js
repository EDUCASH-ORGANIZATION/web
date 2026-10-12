import { readFileSync } from "node:fs"
import path from "node:path"

// Contrastes WCAG 2.x : fonctions pures + lecture des couleurs --c-* de tokens.css.

const HEX = /^#([0-9a-f]{6})$/i

/** "#RRGGBB" -> [r, g, b] (0 a 255). Lance une erreur si le format est invalide. */
export function hexToRgb(hex) {
  const match = HEX.exec(String(hex).trim())
  if (!match) throw new Error(`Couleur hexadecimale invalide : ${hex}`)
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Luminance relative WCAG d'une couleur "#RRGGBB" (0 noir, 1 blanc). */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG entre deux couleurs "#RRGGBB" (de 1 a 21). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Extrait les declarations `--c-*` d'un texte CSS (hex ou alias `var(--c-*)`)
 * et renvoie { "--c-bleu": "#1028F0", ... } avec les alias resolus.
 */
export function parseColorTokens(css) {
  const raw = {}
  const re = /(--c-[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m
  while ((m = re.exec(css)) !== null) {
    if (!(m[1] in raw)) raw[m[1]] = m[2].trim()
  }
  const resolved = {}
  const resolve = (name, seen = []) => {
    const value = raw[name]
    if (value === undefined || seen.includes(name)) return undefined
    const alias = /^var\((--c-[a-z0-9-]+)\)$/i.exec(value)
    if (alias) return resolve(alias[1], [...seen, name])
    return HEX.test(value) ? value.toUpperCase() : undefined
  }
  for (const name of Object.keys(raw)) {
    const value = resolve(name)
    if (value) resolved[name] = value
  }
  return resolved
}

/** Lit src/app/design/tokens.css depuis la racine du projet. */
export function readColorTokens(root = process.cwd()) {
  const file = path.join(root, "src", "app", "design", "tokens.css")
  return parseColorTokens(readFileSync(file, "utf8"))
}
