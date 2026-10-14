import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { COMMON_RULES, TUTOIEMENT_RULE, violations as scanViolations, walk } from "./space-guard-rules.js"

// Garde-fou de transition RD-STUDENT-01 : l'espace étudiant refondu n'utilise que les classes du
// système de design, le vouvoiement, le vocabulaire autorisé et des modules purs.
// Périmètre : src/components/student-space, src/lib/student-space, src/lib/app/student-routes.js,
// plus les fichiers de src/app/(student), src/app/review et src/app/design/student qui portent le
// marqueur `@ds-screen RD-STUDENT-01` (les pages pas encore portées n'en ont pas : elles sont ignorées).
// Les dossiers pas encore créés sont ignorés. Mêmes règles que le client, registre de langue compris :
// ici aussi le tutoiement est interdit et le vouvoiement permis (décision RD-VOUS-01). Les détecteurs sont testés sur des fixtures
// en mémoire (un vrai positif et un vrai négatif par règle).

const SCAN_DIRS = ["src/components/student-space", "src/lib/student-space"]
const SCAN_FILES = ["src/lib/app/student-routes.js"]
const MARKED_DIRS = ["src/app/(student)", "src/app/review", "src/app/design/student"]
const MARKER = "@ds-screen RD-STUDENT-01"

// Registre unique de la plateforme (RD-VOUS-01) : le tutoiement est interdit, le vouvoiement est permis.
const RULES = [...COMMON_RULES, TUTOIEMENT_RULE]

/**
 * @param {string} file Chemin relatif au dépôt
 * @param {string} source
 * @returns {Array<{ file: string, rule: string, hit: string }>}
 */
function violations(file, source) {
  return scanViolations(file, source, RULES)
}

const FILES = [
  ...SCAN_DIRS.flatMap((d) => walk(d)),
  ...SCAN_FILES,
  ...MARKED_DIRS.flatMap((d) => walk(d)).filter((f) => readFileSync(f, "utf8").includes(MARKER)),
]

describe("garde-fou de l'espace étudiant (RD-STUDENT-01)", () => {
  it("scanne les fabriques d'URL et la logique pure étudiante", () => {
    expect(FILES).toContain("src/lib/app/student-routes.js")
    expect(FILES).toContain("src/lib/student-space/verification-status.js")
    expect(FILES).toContain("src/lib/student-space/explore-query.js")
    expect(FILES).toContain("src/lib/student-space/applications-tabs.js")
    expect(FILES).toContain("src/lib/student-space/student-wallet-tx.js")
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

  it("tout fichier non test de src/app/(student) porte le marqueur, sans exemption", () => {
    const unmarked = walk("src/app/(student)").filter((f) => !readFileSync(f, "utf8").slice(0, 300).includes(MARKER))
    expect(unmarked).toEqual([])
    expect(walk("src/app/(student)").length).toBeGreaterThan(15)
  })

  it("le marqueur est celui de la tâche et les tests ne sont pas scannés", () => {
    expect(MARKER).toBe("@ds-screen RD-STUDENT-01")
    expect(FILES.every((f) => !f.endsWith(".test.js") && !f.endsWith(".test.jsx"))).toBe(true)
  })
})

describe("détecteurs étudiants (fixtures en mémoire)", () => {
  const ids = (source, file = "src/lib/student-space/x.jsx") => violations(file, source).map((v) => v.rule)

  /** [règle, source qui doit déclencher, source qui ne doit pas déclencher] */
  const CASES = [
    ["hex", 'const c = "#ff0000"', 'const href = "#i-clock" // couleur #ff0000 en commentaire'],
    ["rgba", 'const c = "rgba(1, 2, 3, 0.5)"', "const c = 'var(--c-encre)'"],
    ["style-attr", "<p style={{ margin: 0 }}>a</p>", '<p className="card">a</p>'],
    ["style-tag", "<style>{`p{}`}</style>", "<p>style</p>"],
    ["tailwind", '<p className="bg-white p-4 flex">a</p>', '<p className="card w-10 h-10 rounded-full">a</p>'],
    ["tailwind", '<p className="text-red-500">a</p>', '<p className="text-sm font-bold">a</p>'],
    ["lucide", 'import { X } from "lucide-react"', 'import { Icon } from "@/components/design/icon"'],
    ["supabase-import", 'import { createClient } from "@/lib/supabase/client"', 'import { T } from "@/lib/supabase/database.constants"'],
    ["commission-literal", "const fee = budget * 0.88", "const n = 10.125 + 0.5"],
    ["commission-literal", "const fee = budget * 0.12", "const n = 10.125 + 0.5"],
    ["banned-words", 'const t = "Ta livraison"', "// livraison en commentaire\nconst t = 1"],
    ["banned-words", "<p>Paiement via FedaPay</p>", "<p>Paiement sécurisé</p>"],
    ["banned-words", 'const t = "Badge bientôt expiré"', 'const t = "Badge à renouveler"'],
    ["raw-type", "<span>{mission.type}</span>", "<span>{missionTypeLabel(mission.type)}</span>"],
    ["tutoiement", 'const t = "Ton solde"', 'const t = "Votre solde"'],
    ["tutoiement", "<p>Tu peux postuler</p>", "<p>Vous pouvez postuler</p>"],
    ["tutoiement", "<p>ne t&apos;est dû</p>", "<p>ne vous est dû</p>"],
    ["tutoiement", 'const t = "Merci pour tes retours"', 'const t = "Merci pour vos retours"'],
    ["tutoiement", 'const t = "Réessaie dans un instant"', 'const t = "Veuillez réessayer"'],
    ["tutoiement", 'const t = "Réessaie plus tard"', 'const t = "Réessayez plus tard"'],
    ["tutoiement", "<p>Vérifie ta carte</p>", "<p>Vérifiez votre carte</p>"],
    ["tutoiement", 'const t = "Contacte le support"', 'const t = "Contactez le support"'],
    ["tutoiement", 'const t = "Envoie ta carte"', 'const t = "Envoyez votre carte"'],
    ["tutoiement", 'const t = "Recharger ton compte"', 'const t = "Recharger votre compte"'],
    ["tutoiement", 'const t = "Connecte-toi"', 'const t = "Connectez-vous"'],
  ]

  for (const [rule, positive, negative] of CASES) {
    it(`${rule} : détecte « ${positive.slice(0, 40)} » et ignore « ${negative.slice(0, 40)} »`, () => {
      expect(ids(positive)).toContain(rule)
      expect(ids(negative)).not.toContain(rule)
    })
  }

  it("le vouvoiement est permis (aucune règle ne le signale)", () => {
    expect(ids('const t = "Votre argent est en sécurité, vous pouvez retirer"')).toEqual([])
    expect(ids("<p>Envoyez votre carte pour postuler</p>")).toEqual([])
  })

  it("le tutoiement n'est pas détecté dans un commentaire ni dans un identifiant", () => {
    expect(ids("// Ta carte\nconst taCarte = 1")).toEqual([])
  })

  it("le tutoiement est signalé aussi pour les impératifs sans pronom de la liste fermée", () => {
    for (const t of ["Retrouve tes missions", "Découvre les missions", "Postule maintenant", "Crée ton compte", "Renvoie ta carte", "Retire tes gains", "Reconnecte-toi"]) {
      expect(ids(`const t = "${t}"`)).toContain("tutoiement")
    }
    expect(ids('const t = "Retrouvez vos missions. Postulez maintenant. Reconnectez-vous"')).toEqual([])
    expect(ids('const t = "La tonalité du texte"')).not.toContain("tutoiement")
  })

  it("l'exception de src/hooks vaut pour l'import Supabase", () => {
    const source = 'import { createClient } from "@/lib/supabase/client"'
    expect(violations("src/hooks/use-x.js", source)).toEqual([])
    expect(violations("src/components/student-space/x.jsx", source).map((v) => v.rule)).toContain("supabase-import")
  })

  it("couvre chaque règle par au moins un cas", () => {
    const covered = new Set(CASES.map((c) => c[0]))
    expect(RULES.map((r) => r.id).filter((id) => !covered.has(id))).toEqual([])
  })
})
