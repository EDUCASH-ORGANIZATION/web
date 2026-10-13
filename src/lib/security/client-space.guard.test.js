import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

// Garde-fou de transition RD-CLIENT-01 : l'espace client refondu n'utilise que les classes du
// système de design, le vouvoiement, le vocabulaire autorisé et des modules purs.
// Périmètre : src/components/{app-shell,app-ui,client-space}, src/lib/app, src/lib/client-space,
// plus les fichiers de src/app/(client) et src/app/design/client qui portent le marqueur
// `@ds-screen RD-CLIENT-01`. Les dossiers pas encore créés sont ignorés. Les détecteurs sont
// testés sur des fixtures en mémoire (un vrai positif et un vrai négatif par règle).

const SCAN_DIRS = [
  "src/components/app-shell",
  "src/components/app-ui",
  "src/components/client-space",
  "src/lib/app",
  "src/lib/client-space",
]
const MARKED_DIRS = ["src/app/(client)", "src/app/design/client"]
const MARKER = "@ds-screen RD-CLIENT-01"
const EXT = /\.(js|jsx|css)$/
const TEST_FILE = /\.test\.(js|jsx)$/

// ─── Lecture du source : retire les commentaires, extrait les chaînes ───────────────────────

// Une apostrophe ouvre une chaîne seulement après un de ces caractères (sinon c'est du texte JSX).
const STRING_OPENERS = new Set(["(", "[", ",", "=", ":", "?", "{", "+", "|", "&", "!", ";", ">"])

/**
 * @param {string} source
 * @param {{ css?: boolean }} [options]
 * @returns {{ code: string, strings: string[] }} `code` sans commentaires (positions conservées)
 */
function scan(source, { css = false } = {}) {
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
function classTokens(code) {
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
  `${WORD_START_NO_HYPHEN}(?:Vérifie|Publie|Rafraîchis|Réessaie|Envoie|Clique|Choisis|Ajoute|Retourne|Recharge|Confirme|Renseigne|Contacte|Annule|Sélectionne|Saisis|Indique|Valide)${WORD_END}`,
  "u",
)
// « Recharge » seul est le libellé nominal d'un type d'opération (portefeuille), pas un impératif.
const NOMINAL_LABELS = new Set(["Recharge"])
const TUTOIEMENT = {
  test: (text) =>
    !NOMINAL_LABELS.has(text.trim()) &&
    [TUTOIEMENT_PRONOUNS, TUTOIEMENT_ELISION, TUTOIEMENT_TA, TUTOIEMENT_IMPERATIVES].some((re) => re.test(text)),
}

/** Texte JSX : ce qui se trouve entre une balise et la suivante (hors `=>` et expressions). */
function jsxText(code) {
  const out = []
  const re = /(?<![=-])>([^<>{}]+)</g
  let m
  while ((m = re.exec(code))) if (/\S/.test(m[1])) out.push(m[1])
  return out
}

const SUPABASE_SPECIFIER = /["'`](?:@\/lib\/supabase|(?:\.{1,2}\/)+(?:lib\/)?supabase)\/[^"'`\s]*/g
// database.constants est un module pur de constantes : sa lecture seule est autorisée, chemin complet exact.
const PURE_SUPABASE_CONSTANTS = /^["'`](?:@\/lib\/supabase|(?:\.{1,2}\/)+(?:lib\/)?supabase)\/database\.constants(?:\.js)?$/

const RULES = [
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
    id: "tutoiement",
    run: ({ strings, code }) => [...strings, ...jsxText(code)].filter((t) => TUTOIEMENT.test(t)),
  },
  {
    id: "raw-type",
    run: ({ code }) =>
      code.match(/\{\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\??\.type\s*\}/g) ?? [],
  },
]

/**
 * @param {string} file Chemin relatif au dépôt
 * @param {string} source
 * @returns {Array<{ file: string, rule: string, hit: string }>}
 */
function violations(file, source) {
  const scanned = { ...scan(source, { css: file.endsWith(".css") }), file }
  return RULES.flatMap((rule) =>
    rule.run(scanned).map((hit) => ({ file, rule: rule.id, hit: String(hit).trim().slice(0, 60) })),
  )
}

// ─── Collecte des fichiers ──────────────────────────────────────────────────────────────────

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (EXT.test(name) && !TEST_FILE.test(name)) acc.push(p.split("\\").join("/"))
  }
  return acc
}

const FILES = [
  ...SCAN_DIRS.flatMap((d) => walk(d)),
  ...MARKED_DIRS.flatMap((d) => walk(d)).filter((f) => readFileSync(f, "utf8").includes(MARKER)),
]

// ─── Tests ──────────────────────────────────────────────────────────────────────────────────

describe("garde-fou de l'espace client (RD-CLIENT-01)", () => {
  it("scanne la logique pure de src/lib/app", () => {
    expect(FILES).toContain("src/lib/app/format.js")
    expect(FILES).toContain("src/lib/app/client-routes.js")
    expect(FILES.filter((f) => f.startsWith("src/lib/app/")).length).toBeGreaterThanOrEqual(6)
  })

  it("aucun fichier scanné ne viole une règle", () => {
    const found = FILES.flatMap((f) => violations(f, readFileSync(f, "utf8")))
    expect(found).toEqual([])
  })

  it("les fonctions de src/lib/app n'importent aucun module serveur ni Supabase client", () => {
    const bad = FILES.filter((f) => f.startsWith("src/lib/app/")).filter((f) =>
      /from\s+["'][^"']*(?:supabase\/(?:server|client|service)|\/actions\/|next\/headers)/.test(
        readFileSync(f, "utf8"),
      ),
    )
    expect(bad).toEqual([])
  })
})

describe("détecteurs (fixtures en mémoire)", () => {
  const ids = (source, file = "src/lib/app/x.jsx") => violations(file, source).map((v) => v.rule)

  /** [règle, source qui doit déclencher, source qui ne doit pas déclencher] */
  const CASES = [
    ["hex", 'const c = "#ff0000"', 'const href = "#i-clock" // couleur #ff0000 en commentaire'],
    ["rgba", 'const c = "rgba(1, 2, 3, 0.5)"', "const c = 'var(--c-encre)'"],
    ["style-attr", "<p style={{ margin: 0 }}>a</p>", "<p className=\"card\">a</p>"],
    ["style-tag", "<style>{`p{}`}</style>", "<p>style</p>"],
    ["tailwind", '<p className="bg-white p-4 flex">a</p>', '<p className="card w-10 h-10 rounded-full">a</p>'],
    ["tailwind", '<p className={"md:gap-4"}>a</p>', '<p className="ds-grid ds-grow object-cover">a</p>'],
    ["tailwind", '<p className="text-red-500">a</p>', '<p className="text-sm font-bold">a</p>'],
    ["tailwind", '<p className="border-gray-200 shadow-md">a</p>', '<p className="border-t">a</p>'],
    ["lucide", 'import { X } from "lucide-react"', 'import { Icon } from "@/components/design/icon"'],
    ["supabase-import", 'import { createClient } from "@/lib/supabase/client"', 'import { Icon } from "@/components/design/icon"'],
    ["supabase-import", 'import { x } from "../supabase/server.js"', 'import { f } from "../vitrine/format.js"'],
    ["supabase-import", 'import { x } from "../supabase/database.constants.js/../server.js"', 'import { T } from "@/lib/supabase/database.constants"'],
    ["supabase-import", 'import { x } from "@/lib/supabase/database.constants-client"', 'import { T } from "../supabase/database.constants.js"'],
    ["supabase-import", "const m = await import(`@/lib/supabase/server`)", "const m = await import(`@/lib/supabase/database.constants`)"],
    ["supabase-import", 'import { T } from "@/lib/supabase/sub/database.constants"', 'import { T } from "../../lib/supabase/database.constants.js"'],
    ["commission-literal", "const fee = budget * 0.12", "const n = 10.125 + 0.5"],
    ["banned-words", 'const t = "Votre livraison"', "// livraison en commentaire\nconst t = 1"],
    ["banned-words", "<p>Paiement via FedaPay</p>", "<p>Paiement sécurisé</p>"],
    ["banned-words", "const t = `Saisie des données`", 'const saisieDone = true'],
    ["tutoiement", 'const t = "Recharge ton compte"', 'const t = "Rechargez votre compte"'],
    ["tutoiement", "<p>Tu peux publier</p>", "<p>Vous pouvez publier</p>"],
    ["tutoiement", 'const t = "Réessaie plus tard"', 'const t = "Veuillez réessayer"'],
    ["tutoiement", "<p>Toi aussi</p>", "<p>Une tonalité neutre</p>"],
    ["tutoiement", 'const t = "Nous te contactons"', 'const t = "Nous vous contactons, êtes-vous là ?"'],
    ["tutoiement", "const t = \"Dis-moi si t'as besoin\"", 'const t = "Vous avez eu l\'été et une tournée"'],
    ["tutoiement", 'const t = "Dis-moi si t\u2019es prêt"', 'const t = "Découvrez la tournée de l\u2019été"'],
    ["tutoiement", 'const t = "t\'a-t-il écrit ?"', 'const t = "il a écrit, rien d\'autre"'],
    ["tutoiement", 'const t = "t\u2019inquiète pas"', 'const t = "Elle n\u2019est pas là, c\u2019est tout"'],
    ["tutoiement", 'const t = "Ta mission est publiée"', 'const t = "TA et data-ta restent des identifiants"'],
    ["tutoiement", '<p>Vérifie ton solde</p>', '<p>Vérifiez votre solde</p>'],
    ["tutoiement", 'const t = "Publie ta mission"', 'const t = "Publiez votre mission. Il publie ensuite."'],
    ["tutoiement", 'const t = "Rafraîchis la page"', 'const t = "Rafraîchissez la page"'],
    ["tutoiement", 'const t = "Envoie un message"', 'const t = "Envoyez un message"'],
    ["tutoiement", 'const t = "Clique ici"', 'const t = "Cliquez ici"'],
    ["tutoiement", 'const t = "Choisis un montant"', 'const t = "Choisissez un montant"'],
    ["tutoiement", 'const t = "Ajoute un moyen de paiement"', 'const t = "Ajoutez un moyen de paiement"'],
    ["tutoiement", 'const t = "Retourne à la liste"', 'const t = "Retournez à la liste"'],
    ["tutoiement", 'const t = "Connecte-toi à ton compte"', 'const t = "Connectez-vous"'],
    ["tutoiement", 'const t = "Inscris-toi"', 'const t = "Inscrivez-vous. Rendez-vous demain"'],
    ["tutoiement", 'const t = "Peux-tu confirmer ?"', 'const t = "Pouvez-vous confirmer ?"'],
    ["tutoiement", 'const t = "As-tu vu le message ?"', 'const t = "Avez-vous vu le message ?"'],
    ["tutoiement", 'const t = "Dis-tu la vérité ?"', 'const t = "Dites-vous la vérité ?"'],
    ["tutoiement", 'const t = "Recharge ton solde"', 'const t = "TE et TON et TES restent des sigles, êtes, tête, Table, tableau, tâche"'],
    ["tutoiement", 'const t = "Recharge la page"', 'const t = "Il recharge la page"'],
    ["tutoiement", 'const t = "Recharge ton solde"', 'const t = "Recharge"'],
    ["tutoiement", 'const t = "Confirme la mission"', 'const t = "Il confirme la mission"'],
    ["tutoiement", 'const t = "Renseigne le montant"', 'const t = "Il renseigne le montant"'],
    ["tutoiement", 'const t = "Contacte le support"', 'const t = "Il contacte le support"'],
    ["tutoiement", 'const t = "Annule la mission"', 'const t = "Il annule la mission"'],
    ["tutoiement", 'const t = "Sélectionne un profil"', 'const t = "Il sélectionne un profil"'],
    ["tutoiement", 'const t = "Saisis un montant"', 'const t = "Il saisit un montant"'],
    ["tutoiement", 'const t = "Indique un budget"', 'const t = "Il indique un budget"'],
    ["tutoiement", 'const t = "Valide la mission"', 'const t = "Il valide la mission"'],
    ["raw-type", "<span>{mission.type}</span>", "<span>{missionTypeLabel(mission.type)}</span>"],
  ]

  for (const [rule, positive, negative] of CASES) {
    it(`${rule} : détecte « ${positive.slice(0, 40)} » et ignore « ${negative.slice(0, 40)} »`, () => {
      expect(ids(positive)).toContain(rule)
      expect(ids(negative)).not.toContain(rule)
    })
  }

  it("l'exception de src/hooks vaut pour l'import Supabase", () => {
    const source = 'import { createClient } from "@/lib/supabase/client"'
    expect(violations("src/hooks/use-x.js", source)).toEqual([])
    expect(violations("src/components/app-ui/x.jsx", source).map((v) => v.rule)).toContain("supabase-import")
  })

  it("couvre chaque règle par au moins un cas", () => {
    const covered = new Set(CASES.map((c) => c[0]))
    expect(RULES.map((r) => r.id).filter((id) => !covered.has(id))).toEqual([])
  })

  it("le marqueur est requis hors des dossiers scannés par défaut", () => {
    expect(MARKER).toBe("@ds-screen RD-CLIENT-01")
    expect(FILES.every((f) => !f.endsWith(".test.js"))).toBe(true)
  })
})
