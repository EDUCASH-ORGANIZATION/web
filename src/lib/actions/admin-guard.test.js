import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((to) => {
  throw new Error(`REDIRECT:${to}`)
})
const state = { user: null, profile: null, updates: 0, rows: [{ user_id: "target" }], error: null, lastValues: null, count: 0 }

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
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (values) => {
          state.updates += 1
          state.lastValues = values
          return chain
        },
        single: async () => ({ data: { full_name: "Awa K" } }),
        maybeSingle: async () => ({ data: { school: "UAC" } }),
        then: (resolve) => resolve({ data: state.rows, error: state.error, count: state.count }),
      }
      return chain
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "a@b.bj" } } }) } },
  }),
}))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({})) }))

const forged = { id: "u1", user_metadata: { role: "admin" } }

beforeEach(() => {
  redirect.mockClear()
  state.user = forged
  state.profile = { role: "student", full_name: "A", city: "Cotonou", is_suspended: false }
  state.updates = 0
  state.rows = [{ user_id: "target" }]
  state.error = null
  state.lastValues = null
  state.count = 0
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("contrôle admin des actions admin", () => {
  it("refuse metadata admin avec profil student, sans écriture", async () => {
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res.error).toMatch(/droits/)
    expect(state.updates).toBe(0)
  })

  it("refuse sans profil même avec metadata admin", async () => {
    state.profile = null
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res.error).toMatch(/droits/)
    expect(state.updates).toBe(0)
  })

  it("autorise un profil admin", async () => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
    const { resetRejection } = await import("@/lib/actions/admin.actions")
    const res = await resetRejection("target")
    expect(res).toEqual({ success: true })
    expect(state.updates).toBe(1)
  })

  it("refuse un administrateur suspendu", async () => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: true }
    const { suspendUser } = await import("@/lib/actions/admin.actions")
    expect((await suspendUser("target")).error).toMatch(/droits/)
    expect(state.updates).toBe(0)
  })

  it("refuse verifyStudent et rejectStudent à un non-admin, sans écriture", async () => {
    const { verifyStudent, rejectStudent } = await import("@/lib/actions/admin.actions")
    expect((await verifyStudent("target")).error).toMatch(/droits/)
    expect((await rejectStudent("target", "x")).error).toMatch(/droits/)
    expect(state.updates).toBe(0)
  })
})

describe("écritures admin : une ligne exactement, messages neutres", () => {
  beforeEach(() => {
    state.profile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  })

  it("verifyStudent réussit et renvoie la date d'expiration", async () => {
    const { verifyStudent } = await import("@/lib/actions/admin.actions")
    const res = await verifyStudent("target")
    expect(res.success).toBe(true)
    expect(res.verifiedUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(state.lastValues).toMatchObject({ is_verified: true, rejection_reason: null })
  })

  it.each([
    ["verifyStudent", (a) => a.verifyStudent("target")],
    ["rejectStudent", (a) => a.rejectStudent("target", "Flou")],
    ["resetRejection", (a) => a.resetRejection("target")],
    ["suspendUser", (a) => a.suspendUser("target")],
  ])("%s renvoie une erreur neutre si aucune ligne n'est modifiée", async (_n, call) => {
    state.rows = []
    const res = await call(await import("@/lib/actions/admin.actions"))
    expect(res.error).toBeTruthy()
    expect(res.success).toBeUndefined()
  })

  it.each([
    ["verifyStudent", (a) => a.verifyStudent("target")],
    ["rejectStudent", (a) => a.rejectStudent("target", "Flou")],
  ])("%s ne relaie pas le message interne de la base", async (_n, call) => {
    state.error = { message: 'new row violates row-level security policy for table "profiles"' }
    const res = await call(await import("@/lib/actions/admin.actions"))
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/row-level|profiles/)
    expect(console.error).toHaveBeenCalled()
  })

  it("refuse un identifiant vide sans écriture", async () => {
    const { suspendUser } = await import("@/lib/actions/admin.actions")
    expect((await suspendUser("")).error).toBeTruthy()
    expect(state.updates).toBe(0)
  })
})
