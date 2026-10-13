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

const { getStudentShellData } = await import("./student-shell.actions")

const STUDENT_PROFILE = { role: "student", full_name: "Awa Dossou", city: "Cotonou", is_suspended: false }

const defaultGetUser = supabase.auth.getUser

beforeEach(() => {
  supabase.auth.getUser = defaultGetUser
  user = { id: "student-1", user_metadata: { role: "student" } }
  profileResult = { data: { ...STUDENT_PROFILE }, error: null }
  messagesResult = { count: 3, error: null }
  messageFilters.length = 0
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getStudentShellData", () => {
  it("renvoie l'identité d'affichage et le nombre de messages non lus de l'étudiant connecté", async () => {
    const res = await getStudentShellData()
    expect(res).toEqual({ shell: { userId: "student-1", fullName: "Awa Dossou", unreadCount: 3 } })
    expect(messageFilters).toEqual([["receiver_id", "student-1"], ["read", false]])
  })

  it("ne renvoie que des champs publics", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, phone: "+22997000000", card_url: "secret" }, error: null }
    const { shell } = await getStudentShellData()
    expect(Object.keys(shell).sort()).toEqual(["fullName", "unreadCount", "userId"])
  })

  it("refuse un client, même si user_metadata prétend étudiant, et l'envoie vers son tableau de bord", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, role: "client" }, error: null }
    const res = await getStudentShellData()
    expect(res).toMatchObject({ error: expect.any(String), redirectTo: "/client/dashboard" })
    expect(res).not.toHaveProperty("shell")
  })

  it("refuse un administrateur et l'envoie vers l'administration", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, role: "admin" }, error: null }
    expect(await getStudentShellData()).toMatchObject({ redirectTo: "/admin/dashboard" })
  })

  it("refuse un compte suspendu et l'envoie vers la connexion signalée", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, is_suspended: true }, error: null }
    expect(await getStudentShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login?suspended=1" })
  })

  it("refuse sans profil et quand la lecture du profil échoue (fail-closed, accueil)", async () => {
    profileResult = { data: null, error: null }
    expect(await getStudentShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
    profileResult = { data: null, error: { message: "boom" } }
    expect(await getStudentShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
  })

  it("refuse un rôle inconnu", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, role: "root" }, error: null }
    expect(await getStudentShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/" })
  })

  it("refuse sans session et renvoie vers la connexion", async () => {
    user = null
    expect(await getStudentShellData()).toMatchObject({ error: expect.any(String), redirectTo: "/auth/login" })
  })

  it("garde la coquille quand le compteur est illisible", async () => {
    messagesResult = { count: null, error: { message: "boom" } }
    const { shell } = await getStudentShellData()
    expect(shell.unreadCount).toBe(0)
  })

  it("remplace un nom absent par une chaîne vide", async () => {
    profileResult = { data: { ...STUDENT_PROFILE, full_name: null }, error: null }
    const { shell } = await getStudentShellData()
    expect(shell.fullName).toBe("")
  })

  it("laisse se propager une exception interne de Next (redirect)", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/auth/login;307;" })
    supabase.auth.getUser = async () => {
      throw redirectError
    }
    await expect(getStudentShellData()).rejects.toBe(redirectError)
  })

  it("transforme une erreur ordinaire en refus fermé", async () => {
    supabase.auth.getUser = async () => {
      throw new Error("boom")
    }
    const res = await getStudentShellData()
    expect(res).toEqual({ error: "Impossible de charger ton espace.", redirectTo: "/" })
  })
})
