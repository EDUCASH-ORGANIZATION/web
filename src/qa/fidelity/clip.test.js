import { existsSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { measureSelectors } from "../../../scripts/fidelity/measure.mjs"

// Test facultatif : il exige un Chromium déjà installé (FIDELITY_CHROMIUM) et est sauté sinon.
// Aucun téléchargement, aucun échec en l'absence du navigateur.
const executablePath = process.env.FIDELITY_CHROMIUM
const available = Boolean(executablePath) && existsSync(executablePath)

const EXPECTED = {
  c1: "div.case.clip",
  c1b: null,
  c2: null,
  c2b: "div.case.clip",
  c3: null,
  c3b: "div.case.clip",
  c4: null,
  c6: null,
  c7: null,
  c7b: "div.case.clip",
  c8: "div.case.clip",
  c9: null,
  c10: "div.case",
  c13: "div.case",
  c14: null,
}

describe.skipIf(!available)("measure.mjs : clippedBy sur les cas de fixtures/clip-cases.html", () => {
  let browser
  let measures

  beforeAll(async () => {
    const require = createRequire(import.meta.url)
    const { chromium } = require("playwright-core")
    browser = await chromium.launch({ executablePath })
    const page = await browser.newPage({ viewport: { width: 600, height: 800 } })
    await page.goto(pathToFileURL(path.resolve("scripts/fidelity/fixtures/clip-cases.html")).href)
    const selectors = Object.fromEntries(Object.keys(EXPECTED).map((name) => [name, `#t-${name}`]))
    measures = await measureSelectors(page, "body", selectors)
  })

  afterAll(async () => {
    if (browser) await browser.close()
  })

  for (const [name, expected] of Object.entries(EXPECTED)) {
    it(`${name} : ${expected ? `rogné par ${expected}` : "non rogné"}`, () => {
      expect(measures[name].clippedBy).toBe(expected)
    })
  }
})
