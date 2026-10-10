import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { MISSION_TYPES } from "@/lib/constants/missions"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const DIRS = ["src/components/vitrine", "src/app/legal", "src/app/about", "src/app/contact", "src/app/(home)", "src/app/(public)", "src/app/(mission-detail)", "src/app/auth", "src/components/auth"]
// Composant partagé avec l'espace étudiant connecté (profile/edit), non refondu : hors périmètre du garde-fou.
const SKIP = new Set(["src/components/auth/card-upload-zone.js"])

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, out)
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) && !SKIP.has(rel)) out.push(rel)
  }
  return out
}
const files = DIRS.flatMap((d) => walk(d))
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")

// Texte "rendu" d'un fichier : commentaires retirés, et jetons exacts égaux à une valeur de MISSION_TYPES
// (valeurs en base, jamais affichées telles quelles) ignorés.
const TYPE_TOKENS = new RegExp(`(["'\`])(?:${MISSION_TYPES.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\1`, "g")
function visibleText(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[\s;,])\/\/.*$/gm, "$1")
    .replace(TYPE_TOKENS, '""')
}

const EMAIL_DIR = "src/lib/email/templates"
const emailFiles = walk(EMAIL_DIR).filter((f) => /\.jsx?$/.test(f))

describe("garde-fous de contenu vitrine", () => {
  it("scanne des fichiers", () => expect(files.length).toBeGreaterThan(30))

  it.each([
    ["EduCash SAS", /EduCash SAS/],
    ["Haie Vive", /Haie Vive/],
    ["XX XX", /XX XX/],
    ["tiret cadratin", /—/],
    ["style inline", /style=\{\{/],
    ["@mui", /@mui/],
    ["@emotion", /@emotion/],
  ])("aucun %s dans les fichiers vitrine", (_n, re) => {
    const hits = files.filter((f) => re.test(read(f)))
    expect(hits).toEqual([])
  })

  it.each([
    ["72 h", /72(\s|&nbsp;|\u00a0)*h\b/],
    ["J'ai terminé", /J(&rsquo;|&apos;|'|\u2019)ai terminé/],
    ["tranche", /tranche/],
    ["coup sûr", /coup sûr/],
    ["privacy@educash.bj", /privacy@educash\.bj/],
    ["24 h ouvrées", /24(\s|&nbsp;|\u00a0)*h ouvrées/],
    ["lundi au samedi", /lundi au samedi/i],
    ["Demande de paiement", /demande de paiement/i],
  ])("aucune promesse retiree (%s) dans les fichiers vitrine", (_n, re) => {
    const hits = files.filter((f) => /\.jsx?$/.test(f) && re.test(read(f)))
    expect(hits).toEqual([])
  })

  it("le libelle de la pastille 24 h n'apparait que dans la page contact", () => {
    const EXCEPTIONS = { "src/app/contact/page.js": "pastille 24 h demandée par l'utilisateur (RD-FIX-03b)" }
    const badge = /24(\s|&nbsp;|\u00a0)*h\s*ouvrées/
    const hits = files
      .filter((f) => /\.jsx?$/.test(f))
      .filter((f) => badge.test(read(f).replace(/<[^>]*>/g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")))
    expect(hits).toEqual(Object.keys(EXCEPTIONS))
  })

  it("les mentions legales portent l'identite BRANDYBEN", () => {
    const src = read("src/components/vitrine/legal/legal-entity.js") + read("src/app/legal/mentions/page.js")
    expect(src).toContain("BRANDYBEN")
    expect(src).toContain("RB/COT/26 A 119853")
    expect(src).toContain("0202212868410")
  })

  it("les CGU contiennent la clause achats", () => {
    const src = read("src/app/legal/terms/page.js")
    expect(src).toMatch(/achats/)
    expect(src).toMatch(/Missions avec achats/)
  })

  it("chaque classe utilisee existe dans le design system", () => {
    const known = new Set()
    const cssDir = path.join(ROOT, "src/app/design")
    for (const f of fs.readdirSync(cssDir).filter((n) => n.endsWith(".css"))) {
      for (const m of fs.readFileSync(path.join(cssDir, f), "utf8").matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) known.add(m[1])
    }
    const allowed = (c) => /^(w|h|max-w)-/.test(c) || ["rounded-full", "object-cover", "sr-only", "focus:not-sr-only", "ds"].includes(c)
    const unknown = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " ")
        for (const c of text.split(/\s+/).filter(Boolean)) {
          // Fragments de gabarits dynamiques (btn--${x}, v06-val--${x}) : non verifiables.
          if (/[$?"]|--$/.test(c)) continue
          if (!known.has(c) && !allowed(c)) unknown.push(`${f}: ${c}`)
        }
      }
    }
    expect([...new Set(unknown)]).toEqual([])
  })

  it("aucune classe generique du design system n'est utilisee en dehors de lui", () => {
    // Noms assembles : un nom de classe Tailwind ecrit en clair dans ce fichier serait scanne
    // par Tailwind, qui generait alors l'utilitaire et ferait diverger le rendu.
    const banned = new Set(["con" + "tainer", "gr" + "ow", "gr" + "id", "ta" + "ble", "h1", "h2", "h3", "h4"])
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        for (const c of (m[1] ?? m[2]).split(/\s+/)) if (banned.has(c)) hits.push(`${f}: ${c}`)
      }
    }
    expect(hits).toEqual([])
  })

  it("aucun mot banni dans les textes vitrine (livraison, course, coursier, saisie, prestataire de paiement, Bientôt)", () => {
    const banned = /livraisons?|coursiers?|\bcourses?\b|saisies?\b|fedapay|bient[ôo]t/i
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      const m = visibleText(f).match(banned)
      if (m) hits.push(`${f}: ${m[0]}`)
    }
    expect(hits).toEqual([])
  })

  it("aucun lien vers /clients (redirigé vers l'accueil)", () => {
    const hits = files.filter((f) => /\.jsx?$/.test(f) && /["'`]\/clients(?:[/?#"'`])/.test(visibleText(f)))
    expect(hits).toEqual([])
  })

  it("les gabarits d'email ne nomment pas le prestataire de paiement et n'affichent aucun mot banni", () => {
    expect(emailFiles.length).toBeGreaterThan(5)
    const hits = emailFiles.filter((f) => /fedapay|livraisons?|coursiers?|\bcourses?\b|saisies?\b/i.test(visibleText(f)))
    expect(hits).toEqual([])
  })

  describe("authentification", () => {
    const authFiles = files.filter((f) => /^src\/(app|components)\/auth\//.test(f) && /\.jsx?$/.test(f))
    const AUTH_UI_SOURCES = [...authFiles, "src/components/vitrine/auth-shell.jsx"]

    it("scanne les écrans d'auth", () => expect(authFiles.length).toBeGreaterThan(20))

    it("aucun formulaire sans action serveur ni method=post", () => {
      const hits = []
      for (const f of AUTH_UI_SOURCES) {
        for (const m of visibleText(f).matchAll(/<form\b[^>]*>/g)) {
          if (!/\baction=\{|method="post"/.test(m[0])) hits.push(`${f}: ${m[0].slice(0, 60)}`)
        }
      }
      expect(hits).toEqual([])
    })

    it("aucun formulaire en method=get", () => {
      expect(AUTH_UI_SOURCES.filter((f) => /method=["']get["']/i.test(read(f)))).toEqual([])
    })

    it("aucun délai d'examen de carte ni promesse de support", () => {
      const re = /réponse sous|sous 24|sous 48|24\s?h|48\s?h|support répond|valable \d|expire dans/i
      const hits = AUTH_UI_SOURCES.filter((f) => re.test(visibleText(f)))
      expect(hits).toEqual([])
    })

    it("aucun accès direct aux tables depuis les composants d'auth", () => {
      const hits = authFiles.filter((f) => f.startsWith("src/components/auth/") && /supabase\s*\.from\(/.test(read(f)))
      expect(hits).toEqual([])
    })

    it("aucune couleur en dur ni balise style dans les écrans d'auth", () => {
      const hits = AUTH_UI_SOURCES.filter((f) => /#[0-9a-fA-F]{3,8}\b|<style/.test(visibleText(f)))
      expect(hits).toEqual([])
    })
  })

  it("aucun tiret cadratin dans les gabarits d'email Resend", () => {
    expect(emailFiles.filter((f) => read(f).includes("—"))).toEqual([])
  })
})
