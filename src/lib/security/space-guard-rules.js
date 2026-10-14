// Détecteurs purs partagés par les garde-fous d'espace refondu (client-space.guard.test.js et
// student-space.guard.test.js). Aucun test ici : chaque garde-fou compose ses règles et teste ses détecteurs.
import { readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

export const EXT = /\.(js|jsx|css)$/
export const TEST_FILE = /\.test\.(js|jsx)$/

// ─── Lecture du source : retire les commentaires, extrait les chaînes ───────────────────────

// Une apostrophe ouvre une chaîne seulement après un de ces caractères (sinon c'est du texte JSX).
const STRING_OPENERS = new Set(["(", "[", ",", "=", ":", "?", "{", "+", "|", "&", "!", ";", ">"])

/**
 * @param {string} source
 * @param {{ css?: boolean }} [options]
 * @returns {{ code: string, strings: string[] }} `code` sans commentaires (positions conservées)
 */
export function scan(source, { css = false } = {}) {
  let code = ""
  const strings = []
  let i = 0
  let prev = ""
  const keep = (c) => {
    code += c
    if (!/\s/.test(c)) prev = c
  }
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
    if (!css && c === "/" && next === "/" && source[i - 1] !== ":") {
      const end = source.indexOf("\n", i)
      const stop = end === -1 ? source.length : end
      code += " ".repeat(stop - i)
      i = stop
      continue
    }
    const opensString =
      c === '"' || c === "`" || (c === "'" && (css || prev === "" || STRING_OPENERS.has(prev)))
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
    keep(c)
    i++
  }
  return { code, strings }
}

// ─── Détecteurs ─────────────────────────────────────────────────────────────────────────────

const COLOR_NAMES =
  "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|ink|inherit|current|transparent"
const TW_BG = /^bg-/
const TW_TEXT_COLOR = new RegExp(`^text-(?:${COLOR_NAMES})(?:-|$|/)`)
const TW_BORDER_COLOR = new RegExp(`^border(?:-[trblxy])?-(?:${COLOR_NAMES})(?:-|$|/)`)
const TW_SPACING = /^-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-/
const TW_LAYOUT = /^(?:inline-)?(?:flex|grid)(?:-[\w[\]./%]+)*$/
const TW_SPACE = /^space-[xy]-/
const TW_SHADOW_RING = /^(?:shadow|ring)(?:-|$)/
const TW_UTILITY = [TW_BG, TW_TEXT_COLOR, TW_BORDER_COLOR, TW_SPACING, TW_LAYOUT, TW_SPACE, TW_SHADOW_RING]

/** Jetons de classe contenus dans les attributs className (variantes responsive ou d'état retirées). */
export function classTokens(code) {
  const tokens = []
  const attr = /className=(?:"([^"]*)"|\{([^}]*)\})/g
  let m
  while ((m = attr.exec(code))) {
    const raw = m[1] ?? (m[2].match(/(["'`])(?:(?!\1)[^\\])*\1/g) ?? []).join(" ")
    for (const t of raw.replace(/["'`]/g, " ").split(/\s+/)) {
      if (t) tokens.push(t.split(":").pop())
    }
  }
  return tokens
}

const BANNED_WORDS = /\b(?:livraisons?|courses?|coursiers?|saisie|bientôt|fedapay)\b/i
// Bornes unicode : \b traite "ê" comme non-mot et ferait matcher "tes" dans "êtes".
// Le trait d'union n'est PAS une borne pour les pronoms : "Connecte-toi", "As-tu vu", "peux-tu".
const WORD_START = "(?<![\\p{L}\\p{N}_])"
// Variante qui exclut aussi le trait d'union : "data-ta" n'est pas un possessif.
const WORD_START_NO_HYPHEN = "(?<![\\p{L}\\p{N}_-])"
const WORD_END = "(?![\\p{L}\\p{N}_])"
// Pronoms et possessifs : tu, toi (toute casse), ton, tes, te (minuscule ou capitalisé seulement : les sigles
// TE, TON, TES ne sont pas détectés, comme TA) ; élisions : t'as, t’inquiète (insensible à la casse).
// Faux positifs acceptés et non traités : le nom propre « Tu Anh Nguyen » et « te.st ».
const TUTOIEMENT_PRONOUNS = new RegExp(`${WORD_START}(?:[Tt][Uu]|[Tt][Oo][Ii]|[Tt](?:on|es|e))${WORD_END}`, "u")
const TUTOIEMENT_ELISION = new RegExp(`${WORD_START}t['’](?=\\p{L})`, "iu")
// "ta" sans le sigle TA : seule la forme minuscule ou capitalisée est un possessif.
const TUTOIEMENT_TA = new RegExp(`${WORD_START_NO_HYPHEN}[Tt]a${WORD_END}`, "u")
// Impératifs courants du tutoiement, en début de phrase (majuscule) : "Il publie" reste permis.
const TUTOIEMENT_IMPERATIVES = new RegExp(
  `${WORD_START_NO_HYPHEN}(?:Vérifie|Publie|Rafraîchis|Réessaie|Envoie|Clique|Choisis|Ajoute|Retourne|Recharge|Confirme|Renseigne|Contacte|Annule|Sélectionne|Saisis|Indique|Valide|Retrouve|Découvre|Postule|Crée|Renvoie|Retire|Renouvelle|Reprends)${WORD_END}`,
  "u",
)
// « Recharge » seul est le libellé nominal d'un type d'opération (portefeuille), pas un impératif.
const NOMINAL_LABELS = new Set(["Recharge"])
const TUTOIEMENT = {
  test: (text) =>
    !NOMINAL_LABELS.has(text.trim()) &&
    [TUTOIEMENT_PRONOUNS, TUTOIEMENT_ELISION, TUTOIEMENT_TA, TUTOIEMENT_IMPERATIVES].some((re) => re.test(text)),
}

const APOSTROPHE_ENTITY = /&(?:apos|rsquo|#39|#x27);/gi

/**
 * Texte JSX : ce qui se trouve entre une balise et la suivante (hors `=>` et expressions).
 * Les entités d'apostrophe (`&apos;`, `&rsquo;`, `&#39;`) sont remplacées par l'apostrophe : « t&apos;est » est
 * l'élision « t'est » une fois rendue.
 */
export function jsxText(code) {
  const out = []
  const re = /(?<![=-])>([^<>{}]+)</g
  let m
  while ((m = re.exec(code))) if (/\S/.test(m[1])) out.push(m[1].replace(APOSTROPHE_ENTITY, "'"))
  return out
}

const SUPABASE_SPECIFIER = /["'`](?:@\/lib\/supabase|(?:\.{1,2}\/)+(?:lib\/)?supabase)\/[^"'`\s]*/g
// database.constants est un module pur de constantes : sa lecture seule est autorisée, chemin complet exact.
const PURE_SUPABASE_CONSTANTS = /^["'`](?:@\/lib\/supabase|(?:\.{1,2}\/)+(?:lib\/)?supabase)\/database\.constants(?:\.js)?$/

/** Règles communes aux espaces refondus (hors registre de langue). */
export const COMMON_RULES = [
  { id: "hex", run: ({ code }) => code.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi) ?? [] },
  { id: "rgba", run: ({ code }) => code.match(/\brgba?\(/gi) ?? [] },
  { id: "style-attr", run: ({ code }) => code.match(/\bstyle=\{/g) ?? [] },
  { id: "style-tag", run: ({ code }) => code.match(/<style\b/g) ?? [] },
  {
    id: "tailwind",
    run: ({ code }) => classTokens(code).filter((t) => TW_UTILITY.some((re) => re.test(t))),
  },
  { id: "lucide", run: ({ code }) => code.match(/["']lucide-react["']/g) ?? [] },
  {
    id: "supabase-import",
    run: ({ code, file }) =>
      file.startsWith("src/hooks/")
        ? []
        : (code.match(SUPABASE_SPECIFIER) ?? []).filter((spec) => !PURE_SUPABASE_CONSTANTS.test(spec)),
  },
  { id: "commission-literal", run: ({ code }) => code.match(/\b0\.(?:88|12)\b/g) ?? [] },
  {
    id: "banned-words",
    run: ({ strings, code }) =>
      [...strings, ...jsxText(code)].filter((t) => BANNED_WORDS.test(t)),
  },
  {
    id: "raw-type",
    run: ({ code }) =>
      code.match(/\{\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\??\.type\s*\}/g) ?? [],
  },
]

/** Registre unique (vouvoiement partout) : le tutoiement est interdit, côté client comme côté étudiant. */
export const TUTOIEMENT_RULE = {
  id: "tutoiement",
  run: ({ strings, code }) => [...strings, ...jsxText(code)].filter((t) => TUTOIEMENT.test(t)),
}

/**
 * @param {string} file Chemin relatif au dépôt
 * @param {string} source
 * @param {Array<{ id: string, run: (scanned: { code: string, strings: string[], file: string }) => unknown[] }>} rules
 * @returns {Array<{ file: string, rule: string, hit: string }>}
 */
export function violations(file, source, rules) {
  const scanned = { ...scan(source, { css: file.endsWith(".css") }), file }
  return rules.flatMap((rule) =>
    rule.run(scanned).map((hit) => ({ file, rule: rule.id, hit: String(hit).trim().slice(0, 60) })),
  )
}

/** Fichiers source (hors tests) d'un dossier, récursivement ; un dossier absent est ignoré. */
export function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (EXT.test(name) && !TEST_FILE.test(name)) acc.push(p.split("\\").join("/"))
  }
  return acc
}

