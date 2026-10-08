import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { AIDE_THEMES, POPULAR_QUESTIONS } from "../aide/aide-content"

// Garde-fou : chaque lien d'ancre écrit en dur ("/route#id", "#id") du site public doit viser un id
// présent dans les fichiers qui rendent la route. Un lien vers une route absente de ROUTE_FILES échoue.
const SRC = path.resolve(__dirname, "../../..")
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8")

// Route d'ancre -> fichiers qui rendent ses ids.
const ROUTE_FILES = {
  "/": ["components/vitrine/home/home-steps.jsx"],
  "/aide": ["components/vitrine/aide/aide-content.js"],
  "/clients": ["components/vitrine/clients/clients-sections.jsx"],
  "/legal/terms": ["app/legal/terms/page.js"],
}

// Liens qui ne sont pas des ancres de page.
const IGNORED_HREF = /^\/sprite\.svg/

// Exceptions connues : composant MUI mort (importé nulle part), lien sans cible, hors périmètre RD-FIX-08.
const KNOWN_EXCEPTIONS = new Set(["components/shared/navbar.jsx"])

// Espaces connectés, hors périmètre.
const SKIPPED_DIRS = [/^app\/\((student|client|admin)\)\//, /^components\/(student|client|admin)\//]

const HREF_LITERAL = /href(?:=\{?|:\s*)(["'])([^"'`$]*#[^"'`$]*)\1/g

function sourceFiles(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) return []
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

function pageRoute(rel) {
  const match = rel.match(/^app\/(?:\((?:home|vitrine)\)\/)?(.*?)\/?page\.jsx?$/)
  return match ? `/${match[1]}` : null
}

function hasId(code, id) {
  return code.includes(`id="${id}"`) || code.includes(`id: "${id}"`)
}

// Liens d'ancre en dur : { file, href, route, id }. `route` est la page visée ("" = lien "#id" local).
function collectAnchors() {
  const found = []
  for (const full of sourceFiles(SRC)) {
    const rel = path.relative(SRC, full).split(path.sep).join("/")
    if (KNOWN_EXCEPTIONS.has(rel) || SKIPPED_DIRS.some((re) => re.test(rel))) continue
    for (const match of readFileSync(full, "utf8").matchAll(HREF_LITERAL)) {
      const href = match[2]
      if (IGNORED_HREF.test(href)) continue
      const at = href.indexOf("#")
      found.push({ file: rel, href, route: href.slice(0, at), id: decodeURIComponent(href.slice(at + 1)) })
    }
  }
  return found
}

const anchors = collectAnchors()

describe("ancres du site public", () => {
  it("trouve les ancres connues", () => {
    const hrefs = anchors.map((a) => a.href)
    for (const expected of ["/#etapes", "/aide#sequestre", "/aide#retraits", "/aide#achats", "#sequestre", "/legal/terms#achats", "#achats"]) {
      expect(hrefs).toContain(expected)
    }
  })

  it("chaque ancre vise un id existant", () => {
    const errors = []
    for (const { file, href, route, id } of anchors) {
      let files
      if (route === "") {
        // Lien local "#id" : la page qui l'écrit, ou le dossier de la fonctionnalité qui rend ses ids.
        const page = pageRoute(file)
        files = [file, ...(ROUTE_FILES[page] ?? [])]
        if (file === "components/vitrine/clients/clients-hero.jsx") files.push(...ROUTE_FILES["/clients"])
      } else {
        files = ROUTE_FILES[route]
        if (!files) {
          errors.push(`${file}: ${href} - route "${route}" absente de ROUTE_FILES`)
          continue
        }
      }
      if (!files.some((f) => hasId(read(f), id))) errors.push(`${file}: ${href} - id "${id}" introuvable dans ${files.join(", ")}`)
    }
    expect(errors).toEqual([])
  })

  it("la liste d'exceptions ne contient que des fichiers existants qui portent bien une ancre morte", () => {
    for (const rel of KNOWN_EXCEPTIONS) {
      expect(read(rel)).toContain("/#how-it-works")
      expect(hasId(read("components/vitrine/home/home-steps.jsx"), "how-it-works")).toBe(false)
    }
  })
})

describe("composant de lien d'ancre", () => {
  it("aucun lien next/link ne porte une ancre en dur : ils passent par AnchorLink", () => {
    const errors = []
    for (const full of sourceFiles(SRC)) {
      const rel = path.relative(SRC, full).split(path.sep).join("/")
      if (KNOWN_EXCEPTIONS.has(rel) || SKIPPED_DIRS.some((re) => re.test(rel))) continue
      const code = readFileSync(full, "utf8")
      for (const match of code.matchAll(/<Link\b[^>]*href=\{?"[^"]*#[^"]*"/g)) errors.push(`${rel}: ${match[0]}`)
    }
    expect(errors).toEqual([])
  })

  it("les liens d'ancre des heros, du bandeau séquestre et de l'aide utilisent AnchorLink", () => {
    const expected = {
      "components/vitrine/clients/clients-hero.jsx": "#sequestre",
      "components/vitrine/shared/payers.jsx": "/aide#sequestre",
      "components/vitrine/shared/escrow-note.jsx": "/aide#sequestre",
      "app/legal/mentions/page.js": "/legal/terms#achats",
    }
    for (const [rel, href] of Object.entries(expected)) {
      const code = read(rel)
      expect(code, rel).toMatch(new RegExp(`<AnchorLink[^>]*href="${href}"`))
    }
    expect(read("app/contact/page.js")).toMatch(/<AnchorLink[^>]*href=\{l\.href\}/)
  })
})

describe("ancres dynamiques", () => {
  it("lien d'évitement : #contenu est l'id du main par défaut", () => {
    const code = read("components/vitrine/shared/vitrine-page.jsx")
    expect(code).toContain('mainId = "contenu"')
    expect(code).toContain("href={`#${mainId}`}")
    expect(code).toContain("id={mainId}")
  })

  it("aide : les pastilles et le sommaire des thèmes pointent vers des ids rendus", () => {
    const ids = new Set(AIDE_THEMES.flatMap((theme) => [theme.id, ...theme.items.map((item) => item.id)]))
    for (const { id } of POPULAR_QUESTIONS) expect(ids.has(id), `pastille #${id}`).toBe(true)
    const code = read("components/vitrine/aide/aide-search.jsx")
    expect(code).toContain("href={`#${theme.id}`}")
    expect(code).toContain("id={theme.id}")
    expect(read("components/vitrine/shared/faq.jsx")).toContain("id={id}")
  })

  it("mentions et conditions : le sommaire et les sections partagent le même id", () => {
    expect(read("components/vitrine/legal/legal-layout.jsx")).toContain("href={`#${id}`}")
    expect(read("components/vitrine/legal/legal-section.jsx")).toContain("<section id={id}>")
  })
})
