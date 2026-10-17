import { describe, it, expect, vi, beforeEach } from "vitest"

const signIn = vi.fn()
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/auth/revoke-session", () => ({ revokeSession: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("./account-closure-core", () => ({ closeAccountCore: vi.fn(), readClosureSnapshot: vi.fn() }))

import { redirect } from "next/navigation"
import { createClient as createEphemeralClient } from "@supabase/supabase-js"
import { requireRole } from "@/lib/auth/require-role"
import { revokeSession } from "@/lib/auth/revoke-session"
import { createServiceClient } from "@/lib/supabase/service"
import { closeAccountCore } from "./account-closure-core"
import { closeMyAccount } from "./account-closure.actions"

const mkSession = (id) => ({ supabase: { id: `s-${id}` }, user: { id, email: "a@b.bj" } })
const form = (confirmation, password) => {
  const data = new FormData()
  if (confirmation !== undefined) data.set("confirmation", confirmation)
  if (password !== undefined) data.set("password", password)
  return data
}
const BAD = { error: { code: "invalid_credentials", status: 400 } }
const OK = { data: {}, error: null }
const DONE = { success: true, complete: true, dueAt: "2026-11-01T10:00:00.000Z" }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
  createEphemeralClient.mockImplementation(() => ({
    auth: { signInWithPassword: signIn, signOut: vi.fn().mockResolvedValue({}) },
  }))
  redirect.mockImplementation((url) => {
    throw new Error(`REDIRECT:${url}`)
  })
  createServiceClient.mockReturnValue({ id: "service" })
})

describe("closeMyAccount : cas limites", () => {
  it("refuse un administrateur : requireRole refuse, rien n'est lu ni révoqué", async () => {
    requireRole.mockResolvedValue({ error: "Accès refusé" })
    const res = await closeMyAccount(null, form("FERMER", "x"))
    expect(res).toEqual({ error: "Accès refusé" })
    expect(requireRole).toHaveBeenCalledWith(["client", "student"])
    expect(requireRole.mock.calls[0][0]).not.toContain("admin")
    expect(signIn).not.toHaveBeenCalled()
    expect(closeAccountCore).not.toHaveBeenCalled()
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it.each([" FERMER", "  FERMER  ", "FERMER\n", "\tFERMER", "Fermer", "F E R M E R", "FERMER FERMER"])(
    "refuse la confirmation %j sans vérifier le mot de passe",
    async (value) => {
      requireRole.mockResolvedValue(mkSession("u-conf"))
      const res = await closeMyAccount(null, form(value, "secret"))
      expect(res.error).toMatch(/FERMER/)
      expect(signIn).not.toHaveBeenCalled()
      expect(closeAccountCore).not.toHaveBeenCalled()
    },
  )

  it("tolère un formulaire absent ou nul sans lever", async () => {
    requireRole.mockResolvedValue(mkSession("u-null"))
    expect((await closeMyAccount(null, null)).error).toMatch(/FERMER/)
    expect((await closeMyAccount(null, undefined)).error).toMatch(/FERMER/)
  })

  it("refuse un mot de passe vide ou envoyé comme fichier", async () => {
    requireRole.mockResolvedValue(mkSession("u-pw"))
    expect((await closeMyAccount(null, form("FERMER", ""))).error).toMatch(/mot de passe/)
    const data = form("FERMER")
    data.set("password", new Blob(["x"]), "f.txt")
    expect((await closeMyAccount(null, data)).error).toMatch(/mot de passe/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it("compte 5 échecs puis refuse même le bon mot de passe, sans fermer le compte", async () => {
    requireRole.mockResolvedValue(mkSession("u-limit"))
    signIn.mockResolvedValue(BAD)
    for (let i = 0; i < 5; i++) {
      expect(await closeMyAccount(null, form("FERMER", "x"))).toEqual({ error: "Le mot de passe est incorrect." })
    }
    signIn.mockClear()
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockResolvedValue(DONE)
    const res = await closeMyAccount(null, form("FERMER", "bon"))
    expect(res.error).toMatch(/Trop de tentatives/)
    expect(signIn).not.toHaveBeenCalled()
    expect(closeAccountCore).not.toHaveBeenCalled()
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it("4 échecs puis un succès : le compteur repart de zéro", async () => {
    requireRole.mockResolvedValue(mkSession("u-reset"))
    signIn.mockResolvedValue(BAD)
    for (let i = 0; i < 4; i++) await closeMyAccount(null, form("FERMER", "x"))
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockResolvedValue({ blocked: ["WALLET_NOT_EMPTY"] })
    await closeMyAccount(null, form("FERMER", "bon"))
    signIn.mockResolvedValue(BAD)
    for (let i = 0; i < 4; i++) {
      expect((await closeMyAccount(null, form("FERMER", "x"))).error).toBe("Le mot de passe est incorrect.")
    }
  })

  it("la confirmation inexacte ne consomme aucune tentative", async () => {
    requireRole.mockResolvedValue(mkSession("u-noconsume"))
    for (let i = 0; i < 10; i++) await closeMyAccount(null, form("fermer", "x"))
    signIn.mockResolvedValue(BAD)
    expect((await closeMyAccount(null, form("FERMER", "x"))).error).toBe("Le mot de passe est incorrect.")
  })

  it("succès : la révocation globale précède la redirection, avec la session de l'appelant", async () => {
    const s = mkSession("u-ok")
    requireRole.mockResolvedValue(s)
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockResolvedValue(DONE)
    const order = []
    revokeSession.mockImplementation(async () => void order.push("revoke"))
    redirect.mockImplementation((url) => {
      order.push("redirect")
      throw new Error(`REDIRECT:${url}`)
    })
    await expect(closeMyAccount(null, form("FERMER", "bon"))).rejects.toThrow(/^REDIRECT:\/compte-ferme\?jusquau=/)
    expect(order).toEqual(["revoke", "redirect"])
    expect(revokeSession).toHaveBeenCalledTimes(1)
    expect(revokeSession).toHaveBeenCalledWith(s.supabase, { scope: "global" })
  })

  it("success:false ou résultat vide : erreur générique, ni révocation ni redirection", async () => {
    requireRole.mockResolvedValue(mkSession("u-incomplete"))
    signIn.mockResolvedValue(OK)
    for (const result of [{ success: false, complete: true, dueAt: "2026-11-01T10:00:00.000Z" }, {}]) {
      closeAccountCore.mockResolvedValueOnce(result)
      const res = await closeMyAccount(null, form("FERMER", "bon"))
      expect(res.error).toMatch(/Réessayez/)
    }
    expect(revokeSession).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("success:true et complete:false : révocation globale puis redirection, journal sans donnée personnelle", async () => {
    const s = mkSession("u-incomplete-ok")
    requireRole.mockResolvedValue(s)
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockResolvedValueOnce({ success: true, complete: false, dueAt: "2026-11-01T10:00:00.000Z" })
    await expect(closeMyAccount(null, form("FERMER", "bon"))).rejects.toThrow(/^REDIRECT:\/compte-ferme\?jusquau=/)
    expect(revokeSession).toHaveBeenCalledTimes(1)
    expect(revokeSession).toHaveBeenCalledWith(s.supabase, { scope: "global" })
    expect(console.error).toHaveBeenCalledWith("[account-closure] self incomplete")
    const logged = JSON.stringify(console.error.mock.calls)
    expect(logged).not.toContain("u-incomplete-ok")
    expect(logged).not.toContain("a@b.bj")
  })

  it.each([undefined, "pas une date", ""])("success:true avec dueAt invalide %j : redirection sans paramètre", async (dueAt) => {
    const s = mkSession("u-nodue")
    requireRole.mockResolvedValue(s)
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockResolvedValueOnce({ success: true, complete: true, dueAt })
    await expect(closeMyAccount(null, form("FERMER", "bon"))).rejects.toThrow("REDIRECT:/compte-ferme")
    expect(redirect).toHaveBeenCalledWith("/compte-ferme")
    expect(revokeSession).toHaveBeenCalledWith(s.supabase, { scope: "global" })
  })

  it("exception du coeur de fermeture : erreur générique, ni révocation ni redirection, aucun détail renvoyé", async () => {
    requireRole.mockResolvedValue(mkSession("u-throw"))
    signIn.mockResolvedValue(OK)
    closeAccountCore.mockRejectedValue(new Error("secret db detail"))
    const res = await closeMyAccount(null, form("FERMER", "bon"))
    expect(JSON.stringify(res)).not.toContain("secret db detail")
    expect(revokeSession).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("variables Supabase absentes : refus de type réseau, aucune fermeture", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    requireRole.mockResolvedValue(mkSession("u-env"))
    const res = await closeMyAccount(null, form("FERMER", "bon"))
    expect(res.error).toMatch(/Connexion impossible/)
    expect(closeAccountCore).not.toHaveBeenCalled()
  })
})
