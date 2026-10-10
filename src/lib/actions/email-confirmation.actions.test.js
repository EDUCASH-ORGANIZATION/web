import { describe, it, expect, vi, beforeEach } from "vitest"

const cookieGet = vi.fn()
const auth = { resend: vi.fn() }

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))

import { resendSignupConfirmation } from "./email-confirmation.actions"

function form(values) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieGet.mockReturnValue(undefined)
  auth.resend.mockResolvedValue({ error: null })
})

describe("resendSignupConfirmation", () => {
  it("utilise l'email du formulaire", async () => {
    const r = await resendSignupConfirmation(null, form({ email: "a@exemple.bj" }))
    expect(r).toEqual({ status: "sent" })
    expect(auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "a@exemple.bj" })
    )
  })

  it("retombe sur le cookie ec_pending_email", async () => {
    cookieGet.mockReturnValue({ value: "cookie@exemple.bj" })
    const r = await resendSignupConfirmation(null, form({}))
    expect(r.status).toBe("sent")
    expect(auth.resend.mock.calls[0][0].email).toBe("cookie@exemple.bj")
  })

  it("sans adresse ni cookie : erreur de champ, aucun appel", async () => {
    const r = await resendSignupConfirmation(null, form({}))
    expect(r.fieldErrors?.email).toBeTruthy()
    expect(auth.resend).not.toHaveBeenCalled()
  })

  it("même résultat que l'adresse existe ou non", async () => {
    const ok = await resendSignupConfirmation(null, form({ email: "a@exemple.bj" }))
    auth.resend.mockResolvedValue({ error: { code: "user_not_found", message: "User not found" } })
    const unknown = await resendSignupConfirmation(null, form({ email: "b@exemple.bj" }))
    expect(unknown).toEqual(ok)
  })

  it("trop de demandes : code rate_limited", async () => {
    auth.resend.mockResolvedValue({ error: { code: "over_email_send_rate_limit", message: "x" } })
    const r = await resendSignupConfirmation(null, form({ email: "a@exemple.bj" }))
    expect(r.code).toBe("rate_limited")
    expect(r.formError).toBeTruthy()
  })

  it("le next sûr est transmis au lien, un next externe est ignoré", async () => {
    await resendSignupConfirmation(null, form({ email: "a@exemple.bj", next: "/client/missions/new?besoin=Repas" }))
    expect(auth.resend.mock.calls[0][0].options.emailRedirectTo).toContain(
      "/auth/confirm?flow=signup&next=%2Fclient%2Fmissions%2Fnew%3Fbesoin%3DRepas"
    )
    await resendSignupConfirmation(null, form({ email: "a@exemple.bj", next: "//evil.example" }))
    expect(auth.resend.mock.calls[1][0].options.emailRedirectTo).not.toContain("next=")
  })
})
