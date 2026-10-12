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

  it("compte sans profil : aucun rôle, même avec une métadonnée student, client ou admin", async () => {
    const empty = { role: null, profile: null, profileComplete: false }
    for (const role of ["student", "client", "admin", "root", undefined]) {
      expect(await getServerRole(supabaseWith(null), { id: "u1", user_metadata: { role } })).toEqual(empty)
    }
    expect(await getServerRole(supabaseWith(null), { id: "u1" })).toEqual(empty)
  })

  it("sans utilisateur : aucun rôle et aucune lecture", async () => {
    const spy = {}
    expect(await getServerRole(supabaseWith(null, spy), null)).toEqual({ role: null, profile: null, profileComplete: false })
    expect(spy.from).not.toHaveBeenCalled()
  })

  it("profil suspendu : rôle et profil renvoyés avec is_suspended, pour que l'appelant refuse", async () => {
    const result = await getServerRole(supabaseWith({ role: "student", ...complete, is_suspended: true }), { id: "u1" })
    expect(result.role).toBe("student")
    expect(result.profile.is_suspended).toBe(true)
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

  it("erreur de lecture de profiles : aucun rôle, pas de repli sur user_metadata, erreur exposée", async () => {
    const error = { message: "boom" }
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error })
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }
    const result = await getServerRole(supabase, { id: "u1", user_metadata: { role: "student" } })
    expect(result).toMatchObject({ role: null, profile: null, profileComplete: false, error })
  })
})
