#!/usr/bin/env node
// Banc de fidélité : compare la planche v2.1 et le rendu du code, sélecteur par sélecteur.
// Usage : npm run fidelity -- E06 [E07,C12 ...] [--report-only]
// Variables : FIDELITY_OUT (défaut /tmp/educash-fidelity), FIDELITY_CHROMIUM (chemin du Chromium,
// obligatoire hors cache Playwright), FIDELITY_MAQUETTES (dossier des planches).
import { spawnSync } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { measureSelectors } from "./measure.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "../..")
const SPECS_DIR = path.join(HERE, "specs")
// Planches : dossier frère de organization/ (valable depuis web/ et depuis organization/web-*).
const DEFAULT_MAQUETTES = path.resolve(ROOT, "../../design-rebrand/maquettes")
const STATUS_BAR = 36

// ---------------------------------------------------------------------------------------------
// Comparaison (pure, testable)
// ---------------------------------------------------------------------------------------------

// tw : largeur du texte lui-même (mesure.mjs), comparée comme w.
const NUMERIC = new Set(["x", "y", "w", "h", "tw"])
const PX_LIST = new Set(["fontSize", "lineHeight", "radius", "pad", "margin", "gap", "cols"])
const COLOR = new Set(["color", "bg"])
// A1 : couleurs des planches -> couleurs de la charte (encre, givre, ardoise, fond bleu clair).
const A1 = { "14,15,26": "23,33,58", "244,245,250": "243,245,252", "91,95,115": "58,62,82", "231,233,255": "230,233,255" }

const parseRgb = (value) => (value.match(/rgba?\(([^)]+)\)/)?.[1] ?? "").split(",").map((part) => part.trim())
const rgbKey = (value) => parseRgb(value).slice(0, 3).join(",")
const alphaOf = (value) => {
  const parts = parseRgb(value)
  return parts.length === 4 ? parts[3] : "1"
}

function parsePxList(value) {
  const tokens = String(value).split(/\s+/).filter(Boolean)
  const numbers = tokens.map((token) => (/^-?\d+(\.\d+)?px$/.test(token) ? parseFloat(token) : /^-?\d+(\.\d+)?$/.test(token) ? parseFloat(token) : null))
  return numbers.every((n) => n !== null) ? numbers : null
}

// Codes autorisés : A1..A7 (plan), L3 (coquille mobile), POLICE (police de repli), X1 (écart non expliqué).
const RULES = new Set(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "L3", "POLICE", "X1"])
const POLICE_PROPS = new Set(["w", "tw"])

/**
 * Analyse une règle assumée : "A3:4", "A2+A3:5" (cumul : plusieurs codes pour une limite), "A1".
 * Refuse tout code hors liste blanche, POLICE hors w/tw ou sans limite, une limite absente ou invalide
 * pour une propriété numérique ou en px. `prop` est facultatif (validation des spécifications).
 */
export function parseAssume(rule, prop) {
  if (!rule) return null
  const [codes, limit, ...extra] = String(rule).split(":")
  const names = codes.split("+").filter(Boolean)
  if (!names.length || extra.length) throw new Error(`Règle assumée invalide : « ${rule} »`)
  for (const name of names) {
    if (!RULES.has(name)) throw new Error(`Règle assumée inconnue : « ${name} » (« ${rule} »). Autorisées : ${[...RULES].join(", ")}`)
  }
  const max = limit === undefined ? null : Number(limit)
  if (max !== null && (!Number.isFinite(max) || max < 0)) throw new Error(`Limite invalide dans « ${rule} »`)
  if (names.includes("POLICE")) {
    if (names.length > 1) throw new Error(`POLICE ne se cumule pas (« ${rule} »)`)
    if (max === null) throw new Error(`POLICE exige une limite (« ${rule} »)`)
    if (prop && !POLICE_PROPS.has(prop)) throw new Error(`POLICE est limité à w et tw, pas « ${prop} » (« ${rule} »)`)
  }
  if (prop && (NUMERIC.has(prop) || PX_LIST.has(prop)) && max === null) {
    throw new Error(`Limite obligatoire pour la propriété numérique « ${prop} » (« ${rule} »)`)
  }
  return { name: names[0], names, max }
}

/**
 * Valide une spécification : règles reconnues et toute règle à limite (« Ax:n ») accompagnée d'une
 * explication (`note` du sélecteur, ou `assumeNote` pour les règles de la spécification ou de la vue).
 */
export function validateSpec(spec) {
  const problems = []
  const check = (assume, prop, where, hasNote) => {
    const rule = assume[prop]
    try {
      const parsed = parseAssume(rule, prop)
      if (parsed && parsed.max !== null && !hasNote) problems.push(`${where} : règle « ${prop}: ${rule} » sans note`)
    } catch (error) {
      problems.push(`${where} : ${error.message}`)
    }
  }
  const scan = (assume, where, hasNote) => {
    for (const prop of Object.keys(assume ?? {})) check(assume, prop, where, hasNote)
  }
  scan(spec.assume, `${spec.id}`, Boolean(spec.assumeNote))
  for (const view of spec.views ?? []) {
    scan(view.assume, `${spec.id}/${view.name}`, Boolean(view.assumeNote || spec.assumeNote))
    for (const selector of view.selectors ?? []) {
      scan(selector.assume, `${spec.id}/${view.name}/${selector.id} ${selector.label ?? ""}`.trim(), Boolean(selector.note))
    }
  }
  if (problems.length) throw new Error(`Spécification invalide :\n- ${problems.join("\n- ")}`)
  return spec
}

/** Écart d'une propriété : { equal, delta, label } ; delta numérique quand elle existe. */
export function diffProp(prop, board, code, tolerance = 1) {
  if (NUMERIC.has(prop)) {
    const delta = code - board
    return { equal: Math.abs(delta) <= tolerance, delta, label: `${prop}${delta >= 0 ? "+" : ""}${delta}` }
  }
  if (PX_LIST.has(prop)) {
    const left = parsePxList(board)
    const right = parsePxList(code)
    if (left && right && left.length === right.length) {
      const deltas = right.map((n, i) => n - left[i])
      const worst = deltas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0)
      return { equal: Math.abs(worst) <= tolerance, delta: worst, label: `${prop}${worst >= 0 ? "+" : ""}${worst}` }
    }
  }
  return { equal: board === code, delta: null, label: `${prop} ${board} -> ${code}` }
}

/**
 * Compare les mesures d'un sélecteur. `assume` : { prop: "A3:4" } (règle assumée, écart maximal en px
 * pour les propriétés numériques ; sans maximum seulement pour les chaînes). A1 sur une couleur
 * n'accepte que la correspondance exacte planche -> charte.
 */
export function compareEntry(board, code, { props, assume = {}, tolerance = 1 }) {
  if (!board && !code) return { status: "ÉCHEC", note: "absent des deux côtés", diffs: [] }
  if (!board) return { status: "ÉCHEC", note: "absent de la planche", diffs: [] }
  if (!code) return { status: "ÉCHEC", note: "absent du code", diffs: [] }
  const diffs = []
  const rules = new Set()
  let failed = false
  for (const prop of props) {
    const diff = diffProp(prop, board[prop], code[prop], tolerance)
    if (diff.equal) continue
    const rule = parseAssume(assume[prop], prop)
    let accepted = false
    if (rule) {
      if (rule.names.includes("A1")) {
        accepted = COLOR.has(prop) && rule.names.length === 1 && A1[rgbKey(board[prop])] === rgbKey(code[prop]) && alphaOf(board[prop]) === alphaOf(code[prop])
      } else if (diff.delta !== null) {
        accepted = rule.max !== null && Math.abs(diff.delta) <= rule.max
      } else {
        accepted = rule.max === null
      }
    }
    if (accepted) rule.names.forEach((name) => rules.add(name))
    else failed = true
    diffs.push({ prop, label: diff.label, rule: accepted ? rule.names.join("+") : null })
  }
  if (failed) return { status: "ÉCHEC", note: "", diffs }
  if (rules.size) {
    const names = [...rules].sort()
    // POLICE : écart de largeur dû à la police de repli (Google Fonts non chargées), statut distinct.
    // X1 : écart non expliqué, jamais mélangé aux écarts assumés (compté à part).
    const status = names.includes("X1")
      ? `NON EXPLIQUÉ ${names.join(", ")}`
      : names.length === 1 && names[0] === "POLICE"
        ? "ASSUMÉ-POLICE"
        : `ASSUMÉ ${names.join(", ")}`
    return { status, note: "", diffs }
  }
  return { status: "OK", note: "", diffs }
}

// ---------------------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------------------

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" }

/** Chemin absolu de `relative` sous `base`, ou null s'il en sort (traversée de dossier). */
export function resolveInside(base, relative) {
  const root = path.resolve(base)
  const target = path.resolve(root, `.${relative.startsWith("/") ? "" : "/"}${relative}`)
  if (target !== root && !target.startsWith(root + path.sep)) return null
  // Étanche aux liens symboliques : la cible réelle doit rester sous la racine réelle.
  try {
    const realRoot = realpathSync(root)
    const realTarget = realpathSync(target)
    return realTarget === realRoot || realTarget.startsWith(realRoot + path.sep) ? target : null
  } catch {
    return null
  }
}

/** Fichier servi pour une URL brute, ou null (URL mal encodée, hors racine publique, octet nul). */
export function fileForUrl({ out, maquettes, publicDir }, rawUrl) {
  let url
  try {
    url = decodeURIComponent((rawUrl || "/").split("?")[0])
  } catch {
    return null
  }
  if (url.includes("\0")) return null
  if (url === "/app.css") return path.join(out, "app.css")
  if (url.startsWith("/screens/")) return resolveInside(out, url)
  if (url.startsWith("/maquettes/")) return resolveInside(maquettes, url.slice("/maquettes/".length))
  return resolveInside(publicDir, url)
}

function startServer({ out, maquettes }) {
  const publicDir = path.join(ROOT, "public")
  const server = createServer((req, res) => {
    const file = fileForUrl({ out, maquettes, publicDir }, req.url)
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

async function buildCss(out) {
  const require = createRequire(path.join(ROOT, "package.json"))
  const postcss = require("postcss")
  const tailwind = require("@tailwindcss/postcss")
  const from = path.join(ROOT, "src/app/globals.css")
  const result = await postcss([tailwind({ base: ROOT })]).process(readFileSync(from, "utf8"), { from })
  writeFileSync(path.join(out, "app.css"), result.css)
}

function renderScreens(out, names) {
  const run = spawnSync(
    "npx",
    ["vitest", "run", "--config", "scripts/fidelity/vitest.fidelity.config.mjs"],
    { cwd: ROOT, env: { ...process.env, FIDELITY_OUT: out, FIDELITY_SCREENS: names.join(",") }, encoding: "utf8" },
  )
  if (run.status !== 0) {
    process.stderr.write(`${run.stdout}\n${run.stderr}\n`)
    throw new Error("Rendu des vues en échec (voir ci-dessus).")
  }
}

async function launchBrowser() {
  const require = createRequire(path.join(ROOT, "package.json"))
  const { chromium } = require("playwright-core")
  const executablePath = process.env.FIDELITY_CHROMIUM || chromium.executablePath()
  if (!existsSync(executablePath)) {
    throw new Error(`Chromium introuvable (${executablePath}). Définir FIDELITY_CHROMIUM (aucun téléchargement n'est fait).`)
  }
  return chromium.launch({ executablePath })
}

const loadSpecs = (ids) => {
  const all = readdirSync(SPECS_DIR).filter((name) => name.endsWith(".json")).map((name) => validateSpec(JSON.parse(readFileSync(path.join(SPECS_DIR, name), "utf8"))))
  if (!ids.length) return all
  const unknown = ids.filter((id) => !all.some((spec) => spec.id === id))
  if (unknown.length) throw new Error(`Spécification inconnue : ${unknown.join(", ")}. Disponibles : ${all.map((s) => s.id).join(", ")}`)
  return ids.map((id) => all.find((spec) => spec.id === id))
}

const cell = (m) => (m ? `x${m.x} y${m.y} w${m.w} h${m.h}` : "absent")

async function runView({ browser, base, spec, view, outDir }) {
  const file = `${base}/maquettes/${spec.planche}`
  const boardContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const boardPage = await boardContext.newPage()
  try {
    await boardPage.goto(file, { waitUntil: "networkidle", timeout: 15000 })
  } catch {
    await boardPage.goto(file, { waitUntil: "load" })
  }
  await boardPage.evaluate(() => document.fonts.ready)
  await boardPage.waitForTimeout(250)
  const frameClass = view.frame === "phone" ? ".frame-phone__screen" : ".frame-desk__screen"
  const frames = await boardPage.$$(frameClass)
  const frame = frames[view.frameIndex ?? 0]
  if (!frame) throw new Error(`${spec.id}/${view.name} : cadre ${frameClass}[${view.frameIndex ?? 0}] introuvable dans la planche.`)
  await boardPage.evaluate(([cls, i]) => document.querySelectorAll(cls)[i].setAttribute("data-fidelity-root", ""), [frameClass, view.frameIndex ?? 0])
  await frame.screenshot({ path: path.join(outDir, `planche-${view.name}.png`) })

  const [width, height] = view.viewport
  const codeContext = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 1024 })
  const codePage = await codeContext.newPage()
  await codePage.goto(`${base}/screens/${spec.screen}.html`, { waitUntil: "load" })
  await codePage.evaluate(() => document.fonts.ready)
  await codePage.waitForTimeout(250)
  await codePage.screenshot({ path: path.join(outDir, `code-${view.name}.png`) })

  const boardSelectors = Object.fromEntries(view.selectors.map((s, i) => [`k${i}`, s.board]))
  const codeSelectors = Object.fromEntries(view.selectors.map((s, i) => [`k${i}`, s.code ?? s.board]))
  const boardDy = view.frame === "phone" ? -(view.statusBar ?? STATUS_BAR) : 0
  const boardMeasures = await measureSelectors(boardPage, "[data-fidelity-root]", boardSelectors, boardDy)
  const codeMeasures = await measureSelectors(codePage, "body", codeSelectors, 0)
  await boardContext.close()
  await codeContext.close()

  return view.selectors.map((selector, index) => {
    const key = `k${index}`
    const props = selector.props ?? view.props ?? spec.props ?? ["x", "y", "w", "h"]
    const assume = { ...(spec.assume ?? {}), ...(view.assume ?? {}), ...(selector.assume ?? {}) }
    const result = compareEntry(boardMeasures[key], codeMeasures[key], { props, assume, tolerance: spec.tolerance ?? 1 })
    return { view: view.name, id: selector.id, label: selector.label ?? "", lot: selector.lot ?? "", specNote: selector.note ?? "", board: boardMeasures[key], code: codeMeasures[key], ...result }
  })
}

function reportMarkdown(spec, rows) {
  const lines = [`# ${spec.id} - ${spec.title}`, "", `Planche : \`${spec.planche}\``, "", "| Vue | Réf. | Élément | Planche | Code | Écart | Statut | Lot |", "|---|---|---|---|---|---|---|---|"]
  for (const row of rows) {
    const diffs = row.note || row.diffs.map((d) => (d.rule ? `${d.label} (${d.rule})` : d.label)).join(", ") || "-"
    const gap = row.specNote ? `${diffs} - ${row.specNote}` : diffs
    lines.push(`| ${row.view} | ${row.id} | ${row.label} | ${cell(row.board)} | ${cell(row.code)} | ${gap} | ${row.status} | ${row.lot || "-"} |`)
  }
  const count = (test) => rows.filter(test).length
  const assumed = count((r) => r.status.startsWith("ASSUMÉ "))
  const withPolice = count((r) => r.status.startsWith("ASSUMÉ ") && r.status.includes("POLICE"))
  lines.push(
    "",
    `OK : ${count((r) => r.status === "OK")} - ASSUMÉ : ${assumed} (dont avec POLICE : ${withPolice}) - ASSUMÉ-POLICE : ${count((r) => r.status === "ASSUMÉ-POLICE")} - NON EXPLIQUÉ (X1) : ${count((r) => r.status.startsWith("NON EXPLIQUÉ"))} - ÉCHEC : ${count((r) => r.status === "ÉCHEC")}`,
    "",
  )
  return lines.join("\n")
}

async function main() {
  const args = process.argv.slice(2)
  const reportOnly = args.includes("--report-only")
  const ids = args.filter((a) => !a.startsWith("--")).flatMap((a) => a.split(",")).filter(Boolean)
  const out = path.resolve(process.env.FIDELITY_OUT || "/tmp/educash-fidelity")
  const maquettes = process.env.FIDELITY_MAQUETTES || DEFAULT_MAQUETTES
  const specs = loadSpecs(ids)
  mkdirSync(out, { recursive: true })

  await buildCss(out)
  renderScreens(out, [...new Set(specs.map((s) => s.screen))])
  const server = await startServer({ out, maquettes })
  const base = `http://127.0.0.1:${server.address().port}`
  let browser = null
  let failures = 0
  try {
    browser = await launchBrowser()
    for (const spec of specs) {
      const outDir = path.join(out, spec.id)
      mkdirSync(outDir, { recursive: true })
      const rows = []
      for (const view of spec.views) rows.push(...(await runView({ browser, base, spec, view, outDir })))
      writeFileSync(path.join(outDir, "rapport.md"), reportMarkdown(spec, rows))
      writeFileSync(path.join(outDir, "rapport.json"), JSON.stringify(rows, null, 1))
      process.stdout.write(`${reportMarkdown(spec, rows)}\n`)
      failures += rows.filter((r) => r.status === "ÉCHEC").length
    }
  } finally {
    if (browser) await browser.close()
    server.close()
  }
  process.stdout.write(`Captures et rapports : ${out}\n`)
  if (failures && !reportOnly) {
    process.stdout.write(`${failures} écart(s) hors tolérance (code de sortie 1 ; --report-only pour l'ignorer).\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
  })
}
