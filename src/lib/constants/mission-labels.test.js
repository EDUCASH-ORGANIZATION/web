import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  MISSION_TYPES,
  MISSION_TYPE_LABELS,
  MISSION_TYPE_TAGLINES,
  MISSION_TYPE_PHRASES,
  MISSION_TYPE_OPTIONS,
  missionTypeLabel,
} from "./missions.js"
import { TYPE_ICON } from "../vitrine/mission-icons.js"

const BANNED = /livraison|\bcourses?\b|coursiers?|saisie|commission/i

describe("dictionnaire des libellés de type", () => {
  it("chaque valeur de MISSION_TYPES a un libellé, une icône et une phrase", () => {
    for (const type of MISSION_TYPES) {
      expect(MISSION_TYPE_LABELS[type], type).toBeTruthy()
      expect(TYPE_ICON[type], type).toBeTruthy()
      expect(MISSION_TYPE_PHRASES[type], type).toBeTruthy()
    }
    expect(Object.keys(MISSION_TYPE_LABELS).sort()).toEqual([...MISSION_TYPES].sort())
    expect(Object.keys(MISSION_TYPE_PHRASES).sort()).toEqual([...MISSION_TYPES].sort())
  })

  it("les libellés sont uniques", () => {
    const labels = Object.values(MISSION_TYPE_LABELS)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("les valeurs en base sont inchangées et Démarches est ajoutée avant Autre", () => {
    expect([...MISSION_TYPES]).toEqual([
      "Babysitting",
      "Livraison",
      "Saisie",
      "Community Management",
      "Traduction",
      "Cours particuliers",
      "Démarches",
      "Autre",
    ])
  })

  it("aucun libellé, accroche ni phrase ne contient un mot banni", () => {
    const texts = [
      ...Object.values(MISSION_TYPE_LABELS),
      ...Object.values(MISSION_TYPE_TAGLINES),
      ...Object.values(MISSION_TYPE_PHRASES),
    ]
    for (const text of texts) expect(text).not.toMatch(BANNED)
  })

  it("les accroches ne portent que sur des types existants", () => {
    for (const type of Object.keys(MISSION_TYPE_TAGLINES)) {
      expect(MISSION_TYPES).toContain(type)
    }
    expect(MISSION_TYPE_TAGLINES.Livraison).toBe("Le marché à votre place")
  })

  it("aucun tiret cadratin", () => {
    const all = JSON.stringify([MISSION_TYPE_LABELS, MISSION_TYPE_TAGLINES, MISSION_TYPE_PHRASES])
    expect(all).not.toContain("—")
  })

  it("les icônes existent dans le sprite", () => {
    const sprite = readFileSync(join(process.cwd(), "public/sprite.svg"), "utf8")
    for (const type of MISSION_TYPES) {
      expect(sprite, TYPE_ICON[type]).toContain(`id="${TYPE_ICON[type]}"`)
    }
    expect(TYPE_ICON.Livraison).toBe("i-receipt")
    expect(TYPE_ICON["Démarches"]).toBe("i-building")
  })
})

describe("missionTypeLabel", () => {
  it("traduit une valeur connue", () => {
    expect(missionTypeLabel("Livraison")).toBe("Marché et achats")
    expect(missionTypeLabel("Démarches")).toBe("Démarches et files d'attente")
    expect(missionTypeLabel("Autre")).toBe("Autre besoin")
  })
  it("renvoie une compétence libre telle quelle", () => {
    expect(missionTypeLabel("Mathématiques")).toBe("Mathématiques")
  })
  it("renvoie une chaîne vide pour null et undefined", () => {
    expect(missionTypeLabel(null)).toBe("")
    expect(missionTypeLabel(undefined)).toBe("")
  })
  it("ne traite pas les clés héritées d'Object comme des types", () => {
    expect(missionTypeLabel("toString")).toBe("toString")
  })
})

describe("MISSION_TYPE_OPTIONS", () => {
  it("suit l'ordre de MISSION_TYPES avec la valeur en base", () => {
    expect(MISSION_TYPE_OPTIONS.map((o) => o.value)).toEqual([...MISSION_TYPES])
    for (const o of MISSION_TYPE_OPTIONS) expect(o.label).toBe(MISSION_TYPE_LABELS[o.value])
  })
})
