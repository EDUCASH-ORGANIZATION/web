import { describe, it, expect, vi, beforeEach } from "vitest"

let user
let profileResult
let tables
const log = []

const DEFAULT_TABLES = () => ({
  applications: { data: [], error: null },
  missions: { data: [], error: null },
  messages: { data: [], error: null },
})

// Faux client : `profiles` répond à maybeSingle ; les autres tables se résolvent avec `tables[nom]`, la réponse d'une
// fonction recevant les filtres posés. Chaque requête est consignée (table, filtres eq / in, limite).
function table(name) {
  const q = { table: name, eq: [], in: [], limit: null }
  if (name !== "profiles") log.push(q)
  const result = () => {
    if (name === "profiles") return profileResult
    const r = tables[name]
    return typeof r === "function" ? r(q) : r
  }
  const b = {
    select: () => b,
    eq: (c, v) => { q.eq.push([c, v]); return b },
    in: (c, v) => { q.in.push([c, v]); return b },
    limit: (n) => { q.limit = n; return b },
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
  tables = DEFAULT_TABLES()
  log.length = 0
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("getStudentShellData", () => {
  it("renvoie l'identité d'affichage et le nombre de messages non lus de ses clients", async () => {
    tables.applications = { data: [{ mission_id: "m1" }], error: null }
    tables.missions = { data: [{ id: "m1", client_id: "client-1" }], error: null }
    tables.messages = { data: [{ sender_id: "client-1", mission_id: "m1" }, { sender_id: "client-1", mission_id: "m1" }], error: null }
    const res = await getStudentShellData()
    expect(res).toEqual({ shell: { userId: "student-1", fullName: "Awa Dossou", unreadCount: 2 } })
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

  it("garde la coquille quand le compteur est illisible, à chaque étape de la lecture", async () => {
    const fail = { data: null, error: { message: "boom" } }
    for (const failing of ["applications", "missions", "messages"]) {
      tables = DEFAULT_TABLES()
      tables.applications = { data: [{ mission_id: "m1" }], error: null }
      tables.missions = { data: [{ id: "m1", client_id: "client-1" }], error: null }
      tables.messages = { data: [{ sender_id: "client-1", mission_id: "m1" }], error: null }
      tables[failing] = fail
      const { shell } = await getStudentShellData()
      expect(shell.unreadCount, failing).toBe(0)
    }
  })

  it("garde la coquille quand une lecture lève une exception", async () => {
    tables.applications = () => {
      throw new Error("réseau")
    }
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
    expect(res).toEqual({ error: "Impossible de charger votre espace.", redirectTo: "/" })
  })
})

describe("getStudentShellData : le compteur ne compte que les clients liés", () => {
  const MISSION_A = "mission-a"
  const MISSION_B = "mission-b"
  const CLIENT_A = "client-a"
  const CLIENT_B = "client-b"
  const STRANGER = "stranger"

  // Candidature à MISSION_A (client CLIENT_A), retenu sur MISSION_B (client CLIENT_B).
  function link() {
    tables.applications = { data: [{ mission_id: MISSION_A }], error: null }
    tables.missions = (q) =>
      q.in.some(([c]) => c === "id")
        ? { data: [{ id: MISSION_A, client_id: CLIENT_A }], error: null }
        : { data: [{ id: MISSION_B, client_id: CLIENT_B }], error: null }
  }

  const messageFilters = () => log.filter((q) => q.table === "messages")

  it("un compte sans lien n'augmente pas le compteur, même avec des messages non lus bien adressés", async () => {
    link()
    // La base renvoie ce que le filtre laisse passer : ici même un faux positif de la requête est écarté.
    tables.messages = { data: [{ sender_id: STRANGER, mission_id: MISSION_A }, { sender_id: STRANGER, mission_id: "inconnue" }], error: null }
    expect((await getStudentShellData()).shell.unreadCount).toBe(0)
  })

  it("un client lié (candidature) compte", async () => {
    link()
    tables.messages = { data: [{ sender_id: CLIENT_A, mission_id: MISSION_A }], error: null }
    expect((await getStudentShellData()).shell.unreadCount).toBe(1)
  })

  it("un client d'une mission où l'étudiant est retenu compte, sur deux missions", async () => {
    link()
    tables.messages = {
      data: [
        { sender_id: CLIENT_A, mission_id: MISSION_A },
        { sender_id: CLIENT_B, mission_id: MISSION_B },
        { sender_id: CLIENT_B, mission_id: MISSION_B },
        { sender_id: STRANGER, mission_id: MISSION_B },
      ],
      error: null,
    }
    expect((await getStudentShellData()).shell.unreadCount).toBe(3)
  })

  it("un client lié qui écrit sur la mission d'un autre client ne compte pas (couple exact)", async () => {
    link()
    tables.messages = { data: [{ sender_id: CLIENT_A, mission_id: MISSION_B }, { sender_id: CLIENT_B, mission_id: MISSION_A }], error: null }
    expect((await getStudentShellData()).shell.unreadCount).toBe(0)
  })

  it("la requête de messages est bornée à l'étudiant, non lus, clients et missions liés, avec plafond", async () => {
    link()
    await getStudentShellData()
    const [q] = messageFilters()
    expect(q.eq).toEqual([["receiver_id", "student-1"], ["read", false]])
    expect(q.in.map(([c]) => c)).toEqual(["sender_id", "mission_id"])
    expect([...q.in[0][1]].sort()).toEqual([CLIENT_A, CLIENT_B])
    expect([...q.in[1][1]].sort()).toEqual([MISSION_A, MISSION_B])
    expect(q.limit).toBe(500)
    for (const t of ["applications", "missions"]) {
      for (const query of log.filter((l) => l.table === t)) expect(query.limit).toBe(200)
    }
    expect(log.find((l) => l.table === "applications").eq).toEqual([["student_id", "student-1"]])
    expect(log.find((l) => l.table === "missions" && l.eq.length).eq).toEqual([["selected_student_id", "student-1"]])
  })

  it("sans mission liée, aucune lecture de messages", async () => {
    expect((await getStudentShellData()).shell.unreadCount).toBe(0)
    expect(messageFilters()).toHaveLength(0)
  })

  it("une mission retenue ET candidatée n'est lue qu'une fois", async () => {
    tables.applications = { data: [{ mission_id: MISSION_B }], error: null }
    tables.missions = { data: [{ id: MISSION_B, client_id: CLIENT_B }], error: null }
    tables.messages = { data: [{ sender_id: CLIENT_B, mission_id: MISSION_B }], error: null }
    expect((await getStudentShellData()).shell.unreadCount).toBe(1)
    expect(log.filter((q) => q.table === "missions")).toHaveLength(1)
  })
})
