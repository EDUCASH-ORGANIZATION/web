import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((url) => {
  throw new Error(`redirect:${url}`)
})
const getCurrentUser = vi.fn()
const getWallet = vi.fn()

vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser }))
vi.mock("@/lib/actions/wallet.actions", () => ({ getWallet }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { full_name: "Awa", avatar_url: null, city: "Cotonou" } }) }),
      }),
    }),
  }),
}))
vi.mock("@/components/client/new-mission-form", () => ({ NewMissionForm: () => null }))
vi.mock("@/components/client/wallet-required-gate", () => ({ WalletRequiredGate: () => null }))

const { default: NewMissionPage } = await import("./page")

function findElement(node, name) {
  if (!node || typeof node !== "object") return null
  if (typeof node.type === "function" && node.type.name === name) return node
  const children = node.props?.children
  for (const child of [].concat(children ?? [])) {
    const found = findElement(child, name)
    if (found) return found
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue({ id: "u1" })
  getWallet.mockResolvedValue({ available: 10000 })
})

describe("NewMissionPage", () => {
  it("transmet le pré-remplissage valide au formulaire", async () => {
    const tree = await NewMissionPage({
      searchParams: Promise.resolve({ besoin: "Faire le marché", ville: "Porto-Novo", type: "Livraison" }),
    })
    const form = findElement(tree, "NewMissionForm")
    expect(form.props.initial).toEqual({ title: "Faire le marché", city: "Porto-Novo", type: "Livraison" })
    expect(form.props.walletAvailable).toBe(10000)
  })

  it("ignore les valeurs invalides", async () => {
    const tree = await NewMissionPage({
      searchParams: Promise.resolve({ ville: "Paris", type: "Inconnu" }),
    })
    const form = findElement(tree, "NewMissionForm")
    expect(form.props.initial).toEqual({ title: "", city: "", type: "" })
  })

  it("garde la porte portefeuille quand le solde est insuffisant", async () => {
    getWallet.mockResolvedValue({ available: 0 })
    const tree = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "x" }) })
    expect(findElement(tree, "WalletRequiredGate")).not.toBeNull()
    expect(findElement(tree, "NewMissionForm")).toBeNull()
  })

  it("transmet le lien de reprise à la porte seulement si un champ est pré-rempli", async () => {
    getWallet.mockResolvedValue({ available: 0 })
    const withPrefill = await NewMissionPage({
      searchParams: Promise.resolve({ besoin: "Faire le marché", ville: "Cotonou", type: "Livraison" }),
    })
    expect(findElement(withPrefill, "WalletRequiredGate").props.resumeHref).toBe(
      "/client/missions/new?besoin=Faire+le+march%C3%A9&ville=Cotonou&type=Livraison",
    )
    const without = await NewMissionPage({ searchParams: Promise.resolve({ ville: "Paris" }) })
    expect(findElement(without, "WalletRequiredGate").props.resumeHref).toBeUndefined()
  })

  it("redirige vers la connexion sans utilisateur", async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(NewMissionPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/auth/login")
  })
})
