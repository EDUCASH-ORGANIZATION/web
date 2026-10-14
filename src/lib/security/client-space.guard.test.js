import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { COMMON_RULES, TUTOIEMENT_RULE, violations as scanViolations, walk } from "./space-guard-rules.js"

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

// Détecteurs partagés avec le garde-fou étudiant : src/lib/security/space-guard-rules.js.
// Registre client : le tutoiement est interdit.
const RULES = [...COMMON_RULES, TUTOIEMENT_RULE]

/**
 * @param {string} file Chemin relatif au dépôt
 * @param {string} source
 * @returns {Array<{ file: string, rule: string, hit: string }>}
 */
function violations(file, source) {
  return scanViolations(file, source, RULES)
}

// ─── Collecte des fichiers ──────────────────────────────────────────────────────────────────

const FILES = [
  ...SCAN_DIRS.flatMap((d) => walk(d)),
  ...MARKED_DIRS.flatMap((d) => walk(d)).filter((f) => readFileSync(f, "utf8").includes(MARKER)),
]

// Fichiers de src/app/(client) dispensés du marqueur (aucun aujourd'hui : layout, loading, error et
// not-found le portent aussi). Toute entrée doit être justifiée ici et rester existante.
const MARKER_EXEMPT = []

// ─── Tests ──────────────────────────────────────────────────────────────────────────────────

describe("garde-fou de l'espace client (RD-CLIENT-01)", () => {
  it("scanne la logique pure de src/lib/app", () => {
    expect(FILES).toContain("src/lib/app/format.js")
    expect(FILES).toContain("src/lib/app/client-routes.js")
    expect(FILES.filter((f) => f.startsWith("src/lib/app/")).length).toBeGreaterThanOrEqual(6)
  })

  it("tout fichier de src/app/(client) porte le marqueur ou figure dans la liste justifiée", () => {
    const files = walk("src/app/(client)")
    expect(files.length).toBeGreaterThan(0)
    const unmarked = files.filter((f) => !MARKER_EXEMPT.includes(f) && !readFileSync(f, "utf8").includes(MARKER))
    expect(unmarked).toEqual([])
    expect(MARKER_EXEMPT.filter((f) => !existsSync(f))).toEqual([])
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
