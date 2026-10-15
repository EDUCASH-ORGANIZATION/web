import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})
const state = { user: null, profile: null, count: 0 }

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: state.profile }),
        then: (resolve) => resolve({ data: null, error: null, count: 0 }),
      }
      return chain
    },
  }
}

vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeSupabase() }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        then: (resolve) => resolve({ data: [], error: null, count: state.count }),
      }
      return chain
    },
  }),
}))
vi.mock("@/components/admin/admin-sidebar", () => ({ AdminSidebar: () => null }))
vi.mock("@/components/app-shell/bottom-nav", () => ({
  BottomNav: (props) => ({ type: "bottom-nav-stub", props }),
}))

const forged = { id: "u1", user_metadata: { role: "admin" } }

beforeEach(() => {
  redirect.mockClear()
  state.user = forged
  state.profile = { role: "student", full_name: "A", city: "Cotonou", is_suspended: false }
  state.count = 0
})

describe("AdminLayout", () => {
  it("redirige vers /auth/login si metadata admin mais profil student", async () => {
    const { default: AdminLayout } = await import("@/app/(admin)/admin/layout")
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("redirige un visiteur non connecté", async () => {
    state.user = null
    const { default: AdminLayout } = await import("@/app/(admin)/admin/layout")
    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("laisse passer un profil admin", async () => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
    const { default: AdminLayout } = await import("@/app/(admin)/admin/layout")
    await expect(AdminLayout({ children: null })).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("rend la barre mobile avec les vérifications en attente (compte du layout) et l'espaceur", async () => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
    state.count = 7
    const { default: AdminLayout } = await import("@/app/(admin)/admin/layout")
    const tree = await AdminLayout({ children: null })
    const found = []
    const walk = (node) => {
      if (!node || typeof node !== "object") return
      if (Array.isArray(node)) return node.forEach(walk)
      if (node.type?.name === "BottomNav") found.push(node.props)
      walk(node.props?.children)
    }
    walk(tree)
    expect(found).toHaveLength(1)
    expect(found[0].counts).toEqual({ verifications: 7 })
    expect(found[0].reserveSpace).toBe(true)
    expect(found[0].items.map((i) => i.key)).toEqual(["accueil", "verifications", "utilisateurs"])
    expect(found[0].more.items.map((i) => i.key)).toEqual(["missions", "portefeuilles"])
  })
})
