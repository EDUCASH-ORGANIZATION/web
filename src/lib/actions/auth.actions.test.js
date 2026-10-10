import { describe, it, expect, vi, beforeEach } from "vitest"

const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})
const cookieSet = vi.fn()
const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}
const getServerRole = vi.fn()
const cookieStore = { getAll: vi.fn(() => []), delete: vi.fn() }

vi.mock("next/navigation", () => ({ redirect: (u) => redirect(u) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, getAll: cookieStore.getAll, delete: cookieStore.delete }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))
vi.mock("@/lib/auth/server-role", () => ({ getServerRole: (...a) => getServerRole(...a) }))

import { login, register } from "./auth.actions"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

async function redirected(promise) {
  try {
    await promise
  } catch (e) {
    const match = /^REDIRECT:(.*)$/.exec(e.message)
    if (match) return match[1]
    throw e
  }
  return null
}

const PASSWORD = "Abcdef1!x"
const registerValues = {
  role: "student",
  email: "sena@exemple.bj",
  password: PASSWORD,
  confirmPassword: PASSWORD,
  cgu: "on",
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getUser.mockResolvedValue({ data: { user: null } })
  auth.signOut.mockResolvedValue({})
  auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
  auth.signUp.mockResolvedValue({
    data: { user: { id: "u1", identities: [{}] }, session: null },
    error: null,
  })
  getServerRole.mockResolvedValue({ role: "student", profile: { is_suspended: false }, profileComplete: true })
})

describe("login", () => {
  it("champs vides : erreurs de champ, aucun appel Supabase", async () => {
    const r = await login(null, form({ email: "", password: "" }))
    expect(r.fieldErrors).toMatchObject({ email: expect.any(String), password: expect.any(String) })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("identifiants incorrects : code et message francais", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", message: "Invalid login credentials" } })
    const r = await login(null, form({ email: "a@exemple.bj", password: "x" }))
    expect(r).toEqual({ code: "invalid_credentials", formError: "Email ou mot de passe incorrect." })
  })

  it("email non confirmé : code email_not_confirmed", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "email_not_confirmed", message: "Email not confirmed" } })
    const r = await login(null, form({ email: "a@exemple.bj", password: "x" }))
    expect(r.code).toBe("email_not_confirmed")
  })

  it("redirige l'étudiant vers son tableau de bord", async () => {
    expect(await redirected(login(null, form({ email: "a@exemple.bj", password: "x" })))).toBe("/dashboard")
  })

  it("profil student malgré user_metadata admin : jamais /admin", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", user_metadata: { role: "admin" } } },
      error: null,
    })
    const url = await redirected(
      login(null, form({ email: "a@exemple.bj", password: "x", next: "/admin/dashboard" }))
    )
    expect(url).toBe("/dashboard")
    expect(getServerRole).toHaveBeenCalled()
  })

  it("honore un next autorisé pour le rôle client", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: {}, profileComplete: true })
    const next = "/client/missions/new?besoin=Repas&ville=Cotonou"
    expect(await redirected(login(null, form({ email: "a@exemple.bj", password: "x", next })))).toBe(next)
  })

  it("profil incomplet : onboarding avec next conservé", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: null, profileComplete: false })
    const next = "/client/missions/new?besoin=Repas"
    const url = await redirected(login(null, form({ email: "a@exemple.bj", password: "x", next })))
    expect(url).toBe(`/auth/register/client?next=${encodeURIComponent(next)}`)
  })

  it("next externe ignoré", async () => {
    expect(
      await redirected(login(null, form({ email: "a@exemple.bj", password: "x", next: "//evil.example" })))
    ).toBe("/dashboard")
  })

  it("compte suspendu : session fermée, code suspended, aucune redirection", async () => {
    getServerRole.mockResolvedValue({ role: "student", profile: { is_suspended: true }, profileComplete: true })
    const r = await login(null, form({ email: "a@exemple.bj", password: "x" }))
    expect(r.code).toBe("suspended")
    expect(r.contactHref).toBe("/contact")
    expect(r.formError).not.toMatch(/\d+\s*h/)
    expect(auth.signOut).toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("lecture du profil en échec : connexion refusée, session fermée, aucune redirection", async () => {
    getServerRole.mockResolvedValue({ role: null, profile: null, profileComplete: false, error: { message: "x" } })
    const r = await login(null, form({ email: "a@exemple.bj", password: "x" }))
    expect(r.code).toBe("unknown")
    expect(auth.signOut).toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([
    ["compte suspendu", { role: "student", profile: { is_suspended: true }, profileComplete: true }],
    ["profil illisible", { role: null, profile: null, profileComplete: false, error: { message: "x" } }],
  ])("%s avec signOut en échec : cookies sb-* supprimés", async (_n, roleResult) => {
    getServerRole.mockResolvedValue(roleResult)
    auth.signOut.mockResolvedValue({ error: { message: "fail" } })
    cookieStore.getAll.mockReturnValue([{ name: "sb-abc-auth-token" }, { name: "ec_pending_email" }])
    const r = await login(null, form({ email: "a@exemple.bj", password: "x" }))
    expect(r.formError).toBeTruthy()
    expect(cookieStore.delete).toHaveBeenCalledWith("sb-abc-auth-token")
    expect(cookieStore.delete).not.toHaveBeenCalledWith("ec_pending_email")
    expect(redirect).not.toHaveBeenCalled()
  })

  it("ton selon l'audience (next client = vouvoiement)", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 429, message: "x" } })
    const c = await login(null, form({ email: "a@exemple.bj", password: "x", next: "/client/dashboard" }))
    const s = await login(null, form({ email: "a@exemple.bj", password: "x", role: "student" }))
    expect(c.formError).toContain("Réessayez")
    expect(s.formError).toContain("Réessaie")
  })
})

describe("register", () => {
  it.each(["admin", "", "superadmin"])("rôle %j refusé sans appeler signUp", async (role) => {
    const r = await register(null, form({ ...registerValues, role }))
    expect(r.fieldErrors?.role).toEqual(expect.any(String))
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it("exige les CGU, la confirmation et refuse un email jetable", async () => {
    const r1 = await register(null, form({ ...registerValues, cgu: "" }))
    expect(r1.fieldErrors.cgu).toBeTruthy()
    const r2 = await register(null, form({ ...registerValues, confirmPassword: "autre" }))
    expect(r2.fieldErrors.confirmPassword).toBeTruthy()
    const r3 = await register(null, form({ ...registerValues, email: "x@mailinator.com" }))
    expect(r3.fieldErrors.email).toBeTruthy()
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it("inscription : role limité, emailRedirectTo avec next, cookie, redirection sans email", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://educash.test")
    const next = "/client/missions/new?besoin=Repas&ville=Cotonou"
    const url = await redirected(register(null, form({ ...registerValues, role: "client", next })))

    const arg = auth.signUp.mock.calls[0][0]
    expect(arg.options.data).toEqual({ role: "client" })
    expect(arg.options.emailRedirectTo).toBe(
      `https://educash.test/auth/confirm?flow=signup&next=${encodeURIComponent(next)}`
    )
    expect(cookieSet).toHaveBeenCalledWith(
      "ec_pending_email",
      "sena@exemple.bj",
      expect.objectContaining({ httpOnly: true, path: "/auth" })
    )
    expect(url).toBe(`/auth/verify-email?role=client&next=${encodeURIComponent(next)}`)
    expect(url).not.toContain("sena")
    expect(url).not.toContain("password")
    vi.unstubAllEnvs()
  })

  it("session immédiate : onboarding avec next", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [{}] }, session: {} }, error: null })
    const next = "/client/missions/new?besoin=Repas"
    const url = await redirected(register(null, form({ ...registerValues, role: "client", next })))
    expect(url).toBe(`/auth/register/client?next=${encodeURIComponent(next)}`)
  })

  it("déconnecte une session existante avant l'inscription", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "old" } } })
    await redirected(register(null, form(registerValues)))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it("email déjà utilisé (erreur ou faux utilisateur) : erreur sous le champ email", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists", message: "User already registered" } })
    const a = await register(null, form(registerValues))
    expect(a.code).toBe("email_taken")
    expect(a.fieldErrors.email).toContain("déjà utilisée")

    auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
    const b = await register(null, form(registerValues))
    expect(b.code).toBe("email_taken")
    expect(redirect).not.toHaveBeenCalled()
  })

  it("erreur Supabase inconnue : message francais", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { message: "Database error saving new user" } })
    const r = await register(null, form(registerValues))
    expect(r.formError).not.toMatch(/database/i)
  })
})
