import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})
const state = { user: null, profile: null, updates: 0 }

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: () => {
          state.updates += 1
          return chain
        },
        maybeSingle: async () => ({ data: state.profile }),
        then: (resolve) => resolve({ data: null, error: null, count: 0 }),
      }
      return chain
    },
  }
}

vi.mock("next/navigation", () => ({ redirect: (to) => redirect(to) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeSupabase() }))
vi.mock("@/lib/actions/auth.actions", () => ({ getCurrentUser: async () => state.user }))
vi.mock("@/components/admin/admin-sidebar", () => ({ AdminSidebar: () => null }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }))

const forged = { id: "u1", user_metadata: { role: "admin" } }

beforeEach(() => {
  redirect.mockClear()
  state.user = forged
  state.profile = { role: "student", full_name: "A", city: "Cotonou", is_suspended: false }
  state.updates = 0
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
})

describe("assertAdmin via les actions admin", () => {
  it("refuse metadata admin avec profil student, sans écriture", async () => {
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res.error).toMatch(/Accès refusé/)
    expect(state.updates).toBe(0)
  })

  it("refuse sans profil même avec metadata admin", async () => {
    state.profile = null
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res.error).toMatch(/Accès refusé/)
    expect(state.updates).toBe(0)
  })

  it("autorise un profil admin", async () => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res).toEqual({ success: true })
    expect(state.updates).toBe(1)
  })
})
