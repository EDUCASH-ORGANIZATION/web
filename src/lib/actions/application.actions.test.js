import { describe, it, expect, vi, beforeEach } from "vitest"

// Faux client Supabase : chaque requête est journalisée puis résolue par `respond`.
const calls = []
let respond = () => ({ data: null, error: null })

function makeQuery(table) {
  const q = { table, action: "select", values: undefined, filters: [] }
  const chain = {
    select: () => chain,
    insert: (v) => { q.action = "insert"; q.values = v; return chain },
    update: (v) => { q.action = "update"; q.values = v; return chain },
    eq: (c, v) => { q.filters.push(["eq", c, v]); return chain },
    neq: (c, v) => { q.filters.push(["neq", c, v]); return chain },
    in: (c, v) => { q.filters.push(["in", c, v]); return chain },
    not: (c, op, v) => { q.filters.push(["not", c, v]); return chain },
    order: () => chain,
    limit: (n) => { q.limit = n; return chain },
    maybeSingle: () => chain,
    then: (resolve, reject) => {
      calls.push(q)
      return Promise.resolve(respond(q)).then(resolve, reject)
    },
  }
  return chain
}

// Statut de vérification : lu par getMyProfile / getMyStudentProfile (service role, filtre sur la session), simulés ici.
const verifiedProfile = { is_verified: true, verified_until: null, rejection_reason: null }
let profileRow = verifiedProfile
let cardRow = { card_url: "stu-1/card.jpg" }
let verificationError = null
const getMyProfile = vi.fn(async () => (verificationError ? { error: verificationError } : { profile: profileRow }))
const getMyStudentProfile = vi.fn(async () => (verificationError ? { error: verificationError } : { studentProfile: cardRow }))

const supabase = { from: (table) => makeQuery(table) }
const getUserById = vi.fn()
const sendEmail = vi.fn()
const requireRole = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ auth: { admin: { getUserById } }, from: (table) => makeQuery(table) })),
}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: (...a) => getMyProfile(...a),
  getMyStudentProfile: (...a) => getMyStudentProfile(...a),
}))
vi.mock("@/lib/email/index", () => ({ sendEmail: (...a) => sendEmail(...a) }))
const notify = vi.fn()
vi.mock("@/lib/notifications/notify", () => ({ notify: (...a) => notify(...a) }))

import { apply, acceptApplication, rejectApplication, getMissionApplications } from "./application.actions"

const filterOf = (q, col) => q.filters.find((f) => f[1] === col)?.[2]
const writes = () => calls.filter((q) => q.action !== "select")

beforeEach(() => {
  calls.length = 0
  respond = () => ({ data: null, error: null })
  profileRow = verifiedProfile
  cardRow = { card_url: "stu-1/card.jpg" }
  verificationError = null
  getMyProfile.mockClear()
  getMyStudentProfile.mockClear()
  getUserById.mockReset()
  getUserById.mockResolvedValue({ data: { user: { email: "dest@example.com" } } })
  sendEmail.mockReset()
  notify.mockReset()
  notify.mockResolvedValue({ ok: true })
  requireRole.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const APPLY_MISSION = "11111111-1111-4111-8111-111111111111"

describe("apply", () => {
  const asStudent = () => requireRole.mockResolvedValue({ supabase, user: { id: "stu-1" }, role: "student" })
  const openMission = { id: APPLY_MISSION, title: "Courses", client_id: "cli-1", status: "open" }

  it("identifiant de mission absent ou mal formé : « Mission introuvable », aucune lecture", async () => {
    asStudent()
    for (const missionId of [undefined, "", "m1", "1; drop", 42]) {
      calls.length = 0
      expect(await apply({ missionId, message: "Bonjour" })).toEqual({ error: "Mission introuvable." })
      expect(calls).toHaveLength(0)
    }
  })

  it("erreur de lecture de la mission : message générique, erreur journalisée sans détail renvoyé", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: null, error: { message: "relation secrete" } } : { data: null, error: null })
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
    expect(JSON.stringify(res)).not.toContain("secrete")
    expect(console.error).toHaveBeenCalledWith("[apply] mission", "relation secrete")
    expect(calls.some((c) => c.action === "insert")).toBe(false)
  })

  it("refuse un non-étudiant et n'écrit rien", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(res.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it("refuse un message trop long ou non textuel sans écrire", async () => {
    asStudent()
    for (const message of ["a".repeat(501), 42, { x: 1 }]) {
      const res = await apply({ missionId: APPLY_MISSION, message })
      expect(res.error).toBeTruthy()
    }
    expect(calls).toHaveLength(0)
  })

  it("accepte un message de 500 caractères", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: openMission } : { data: null, error: null })
    expect((await apply({ missionId: APPLY_MISSION, message: "a".repeat(500) })).success).toBe(true)
  })

  it("refuse de postuler à sa propre mission", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: { ...openMission, client_id: "stu-1" } } : { data: null })
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res.error).toMatch(/propre mission/)
    expect(writes()).toHaveLength(0)
  })

  it("refuse une mission non ouverte", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: { ...openMission, status: "in_progress" } } : { data: null })
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it("refuse une mission dont l'échéance est dépassée, sans insertion ni notification", async () => {
    asStudent()
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
    respond = (q) => (q.table === "missions" ? { data: { ...openMission, deadline: yesterday } } : { data: null, error: null })
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res).toEqual({ error: "L'échéance de cette mission est dépassée." })
    expect(writes()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("accepte une échéance aujourd'hui, future ou absente", async () => {
    asStudent()
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Porto-Novo" })
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    for (const deadline of [today, tomorrow, null]) {
      respond = (q) => {
        if (q.table === "missions") return { data: { ...openMission, deadline } }
        if (q.table === "profiles") return { data: { full_name: "Nom" } }
        return { data: null, error: null }
      }
      expect(await apply({ missionId: APPLY_MISSION, message: "Bonjour" })).toEqual({ success: true })
    }
  })

  it("refuse une mission inconnue", async () => {
    asStudent()
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it("refuse une candidature déjà déposée", async () => {
    asStudent()
    respond = (q) => {
      if (q.table === "missions") return { data: openMission }
      if (q.table === "applications") return { data: { id: "a0" } }
      return { data: null }
    }
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res.error).toMatch(/déjà postulé/)
    expect(writes()).toHaveLength(0)
  })

  it("insère en pending et notifie le client via le client service role", async () => {
    asStudent()
    respond = (q) => {
      if (q.table === "missions") return { data: openMission }
      if (q.table === "profiles") return { data: { full_name: "Nom" } }
      return { data: null, error: null }
    }
    const res = await apply({ missionId: APPLY_MISSION, message: " Bonjour " })
    expect(res).toEqual({ success: true })
    const insert = writes()[0]
    expect(insert.values).toEqual({ mission_id: APPLY_MISSION, student_id: "stu-1", message: "Bonjour", status: "pending" })
    expect(getUserById).toHaveBeenCalledWith("cli-1")
    expect(sendEmail).toHaveBeenCalledWith("new-application", "dest@example.com", expect.objectContaining({ missionId: APPLY_MISSION }))
  })

  it("revalide les routes qui existent : /applications (jamais /student/applications) et le détail de la mission", async () => {
    const { revalidatePath } = await import("next/cache")
    revalidatePath.mockClear()
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: openMission } : { data: null, error: null })
    expect(await apply({ missionId: APPLY_MISSION, message: "Bonjour" })).toEqual({ success: true })
    const paths = revalidatePath.mock.calls.map((c) => c[0])
    expect(paths).toContain("/applications")
    expect(paths).not.toContain("/student/applications")
  })

  describe("décision D2 : contrôle serveur du statut de vérification", () => {
    const plus = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
    const post = () => apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    beforeEach(() => {
      asStudent()
      respond = (q) => (q.table === "missions" ? { data: openMission } : { data: null, error: null })
    })

    it.each([
      ["carte jamais envoyée", { is_verified: false }, null, "Envoyez votre carte étudiante pour pouvoir postuler."],
      ["carte refusée", { is_verified: false, rejection_reason: "floue" }, { card_url: "stu-1/c.jpg" }, "Votre carte a été refusée, renvoyez-la pour pouvoir postuler."],
      ["badge expiré", { is_verified: true, verified_until: plus(-3) }, { card_url: "stu-1/c.jpg" }, "Votre badge a expiré, renouvelez-le pour pouvoir postuler."],
      ["date de fin illisible", { is_verified: true, verified_until: "pas une date" }, { card_url: "stu-1/c.jpg" }, "Votre badge a expiré, renouvelez-le pour pouvoir postuler."],
    ])("refuse sans insérer ni notifier : %s", async (_n, profile, card, message) => {
      profileRow = profile
      cardRow = card
      expect(await post()).toEqual({ error: message })
      expect(writes()).toHaveLength(0)
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it.each([
      ["vérifié", { is_verified: true, verified_until: plus(200) }, null],
      ["badge à renouveler", { is_verified: true, verified_until: plus(10) }, null],
      ["carte en cours d'examen", { is_verified: false }, { card_url: "stu-1/c.jpg" }],
    ])("accepte : %s", async (_n, profile, card) => {
      profileRow = profile
      cardRow = card
      expect(await post()).toEqual({ success: true })
      expect(writes()).toHaveLength(1)
    })

    it("lit le statut par les lectures de la session (aucun paramètre d'identité transmis)", async () => {
      await apply({ missionId: APPLY_MISSION, message: "Bonjour", userId: "autre", studentId: "autre" })
      expect(getMyProfile).toHaveBeenCalledWith()
      expect(getMyStudentProfile).toHaveBeenCalledWith()
    })

    it("lecture du statut en échec : refus neutre sans insertion", async () => {
      verificationError = { message: "relation secrete" }
      const res = await post()
      expect(res.error).toBeTruthy()
      expect(res.error).not.toContain("secrete")
      expect(writes()).toHaveLength(0)
    })

    it("ne renvoie jamais de colonne privée", async () => {
      profileRow = { is_verified: false, rejection_reason: "motif secret" }
      cardRow = null
      expect(JSON.stringify(await post())).not.toContain("motif secret")
    })

    it("les autres contrôles passent avant : mission fermée reste refusée avec son message", async () => {
      profileRow = { is_verified: false }
      respond = (q) => (q.table === "missions" ? { data: { ...openMission, status: "done" } } : { data: null })
      expect((await post()).error).toMatch(/n'accepte plus/)
    })
  })

  it("réussit même si l'email échoue", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: openMission } : { data: null, error: null })
    sendEmail.mockRejectedValue(new Error("boom"))
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res).toEqual({ success: true })
  })
})

describe("acceptApplication", () => {
  const params = { applicationId: "a1", studentId: "stu-1", missionId: "m1" }
  const asClient = () => requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })
  const mission = { id: "m1", title: "Courses", client_id: "cli-1", status: "open" }

  function happy(overrides = {}) {
    return (q) => {
      if (q.table === "missions" && q.action === "select") return { data: mission }
      if (q.table === "missions" && q.action === "update") return overrides.missionUpdate ?? { data: [{ id: "m1" }], error: null }
      if (q.table === "applications" && q.action === "update" && q.values.status === "accepted") return { data: [{ id: "a1" }], error: null }
      if (q.table === "applications" && q.action === "update" && q.values.status === "rejected") return { data: [{ student_id: "stu-2" }], error: null }
      if (q.table === "applications" && q.action === "update" && q.values.status === "pending") return { data: [{ id: "a1" }], error: null }
      if (q.table === "profiles") return { data: { full_name: "Nom" } }
      return { data: null, error: null }
    }
  }

  it("refuse un non-client", async () => {
    requireRole.mockResolvedValue({ error: "interdit" })
    const res = await acceptApplication(params)
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(res.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it("refuse une mission qui n'est pas celle du client", async () => {
    asClient()
    respond = () => ({ data: null })
    const res = await acceptApplication(params)
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
    expect(calls[0].filters).toContainEqual(["eq", "client_id", "cli-1"])
  })

  it("refuse une mission non ouverte", async () => {
    asClient()
    respond = () => ({ data: { ...mission, status: "in_progress" } })
    const res = await acceptApplication(params)
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  describe("étudiant fermé ou suspendu", () => {
    const withProfile = (profile) => (q) =>
      q.table === "profiles" && q.filters.some((f) => f[1] === "user_id" && f[0] === "eq")
        && q.action === "select" ? profile : happy()(q)

    it.each([
      ["fermé", { data: { closed_at: "2026-10-01T00:00:00Z", is_suspended: false }, error: null }],
      ["suspendu", { data: { closed_at: null, is_suspended: true }, error: null }],
      ["profil illisible", { data: null, error: { message: "boom" } }],
      ["profil introuvable", { data: null, error: null }],
    ])("refuse sans rien écrire : %s", async (_label, profile) => {
      asClient()
      respond = withProfile(profile)
      const res = await acceptApplication(params)
      expect(res.error).toBe("Cette candidature n'est plus disponible.")
      expect(writes()).toHaveLength(0)
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it("accepte un étudiant actif", async () => {
      asClient()
      respond = withProfile({ data: { closed_at: null, is_suspended: false }, error: null })
      expect(await acceptApplication(params)).toEqual({ success: true })
    })
  })

  it("n'envoie pas l'e-mail de rejet à un étudiant dont l'adresse est effacée", async () => {
    asClient()
    respond = happy()
    getUserById.mockImplementation(async (id) => ({
      data: { user: { email: id === "stu-2" ? "x@comptes-clotures.invalid" : "dest@example.com" } },
    }))
    await acceptApplication(params)
    expect(sendEmail.mock.calls.map((c) => c[0])).toEqual(["application-accepted"])
  })

  it("filtre la candidature par id, mission, étudiant et statut pending", async () => {
    asClient()
    respond = happy()
    await acceptApplication(params)
    const first = writes()[0]
    expect(filterOf(first, "id")).toBe("a1")
    expect(filterOf(first, "mission_id")).toBe("m1")
    expect(filterOf(first, "student_id")).toBe("stu-1")
    expect(filterOf(first, "status")).toBe("pending")
  })

  it("refuse si aucune candidature ne correspond et n'écrit pas la mission", async () => {
    asClient()
    respond = (q) => {
      if (q.table === "missions") return { data: mission }
      if (q.table === "applications") return { data: [], error: null }
      return { data: null }
    }
    const res = await acceptApplication(params)
    expect(res.error).toBeTruthy()
    expect(writes().filter((q) => q.table === "missions")).toHaveLength(0)
  })

  it("écrit dans l'ordre : candidature, mission, rejet des autres", async () => {
    asClient()
    respond = happy()
    const res = await acceptApplication(params)
    expect(res).toEqual({ success: true })
    const w = writes()
    expect(w.map((q) => [q.table, q.values.status])).toEqual([
      ["applications", "accepted"],
      ["missions", "in_progress"],
      ["applications", "rejected"],
    ])
    expect(w[1].values.selected_student_id).toBe("stu-1")
    expect(filterOf(w[1], "status")).toBe("open")
    expect(w[2].filters).toContainEqual(["neq", "id", "a1"])
    expect(filterOf(w[2], "status")).toBe("pending")
  })

  it("remet la candidature en pending si la mission ne passe pas en cours", async () => {
    asClient()
    respond = happy({ missionUpdate: { data: [], error: null } })
    const res = await acceptApplication(params)
    expect(res.error).toBe("Cette mission n'est plus disponible.")
    const w = writes()
    expect(w.map((q) => [q.table, q.values.status])).toEqual([
      ["applications", "accepted"],
      ["missions", "in_progress"],
      ["applications", "pending"],
    ])
    expect(filterOf(w[2], "status")).toBe("accepted")
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("compense aussi sur erreur d'écriture de la mission", async () => {
    asClient()
    respond = happy({ missionUpdate: { data: null, error: { message: "garde" } } })
    const res = await acceptApplication(params)
    expect(res.error).toBeTruthy()
    expect(writes().at(-1).values.status).toBe("pending")
  })

  it("journalise quand la remise en attente touche 0 ligne ou échoue", async () => {
    asClient()
    for (const undo of [{ data: [], error: null }, { data: null, error: { message: "boom" } }]) {
      console.error.mockClear()
      respond = (q) => {
        if (q.table === "applications" && q.values?.status === "pending") return undo
        return happy({ missionUpdate: { data: [], error: null } })(q)
      }
      const res = await acceptApplication(params)
      expect(res.error).toBe("Cette mission n'est plus disponible.")
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Compensation"), expect.anything())
    }
  })

  it("envoie les emails via le client service role", async () => {
    asClient()
    respond = happy()
    await acceptApplication(params)
    expect(getUserById).toHaveBeenCalledWith("stu-1")
    expect(getUserById).toHaveBeenCalledWith("stu-2")
    expect(sendEmail).toHaveBeenCalledWith("application-accepted", "dest@example.com", expect.objectContaining({ missionId: "m1" }))
    expect(sendEmail).toHaveBeenCalledWith("application-rejected", "dest@example.com", expect.any(Object))
  })

  it("reste un succès si l'envoi d'email échoue", async () => {
    asClient()
    respond = happy()
    sendEmail.mockRejectedValue(new Error("boom"))
    const res = await acceptApplication(params)
    expect(res).toEqual({ success: true })
  })
})

describe("rejectApplication", () => {
  const asClient = () => requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })

  it("refuse un non-client", async () => {
    requireRole.mockResolvedValue({ error: "interdit" })
    const res = await rejectApplication("a1")
    expect(res.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it("refuse une candidature d'une mission qui n'est pas la sienne", async () => {
    asClient()
    respond = (q) => (q.table === "applications" ? { data: { id: "a1", mission_id: "m9", status: "pending" } } : { data: null })
    const res = await rejectApplication("a1")
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
    const missionRead = calls.find((q) => q.table === "missions")
    expect(missionRead.filters).toContainEqual(["eq", "client_id", "cli-1"])
  })

  it("refuse une candidature qui n'est plus en attente", async () => {
    asClient()
    respond = (q) => {
      if (q.table === "applications") return { data: { id: "a1", mission_id: "m1", status: "accepted" } }
      return { data: { id: "m1" } }
    }
    const res = await rejectApplication("a1")
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it("rejette une candidature pending de sa mission", async () => {
    asClient()
    respond = (q) => {
      if (q.table === "applications" && q.action === "select") return { data: { id: "a1", mission_id: "m1", status: "pending" } }
      if (q.table === "applications") return { data: [{ id: "a1" }], error: null }
      return { data: { id: "m1" } }
    }
    const res = await rejectApplication("a1")
    expect(res).toEqual({ success: true })
    const w = writes()[0]
    expect(w.values).toEqual({ status: "rejected" })
    expect(filterOf(w, "status")).toBe("pending")
    expect(filterOf(w, "mission_id")).toBe("m1")
  })
})

describe("getMissionApplications", () => {
  const asClient = () => requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })

  it("exige le rôle client et ne lit rien sinon", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    await expect(getMissionApplications("m1")).rejects.toThrow("refus")
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(calls).toHaveLength(0)
  })

  it("refuse une mission qui n'appartient pas au client, sans lire les candidatures", async () => {
    asClient()
    respond = () => ({ data: null, error: null })
    await expect(getMissionApplications("m1")).rejects.toThrow()
    expect(calls.map((q) => q.table)).toEqual(["missions"])
    expect(filterOf(calls[0], "client_id")).toBe("cli-1")
  })

  it("lit les candidatures de sa mission avec une limite bornée", async () => {
    asClient()
    respond = (q) => (q.table === "missions" ? { data: { id: "m1" } } : { data: [{ id: "a1" }], error: null })
    expect(await getMissionApplications("m1", { limit: 0 })).toEqual([{ id: "a1" }])
    const read = calls.find((q) => q.table === "applications")
    expect(filterOf(read, "mission_id")).toBe("m1")
    expect(read.limit).toBe(100)
  })
})

describe("getMissionApplications : comptes fermés", () => {
  const rows = [{ id: "a1", student_id: "s1" }, { id: "a2", student_id: "s2" }]
  beforeEach(() => requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" }))

  it("masque les candidatures d'étudiants fermés", async () => {
    respond = (q) => {
      if (q.table === "missions") return { data: { id: "m1" } }
      if (q.table === "profiles") return { data: [{ user_id: "s2" }], error: null }
      return { data: rows, error: null }
    }
    expect(await getMissionApplications("m1")).toEqual([rows[0]])
  })

  it("échoue fermé si l'état des comptes est illisible", async () => {
    respond = (q) => {
      if (q.table === "missions") return { data: { id: "m1" } }
      if (q.table === "profiles") return { data: null, error: { message: "boom" } }
      return { data: rows, error: null }
    }
    await expect(getMissionApplications("m1")).rejects.toThrow("Impossible de charger les candidatures.")
  })
})

describe("lectures de candidatures : erreurs neutres", () => {
  const SECRET = 'column "x" of relation "applications" does not exist'

  it("getMissionApplications masque le détail et le journalise", async () => {
    requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })
    respond = (q) => (q.table === "missions" ? { data: { id: "m1" } } : { data: null, error: { message: SECRET } })
    await expect(getMissionApplications("m1")).rejects.toThrow("Impossible de charger les candidatures.")
    expect(console.error).toHaveBeenCalledWith("[getMissionApplications]", SECRET)
  })
})

describe("registre des messages : vouvoiement partout (RD-VOUS-01)", () => {
  const TUTOIEMENT = /\b(tu|ton|ta|tes)\b|Réessaie\b/i

  it("rejectApplication vouvoie le client quand l'écriture échoue", async () => {
    requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })
    respond = (q) => {
      if (q.table === "applications" && q.action === "select") return { data: { id: "a1", mission_id: "m1", status: "pending" } }
      if (q.table === "applications") return { data: null, error: { message: "db" } }
      return { data: { id: "m1" } }
    }
    const res = await rejectApplication("a1")
    expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
    expect(res.error).not.toMatch(TUTOIEMENT)
  })

  it("getMissionApplications vouvoie le client sur une mission qui n'est pas la sienne", async () => {
    requireRole.mockResolvedValue({ supabase, user: { id: "cli-1" }, role: "client" })
    respond = () => ({ data: null, error: null })
    await expect(getMissionApplications("m1")).rejects.toThrow("Vous n'avez pas les droits pour effectuer cette action.")
  })

  it("apply vouvoie l'étudiant quand l'insertion échoue", async () => {
    requireRole.mockResolvedValue({ supabase, user: { id: "stu-1" }, role: "student" })
    respond = (q) => {
      if (q.table === "missions") return { data: { id: APPLY_MISSION, title: "Courses", client_id: "cli-1", status: "open" } }
      if (q.action === "select") return { data: null }
      return { data: null, error: { message: "db" } }
    }
    const res = await apply({ missionId: APPLY_MISSION, message: "Bonjour" })
    expect(res).toEqual({ error: "Une erreur est survenue. Réessayez dans un instant." })
    expect(res.error).not.toMatch(TUTOIEMENT)
  })
})

describe("notifications in-app (RD-NOTIF-01)", () => {
  const MISSION_ID = "11111111-1111-4111-8111-111111111111"
  const STUDENT_ID = "22222222-2222-4222-8222-222222222222"
  const OTHER_ID = "33333333-3333-4333-8333-333333333333"
  const CLIENT_ID = "44444444-4444-4444-8444-444444444444"
  const asStudent = () => requireRole.mockResolvedValue({ supabase, user: { id: STUDENT_ID }, role: "student" })
  const asClient = () => requireRole.mockResolvedValue({ supabase, user: { id: CLIENT_ID }, role: "client" })

  describe("apply", () => {
    const openMission = { id: MISSION_ID, title: "Traduction d'un flyer", client_id: CLIENT_ID, status: "open" }
    beforeEach(() => {
      asStudent()
      respond = (q) => {
        if (q.table === "missions") return { data: openMission }
        if (q.table === "profiles") return { data: { full_name: "Afiavi Dossou" } }
        return { data: null, error: null }
      }
    })

    it("notifie le client une seule fois après l'insertion, avec la clé attendue", async () => {
      expect(await apply({ missionId: MISSION_ID, message: "Bonjour" })).toEqual({ success: true })
      expect(notify).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: CLIENT_ID,
          type: "application_received",
          title: "Nouvelle candidature",
          body: "Afiavi D. a postulé à « Traduction d'un flyer ».",
          dedupeKey: `application_received:${MISSION_ID}:${STUDENT_ID}`,
          missionId: MISSION_ID,
          actorId: STUDENT_ID,
        }),
      )
    })

    it("aucune notification quand l'insertion échoue ou qu'une règle refuse", async () => {
      respond = (q) => {
        if (q.table === "missions") return { data: openMission }
        if (q.table === "applications" && q.action === "insert") return { data: null, error: { message: "refusé" } }
        return { data: null, error: null }
      }
      expect((await apply({ missionId: MISSION_ID, message: "Bonjour" })).error).toBeTruthy()
      expect((await apply({ missionId: "pas-un-uuid", message: "Bonjour" })).error).toBeTruthy()
      expect(notify).not.toHaveBeenCalled()
    })

    it("même résultat si notify renvoie { ok: false } ou lève une exception", async () => {
      notify.mockResolvedValueOnce({ ok: false })
      expect(await apply({ missionId: MISSION_ID, message: "Bonjour" })).toEqual({ success: true })
      notify.mockRejectedValueOnce(new Error("boom"))
      expect(await apply({ missionId: MISSION_ID, message: "Bonjour" })).toEqual({ success: true })
      expect(sendEmail).toHaveBeenCalledTimes(2)
    })

    it("le nom de l'étudiant n'est lu qu'une fois pour la notification et l'e-mail", async () => {
      expect(await apply({ missionId: MISSION_ID, message: "Bonjour" })).toEqual({ success: true })
      const reads = calls.filter((q) => q.table === "profiles" && filterOf(q, "user_id") === STUDENT_ID)
      expect(reads).toHaveLength(1)
      expect(notify.mock.calls[0][0].body).toBe("Afiavi D. a postulé à « Traduction d'un flyer ».")
      expect(sendEmail.mock.calls[0][2]).toMatchObject({ studentName: "Afiavi Dossou", clientName: "Afiavi Dossou" })
    })

    it("la notification est écrite avant l'email", async () => {
      const order = []
      notify.mockImplementation(async () => { order.push("notify"); return { ok: true } })
      sendEmail.mockImplementation(async () => { order.push("email") })
      await apply({ missionId: MISSION_ID, message: "Bonjour" })
      expect(order).toEqual(["notify", "email"])
    })
  })

  describe("acceptApplication", () => {
    const params = { applicationId: "a1", studentId: STUDENT_ID, missionId: MISSION_ID }
    const mission = { id: MISSION_ID, title: "Traduction d'un flyer", client_id: CLIENT_ID, status: "open" }
    function happy({ missionUpdate, rejected = [{ student_id: OTHER_ID }] } = {}) {
      return (q) => {
        if (q.table === "missions" && q.action === "select") return { data: mission }
        if (q.table === "missions" && q.action === "update") return missionUpdate ?? { data: [{ id: MISSION_ID }], error: null }
        if (q.table === "applications" && q.action === "update" && q.values.status === "accepted") return { data: [{ id: "a1" }], error: null }
        if (q.table === "applications" && q.action === "update" && q.values.status === "rejected") return { data: rejected, error: null }
        if (q.table === "applications" && q.action === "update" && q.values.status === "pending") return { data: [{ id: "a1" }], error: null }
        if (q.table === "profiles") return { data: { full_name: "Rosine Hounkpatin" } }
        return { data: null, error: null }
      }
    }
    beforeEach(asClient)

    it("notifie l'étudiant retenu et chaque étudiant non retenu", async () => {
      respond = happy()
      expect(await acceptApplication(params)).toEqual({ success: true })
      expect(notify).toHaveBeenCalledTimes(2)
      const accepted = notify.mock.calls.map((c) => c[0]).find((n) => n.type === "application_accepted")
      expect(accepted).toMatchObject({
        recipientId: STUDENT_ID,
        body: "Rosine H. vous a retenu pour « Traduction d'un flyer ». La mission démarre.",
        dedupeKey: `application_accepted:${MISSION_ID}:${STUDENT_ID}`,
        actorId: CLIENT_ID,
      })
      const rejected = notify.mock.calls.map((c) => c[0]).find((n) => n.type === "application_rejected")
      expect(rejected).toMatchObject({
        recipientId: OTHER_ID,
        dedupeKey: `application_rejected:${MISSION_ID}:${OTHER_ID}`,
      })
    })

    it("aucune notification quand la candidature n'est plus disponible ou que la mission ne démarre pas (compensation)", async () => {
      respond = (q) => {
        if (q.table === "missions" && q.action === "select") return { data: mission }
        if (q.table === "applications" && q.action === "update") return { data: [], error: null }
        return { data: null, error: null }
      }
      expect((await acceptApplication(params)).error).toBeTruthy()
      respond = happy({ missionUpdate: { data: [], error: null } })
      expect((await acceptApplication(params)).error).toBeTruthy()
      expect(notify).not.toHaveBeenCalled()
    })

    it("même résultat si notify échoue ou lève", async () => {
      respond = happy()
      notify.mockRejectedValue(new Error("boom"))
      expect(await acceptApplication(params)).toEqual({ success: true })
      notify.mockResolvedValue({ ok: false })
      expect(await acceptApplication(params)).toEqual({ success: true })
      expect(sendEmail).toHaveBeenCalled()
    })

    it("sans autre candidature : une seule notification", async () => {
      respond = happy({ rejected: [] })
      await acceptApplication(params)
      expect(notify).toHaveBeenCalledTimes(1)
    })
  })

  describe("rejectApplication", () => {
    beforeEach(asClient)
    const reading = (rejectedResult) => (q) => {
      if (q.table === "applications" && q.action === "select") return { data: { id: "a1", mission_id: MISSION_ID, student_id: STUDENT_ID, status: "pending" } }
      if (q.table === "applications") return rejectedResult ?? { data: [{ id: "a1" }], error: null }
      return { data: { id: MISSION_ID, title: "Traduction d'un flyer" } }
    }

    it("notifie l'étudiant non retenu après le rejet", async () => {
      respond = reading()
      expect(await rejectApplication("a1")).toEqual({ success: true })
      expect(notify).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: STUDENT_ID,
          type: "application_rejected",
          body: "Votre candidature à « Traduction d'un flyer » n'a pas été retenue.",
          dedupeKey: `application_rejected:${MISSION_ID}:${STUDENT_ID}`,
        }),
      )
    })

    it("aucune notification quand le rejet échoue ou ne touche aucune ligne", async () => {
      respond = reading({ data: null, error: { message: "refus" } })
      expect((await rejectApplication("a1")).error).toBeTruthy()
      respond = reading({ data: [], error: null })
      expect((await rejectApplication("a1")).error).toBeTruthy()
      expect(notify).not.toHaveBeenCalled()
    })

    it("même résultat si notify lève", async () => {
      respond = reading()
      notify.mockRejectedValue(new Error("boom"))
      expect(await rejectApplication("a1")).toEqual({ success: true })
    })
  })
})
