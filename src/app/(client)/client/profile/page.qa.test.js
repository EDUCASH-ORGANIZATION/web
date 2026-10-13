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

describe("QA - cas limites du total dépensé", () => {
  it("gère décimaux en chaîne, null et undefined", async () => {
    ledger = [
      { user_id: "u1", type: "release", amount: "1500.50" },
      { user_id: "u1", type: "release", amount: null },
      { user_id: "u1", type: "release", amount: undefined },
      { user_id: "u1", type: "release", amount: 0.25 },
    ]
    expect(await renderedText()).toMatch(/Total dépensé 1.500,75 FCFA/)
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

  it("montant non numérique donne NaN (documenté : colonne numeric NOT NULL, donc impossible en base)", async () => {
    ledger = [{ user_id: "u1", type: "release", amount: "abc" }]
    expect(await renderedText()).toMatch(/NaN/)
  })

  it("une erreur avec data renseigné reste Indisponible", async () => {
    ledgerError = { message: "x" }
    expect(await renderedText()).toMatch(/Indisponible/)
  })
})
