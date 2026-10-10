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
    maybeSingle: () => chain,
    then: (resolve, reject) => {
      calls.push(q)
      return Promise.resolve(respond(q)).then(resolve, reject)
    },
  }
  return chain
}

const supabase = { from: (table) => makeQuery(table) }
const getUserById = vi.fn()
const sendEmail = vi.fn()
const requireRole = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ auth: { admin: { getUserById } } })),
}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/email/index", () => ({ sendEmail: (...a) => sendEmail(...a) }))

import { apply, acceptApplication, rejectApplication } from "./application.actions"

const filterOf = (q, col) => q.filters.find((f) => f[1] === col)?.[2]
const writes = () => calls.filter((q) => q.action !== "select")

beforeEach(() => {
  calls.length = 0
  respond = () => ({ data: null, error: null })
  getUserById.mockReset()
  getUserById.mockResolvedValue({ data: { user: { email: "dest@example.com" } } })
  sendEmail.mockReset()
  requireRole.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("apply", () => {
  const asStudent = () => requireRole.mockResolvedValue({ supabase, user: { id: "stu-1" }, role: "student" })
  const openMission = { id: "m1", title: "Courses", client_id: "cli-1", status: "open" }

  it("refuse un non-étudiant et n'écrit rien", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    const res = await apply({ missionId: "m1", message: "Bonjour" })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(res.error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it("refuse de postuler à sa propre mission", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: { ...openMission, client_id: "stu-1" } } : { data: null })
    const res = await apply({ missionId: "m1", message: "Bonjour" })
    expect(res.error).toMatch(/propre mission/)
    expect(writes()).toHaveLength(0)
  })

  it("refuse une mission non ouverte", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: { ...openMission, status: "in_progress" } } : { data: null })
    const res = await apply({ missionId: "m1", message: "Bonjour" })
    expect(res.error).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it("refuse une mission inconnue", async () => {
    asStudent()
    const res = await apply({ missionId: "m1", message: "Bonjour" })
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
    const res = await apply({ missionId: "m1", message: "Bonjour" })
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
    const res = await apply({ missionId: "m1", message: " Bonjour " })
    expect(res).toEqual({ success: true })
    const insert = writes()[0]
    expect(insert.values).toEqual({ mission_id: "m1", student_id: "stu-1", message: "Bonjour", status: "pending" })
    expect(getUserById).toHaveBeenCalledWith("cli-1")
    expect(sendEmail).toHaveBeenCalledWith("new-application", "dest@example.com", expect.objectContaining({ missionId: "m1" }))
  })

  it("réussit même si l'email échoue", async () => {
    asStudent()
    respond = (q) => (q.table === "missions" ? { data: openMission } : { data: null, error: null })
    sendEmail.mockRejectedValue(new Error("boom"))
    const res = await apply({ missionId: "m1", message: "Bonjour" })
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
    expect(res.error).toBeTruthy()
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
