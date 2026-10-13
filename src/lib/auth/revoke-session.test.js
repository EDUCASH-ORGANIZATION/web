import { describe, it, expect, vi, beforeEach } from "vitest"

const store = { getAll: vi.fn(), delete: vi.fn() }
vi.mock("next/headers", () => ({ cookies: async () => store }))

import { revokeSession } from "./revoke-session.js"

const supabaseWith = (result) => ({ auth: { signOut: vi.fn().mockResolvedValue(result) } })

describe("revokeSession", () => {
  beforeEach(() => {
    store.getAll.mockReset().mockReturnValue([{ name: "sb-abc-auth-token" }, { name: "autre" }])
    store.delete.mockReset()
  })

  it("sans option, appelle signOut() sans argument (comportement inchangé)", async () => {
    const supabase = supabaseWith({ error: null })
    await revokeSession(supabase)
    expect(supabase.auth.signOut).toHaveBeenCalledWith()
    expect(store.delete).not.toHaveBeenCalled()
  })

  it("transmet la portée demandée", async () => {
    const supabase = supabaseWith({ error: null })
    await revokeSession(supabase, { scope: "global" })
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" })
    await revokeSession(supabase, { scope: "local" })
    expect(supabase.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" })
  })

  it("supprime les cookies sb-* si la révocation échoue", async () => {
    await revokeSession(supabaseWith({ error: { message: "x" } }), { scope: "global" })
    expect(store.delete).toHaveBeenCalledTimes(1)
    expect(store.delete).toHaveBeenCalledWith("sb-abc-auth-token")
  })

  it("tolère une réponse vide de signOut", async () => {
    await expect(revokeSession(supabaseWith(undefined))).resolves.toBeUndefined()
    expect(store.delete).not.toHaveBeenCalled()
  })
})
