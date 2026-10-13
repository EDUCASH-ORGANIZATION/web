import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

// Page, action et vue réelles : seuls l'authentification et la base sont simulés. Les cas du total dépensé de la
// page d'origine (somme des libérations du grand livre de la session, « Indisponible » en cas d'erreur) sont
// portés ici de bout en bout, sur l'action getClientProfileSummary et son affichage.

let ledger = []
let ledgerError = null
const ledgerFilters = []

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("next/image", () => ({ default: ({ src, className }) => <span data-image={src} className={className} /> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn(), requireUser: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: { user_id: "u1", full_name: "Awa", city: "Cotonou", phone: null, bio: null, avatar_url: null, rating: 0, created_at: "2026-04-02T10:00:00Z" }, error: null }),
      }
      return builder
    },
  }),
}))

const { requireRole } = await import("@/lib/auth/require-role")

// Faux client de session : le grand livre est filtré par les .eq() reçus, paginé par .range() ; le reste est vide.
function query(table) {
  const filters = []
  let window = null
  const builder = {
    select: () => builder,
    eq: (col, val) => {
      filters.push([col, val])
      if (table === "wallet_transactions") ledgerFilters.push([col, val])
      return builder
    },
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    range: (from, to) => {
      window = [from, to]
      return builder
    },
    then: (resolve) => {
      if (table === "wallet_transactions") {
        if (ledgerError) return resolve({ data: null, error: ledgerError })
        let data = ledger
          .filter((row) => filters.every(([col, val]) => row[col] === val))
          .map((row) => ({ amount: row.amount }))
        if (window) data = data.slice(window[0], window[1] + 1)
        return resolve({ data, error: null })
      }
      return resolve({ data: [], count: 0, error: null })
    },
  }
  return builder
}

const { default: ClientProfilePage } = await import("./page")

async function renderedText() {
  const html = renderToStaticMarkup(await ClientProfilePage())
  return html.replace(/<script>[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  ledger = []
  ledgerError = null
  ledgerFilters.length = 0
  requireRole.mockResolvedValue({ supabase: { from: (table) => query(table) }, user: { id: "u1" }, role: "client", profile: {} })
})

describe("QA - cas limites du total dépensé", () => {
  it("gère décimaux en chaîne, null et undefined (le FCFA est affiché sans décimale)", async () => {
    ledger = [
      { user_id: "u1", type: "release", amount: "1500.50" },
      { user_id: "u1", type: "release", amount: null },
      { user_id: "u1", type: "release", amount: undefined },
      { user_id: "u1", type: "release", amount: 0.25 },
    ]
    // 1500,75 arrondi à l'unité : 1 501 FCFA (la valeur exacte est vérifiée dans profile.actions.test.js).
    expect(await renderedText()).toMatch(/Total dépensé 1.501 FCFA/)
  })

  it("gère de très grands montants sans NaN", async () => {
    ledger = [
      { user_id: "u1", type: "release", amount: "999999999999" },
      { user_id: "u1", type: "release", amount: 1 },
    ]
    const text = await renderedText()
    expect(text).not.toMatch(/NaN/)
    expect(text).toMatch(/1.000.000.000.000 FCFA/)
  })

  it("montant non numérique : Indisponible au lieu de NaN (colonne numeric NOT NULL, donc impossible en base)", async () => {
    ledger = [{ user_id: "u1", type: "release", amount: "abc" }]
    const text = await renderedText()
    expect(text).toMatch(/Total dépensé Indisponible/)
    expect(text).not.toMatch(/NaN/)
  })

  it("une erreur avec data renseigné reste Indisponible", async () => {
    ledger = [{ user_id: "u1", type: "release", amount: 5000 }]
    ledgerError = { message: "x" }
    expect(await renderedText()).toMatch(/Indisponible/)
  })
})
