import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou RD-SEC-01 : aucun tiret cadratin (U+2014) dans src/.
// Le motif est écrit en échappement unicode pour que ce fichier ne contienne jamais le caractère.

const ROOT = process.cwd()
const EM_DASH = new RegExp(String.fromCharCode(0x2014))

// Exceptions documentées : fichiers qui contiennent le caractère à dessein ou en attente de nettoyage.
// - Les tests qui vérifient l'absence du caractère l'écrivent dans leurs assertions.
// - Les pages admin sont nettoyées par la sous-tâche ST-09B (à retirer de la liste ensuite).
const EXCEPTIONS = [
  "src/app/(home)/page.test.js",
  "src/app/(public)/etudiants/page.test.js",
  "src/components/shared/install-prompt-logic.test.js",
  "src/lib/constants/mission-labels.test.js",
  "src/lib/email/auth-emails.guard.test.js",
  "src/lib/vitrine/vitrine-content.guard.test.js",
]
const EXCEPTION_PREFIXES = ["src/app/(admin)/"]
const EXCEPTION_FILES_PENDING = [
  "src/lib/actions/profile.actions.test.js",
  "src/lib/security/role-authority.guard.test.js",
]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function isException(rel) {
  return (
    EXCEPTIONS.includes(rel) ||
    EXCEPTION_FILES_PENDING.includes(rel) ||
    EXCEPTION_PREFIXES.some((prefix) => rel.startsWith(prefix))
  )
}

describe("aucun tiret cadratin dans src", () => {
  it("les fichiers hors exceptions n'en contiennent pas", () => {
    const hits = walk(path.join(ROOT, "src"))
      .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
      .filter((rel) => /\.(js|jsx|css|json|md)$/.test(rel) && !isException(rel))
      .filter((rel) => EM_DASH.test(readFileSync(path.join(ROOT, rel), "utf8")))
    expect(hits).toEqual([])
  })
})
