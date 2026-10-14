import { describe, it, expect } from "vitest"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { COMMON_RULES, TUTOIEMENT_RULE, scan, violations as scanViolations, walk } from "./space-guard-rules.js"

// Garde-fou de transition RD-ADMIN-01 : l'espace admin refondu n'utilise que les classes du système de
// design, le vouvoiement, le vocabulaire autorisé et des modules purs.
// Périmètre : src/components/admin-space, src/lib/admin-space, src/lib/app/admin-routes.js, plus les fichiers de
// src/app/(admin) et src/app/design/admin qui portent le marqueur `@ds-screen RD-ADMIN-01` (les pages pas
// encore portées n'en ont pas : elles sont ignorées). Les dossiers pas encore créés sont ignorés.
// Règle statique en plus : chaque fonction exportée de `src/lib/actions/admin-*.actions.js` appelle
// `await requireAdminService()` avant tout `createServiceClient`, `.from(` ou `.storage`.
// Les détecteurs sont testés sur des fixtures en mémoire (un vrai positif et un vrai négatif par règle).

const SCAN_DIRS = ["src/components/admin-space", "src/lib/admin-space"]
const SCAN_FILES = ["src/lib/app/admin-routes.js"]
const MARKED_DIRS = ["src/app/(admin)", "src/app/design/admin"]
const MARKER = "@ds-screen RD-ADMIN-01"
const ACTIONS_DIR = "src/lib/actions"
const ADMIN_ACTIONS = /^admin-[\w-]+\.actions\.js$/

// Registre unique de la plateforme (RD-VOUS-01) : le tutoiement est interdit, le vouvoiement est permis.
const RULES = [...COMMON_RULES, TUTOIEMENT_RULE]

/**
 * @param {string} file Chemin relatif au dépôt
 * @param {string} source
 */
function violations(file, source) {
  return scanViolations(file, source, RULES)
}

const SENSITIVE_ACCESS = /createServiceClient|\.from\(|\.storage\b/
const CONTEXT_CALL = /await\s+requireAdminService\s*\(\s*\)/

/** Corps (accolades appariées) à partir de l'accolade ouvrante située à `open`. */
function bodyFrom(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++
    else if (code[i] === "}" && --depth === 0) return code.slice(open + 1, i)
  }
  return code.slice(open + 1)
}

/**
 * Fonctions exportées d'un fichier d'actions : `export [async] function nom(...) {...}` et
 * `export const nom = [async] (...) => {...}`.
 * @returns {Array<{ name: string, body: string }>}
 */
function exportedFunctions(source) {
  const { code } = scan(source)
  const found = []
  const re = /export\s+(?:async\s+)?function\s+([\w$]+)\s*\([^)]*\)\s*\{|export\s+const\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g
  let m
  while ((m = re.exec(code))) {
    found.push({ name: m[1] ?? m[2], body: bodyFrom(code, m.index + m[0].length - 1) })
  }
  return found
}

/**
 * Fonctions qui n'ouvrent pas par le contrôle admin : pas d'appel `await requireAdminService()`, ou un accès
 * (service role, requête, stockage) placé avant lui.
 * @returns {string[]} noms fautifs
 */
function unguardedActions(source) {
  return exportedFunctions(source)
    .filter(({ body }) => {
      const guard = body.search(CONTEXT_CALL)
      const access = body.search(SENSITIVE_ACCESS)
      return guard === -1 || (access !== -1 && access < guard)
    })
    .map(({ name }) => name)
}

const FILES = [
  ...SCAN_DIRS.flatMap((d) => walk(d)),
  ...SCAN_FILES,
  ...MARKED_DIRS.flatMap((d) => walk(d)).filter((f) => readFileSync(f, "utf8").includes(MARKER)),
]

const ACTION_FILES = existsSync(ACTIONS_DIR)
  ? readdirSync(ACTIONS_DIR)
      .filter((name) => ADMIN_ACTIONS.test(name))
      .map((name) => `${ACTIONS_DIR}/${name}`)
  : []

describe("garde-fou de l'espace admin (RD-ADMIN-01)", () => {
  it("scanne les fabriques d'URL et la logique pure admin", () => {
    expect(FILES).toContain("src/lib/app/admin-routes.js")
    expect(FILES).toContain("src/lib/admin-space/verification-queue.js")
    expect(FILES).toContain("src/lib/admin-space/decision-schemas.js")
    expect(FILES).toContain("src/lib/admin-space/dashboard-queue.js")
    expect(FILES).toContain("src/lib/admin-space/labels.js")
  })

  it("aucun fichier scanné ne viole une règle", () => {
    const found = FILES.flatMap((f) => violations(f, readFileSync(f, "utf8")))
    expect(found).toEqual([])
  })

  it("la logique pure n'importe aucun module serveur ni Supabase client", () => {
    const bad = FILES.filter((f) => f.startsWith("src/lib/")).filter((f) =>
      /from\s+["'][^"']*(?:supabase\/(?:server|client|service)|\/actions\/|next\/headers)/.test(
        readFileSync(f, "utf8"),
      ),
    )
    expect(bad).toEqual([])
  })

  it("le marqueur est celui de la tâche et les tests ne sont pas scannés", () => {
    expect(MARKER).toBe("@ds-screen RD-ADMIN-01")
    expect(FILES.every((f) => !f.endsWith(".test.js") && !f.endsWith(".test.jsx"))).toBe(true)
  })

  it("chaque fonction exportée d'un admin-*.actions.js appelle requireAdminService avant tout accès", () => {
    const offenders = ACTION_FILES.flatMap((f) => unguardedActions(readFileSync(f, "utf8")).map((name) => `${f}: ${name}`))
    expect(offenders).toEqual([])
  })
})

describe("détecteurs admin (fixtures en mémoire)", () => {
  const ids = (source, file = "src/lib/admin-space/x.jsx") => violations(file, source).map((v) => v.rule)

  /** [règle, source qui doit déclencher, source qui ne doit pas déclencher] */
  const CASES = [
    ["hex", 'const c = "#ff0000"', 'const href = "#i-clock" // couleur #ff0000 en commentaire'],
    ["rgba", 'const c = "rgba(1, 2, 3, 0.5)"', "const c = 'var(--c-encre)'"],
    ["style-attr", "<p style={{ margin: 0 }}>a</p>", '<p className="card">a</p>'],
    ["style-tag", "<style>{`p{}`}</style>", "<p>style</p>"],
    ["tailwind", '<p className="bg-white p-4 flex">a</p>', '<p className="card w-10 h-10 rounded-full">a</p>'],
    ["lucide", 'import { X } from "lucide-react"', 'import { Icon } from "@/components/design/icon"'],
    ["supabase-import", 'import { createClient } from "@/lib/supabase/client"', 'import { T } from "@/lib/supabase/database.constants"'],
    ["commission-literal", "const fee = budget * 0.88", "const n = 10.125 + 0.5"],
    ["commission-literal", "const fee = budget * 0.12", "const n = 10.125 + 0.5"],
    ["banned-words", 'const t = "Ta livraison"', "// livraison en commentaire\nconst t = 1"],
    ["banned-words", "<p>Paiement via FedaPay</p>", "<p>Paiement sécurisé</p>"],
    ["raw-type", "<span>{mission.type}</span>", "<span>{missionTypeLabel(mission.type)}</span>"],
    ["tutoiement", 'const t = "Vérifie la zone 3"', 'const t = "Vérifiez la zone 3"'],
    ["tutoiement", "<p>Ta carte a été refusée</p>", "<p>Votre carte a été refusée</p>"],
    ["tutoiement", 'const t = "Indique le motif"', 'const t = "Indiquez le motif"'],
    ["tutoiement", 'const t = "Renvoie ta carte"', 'const t = "Renvoyez votre carte"'],
  ]

  for (const [rule, positive, negative] of CASES) {
    it(`${rule} : détecte « ${positive.slice(0, 40)} » et ignore « ${negative.slice(0, 40)} »`, () => {
      expect(ids(positive)).toContain(rule)
      expect(ids(negative)).not.toContain(rule)
    })
  }

  it("couvre chaque règle par au moins un cas", () => {
    const covered = new Set(CASES.map((c) => c[0]))
    expect(RULES.map((r) => r.id).filter((id) => !covered.has(id))).toEqual([])
  })

  describe("règle requireAdminService", () => {
    const ok = `
      export async function approve(id) {
        const ctx = await requireAdminService()
        if (ctx.error) return { error: ctx.error }
        const { data } = await ctx.service.from("profiles").select("id")
        return data
      }
      export const reject = async (id) => {
        const ctx = await requireAdminService()
        return ctx.service.storage.from("x")
      }
    `
    it("accepte des fonctions qui ouvrent par le contrôle admin", () => {
      expect(exportedFunctions(ok).map((f) => f.name)).toEqual(["approve", "reject"])
      expect(unguardedActions(ok)).toEqual([])
    })

    it("signale une fonction sans contrôle", () => {
      const src = `export async function list() {\n  const service = createServiceClient()\n  return service.from("profiles")\n}`
      expect(unguardedActions(src)).toEqual(["list"])
    })

    it("signale un accès placé avant le contrôle", () => {
      const early = `export async function a() {\n  const service = createServiceClient()\n  const ctx = await requireAdminService()\n  return ctx\n}`
      const query = `export const b = async () => {\n  await client.from("t").select("id")\n  await requireAdminService()\n}`
      expect(unguardedActions(early)).toEqual(["a"])
      expect(unguardedActions(query)).toEqual(["b"])
    })

    it("signale un appel sans await ou seulement cité en commentaire", () => {
      const noAwait = `export async function c() {\n  requireAdminService()\n  return 1\n}`
      const comment = `export async function d() {\n  // await requireAdminService()\n  return 1\n}`
      expect(unguardedActions(noAwait)).toEqual(["c"])
      expect(unguardedActions(comment)).toEqual(["d"])
    })

    it("ne confond pas deux fonctions : le contrôle de l'une ne couvre pas l'autre", () => {
      const src = `export async function e() {\n  await requireAdminService()\n}\nexport async function f() {\n  return createServiceClient()\n}`
      expect(unguardedActions(src)).toEqual(["f"])
    })
  })
})
