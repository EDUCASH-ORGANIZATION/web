import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn() }))

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { notify } from "@/lib/notifications/notify"
import { sendEmail } from "@/lib/email/index"
import { declareMissionCompletion } from "./mission-completion.actions"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const STUDENT = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const DATE = "2026-10-14T09:30:00.000Z"
const mission = {
  id: M, title: "Flyer", client_id: "client-1", selected_student_id: STUDENT,
  status: "in_progress", completion_declared_at: null,
}

// reads : réponses successives des SELECT (lecture puis relecture) ; update : réponse de l'UPDATE.
function makeService({
  reads = [],
  update = { data: [{ id: M, completion_declared_at: DATE }], error: null },
  profile = { data: { full_name: "Awa Koffi" }, error: null },
  clientUser = { data: { user: { email: "client@exemple.bj" } } },
} = {}) {
  const calls = []
  let readIndex = 0
  const from = vi.fn((table) => {
    const state = { table, op: "select", payload: null, filters: [] }
    calls.push(state)
    const builder = {
      select: () => builder,
      update: (v) => { state.op = "update"; state.payload = v; return builder },
      eq: (c, v) => { state.filters.push(["eq", c, v]); return builder },
      is: (c, v) => { state.filters.push(["is", c, v]); return builder },
      maybeSingle: () => Promise.resolve(table === "profiles" ? profile : reads[Math.min(readIndex++, reads.length - 1)]),
      then: (ok, ko) => Promise.resolve(state.op === "update" ? update : reads[0]).then(ok, ko),
    }
    return builder
  })
  const getUserById = vi.fn(() => Promise.resolve(clientUser))
  return { client: { from, auth: { admin: { getUserById } } }, calls, from, getUserById }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ user: { id: STUDENT }, role: "student" })
  notify.mockResolvedValue({ ok: true })
  sendEmail.mockResolvedValue({ success: true })
})

describe("declareMissionCompletion", () => {
  it("le rôle étudiant est exigé en premier, avant toute autre opération", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(await declareMissionCompletion(M)).toEqual({
      error: "Vous n'avez pas les droits pour effectuer cette action.",
      code: "generic",
    })
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("déclare : un seul UPDATE conditionnel, date serveur, revalidation des 4 pages", async () => {
    const { client, calls } = makeService({ reads: [{ data: mission, error: null }] })
    createServiceClient.mockReturnValue(client)
    const res = await declareMissionCompletion(M)
    expect(res).toEqual({ success: true, alreadyDeclared: false, declaredAt: DATE })

    const updates = calls.filter((c) => c.op === "update")
    expect(updates).toHaveLength(1)
    expect(Object.keys(updates[0].payload)).toEqual(["completion_declared_at"])
    expect(Number.isNaN(Date.parse(updates[0].payload.completion_declared_at))).toBe(false)
    expect(updates[0].filters).toEqual([
      ["eq", "id", M],
      ["eq", "selected_student_id", STUDENT],
      ["eq", "status", "in_progress"],
      ["is", "completion_declared_at", null],
    ])
    expect(revalidatePath.mock.calls.map((c) => c[0]).sort()).toEqual(
      [`/client/messages/${M}`, `/client/missions/${M}`, `/messages/${M}`, `/student/missions/${M}`].sort()
    )
  })

  it("déjà déclarée : succès alreadyDeclared, aucun UPDATE", async () => {
    const { client, calls } = makeService({
      reads: [{ data: { ...mission, completion_declared_at: DATE }, error: null }],
    })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ success: true, alreadyDeclared: true, declaredAt: DATE })
    expect(calls.some((c) => c.op === "update")).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("erreur d'écriture : message neutre, aucun détail SQL", async () => {
    const { client } = makeService({
      reads: [{ data: mission, error: null }],
      update: { data: null, error: { code: "42501", message: "La declaration de fin est reservee au serveur." } },
    })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({
      error: "Une erreur est survenue. Réessayez dans un instant.",
      code: "generic",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("UPDATE à 0 ligne puis relecture sans la colonne (42703 ou PGRST204) : unavailable, pas generic", async () => {
    for (const code of ["42703", "PGRST204"]) {
      vi.clearAllMocks()
      const { client, calls } = makeService({
        reads: [{ data: mission, error: null }, { data: null, error: { code, message: "colonne absente" } }],
        update: { data: [], error: null },
      })
      createServiceClient.mockReturnValue(client)
      expect(await declareMissionCompletion(M)).toEqual({
        error: "Cette fonction n'est pas encore disponible.",
        code: "unavailable",
      })
      expect(calls.filter((c) => c.op === "update")).toHaveLength(1)
      expect(calls.filter((c) => c.op === "select")).toHaveLength(2)
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  })

  it("UPDATE à 0 ligne puis autre erreur de relecture : generic", async () => {
    const { client } = makeService({
      reads: [{ data: mission, error: null }, { data: null, error: { code: "57014", message: "timeout" } }],
      update: { data: [], error: null },
    })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({
      error: "Une erreur est survenue. Réessayez dans un instant.",
      code: "generic",
    })
  })

  describe("prévenir le client", () => {
    const declare = async (opts) => {
      const svc = makeService({ reads: [{ data: mission, error: null }], ...opts })
      createServiceClient.mockReturnValue(svc.client)
      return { res: await declareMissionCompletion(M), svc }
    }

    it("déclaration réelle : une notification et un e-mail, au client, prénom et titre seulement", async () => {
      const { res, svc } = await declare()
      expect(res).toEqual({ success: true, alreadyDeclared: false, declaredAt: DATE })
      expect(notify).toHaveBeenCalledTimes(1)
      const n = notify.mock.calls[0][0]
      expect(n).toMatchObject({
        recipientId: "client-1",
        type: "completion_declared",
        missionId: M,
        actorId: STUDENT,
        dedupeKey: `completion_declared:${M}`,
      })
      expect(n.body).toBe("Awa indique avoir terminé « Flyer ». Vérifiez le travail puis confirmez la fin.")
      expect(svc.getUserById).toHaveBeenCalledWith("client-1")
      expect(sendEmail).toHaveBeenCalledTimes(1)
      expect(sendEmail).toHaveBeenCalledWith("completion-declared", "client@exemple.bj", {
        studentName: "Awa",
        missionTitle: "Flyer",
        missionId: M,
      })
    })

    it("prénom absent : repli neutre « L'étudiant »", async () => {
      await declare({ profile: { data: { full_name: "" }, error: null } })
      expect(sendEmail.mock.calls[0][2].studentName).toBe("L'étudiant")
      expect(notify.mock.calls[0][0].body).toMatch(/^L'étudiant indique/)
    })

    it("alreadyDeclared : ni notification ni e-mail", async () => {
      const { res } = await declare({ reads: [{ data: { ...mission, completion_declared_at: DATE }, error: null }] })
      expect(res.alreadyDeclared).toBe(true)
      expect(notify).not.toHaveBeenCalled()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it("course (UPDATE à 0 ligne puis relecture déclarée) : ni notification ni e-mail", async () => {
      const { res } = await declare({
        reads: [{ data: mission, error: null }, { data: { ...mission, completion_declared_at: DATE }, error: null }],
        update: { data: [], error: null },
      })
      expect(res.alreadyDeclared).toBe(true)
      expect(notify).not.toHaveBeenCalled()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it("notify qui lève : la déclaration reste un succès et l'e-mail part", async () => {
      notify.mockRejectedValue(Object.assign(new Error("42P01 notifications"), { code: "42P01" }))
      const { res } = await declare()
      expect(res).toEqual({ success: true, alreadyDeclared: false, declaredAt: DATE })
      expect(sendEmail).toHaveBeenCalledTimes(1)
    })

    it("table notifications absente (notify répond ok:false) : succès", async () => {
      notify.mockResolvedValue({ ok: false })
      const { res } = await declare()
      expect(res.success).toBe(true)
    })

    it("e-mail qui échoue (réponse en erreur ou exception) : succès, journal par code seulement", async () => {
      sendEmail.mockResolvedValue({ error: "403 domaine non vérifié client@exemple.bj" })
      expect((await declare()).res.success).toBe(true)
      sendEmail.mockRejectedValue(new Error("boom client@exemple.bj"))
      expect((await declare()).res.success).toBe(true)
      expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/client@exemple|Awa|Flyer/)
    })

    it("client sans adresse ou lecture de l'adresse en échec : succès, aucun e-mail", async () => {
      expect((await declare({ clientUser: { data: { user: null } } })).res.success).toBe(true)
      expect(sendEmail).not.toHaveBeenCalled()
      const svc = makeService({ reads: [{ data: mission, error: null }] })
      svc.client.auth.admin.getUserById.mockRejectedValue(new Error("réseau"))
      createServiceClient.mockReturnValue(svc.client)
      expect((await declareMissionCompletion(M)).success).toBe(true)
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it("mission en erreur d'écriture : ni notification ni e-mail", async () => {
      await declare({ update: { data: null, error: { code: "42501", message: "x" } } })
      expect(notify).not.toHaveBeenCalled()
      expect(sendEmail).not.toHaveBeenCalled()
    })
  })

  it("expose une signature à un seul argument", () => {
    expect(declareMissionCompletion.length).toBe(1)
  })
})
