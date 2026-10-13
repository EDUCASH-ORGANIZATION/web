import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((url) => {
  throw new Error(`redirect:${url}`)
})
const getCurrentUser = vi.fn()

let ledger = []
let ledgerError = null
const ledgerFilters = []

vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser, logout: vi.fn() }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: async () => ({ profile: { phone: null }, error: null }),
}))

function query(table) {
  const filters = []
  const builder = {
    select: () => builder,
    eq: (col, val) => {
      filters.push([col, val])
      if (table === "wallet_transactions") ledgerFilters.push([col, val])
      return builder
    },
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: { full_name: "Awa", user_id: "u1" } }),
    then: (resolve) => {
      if (table === "wallet_transactions") {
        if (ledgerError) return resolve({ data: null, error: ledgerError })
        const data = ledger
          .filter((row) => filters.every(([col, val]) => row[col] === val))
          .map((row) => ({ amount: row.amount }))
        return resolve({ data, error: null })
      }
      return resolve({ data: [], error: null })
    },
  }
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table) => query(table) }),
}))

const { default: ClientProfilePage } = await import("./page")

function texts(node, out = []) {
  if (node == null || typeof node === "boolean") return out
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => texts(n, out))
    return out
  }
  texts(node.props?.children, out)
  return out
}

async function renderedText() {
  return texts(await ClientProfilePage()).join(" ").replace(/\s+/g, " ")
}

beforeEach(() => {
  vi.clearAllMocks()
  ledger = []
  ledgerError = null
  ledgerFilters.length = 0
  getCurrentUser.mockResolvedValue({ id: "u1" })
})

describe("ClientProfilePage - total dépensé", () => {
  it("redirige vers la connexion sans session", async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(ClientProfilePage()).rejects.toThrow("redirect:/auth/login")
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
})
