import { describe, it, expect, vi } from "vitest"
import { getServerRole } from "./server-role.js"

function supabaseWith(profile, spy = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  Object.assign(spy, { from, select, eq, maybeSingle })
  return { from }
}

const complete = { full_name: "Sèna Agossou", city: "Cotonou", is_suspended: false }

describe("getServerRole", () => {
  it("lit profiles par user_id", async () => {
    const spy = {}
    const user = { id: "u1", user_metadata: {} }
    await getServerRole(supabaseWith({ role: "student", ...complete }, spy), user)
    expect(spy.from).toHaveBeenCalledWith("profiles")
    expect(spy.select.mock.calls[0][0]).toContain("is_suspended")
    expect(spy.eq).toHaveBeenCalledWith("user_id", "u1")
  })

  it("renvoie admin quand le profil dit admin", async () => {
    const result = await getServerRole(supabaseWith({ role: "admin", ...complete }), { id: "u1", user_metadata: {} })
    expect(result.role).toBe("admin")
    expect(result.profileComplete).toBe(true)
  })

  it("ignore user_metadata.role = admin quand le profil dit student", async () => {
    const result = await getServerRole(supabaseWith({ role: "student", ...complete }), {
      id: "u1",
      user_metadata: { role: "admin" },
    })
    expect(result.role).toBe("student")
  })

  it("n'utilise pas la métadonnée quand un profil existe sans rôle valide", async () => {
    const result = await getServerRole(supabaseWith({ role: null, ...complete }), { id: "u1", user_metadata: { role: "client" } })
    expect(result.role).toBeNull()
    const odd = await getServerRole(supabaseWith({ role: "superadmin", ...complete }), { id: "u1", user_metadata: { role: "client" } })
    expect(odd.role).toBeNull()
  })

  it("se replie sur la métadonnée student ou client sans profil", async () => {
    for (const role of ["student", "client"]) {
      const result = await getServerRole(supabaseWith(null), { id: "u1", user_metadata: { role } })
      expect(result).toEqual({ role, profile: null, profileComplete: false })
    }
  })

  it("ne prend jamais admin dans la métadonnée sans profil", async () => {
    const result = await getServerRole(supabaseWith(null), { id: "u1", user_metadata: { role: "admin" } })
    expect(result).toEqual({ role: null, profile: null, profileComplete: false })
  })

  it("renvoie un rôle nul sans profil ni métadonnée valide, ou sans utilisateur", async () => {
    const empty = { role: null, profile: null, profileComplete: false }
    expect(await getServerRole(supabaseWith(null), { id: "u1" })).toEqual(empty)
    expect(await getServerRole(supabaseWith(null), { id: "u1", user_metadata: { role: "root" } })).toEqual(empty)
    const spy = {}
    expect(await getServerRole(supabaseWith(null, spy), null)).toEqual(empty)
    expect(spy.from).not.toHaveBeenCalled()
  })

  it("profileComplete exige nom et ville renseignés", async () => {
    const user = { id: "u1", user_metadata: {} }
    expect((await getServerRole(supabaseWith({ role: "client", full_name: "A", city: "Cotonou" }), user)).profileComplete).toBe(true)
    expect((await getServerRole(supabaseWith({ role: "client", full_name: "A", city: null }), user)).profileComplete).toBe(false)
    expect((await getServerRole(supabaseWith({ role: "client", full_name: "  ", city: "Cotonou" }), user)).profileComplete).toBe(false)
    expect((await getServerRole(supabaseWith({ role: "client", full_name: null, city: "" }), user)).profileComplete).toBe(false)
  })

  it("expose le profil lu", async () => {
    const profile = { role: "student", ...complete }
    expect((await getServerRole(supabaseWith(profile), { id: "u1" })).profile).toBe(profile)
  })
})
