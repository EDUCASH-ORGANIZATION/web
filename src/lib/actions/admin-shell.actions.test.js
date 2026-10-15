import { describe, it, expect, vi, beforeEach } from "vitest"

const state = { user: null, profile: null, profileError: null, serviceThrows: false, pending: 0, cardsError: false }
const createServiceClient = vi.fn(() => {
  if (state.serviceThrows) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante")
  return makeService()
})

// Client de session : getUser puis profiles.maybeSingle (rôle).
function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: state.profile, error: state.profileError }),
      }
      return chain
    },
  }
}

// Client service : étudiants avec carte (state.pending ids), puis profils « à examiner » sans badge.
function makeService() {
  return {
    from: (table) => {
      const b = {
        select: () => b,
        not: () => b,
        in: () => b,
        eq: () => b,
        is: () => b,
        gte: () => b,
        order: () => b,
        range: () => b,
        then: (res, rej) => {
          let result
          if (state.cardsError) result = { data: null, error: { message: "boom" } }
          else if (table === "student_profiles") {
            result = { data: Array.from({ length: state.pending }, (_, i) => ({ user_id: `s${i}` })), error: null }
          } else {
            result = { data: Array.from({ length: state.pending }, (_, i) => ({ user_id: `s${i}`, verified_until: null })), error: null }
          }
          return Promise.resolve(result).then(res, rej)
        },
      }
      return b
    },
  }
}

// Compteur de notifications : lecture mockée (le module de lecture a ses propres tests).
let notificationsResult = { count: 0 }
const countUnread = vi.fn(async () => notificationsResult)
vi.mock("@/lib/notifications/read", () => ({
  countUnread: (...a) => countUnread(...a),
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => makeSupabase()) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

const { getAdminShellData } = await import("./admin-shell.actions")

const ADMIN = { role: "admin", full_name: "Awa Admin", city: "Cotonou", is_suspended: false }

beforeEach(() => {
  notificationsResult = { count: 0 }
  countUnread.mockClear()
  createServiceClient.mockClear()
  state.user = { id: "admin-1", user_metadata: { role: "admin" } }
  state.profile = { ...ADMIN }
  state.profileError = null
  state.serviceThrows = false
  state.pending = 0
  state.cardsError = false
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getAdminShellData", () => {
  it("renvoie l'identité d'affichage et le nombre de dossiers à examiner", async () => {
    state.pending = 4
    expect(await getAdminShellData()).toEqual({ shell: { userId: "admin-1", fullName: "Awa Admin", pendingCount: 4, notificationCount: 0 } })
  })

  it("ne renvoie que des champs publics", async () => {
    state.profile = { ...ADMIN, phone: "+22997000000", card_url: "secret" }
    const { shell } = await getAdminShellData()
    expect(Object.keys(shell).sort()).toEqual(["fullName", "notificationCount", "pendingCount", "userId"])
  })

  it("refuse un étudiant, même si user_metadata prétend admin, et l'envoie vers son tableau de bord", async () => {
    state.profile = { ...ADMIN, role: "student" }
    const res = await getAdminShellData()
    expect(res).toMatchObject({ error: expect.any(String), redirectTo: "/dashboard" })
    expect(res).not.toHaveProperty("shell")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un client et l'envoie vers son tableau de bord", async () => {
    state.profile = { ...ADMIN, role: "client" }
    expect(await getAdminShellData()).toMatchObject({ redirectTo: "/client/dashboard" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un administrateur suspendu et l'envoie vers la connexion signalée", async () => {
    state.profile = { ...ADMIN, is_suspended: true }
    expect(await getAdminShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login?suspended=1" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse sans session et renvoie vers la connexion", async () => {
    state.user = null
    expect(await getAdminShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse sans profil et quand la lecture du profil échoue (fail-closed, accueil)", async () => {
    state.profile = null
    expect(await getAdminShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
    state.profileError = { message: "boom" }
    expect(await getAdminShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un rôle inconnu", async () => {
    state.profile = { ...ADMIN, role: "root" }
    expect(await getAdminShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
  })

  it("garde la coquille avec un compteur à 0 quand la lecture des dossiers échoue", async () => {
    state.cardsError = true
    const { shell } = await getAdminShellData()
    expect(shell.pendingCount).toBe(0)
    expect(console.error).toHaveBeenCalled()
  })

  it("refuse avec un message neutre quand le client service est indisponible", async () => {
    state.serviceThrows = true
    const res = await getAdminShellData()
    expect(res.error).toMatch(/Réessayez/)
    expect(res.error).not.toMatch(/SERVICE_ROLE/)
    expect(res).not.toHaveProperty("shell")
  })

  it("renvoie le nombre de notifications non lues de l'appelant (lecture filtrée sur son identifiant)", async () => {
    notificationsResult = { count: 5 }
    const { shell } = await getAdminShellData()
    expect(shell.notificationCount).toBe(5)
    expect(countUnread).toHaveBeenCalledWith(expect.anything(), "admin-1")
  })

  it("compteur de notifications à 0 quand la table est absente, en erreur ou en exception (coquille jamais bloquée)", async () => {
    for (const result of [{ unavailable: true }, { error: true }]) {
      notificationsResult = result
      expect((await getAdminShellData()).shell.notificationCount).toBe(0)
    }
    countUnread.mockRejectedValueOnce(new Error("boom"))
    const res = await getAdminShellData()
    expect(res.shell.notificationCount).toBe(0)
    expect(res).not.toHaveProperty("error")
  })
})
