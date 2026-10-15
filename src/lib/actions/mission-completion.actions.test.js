import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { declareMissionCompletion } from "./mission-completion.actions"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const STUDENT = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const DATE = "2026-10-14T09:30:00.000Z"
const mission = {
  id: M, title: "Flyer", client_id: "client-1", selected_student_id: STUDENT,
  status: "in_progress", completion_declared_at: null,
}

// reads : réponses successives des SELECT (lecture puis relecture) ; update : réponse de l'UPDATE.
function makeService({ reads = [], update = { data: [{ id: M, completion_declared_at: DATE }], error: null } } = {}) {
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
      maybeSingle: () => Promise.resolve(reads[Math.min(readIndex++, reads.length - 1)]),
      then: (ok, ko) => Promise.resolve(state.op === "update" ? update : reads[0]).then(ok, ko),
    }
    return builder
  })
  return { client: { from }, calls, from }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ user: { id: STUDENT }, role: "student" })
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

  it("expose une signature à un seul argument", () => {
    expect(declareMissionCompletion.length).toBe(1)
  })
})
