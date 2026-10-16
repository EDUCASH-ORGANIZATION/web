import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

// RD-ACCEPT-01 : plus aucune date de rétention ne vient de updated_at (réécrite par le trigger à chaque mise à
// jour, donc déplaçable par le client). La date vient de applications.accepted_at, posée par la base et lue par
// src/lib/actions/application-accepted-core.js. Ce garde lit les sources de src/ (hors tests).
const SRC = path.join(process.cwd(), "src")

// Motifs interdits partout dans src/ (hors tests).
const FORBIDDEN_EVERYWHERE = [
  /acceptedAt:\s*[^,\n]*updated_?[aA]t/,
  /retainedAt[^\n]*updated/,
  /Retenue le \$\{formatShortDate\(row\.updatedAt\)\}/,
]
// Lecteurs de rétention : aucune construction de date depuis updated_at.
const RETENTION_READERS = [
  "lib/actions/student-applications.actions.js",
  "lib/actions/student-mission-detail.actions.js",
  "lib/actions/application-accepted-core.js",
  "lib/student-space/mission-view.js",
  "components/student-space/applications/applications-view.jsx",
  "components/student-space/mission/followup-view.jsx",
  "components/student-space/mission/mission-header.jsx",
]
const READER_ONLY = [/new Date\([^)]*updated_at/]

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

/** Motifs interdits trouvés dans `source` ; `reader` active les motifs propres aux lecteurs de rétention. */
export function retentionViolations(source, { reader }) {
  const patterns = reader ? [...FORBIDDEN_EVERYWHERE, ...READER_ONLY] : FORBIDDEN_EVERYWHERE
  return patterns.filter((re) => re.test(source)).map(String)
}

describe("date de rétention : jamais tirée de updated_at (source)", () => {
  const files = sourceFiles(SRC)

  it("la liste des lecteurs de rétention existe toujours", () => {
    const rel = files.map((f) => path.relative(SRC, f).split(path.sep).join("/"))
    for (const reader of RETENTION_READERS) expect(rel, reader).toContain(reader)
  })

  it("aucun fichier de src/ ne tire acceptedAt ou retainedAt de updated_at", () => {
    const found = []
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join("/")
      const hits = retentionViolations(readFileSync(file, "utf8"), { reader: RETENTION_READERS.includes(rel) })
      if (hits.length) found.push(`${rel} : ${hits.join(", ")}`)
    }
    expect(found).toEqual([])
  })

  it("le garde détecte les anciens usages", () => {
    const old = [
      "acceptedAt: recent.updated_at",
      "const x = { acceptedAt: new Date(a.updatedAt) }",
      "const retainedAt = application.updated_at",
      "<p>Retenue le ${formatShortDate(row.updatedAt)}</p>",
    ]
    for (const line of old) expect(retentionViolations(line, { reader: false }), line).not.toEqual([])
    expect(retentionViolations("const d = new Date(app.updated_at)", { reader: true })).not.toEqual([])
    expect(retentionViolations("acceptedAt: validAcceptedAt(byId.get(id))", { reader: true })).toEqual([])
  })
})
