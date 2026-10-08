import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Garde-fou : le compilateur SWC de Next supprime l'espace qui suit une balise ou une
// expression JSX quand le texte qui suit contient une entité HTML (&rsquo;, &nbsp;...)
// ET un retour à la ligne. Résultat : "<b>avant</b> que" s'affiche "avantque".
// Correctif : écrire {" "} après la balise, ou garder le texte sur une seule ligne.
const SRC = path.resolve(__dirname, "../../..")
const ROOTS = [
  "app/(home)",
  "app/(public)",
  "app/(mission-detail)",
  "app/about",
  "app/contact",
  "app/legal",
  "components/vitrine",
]
const LEADING_TEXT = /(?<=[>}])([ \t]+)([^<>{}]*)(?=[<{])/g
const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);/

function sourceFiles(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) return []
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

function findLostSpaces(code) {
  const found = []
  for (const match of code.matchAll(LEADING_TEXT)) {
    const body = match[2]
    if (ENTITY.test(body) && body.includes("\n")) {
      found.push(code.slice(0, match.index).split("\n").length)
    }
  }
  return found
}

describe("espaces JSX dans la vitrine", () => {
  it("détecte le motif fautif", () => {
    expect(findLostSpaces("<p><b>avant</b> que c&rsquo;est\n  ok</p>")).toEqual([1])
  })

  it("ignore les formes sûres", () => {
    expect(findLostSpaces('<p><b>avant</b>{" "}\n  que c&rsquo;est ok</p>')).toEqual([])
    expect(findLostSpaces("<p><b>avant</b> que c&rsquo;est ok</p>")).toEqual([])
    expect(findLostSpaces("<p><b>avant</b> que c'est\n  ok</p>")).toEqual([])
  })

  it("ne trouve aucune espace perdue dans les fichiers de la vitrine", () => {
    const offenders = ROOTS.flatMap((root) =>
      sourceFiles(path.join(SRC, root)).flatMap((file) =>
        findLostSpaces(readFileSync(file, "utf8")).map((line) => `${path.relative(SRC, file)}:${line}`),
      ),
    )
    expect(offenders).toEqual([])
  })
})
