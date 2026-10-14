import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

// Un loading.js enveloppe son segment et tous ses enfants dans un Suspense : le flux est alors déjà
// commencé quand notFound() est appelé, et la page répond 200 au lieu de 404. Ce test refuse tout
// loading.js dans un segment qui appelle notFound() ou dans un de ses parents, sous (student).
const ROOT = path.join(process.cwd(), "src/app/(student)")
const SOURCE = /\.jsx?$/
const TEST_FILE = /\.test\.jsx?$/

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return sources(full)
    return SOURCE.test(e.name) && !TEST_FILE.test(e.name) ? [full] : []
  })
}

const files = sources(ROOT)
const notFoundSegments = [
  ...new Set(
    files.filter((f) => /\bnotFound\s*\(/.test(readFileSync(f, "utf8").replace(/\/\/.*$/gm, ""))).map((f) => path.dirname(f)),
  ),
]

function chain(segment) {
  const dirs = []
  for (let d = segment; d.startsWith(ROOT); d = path.dirname(d)) dirs.push(d)
  return dirs
}

const loadingIn = (dir) => ["loading.js", "loading.jsx"].some((n) => existsSync(path.join(dir, n)))
const rel = (p) => path.relative(ROOT, p) || "."

describe("structure de src/app/(student) : le 404 reste un 404", () => {
  it("repère les segments qui appellent notFound()", () => {
    expect(notFoundSegments.map(rel).sort()).toEqual(
      ["messages/[missionId]", "student/missions/[id]", "student/review/[missionId]"].sort(),
    )
  })

  it("aucun loading.js dans un segment qui appelle notFound() ni dans un de ses parents", () => {
    const offenders = notFoundSegments.flatMap((segment) => chain(segment).filter(loadingIn).map(rel))
    expect(offenders).toEqual([])
  })

  it("chaque segment qui appelle notFound() a son not-found.js, dans la coquille", () => {
    const missing = notFoundSegments.filter((s) => !existsSync(path.join(s, "not-found.js"))).map(rel)
    expect(missing).toEqual([])
  })

  it("le détecteur voit un loading.js posé dans un parent (vrai positif)", () => {
    const fake = path.join(ROOT, "applications")
    expect(loadingIn(fake)).toBe(true)
    expect(chain(path.join(ROOT, "messages/[missionId]")).map(rel)).toEqual(["messages/[missionId]", "messages", "."])
  })
})
