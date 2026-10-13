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

describe("ClientProfilePage - total dépensé", () => {
  it("sans session ni rôle client : état d'erreur, aucune lecture du grand livre", async () => {
    requireRole.mockResolvedValue({ error: "Vous devez être connecté pour effectuer cette action." })
    const text = await renderedText()
    expect(text).toContain("Impossible de charger votre profil")
    expect(text).not.toMatch(/Total dépensé/)
    expect(ledgerFilters).toEqual([])
    expect(requireRole).toHaveBeenCalledWith(["client"])
  })

  it("affiche 0 sans aucune libération", async () => {
    expect(await renderedText()).toMatch(/Total dépensé 0 FCFA/)
  })

  it("additionne plusieurs libérations de l'utilisateur", async () => {
    ledger = [
      { user_id: "u1", type: "release", amount: 5000 },
      { user_id: "u1", type: "release", amount: "7500" },
      { user_id: "u1", type: "reserve", amount: 99999 },
      { user_id: "u1", type: "commission", amount: 1500 },
    ]
    expect(await renderedText()).toMatch(/Total dépensé 12.500 FCFA/)
  })

  it("ignore les libérations d'un autre utilisateur et filtre sur la session", async () => {
    ledger = [
      { user_id: "u2", type: "release", amount: 40000 },
      { user_id: "u1", type: "release", amount: 3000 },
    ]
    const text = await renderedText()
    expect(text).toMatch(/Total dépensé 3.000 FCFA/)
    expect(ledgerFilters).toEqual([
      ["user_id", "u1"],
      ["type", "release"],
    ])
  })

  it("affiche un message neutre si la lecture échoue, sans détail technique", async () => {
    ledgerError = { message: 'relation "secret_table" does not exist' }
    const text = await renderedText()
    expect(text).toMatch(/Total dépensé Indisponible/)
    expect(text).not.toMatch(/secret_table|0 FCFA/)
  })

  it("somme exacte au-delà du plafond de 1000 lignes de PostgREST", async () => {
    ledger = Array.from({ length: 1500 }, () => ({ user_id: "u1", type: "release", amount: 10 }))
    expect(await renderedText()).toMatch(/Total dépensé 15.000 FCFA/)
  })
})
