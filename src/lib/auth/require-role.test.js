import { describe, it, expect, vi, beforeEach } from "vitest"

const createClient = vi.fn()
const getServerRole = vi.fn()
vi.mock("@/lib/supabase/server", () => ({ createClient: (...a) => createClient(...a) }))
vi.mock("@/lib/auth/server-role", () => ({ getServerRole: (...a) => getServerRole(...a) }))

import { requireUser, requireRole } from "./require-role.js"

function supabaseUser(user, error = null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) } }
}

describe("requireUser", () => {
  it("refuse un visiteur non connecté", async () => {
    createClient.mockResolvedValue(supabaseUser(null))
    expect(await requireUser()).toEqual({ error: expect.any(String) })
  })

  it("refuse si getUser renvoie une erreur", async () => {
    createClient.mockResolvedValue(supabaseUser({ id: "u1" }, { message: "jwt" }))
    expect((await requireUser()).error).toBeTruthy()
  })

  it("renvoie le client et l'utilisateur", async () => {
    const supabase = supabaseUser({ id: "u1" })
    createClient.mockResolvedValue(supabase)
    expect(await requireUser()).toEqual({ supabase, user: { id: "u1" } })
  })
})

describe("requireRole", () => {
  const user = { id: "u1", user_metadata: { role: "admin" } }
  let supabase
  beforeEach(() => {
    supabase = supabaseUser(user)
    createClient.mockResolvedValue(supabase)
    getServerRole.mockReset()
  })

  it("refuse un utilisateur non connecté sans lire le rôle", async () => {
    createClient.mockResolvedValue(supabaseUser(null))
    const result = await requireRole(["client"])
    expect(result.error).toBeTruthy()
    expect(getServerRole).not.toHaveBeenCalled()
  })

  it("accepte le rôle attendu", async () => {
    const profile = { role: "client", is_suspended: false }
    getServerRole.mockResolvedValue({ role: "client", profile })
    const result = await requireRole(["client"])
    expect(result).toEqual({ supabase, user, role: "client", profile })
    expect(getServerRole).toHaveBeenCalledWith(supabase, user)
  })

  it("accepte l'un des rôles de la liste", async () => {
    getServerRole.mockResolvedValue({ role: "admin", profile: { role: "admin", is_suspended: false } })
    expect((await requireRole(["client", "admin"])).role).toBe("admin")
  })

  it("refuse un mauvais rôle", async () => {
    getServerRole.mockResolvedValue({ role: "student", profile: { role: "student", is_suspended: false } })
    expect((await requireRole(["client"])).error).toBeTruthy()
  })

  it("refuse un compte suspendu", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: { role: "client", is_suspended: true } })
    expect((await requireRole(["client"])).error).toBeTruthy()
  })

  it("refuse en cas d'erreur de lecture du profil (fail-closed)", async () => {
    getServerRole.mockResolvedValue({ role: null, profile: null, error: { message: "db" } })
    expect((await requireRole(["client"])).error).toBeTruthy()
  })

  it("refuse un rôle null et l'absence de profil (repli métadonnées non suffisant)", async () => {
    getServerRole.mockResolvedValue({ role: null, profile: { role: "x", is_suspended: false } })
    expect((await requireRole(["client"])).error).toBeTruthy()
    getServerRole.mockResolvedValue({ role: "client", profile: null })
    expect((await requireRole(["client"])).error).toBeTruthy()
  })
})

describe("requireRole : registre des messages selon le rôle exigé", () => {
  const user = { id: "u1" }
  const TUTOIEMENT = /\b(tu|ton|ta|tes)\b|Réessaie/i
  beforeEach(() => {
    createClient.mockResolvedValue(supabaseUser(user))
    getServerRole.mockReset()
    getServerRole.mockResolvedValue({ role: "student", profile: { role: "student", is_suspended: false } })
  })

  it("vouvoie quand le rôle exigé est exactement client (refus de rôle)", async () => {
    const { error } = await requireRole(["client"])
    expect(error).toBe("Vous n'avez pas les droits pour effectuer cette action.")
    expect(error).not.toMatch(TUTOIEMENT)
  })

  it("vouvoie un client non connecté", async () => {
    createClient.mockResolvedValue(supabaseUser(null))
    expect((await requireRole(["client"])).error).toBe("Vous devez être connecté pour effectuer cette action.")
  })

  it("garde le tutoiement pour étudiant, admin et rôles multiples", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: { role: "client", is_suspended: false } })
    for (const roles of [["student"], ["admin"], ["student", "admin"]]) {
      expect((await requireRole(roles)).error).toBe("Tu n'as pas les droits pour effectuer cette action.")
    }
    getServerRole.mockResolvedValue({ role: "student", profile: { role: "student", is_suspended: false } })
    expect((await requireRole(["client", "admin"])).error).toBe("Tu n'as pas les droits pour effectuer cette action.")
    createClient.mockResolvedValue(supabaseUser(null))
    expect((await requireRole(["student"])).error).toBe("Tu dois être connecté pour effectuer cette action.")
    expect((await requireRole(["client", "admin"])).error).toBe("Tu dois être connecté pour effectuer cette action.")
    expect((await requireUser()).error).toBe("Tu dois être connecté pour effectuer cette action.")
  })
})
