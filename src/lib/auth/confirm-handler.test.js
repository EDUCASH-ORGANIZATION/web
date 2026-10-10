import { describe, it, expect, vi, beforeEach } from "vitest"

const auth = { exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }
const getServerRole = vi.fn()

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))
vi.mock("@/lib/auth/server-role", () => ({ getServerRole: (...a) => getServerRole(...a) }))

import { handleAuthConfirm } from "./confirm-handler"

async function run(query) {
  const res = await handleAuthConfirm(new Request(`http://localhost/auth/confirm?${query}`))
  const location = new URL(res.headers.get("location"), "http://localhost")
  return { res, location }
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
  auth.verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
  getServerRole.mockResolvedValue({ role: "student", profile: null, profileComplete: false })
})

describe("handleAuthConfirm", () => {
  it("code valide, flux signup : onboarding du rôle serveur", async () => {
    const { location } = await run("flow=signup&code=abc")
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc")
    expect(location.pathname).toBe("/auth/register/student")
  })

  it("signup client avec next de publication : onboarding avec next intact", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: null, profileComplete: false })
    const next = "/client/missions/new?besoin=Repas&ville=Cotonou"
    const { location } = await run(`flow=signup&code=abc&next=${encodeURIComponent(next)}`)
    expect(location.pathname).toBe("/auth/register/client")
    expect(location.searchParams.get("next")).toBe(next)
  })

  it("profil complet : next autorisé, sinon tableau de bord", async () => {
    getServerRole.mockResolvedValue({ role: "client", profile: {}, profileComplete: true })
    const ok = await run(`code=abc&next=${encodeURIComponent("/client/missions/new?besoin=Repas")}`)
    expect(ok.location.pathname + ok.location.search).toBe("/client/missions/new?besoin=Repas")
    const refused = await run(`code=abc&next=${encodeURIComponent("/admin/dashboard")}`)
    expect(refused.location.pathname).toBe("/client/dashboard")
  })

  it("jamais admin depuis les métadonnées : getServerRole décide", async () => {
    const { location } = await run("code=abc")
    expect(getServerRole).toHaveBeenCalledWith(expect.anything(), { id: "u1" })
    expect(location.pathname).not.toMatch(/^\/admin/)
  })

  it("ancien lien /auth/callback sans flow : traité comme signup", async () => {
    const { location } = await run("code=abc")
    expect(location.pathname).toBe("/auth/register/student")
  })

  it("code invalide sans verifier : autre-appareil", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { code: "validation_failed", message: "PKCE code verifier not found in storage" },
    })
    const { location } = await run("flow=signup&code=faux")
    expect(location.pathname).toBe("/auth/link-expired")
    expect(location.searchParams.get("cause")).toBe("autre-appareil")
    expect(location.searchParams.get("flow")).toBe("signup")
  })

  it("token_hash expiré : cause expire", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: "otp_expired", message: "Token has expired" } })
    const { location } = await run("flow=signup&token_hash=h&type=signup")
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "h" })
    expect(location.searchParams.get("cause")).toBe("expire")
  })

  it("erreur dans l'URL : link-expired sans appel Supabase", async () => {
    const { location } = await run("error=access_denied&error_code=otp_expired")
    expect(location.pathname).toBe("/auth/link-expired")
    expect(location.searchParams.get("cause")).toBe("expire")
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("aucun code ni token : invalide, jamais /auth/register?error=", async () => {
    const { location } = await run("flow=signup")
    expect(location.pathname).toBe("/auth/link-expired")
    expect(location.searchParams.get("cause")).toBe("invalide")
    expect(location.search).not.toContain("error=")
  })

  it("type de jeton inconnu : refusé", async () => {
    const { location } = await run("token_hash=h&type=magiclink")
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(location.pathname).toBe("/auth/link-expired")
  })

  it("flux recovery : cookie ec_recovery puis /auth/reset-password", async () => {
    const { res, location } = await run("flow=recovery&token_hash=h&type=recovery")
    expect(location.pathname).toBe("/auth/reset-password")
    expect(res.headers.get("set-cookie")).toContain("ec_recovery=1")
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i)
    expect(getServerRole).not.toHaveBeenCalled()
  })

  it("recovery en échec : link-expired avec flow=recovery", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "otp_expired", message: "x" } })
    const { location } = await run("flow=recovery&code=abc")
    expect(location.searchParams.get("flow")).toBe("recovery")
  })

  it("aucune redirection ne contient d'email", async () => {
    const { location } = await run("code=abc")
    expect(location.href).not.toContain("@")
  })
})
