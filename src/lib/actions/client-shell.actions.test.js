import { describe, it, expect, vi, beforeEach } from "vitest"

let user
let profileResult
let messagesResult
const messageFilters = []

function table(name) {
  const result = () => (name === "profiles" ? profileResult : messagesResult)
  const b = {
    select: () => b,
    eq: (...args) => {
      if (name === "messages") messageFilters.push(args)
      return b
    },
    maybeSingle: () => Promise.resolve(result()),
    then: (res, rej) => Promise.resolve(result()).then(res, rej),
  }
  return b
}

const supabase = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (name) => table(name),
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))

const { getClientShellData } = await import("./client-shell.actions")

const CLIENT_PROFILE = { role: "client", full_name: "Rosine Houngbédji", city: "Cotonou", is_suspended: false }

beforeEach(() => {
  user = { id: "client-1", user_metadata: { role: "client" } }
  profileResult = { data: { ...CLIENT_PROFILE }, error: null }
  messagesResult = { count: 3, error: null }
  messageFilters.length = 0
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getClientShellData", () => {
  it("renvoie l'identité d'affichage et le nombre de messages non lus du client connecté", async () => {
    const res = await getClientShellData()
    expect(res).toEqual({ shell: { userId: "client-1", fullName: "Rosine Houngbédji", unreadCount: 3 } })
    expect(messageFilters).toEqual([["receiver_id", "client-1"], ["read", false]])
  })

  it("ne renvoie que des champs publics", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, phone: "+22997000000", card_url: "secret" }, error: null }
    const { shell } = await getClientShellData()
    expect(Object.keys(shell).sort()).toEqual(["fullName", "unreadCount", "userId"])
  })

  it("refuse un étudiant, même si user_metadata prétend client, et l'envoie vers son tableau de bord", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, role: "student" }, error: null }
    const res = await getClientShellData()
    expect(res).toMatchObject({ error: expect.any(String), redirectTo: "/dashboard" })
    expect(res).not.toHaveProperty("shell")
  })

  it("refuse un administrateur et l'envoie vers l'administration", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, role: "admin" }, error: null }
    expect(await getClientShellData()).toMatchObject({ redirectTo: "/admin/dashboard" })
  })

  it("refuse un compte suspendu et l'envoie vers la connexion signalée", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, is_suspended: true }, error: null }
    expect(await getClientShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login?suspended=1" })
  })

  it("refuse sans profil et quand la lecture du profil échoue (fail-closed, accueil)", async () => {
    profileResult = { data: null, error: null }
    expect(await getClientShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
    profileResult = { data: null, error: { message: "boom" } }
    expect(await getClientShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
  })

  it("refuse un rôle inconnu", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, role: "root" }, error: null }
    expect(await getClientShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
  })

  it("refuse sans session et renvoie vers la connexion", async () => {
    user = null
    expect(await getClientShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login" })
  })

  it("garde la coquille quand le compteur est illisible", async () => {
    messagesResult = { count: null, error: { message: "boom" } }
    const { shell } = await getClientShellData()
    expect(shell.unreadCount).toBe(0)
  })

  it("remplace un nom absent par une chaîne vide", async () => {
    profileResult = { data: { ...CLIENT_PROFILE, full_name: null }, error: null }
    const { shell } = await getClientShellData()
    expect(shell.fullName).toBe("")
  })
})
