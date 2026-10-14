import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// Un loading.js enveloppe son segment et tous ses enfants dans un Suspense : le flux est alors déjà
// commencé quand notFound() est appelé, et la page répond 200 au lieu de 404. Ce test refuse tout
// loading.* dans un segment qui peut appeler notFound() ou dans un de ses parents, sous (student).
//
// Détection fail-closed, sur un « arbre » { chemin relatif: contenu } (le vrai dossier, ou des fixtures en
// mémoire pour tester les détecteurs eux-mêmes) :
// - un fichier qui importe `notFound` de "next/navigation" (sous n'importe quel alias) ou l'appelle ;
// - tout segment dynamique `[...]` qui contient une page (l'identifiant peut mener à un notFound()) ;
// - `import * as` (et import dynamique ou require) de "next/navigation" refusé : l'alias ne serait pas suivi.
const ROOT = path.join(process.cwd(), "src/app/(student)")
const SOURCE = /\.(js|jsx|ts|tsx)$/
const TEST_FILE = /\.test\.(js|jsx|ts|tsx)$/
const PAGE = /(^|\/)page\.(js|jsx|ts|tsx)$/
const LOADING = /^loading\.(js|jsx|ts|tsx)$/
const NOT_FOUND_FILE = /^not-found\.(js|jsx|ts|tsx)$/
const DYNAMIC_SEGMENT = /^\[.+\]$/

function readTree(dir, base = "") {
  const tree = {}
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) Object.assign(tree, readTree(path.join(dir, e.name), rel))
    else tree[rel] = SOURCE.test(e.name) ? readFileSync(path.join(dir, e.name), "utf8") : ""
  }
  return tree
}

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1")
const sourceFiles = (tree) => Object.keys(tree).filter((f) => SOURCE.test(f) && !TEST_FILE.test(f))
const dirOf = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".")
const nameOf = (file) => file.slice(file.lastIndexOf("/") + 1)

const NAVIGATION_IMPORT = /import\s+([^;'"]*?)\s*from\s*["']next\/navigation["']/g
const NAVIGATION_DYNAMIC = /(?:\bimport\s*\(|\brequire\s*\()\s*["']next\/navigation["']/

/** Identifiants locaux sous lesquels `notFound` est importé de "next/navigation" (alias compris). */
function notFoundLocals(code) {
  const locals = []
  for (const [, clause] of code.matchAll(NAVIGATION_IMPORT)) {
    const named = clause.match(/\{([^}]*)\}/)?.[1] ?? ""
    for (const part of named.split(",")) {
      const m = part.trim().match(/^notFound(?:\s+as\s+([\w$]+))?$/)
      if (m) locals.push(m[1] ?? "notFound")
    }
  }
  return locals
}

/** Le fichier importe notFound de next/navigation ou appelle notFound() / son alias. */
function usesNotFound(source) {
  const code = stripComments(source)
  const locals = notFoundLocals(code)
  if (locals.length > 0) return true
  return /(?<![\w$.])notFound\s*\(/.test(code)
}

/** Fichiers qui importent next/navigation en espace de noms ou dynamiquement (alias non suivi). */
function untrackedNavigationImports(tree) {
  return sourceFiles(tree).filter((f) => {
    const code = stripComments(tree[f])
    const namespaced = [...code.matchAll(NAVIGATION_IMPORT)].some(([, clause]) => /\*\s*as\s+[\w$]+/.test(clause))
    return namespaced || NAVIGATION_DYNAMIC.test(code)
  })
}

/** Dossiers (chemins relatifs) à tenir pour des segments notFound : appel détecté ou segment dynamique avec page. */
function notFoundSegments(tree) {
  const segments = new Set()
  for (const f of sourceFiles(tree)) {
    if (usesNotFound(tree[f])) segments.add(dirOf(f))
    if (PAGE.test(f)) {
      const dir = dirOf(f)
      if (dir !== "." && DYNAMIC_SEGMENT.test(nameOf(dir))) segments.add(dir)
    }
  }
  return [...segments]
}

/** Le segment, puis chacun de ses parents jusqu'à la racine (« . »). */
function chain(segment) {
  const dirs = []
  let d = segment
  while (d !== ".") {
    dirs.push(d)
    d = dirOf(d)
  }
  dirs.push(".")
  return dirs
}

const loadingIn = (tree, dir) => Object.keys(tree).some((f) => dirOf(f) === dir && LOADING.test(nameOf(f)))
const notFoundFileIn = (tree, dir) => Object.keys(tree).some((f) => dirOf(f) === dir && NOT_FOUND_FILE.test(nameOf(f)))
const loadingOffenders = (tree) =>
  notFoundSegments(tree).flatMap((segment) => chain(segment).filter((d) => loadingIn(tree, d)))

const real = readTree(ROOT)

describe("structure de src/app/(student) : le 404 reste un 404", () => {
  it("repère les segments qui appellent notFound() ou portent un identifiant dynamique", () => {
    expect(notFoundSegments(real).sort()).toEqual(
      ["messages/[missionId]", "student/missions/[id]", "student/review/[missionId]"].sort(),
    )
  })

  it("aucun loading.* dans un segment qui appelle notFound() ni dans un de ses parents", () => {
    expect(loadingOffenders(real)).toEqual([])
  })

  it("chaque segment qui appelle notFound() a son not-found.*, dans la coquille", () => {
    const missing = notFoundSegments(real).filter((s) => !notFoundFileIn(real, s))
    expect(missing).toEqual([])
  })

  it("aucun import de next/navigation en espace de noms ou dynamique (l'alias de notFound ne serait pas suivi)", () => {
    expect(untrackedNavigationImports(real)).toEqual([])
  })
})

describe("détecteurs de structure (fixtures en mémoire)", () => {
  const page = "export default function Page() { return null }"
  const withNotFound = (importLine, call = "notFound()") => `${importLine}\nexport default function Page() { ${call} }`

  it("voit un loading.js posé dans un parent d'un segment notFound (vrai positif)", () => {
    const tree = {
      "applications/loading.js": "export default function Loading() { return null }",
      "applications/[id]/page.js": withNotFound('import { notFound } from "next/navigation"'),
    }
    expect(notFoundSegments(tree)).toEqual(["applications/[id]"])
    expect(chain("applications/[id]")).toEqual(["applications/[id]", "applications", "."])
    expect(loadingOffenders(tree)).toEqual(["applications"])
  })

  it.each(["loading.js", "loading.jsx", "loading.ts", "loading.tsx"])("voit %s", (name) => {
    const tree = { [`messages/${name}`]: "", "messages/[id]/page.js": page }
    expect(loadingOffenders(tree)).toEqual(["messages"])
  })

  it("ne confond pas un autre fichier avec un loading", () => {
    const tree = { "messages/loading-state.js": "", "messages/[id]/page.js": page }
    expect(loadingOffenders(tree)).toEqual([])
  })

  it("suit notFound importé sous un alias, sur une ou plusieurs lignes", () => {
    for (const importLine of [
      'import { notFound as nf } from "next/navigation"',
      'import {\n  redirect,\n  notFound as nf,\n} from "next/navigation"',
      "import { redirect, notFound } from 'next/navigation'",
    ]) {
      const tree = { "a/page.js": withNotFound(importLine, "nf()"), "a/loading.js": "" }
      expect(notFoundSegments(tree), importLine).toEqual(["a"])
      expect(loadingOffenders(tree), importLine).toEqual(["a"])
    }
  })

  it("ignore un import de next/navigation sans notFound et la mention en commentaire", () => {
    const tree = {
      "a/page.js": '// notFound() est évoqué ici\n/* notFound() */\nimport { redirect } from "next/navigation"\nexport default () => redirect("/")',
      "a/loading.js": "",
    }
    expect(notFoundSegments(tree)).toEqual([])
    expect(loadingOffenders(tree)).toEqual([])
  })

  it("ignore un notFound importé d'un autre module et une URL contenant « // » avant l'appel", () => {
    expect(notFoundSegments({ "a/page.js": 'import { notFound } from "@/lib/autre"\nexport default () => null' })).toEqual([])
    expect(notFoundSegments({ "a/page.js": 'const u = "https://x.example"; notFound()' })).toEqual(["a"])
  })

  it("refuse import * as, import dynamique et require de next/navigation", () => {
    const tree = {
      "a/page.js": 'import * as nav from "next/navigation"\nnav.notFound()',
      "b/page.js": 'const nav = await import("next/navigation")',
      "c/page.js": 'const nav = require("next/navigation")',
      "d/page.js": 'import { redirect } from "next/navigation"',
    }
    expect(untrackedNavigationImports(tree).sort()).toEqual(["a/page.js", "b/page.js", "c/page.js"])
  })

  it("tient tout segment dynamique qui contient une page pour un segment notFound (fail-closed)", () => {
    const tree = {
      "x/[slug]/page.js": page,
      "x/[...rest]/page.jsx": page,
      "x/[[...opt]]/page.tsx": page,
      "x/[slug]/loading.js": "",
      "y/[vide]/layout.js": page,
      "y/fixe/page.js": page,
    }
    expect(notFoundSegments(tree).sort()).toEqual(["x/[...rest]", "x/[[...opt]]", "x/[slug]"].sort())
    expect(loadingOffenders(tree)).toEqual(["x/[slug]"])
  })

  it("ne tient pas les fichiers de test pour des segments notFound", () => {
    expect(notFoundSegments({ "a/page.test.js": "notFound()" })).toEqual([])
  })

  it("exige un not-found.* par segment", () => {
    const tree = { "a/[id]/page.js": page, "b/[id]/page.js": page, "b/[id]/not-found.tsx": "" }
    expect(notFoundSegments(tree).filter((s) => !notFoundFileIn(tree, s))).toEqual(["a/[id]"])
  })
})
