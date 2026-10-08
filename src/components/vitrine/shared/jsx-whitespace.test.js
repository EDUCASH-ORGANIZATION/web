import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Garde-fou : le compilateur SWC de Next supprime l'espace qui suit une balise ou une
// expression JSX quand le texte qui suit contient une entité HTML (&rsquo;, &nbsp;...)
// ET un retour à la ligne. Résultat : "<b>avant</b> que" s'affiche "avantque".
// Correctif : écrire {" "} après la balise, ou garder le texte sur une seule ligne.
const SRC = path.resolve(__dirname, "../../..")
// Exceptions connues, hors vitrine, à traiter dans un lot dédié (fichier:ligne).
const KNOWN_EXCEPTIONS = new Set([
  "app/(student)/profile/edit/page.js:174",
  "lib/email/templates/application-rejected.jsx:25",
  "components/admin/verifications-tabs.js:27",
])
// Texte JSX qui commence par des espaces juste après une balise ou une expression, puis
// contient une entité et un retour à la ligne. Exemple fautif :
//   <b>avant</b> que c&rsquo;est
//   la suite
// Le texte " que c'est..." perd son espace de tête : "avantque".
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

describe("espaces JSX", () => {
  it("détecte le motif fautif", () => {
    expect(findLostSpaces("<p><b>avant</b> que c&rsquo;est\n  ok</p>")).toEqual([1])
  })

  it("ignore les formes sûres", () => {
    expect(findLostSpaces('<p><b>avant</b>{" "}\n  que c&rsquo;est ok</p>')).toEqual([])
    expect(findLostSpaces("<p><b>avant</b> que c&rsquo;est ok</p>")).toEqual([])
    expect(findLostSpaces("<p><b>avant</b> que c'est\n  ok</p>")).toEqual([])
  })

  it("ne trouve aucune espace perdue dans src (hors exceptions connues)", () => {
    const offenders = sourceFiles(SRC)
      .flatMap((file) =>
        findLostSpaces(readFileSync(file, "utf8")).map((line) => `${path.relative(SRC, file)}:${line}`),
      )
      .filter((id) => !KNOWN_EXCEPTIONS.has(id))
    expect(offenders).toEqual([])
  })
})
