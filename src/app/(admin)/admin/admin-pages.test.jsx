import { describe, it, expect, vi, beforeEach } from "vitest"

const requireRole = vi.fn()
const createServiceClient = vi.fn()
const redirect = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("next/navigation", () => ({ redirect: (...a) => redirect(...a) }))
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("next/link", () => ({ default: () => null }))
vi.mock("@/components/admin/verifications-tabs", () => ({ VerificationsTabs: () => null }))
vi.mock("@/components/admin/suspend-button", () => ({ SuspendButton: () => null }))

import Dashboard from "./dashboard/page.js"
import Verifications from "./verifications/page.js"
import Users from "./users/page.js"
import Missions from "./missions/page.js"
import Wallets from "./wallets/page.js"

/** Constructeur de requête chaînable et attendable. */
function query(result) {
  const q = {}
  for (const m of ["select", "eq", "order", "range", "limit", "gte", "is"]) q[m] = () => q
  q.then = (resolve) => resolve(result)
  return q
}

describe("pages admin : contrôle de rôle fail-closed", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    redirect.mockClear()
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
  })

  it.each([
    ["dashboard", Dashboard, []],
    ["verifications", Verifications, []],
    ["users", Users, [{ searchParams: Promise.resolve({}) }]],
    ["missions", Missions, [{ searchParams: Promise.resolve({}) }]],
    ["wallets", Wallets, []],
  ])("%s redirige sans lire de données si requireRole refuse", async (_name, Page, args) => {
    await expect(Page(...args)).rejects.toThrow("REDIRECT:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("admin/verifications : erreur visible", () => {
  beforeEach(() => {
    requireRole.mockReset()
    createServiceClient.mockReset()
    requireRole.mockResolvedValue({ supabase: { storage: { from: () => ({}) } }, user: { id: "a" }, role: "admin", profile: {} })
  })

  function serviceWith(profiles, students) {
    return { from: (t) => query(t === "profiles" ? profiles : students) }
  }

  it("affiche une alerte au lieu de se replier en silence si la lecture des profils échoue", async () => {
    createServiceClient.mockReturnValue(
      serviceWith({ data: null, error: { message: "column does not exist" } }, { data: [], error: null })
    )
    const tree = JSON.stringify(await Verifications())
    expect(tree).toContain('"role":"alert"')
    expect(tree).toContain("Impossible de charger les dossiers de vérification.")
  })

  it("affiche une alerte si la lecture des student_profiles échoue", async () => {
    createServiceClient.mockReturnValue(
      serviceWith({ data: [], error: null }, { data: null, error: { message: "boom" } })
    )
    expect(JSON.stringify(await Verifications())).toContain('"role":"alert"')
  })

  it("rend les onglets sans alerte quand tout va bien", async () => {
    createServiceClient.mockReturnValue(serviceWith({ data: [], error: null }, { data: [], error: null }))
    expect(JSON.stringify(await Verifications())).not.toContain('"role":"alert"')
  })
})
