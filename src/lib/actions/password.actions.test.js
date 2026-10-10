import { describe, it, expect, vi, beforeEach } from "vitest"

const cookieGet = vi.fn()
const cookieSet = vi.fn()
const auth = {
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet, set: cookieSet }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))

import { requestPasswordReset, updatePassword } from "./password.actions"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

const PASSWORD = "Abcdef1!x"

beforeEach(() => {
  vi.clearAllMocks()
  cookieGet.mockReturnValue({ value: "1" })
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({})
})

describe("requestPasswordReset", () => {
  it("envoie avec redirectTo du flux recovery", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://educash.test")
    const r = await requestPasswordReset(null, form({ email: "a@exemple.bj" }))
    expect(r).toEqual({ status: "sent" })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@exemple.bj", {
      redirectTo: "https://educash.test/auth/confirm?flow=recovery",
    })
    vi.unstubAllEnvs()
  })

  it("email invalide : erreur de champ, aucun appel", async () => {
    const r = await requestPasswordReset(null, form({ email: "nope" }))
    expect(r.fieldErrors.email).toBeTruthy()
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it("même résultat pour une adresse inconnue", async () => {
    const known = await requestPasswordReset(null, form({ email: "a@exemple.bj" }))
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found", message: "User not found" } })
    const unknown = await requestPasswordReset(null, form({ email: "z@exemple.bj" }))
    expect(unknown).toEqual(known)
  })

  it("trop de demandes : rate_limited", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 429, message: "x" } })
    const r = await requestPasswordReset(null, form({ email: "a@exemple.bj" }))
    expect(r.code).toBe("rate_limited")
  })
})

describe("updatePassword", () => {
  const valid = { password: PASSWORD, confirmPassword: PASSWORD }

  it("sans cookie ec_recovery : expired, updateUser jamais appelé", async () => {
    cookieGet.mockReturnValue(undefined)
    const r = await updatePassword(null, form(valid))
    expect(r.code).toBe("expired")
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("sans session : expired", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } })
    const r = await updatePassword(null, form(valid))
    expect(r.code).toBe("expired")
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("mot de passe faible ou confirmation différente : erreurs de champ", async () => {
    const weak = await updatePassword(null, form({ password: "abc", confirmPassword: "abc" }))
    expect(weak.fieldErrors.password).toBeTruthy()
    const diff = await updatePassword(null, form({ password: PASSWORD, confirmPassword: "Autre1!xx" }))
    expect(diff.fieldErrors.confirmPassword).toBeTruthy()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("succès : mot de passe changé, session fermée, cookie supprimé", async () => {
    const r = await updatePassword(null, form(valid))
    expect(r).toEqual({ status: "updated" })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: PASSWORD })
    expect(auth.signOut).toHaveBeenCalled()
    expect(cookieSet).toHaveBeenCalledWith("ec_recovery", "", expect.objectContaining({ maxAge: 0 }))
  })

  it("même mot de passe : same_password, session conservée", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "same_password", message: "x" } })
    const r = await updatePassword(null, form(valid))
    expect(r.code).toBe("same_password")
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it("session expirée côté Supabase : expired", async () => {
    auth.updateUser.mockResolvedValue({ error: { message: "Auth session missing!" } })
    const r = await updatePassword(null, form(valid))
    expect(r.code).toBe("expired")
  })
})
