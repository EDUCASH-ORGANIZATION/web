import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

// Un type de mission est une valeur en base (ex. "Livraison") : on l'affiche toujours via missionTypeLabel.
// Ce garde-fou refuse tout affichage brut `{<identifiant>.type}` en position de texte JSX.
const ROOT = path.resolve(import.meta.dirname, "../../..")
const DIRS = ["src/app", "src/components"]

// Exceptions documentées : `type` n'est pas un type de mission.
const EXCEPTIONS = {
  "src/components/messages/location-picker-modal.js": "type d'un lieu renvoyé par la recherche d'adresses",
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, out)
    else if (/\.(jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel)
  }
  return out
}

// `{x.type}`, `{x?.type}`, `{x.mission.type}` hors attribut (pas de "=" ni de "$" juste avant l'accolade).
const RAW_TYPE = /(?<![=$])\{\s*[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\??\.type\s*\}/g

describe("affichage des types de mission", () => {
  it("aucun type affiché brut dans src/app et src/components", () => {
    const hits = []
    for (const file of DIRS.flatMap((d) => walk(d))) {
      if (file in EXCEPTIONS) continue
      const code = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
      for (const m of code.matchAll(RAW_TYPE)) hits.push(`${file}: ${m[0]}`)
    }
    expect(hits).toEqual([])
  })

  it("les exceptions existent encore et portent bien un affichage brut", () => {
    for (const file of Object.keys(EXCEPTIONS)) {
      expect(fs.readFileSync(path.join(ROOT, file), "utf8")).toMatch(RAW_TYPE)
    }
  })
})
