// Garde-fou de frontière serveur / client (incident RD-02-FIX-01, digest 1079612244).
// Côté serveur, chaque export d'un module "use client" est remplacé par une référence client :
// seul un composant peut être rendu ou passé en prop. Appeler une fonction (ex. `parseStep`) ou
// lire une constante importée d'un tel module lève une erreur au rendu et la page tombe en 500.
// Vitest ignore la directive "use client" : seul ce contrôle statique détecte le défaut.
import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const SRC = path.resolve(import.meta.dirname, "..")
const EXTENSIONS = ["", ".js", ".jsx", "/index.js", "/index.jsx"]
const IMPORT = /import\s+(?:[\w$]+\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+["']([^"']+)["']/g
// Nom de composant : PascalCase avec au moins une minuscule (exclut les CONSTANTES).
const COMPONENT = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [full] : []
  })
}

function isClientModule(source) {
  return /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source)
}

function resolve(from, specifier) {
  let base
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2))
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier)
  else return null
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export function findServerCallsToClientExports(files) {
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]))
  const read = (file) => sources.get(file) ?? readFileSync(file, "utf8")
  const violations = []
  for (const [file, source] of sources) {
    if (isClientModule(source)) continue
    for (const [, named, specifier] of source.matchAll(IMPORT)) {
      if (!named) continue
      const target = resolve(file, specifier)
      if (!target || !isClientModule(read(target))) continue
      for (const entry of named.split(",")) {
        const name = entry.trim().split(/\s+as\s+/)[0]
        if (name && !COMPONENT.test(name)) {
          violations.push(`${path.relative(SRC, file)} importe ${name} depuis le module client ${specifier}`)
        }
      }
    }
  }
  return violations
}

describe("frontière serveur / client", () => {
  it("aucun module serveur n'importe une fonction ou une constante d'un module \"use client\"", () => {
    expect(findServerCallsToClientExports(walk(SRC))).toEqual([])
  })

  it("la page d'onboarding étudiant prend parseStep dans un module serveur", () => {
    const page = path.join(SRC, "app/auth/register/student/page.js")
    expect(findServerCallsToClientExports([page])).toEqual([])
    expect(isClientModule(readFileSync(path.join(SRC, "components/auth/student-onboarding/wizard-steps.js"), "utf8"))).toBe(
      false
    )
  })
})
