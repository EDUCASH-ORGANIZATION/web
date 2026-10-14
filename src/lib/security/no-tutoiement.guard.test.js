import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

// Garde-fou global RD-VOUS-01 : vouvoiement partout. Aucun texte visible de src/ (chaînes JS et texte JSX :
// clients, étudiants, admin, vitrine, authentification, messages d'erreur des actions serveur) ne tutoie.
// Les commentaires ne sont pas lus (le mot « ton » au sens de tonalité y est toléré).
// Périmètre : tous les .js et .jsx de src/, sauf :
// - les fichiers de test (*.test.js et *.test.jsx) : ils portent les fixtures de détection et les regex ;
// - src/lib/actions/verify-card.actions.js : prompt LLM interne (« Tu es un système de vérification... »),
//   jamais affiché à un utilisateur.
// Les emails (gabarits Resend dans src/lib/email) sont couverts ici ; les gabarits HTML Supabase le sont par
// auth-emails.guard.test.js.

const ROOT = process.cwd()
const SRC = path.join(ROOT, "src")
const TEST_FILE = /\.test\.(js|jsx)$/
const EXCLUDED = new Set(["src/lib/actions/verify-card.actions.js"])

// ─── Lecture du source : retire les commentaires, extrait les chaînes ───────────────────────

// Une apostrophe ouvre une chaîne seulement après un de ces caractères (sinon c'est du texte JSX).
const STRING_OPENERS = new Set(["(", "[", ",", "=", ":", "?", "{", "+", "|", "&", "!", ";", ">"])

/** @returns {{ code: string, strings: string[] }} `code` sans commentaires (positions conservées) */
export function scan(source) {
  let code = ""
  const strings = []
  let i = 0
  let prev = ""
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2)
      const stop = end === -1 ? source.length : end + 2
      code += source.slice(i, stop).replace(/[^\n]/g, " ")
      i = stop
      continue
    }
    if (c === "/" && next === "/" && source[i - 1] !== ":") {
      const end = source.indexOf("\n", i)
      const stop = end === -1 ? source.length : end
      code += " ".repeat(stop - i)
      i = stop
      continue
    }
    const opensString = c === '"' || c === "`" || (c === "'" && (prev === "" || STRING_OPENERS.has(prev)))
    if (opensString) {
      let j = i + 1
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") j++
        else if (c !== "`" && source[j] === "\n") break
        j++
      }
      strings.push(source.slice(i + 1, j))
      code += source.slice(i, j + 1)
      prev = c
      i = j + 1
      continue
    }
    code += c
    if (!/\s/.test(c)) prev = c
    i++
  }
  return { code, strings }
}

/** Texte JSX : ce qui se trouve entre une balise et la suivante (hors `=>` et expressions). */
function jsxText(code) {
  const out = []
  const re = /(?<![=-])>([^<>{}]+)</g
  let m
  while ((m = re.exec(code))) if (/\S/.test(m[1])) out.push(m[1])
  return out
}

// ─── Détecteurs ─────────────────────────────────────────────────────────────────────────────

// Bornes unicode : \b traite « ê » comme non-mot et ferait matcher « tes » dans « êtes ».
// Le trait d'union n'est PAS une borne pour les pronoms : « Connecte-toi », « As-tu vu ».
const START = "(?<![\\p{L}\\p{N}_])"
// Variante qui exclut aussi le trait d'union : « data-ta » n'est pas un possessif.
const START_NO_HYPHEN = "(?<![\\p{L}\\p{N}_-])"
const END = "(?![\\p{L}\\p{N}_])"

// tu, toi, ton, tes, te (minuscule ou capitalisé : les sigles TE, TON, TES ne sont pas détectés), ta (hors trait d'union).
const PRONOUNS = new RegExp(`${START}(?:[Tt][Uu]|[Tt][Oo][Ii]|[Tt](?:on|es|e))${END}|${START_NO_HYPHEN}[Tt]a${END}`, "u")
// Élisions : t'as, t’inquiète, t&apos;.
const ELISION = new RegExp(`${START}t(?:['\\u2019]|&rsquo;|&apos;)(?=\\p{L})`, "iu")
// Composés : Connecte-toi, peux-tu, vois-te.
const COMPOUND = new RegExp(`\\p{L}-(?:toi|tu|te)${END}`, "iu")
// Impératifs de la 2e personne du singulier sans pronom, en début de phrase (majuscule) :
// « Il publie » reste permis. Liste des lots vitrine, emails et espaces connectés, plus les verbes d'action courants.
// « Recharge », « Garde » et « Copie » sont aussi des noms (« Recharge confirmée », « Garde d'enfants ») :
// impératif seulement s'ils ne sont ni seuls, ni suivis de de, d', et, en ou confirmé.
const NOUN_USE = "(?!\\s*$|\\s+(?:de|d['\\u2019]|et|en|confirm))"
const IMPERATIVES = new RegExp(
  `${START_NO_HYPHEN}(?:Crée|Encaisse|Postule|Écris|Fais|Trouve|Prouve|Découvre|Retire|Reprends|Réessaie|Vérifie|Envoie|Contacte|Choisis|Parcours|Bosse|Sois|Essaie|Précise|Explique|Laisse|Inscris|Connecte|Reviens|Retrouve|Filtre|Ouvre|Utilise|Renvoie|Élargis|Donne|Passe|Reconnecte|Indique|Complète|Décris|Publie|Rafraîchis|Clique|Ajoute|Retourne|Confirme|Renseigne|Annule|Sélectionne|Saisis|Valide|Réinitialise|Ignore|Consulte|Commence|Hésite|Renouvelle|Soumets|Explore)${END}|${START_NO_HYPHEN}(?:Recharge|Garde|Copie)${END}${NOUN_USE}`,
  "u",
)

/** @returns {string | null} la première forme de tutoiement trouvée dans un texte visible */
export function findTutoiement(text) {
  for (const re of [PRONOUNS, ELISION, COMPOUND, IMPERATIVES]) {
    const m = text.match(re)
    if (m) return m[0].trim()
  }
  return null
}

/** Textes visibles d'un source (chaînes et texte JSX) qui tutoient. */
export function tutoiementHits(source) {
  const { strings, code } = scan(source)
  return [...strings, ...jsxText(code)].map(findTutoiement).filter(Boolean)
}

// ─── Fixtures de détection ──────────────────────────────────────────────────────────────────

describe("détecteurs de tutoiement (fixtures)", () => {
  const POSITIVES = [
    'const t = "Recharge ton compte"',
    "<p>Tu peux publier</p>",
    'const t = "Nous te contactons"',
    'const t = "Ta mission est publiée"',
    "const t = \"Dis-moi si t'as besoin\"",
    'const t = "Dis-moi si t’es prêt"',
    'const t = "Connecte-toi à votre compte"',
    'const t = "Peux-tu confirmer ?"',
    '<p>Toi aussi</p>',
    'const t = "Réessaie plus tard"',
    'const t = "Reconnecte votre compte"',
    "const t = 'Contacte le support'",
    "<p>Envoie un message</p>",
    'const t = "Vérifie le numéro"',
    'const t = "Choisis une ville"',
    'const t = "Indique un budget"',
    'const t = "Retire vos gains"',
    'const t = "Renvoie le lien"',
    'const t = "Complète le profil"',
    'const t = "Décris la mission"',
    'const t = "Laisse un avis"',
    'const t = "Retrouve les missions"',
    'const t = "Recharge le solde"',
    "const t = `Bonjour ${name}, ton solde`",
  ]
  const NEGATIVES = [
    'const t = "Rechargez votre compte"',
    "<p>Vous pouvez publier</p>",
    'const t = "Nous vous contactons, êtes-vous là ?"',
    'const t = "TA et data-ta restent des identifiants"',
    'const t = "TE et TON et TES restent des sigles, êtes, tête, Table, tableau, tâche"',
    'const t = "Réessayez plus tard"',
    'const t = "Il publie ensuite. Elle contacte le support."',
    'const t = "Recharge"',
    'const t = "Recharge confirmée"',
    'const t = "Garde d\'enfants"',
    'const tone = "chaleureux"; const ton = tone',
    "// Ton chaleureux : tu peux le dire en commentaire\nconst a = 1",
    "/* Tu es un commentaire, ton aussi */\nconst a = 1",
    'const t = "Vous avez eu l\'été et une tournée"',
    'const t = "Il a écrit, rien d\'autre. C\'est tout"',
    "<p>Vérifiez votre solde</p>",
  ]

  it.each(POSITIVES)("détecte : %s", (src) => {
    expect(tutoiementHits(src).length).toBeGreaterThan(0)
  })

  it.each(NEGATIVES)("ne détecte pas : %s", (src) => {
    expect(tutoiementHits(src)).toEqual([])
  })
})

// ─── Scan de src/ ───────────────────────────────────────────────────────────────────────────

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(SRC)
  .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
  .filter((rel) => /\.(js|jsx)$/.test(rel) && !TEST_FILE.test(rel) && !EXCLUDED.has(rel))

describe("vouvoiement partout dans src", () => {
  it("scanne un périmètre large (espaces connectés, vitrine, auth, emails, actions)", () => {
    expect(files.length).toBeGreaterThan(200)
    for (const dir of ["src/app/auth", "src/components/vitrine", "src/lib/actions", "src/lib/email", "src/components/client-space", "src/components/admin"]) {
      expect(files.some((f) => f.startsWith(dir)), dir).toBe(true)
    }
    expect(files).not.toContain("src/lib/actions/verify-card.actions.js")
  })

  it("aucun tutoiement dans les chaînes et le texte JSX visibles", () => {
    const hits = []
    for (const f of files) {
      for (const h of tutoiementHits(readFileSync(path.join(ROOT, f), "utf8"))) hits.push(`${f}: ${h}`)
    }
    expect(hits).toEqual([])
  })
})
