import { describe, it, expect, vi, beforeEach } from "vitest"

const signIn = vi.fn()
const signOutProbe = vi.fn()
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithPassword: signIn, signOut: signOutProbe } })),
}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/auth/revoke-session", () => ({ revokeSession: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("./account-closure-core", () => ({ closeAccountCore: vi.fn(), readClosureSnapshot: vi.fn() }))

import { createClient as createEphemeralClient } from "@supabase/supabase-js"
import { requireRole } from "@/lib/auth/require-role"
import { revokeSession } from "@/lib/auth/revoke-session"
import { createServiceClient } from "@/lib/supabase/service"
import { closeAccountCore, readClosureSnapshot } from "./account-closure-core"
import { closeMyAccount, getMyClosurePreview } from "./account-closure.actions"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const session = { supabase: { id: "session-client" }, user: { id: USER_ID, email: "a@b.bj" } }
const SERVICE = { id: "service" }
const form = (confirmation, password) => {
  const data = new FormData()
  if (confirmation !== undefined) data.set("confirmation", confirmation)
  if (password !== undefined) data.set("password", password)
  return data
}
const cleanSnapshot = {
  role: "client",
  activeClientMissions: 0,
  activeStudentMissions: 0,
  walletBalance: 0,
  walletReserved: 0,
  openPurchases: 0,
  openReports: 0,
  recentWithdrawals: 0,
  pendingTransactions: 0,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
  createEphemeralClient.mockImplementation(() => ({ auth: { signInWithPassword: signIn, signOut: signOutProbe } }))
  signOutProbe.mockResolvedValue({})
  createServiceClient.mockReturnValue(SERVICE)
})

describe("getMyClosurePreview", () => {
  it("refuse sans session ou rôle autorisé, sans ouvrir le service role", async () => {
    requireRole.mockResolvedValue({ error: "Non connecté" })
    expect(await getMyClosurePreview()).toEqual({ error: "Non connecté" })
    expect(requireRole).toHaveBeenCalledWith(["client", "student"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("renvoie les blocages au vouvoiement et la fin du délai de grâce", async () => {
    requireRole.mockResolvedValue(session)
    readClosureSnapshot.mockResolvedValue({ ...cleanSnapshot, walletBalance: 500 })
    const res = await getMyClosurePreview()
    expect(readClosureSnapshot).toHaveBeenCalledWith(SERVICE, USER_ID, expect.any(Object))
    expect(res.blockers.map((b) => b.code)).toEqual(["WALLET_NOT_EMPTY"])
    expect(Object.keys(res.blockers[0]).sort()).toEqual(["code", "message"])
    expect(new Date(res.dueAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000)
  })

  it("renvoie une liste vide quand rien ne bloque", async () => {
    requireRole.mockResolvedValue(session)
    readClosureSnapshot.mockResolvedValue(cleanSnapshot)
    expect((await getMyClosurePreview()).blockers).toEqual([])
  })
})

describe("closeMyAccount", () => {
  it("refuse sans session ou avec un rôle admin avant toute lecture du formulaire", async () => {
    requireRole.mockResolvedValue({ error: "Interdit" })
    expect(await closeMyAccount(null, form("FERMER", "x"))).toEqual({ error: "Interdit" })
    expect(requireRole).toHaveBeenCalledWith(["client", "student"])
    expect(signIn).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([undefined, "", "fermer", "FERME", "FERMER ", "oui"])("refuse la confirmation %j", async (value) => {
    requireRole.mockResolvedValue(session)
    const res = await closeMyAccount(null, form(value, "secret"))
    expect(res.error).toMatch(/FERMER/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it("refuse un mot de passe absent", async () => {
    requireRole.mockResolvedValue(session)
    const res = await closeMyAccount(null, form("FERMER"))
    expect(res.error).toMatch(/mot de passe/)
    expect(signIn).not.toHaveBeenCalled()
  })

  it("refuse un mot de passe faux sans ouvrir le service role", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } })
    expect(await closeMyAccount(null, form("FERMER", "mauvais"))).toEqual({ error: "Le mot de passe est incorrect." })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(closeAccountCore).not.toHaveBeenCalled()
  })

  it("vérifie le mot de passe avec un client éphémère sans persistance", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } })
    await closeMyAccount(null, form("FERMER", "mauvais"))
    expect(createEphemeralClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "anon",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }) }),
    )
    expect(signIn).toHaveBeenCalledWith({ email: "a@b.bj", password: "mauvais" })
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it("bloque après 5 échecs sans plus interroger Supabase, puis autorise un autre compte", async () => {
    const other = { supabase: {}, user: { id: "22222222-2222-4222-8222-222222222222", email: "c@d.bj" } }
    requireRole.mockResolvedValue({ ...session, user: { ...session.user, id: "33333333-3333-4333-8333-333333333333" } })
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } })
    for (let i = 0; i < 5; i++) await closeMyAccount(null, form("FERMER", "x"))
    signIn.mockClear()
    expect((await closeMyAccount(null, form("FERMER", "x"))).error).toMatch(/Trop de tentatives/)
    expect(signIn).not.toHaveBeenCalled()
    requireRole.mockResolvedValue(other)
    await closeMyAccount(null, form("FERMER", "x"))
    expect(signIn).toHaveBeenCalledTimes(1)
  })

  it("relaie la limite de Supabase Auth et les pannes réseau", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValueOnce({ error: { status: 429, code: "over_request_rate_limit" } })
    expect((await closeMyAccount(null, form("FERMER", "x"))).error).toMatch(/Trop de tentatives/)
    signIn.mockRejectedValueOnce(new Error("fetch failed"))
    expect((await closeMyAccount(null, form("FERMER", "x"))).error).toMatch(/Connexion impossible/)
    expect(closeAccountCore).not.toHaveBeenCalled()
  })

  it("renvoie les blocages sans révoquer les sessions", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ data: {}, error: null })
    closeAccountCore.mockResolvedValue({ blocked: ["WALLET_NOT_EMPTY"] })
    const res = await closeMyAccount(null, form("FERMER", "ok"))
    expect(res.error).toBeTruthy()
    expect(res.blockers.map((b) => b.code)).toEqual(["WALLET_NOT_EMPTY"])
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it("renvoie une erreur générique si la fermeture échoue (success:false ou vide)", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ data: {}, error: null })
    closeAccountCore.mockResolvedValueOnce({ error: "interne" })
    expect((await closeMyAccount(null, form("FERMER", "ok"))).error).toMatch(/Réessayez/)
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it("complete:false : compte déjà fermé, révocation globale, journal sans donnée personnelle, redirection", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ data: {}, error: null })
    closeAccountCore.mockResolvedValueOnce({ success: true, complete: false, dueAt: "2026-11-01T00:00:00.000Z" })
    await expect(closeMyAccount(null, form("FERMER", "ok"))).rejects.toThrow(
      "REDIRECT:/compte-ferme?jusquau=2026-11-01T00%3A00%3A00.000Z",
    )
    expect(revokeSession).toHaveBeenCalledWith(session.supabase, { scope: "global" })
    expect(console.error).toHaveBeenCalledWith("[account-closure] self incomplete")
    const logged = JSON.stringify(console.error.mock.calls)
    expect(logged).not.toContain(USER_ID)
    expect(logged).not.toContain("a@b.bj")
  })

  it("une erreur Supabase autre que mot de passe faux (400, 500) : message générique, aucune tentative consommée", async () => {
    const other = { ...session, user: { id: "44444444-4444-4444-8444-444444444444", email: "e@f.bj" } }
    requireRole.mockResolvedValue(other)
    signIn.mockResolvedValue({ error: { status: 400, code: "validation_failed" } })
    for (let i = 0; i < 6; i++) {
      expect((await closeMyAccount(null, form("FERMER", "x"))).error).toMatch(/n'a pas pu aboutir/)
    }
    signIn.mockResolvedValue({ error: { status: 500 } })
    expect((await closeMyAccount(null, form("FERMER", "x"))).error).toMatch(/n'a pas pu aboutir/)
    expect(signIn).toHaveBeenCalledTimes(7)
    expect(closeAccountCore).not.toHaveBeenCalled()
  })

  it("compte sans e-mail : message générique, aucun appel à Supabase Auth", async () => {
    requireRole.mockResolvedValue({ ...session, user: { id: USER_ID } })
    const res = await closeMyAccount(null, form("FERMER", "x"))
    expect(res.error).toMatch(/n'a pas pu aboutir/)
    expect(res.error).not.toMatch(/réseau/)
    expect(signIn).not.toHaveBeenCalled()
    expect(closeAccountCore).not.toHaveBeenCalled()
  })

  it("succès : ferme en acteur self, révoque toutes les sessions puis redirige", async () => {
    requireRole.mockResolvedValue(session)
    signIn.mockResolvedValue({ data: {}, error: null })
    closeAccountCore.mockResolvedValue({ success: true, alreadyClosed: false, complete: true, dueAt: "2026-11-01T10:00:00.000Z" })
    await expect(closeMyAccount(null, form("FERMER", "ok"))).rejects.toThrow(
      "REDIRECT:/compte-ferme?jusquau=2026-11-01T10%3A00%3A00.000Z",
    )
    expect(closeAccountCore).toHaveBeenCalledWith(SERVICE, {
      userId: USER_ID,
      actor: { kind: "self" },
      reasonCode: "user_request",
    })
    expect(revokeSession).toHaveBeenCalledWith(session.supabase, { scope: "global" })
    expect(signOutProbe).toHaveBeenCalledWith({ scope: "local" })
  })
})
