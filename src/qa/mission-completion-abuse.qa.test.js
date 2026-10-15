import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// RD-DONE-01 / cas d'abus de la déclaration de fin (A1 à A12), avec un faux client Supabase.
// Chaque refus doit être vouvoyé, sans texte SQL ni identifiant tiers, et ne jamais écrire.
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { declareMissionCompletion } from "@/lib/actions/mission-completion.actions"
import { readCompletionDeclared } from "@/lib/actions/mission-completion-core"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const STUDENT = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const OTHER = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"
const CLIENT = "7a7a7a7a-1111-4222-8333-444444444444"
const DATE = "2026-10-14T09:30:00.000Z"
const base = {
  id: M, title: "Flyer", client_id: CLIENT, selected_student_id: STUDENT,
  status: "in_progress", completion_declared_at: null,
}
const NOT_FOUND = { error: "Mission introuvable.", code: "not_found" }

function makeService({ reads, update } = {}) {
  const writes = []
  let n = 0
  const from = vi.fn(() => {
    const state = { op: "select" }
    const builder = {
      select: () => builder,
      update: (v) => { state.op = "update"; writes.push(v); return builder },
      eq: () => builder,
      is: () => builder,
      maybeSingle: () => Promise.resolve(reads[Math.min(n++, reads.length - 1)]),
      then: (ok, ko) =>
        Promise.resolve(update ?? { data: [{ id: M, completion_declared_at: DATE }], error: null }).then(ok, ko),
    }
    return builder
  })
  return { client: { from }, from, writes }
}
const ok = (row) => ({ data: row, error: null })

function expectNoLeak(res) {
  const text = JSON.stringify(res)
  expect(text).not.toMatch(/42501|42703|PGRST|violates|constraint|relation|column|SELECT|UPDATE/)
  expect(text).not.toContain(CLIENT)
  expect(text).not.toContain(OTHER)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireRole.mockResolvedValue({ user: { id: STUDENT }, role: "student" })
})

describe("declareMissionCompletion : abus", () => {
  it("A1 autre étudiant (non retenu) : « Mission introuvable. », aucune écriture", async () => {
    requireRole.mockResolvedValue({ user: { id: OTHER }, role: "student" })
    const { client, writes } = makeService({ reads: [ok(base)] })
    createServiceClient.mockReturnValue(client)
    const res = await declareMissionCompletion(M)
    expect(res).toEqual(NOT_FOUND)
    expect(writes).toEqual([])
    expectNoLeak(res)
  })

  it("A2 candidat en attente ou refusé (mission non attribuée) : même réponse que l'inexistant", async () => {
    const { client, writes } = makeService({ reads: [ok({ ...base, status: "open", selected_student_id: null })] })
    createServiceClient.mockReturnValue(client)
    const res = await declareMissionCompletion(M)
    expect(res).toEqual(NOT_FOUND)
    expect(writes).toEqual([])

    const missing = makeService({ reads: [ok(null)] })
    createServiceClient.mockReturnValue(missing.client)
    expect(await declareMissionCompletion(M)).toEqual(res)
  })

  it("A3 client, admin ou anonyme : refus de requireRole, aucune lecture", async () => {
    for (const error of ["Vous devez être connecté pour effectuer cette action.", "Vous n'avez pas les droits pour effectuer cette action."]) {
      requireRole.mockResolvedValue({ error })
      createServiceClient.mockClear()
      const res = await declareMissionCompletion(M)
      expect(res).toEqual({ error, code: "generic" })
      expect(createServiceClient).not.toHaveBeenCalled()
    }
    expect(requireRole).toHaveBeenCalledWith(["student"])
  })

  it("A3 bis le client propriétaire (rôle client) est refusé avant toute lecture", async () => {
    requireRole.mockImplementation(async (roles) =>
      roles.includes("client") ? { user: { id: CLIENT }, role: "client" } : { error: "Vous n'avez pas les droits pour effectuer cette action." }
    )
    const res = await declareMissionCompletion(M)
    expect(res.error).toBe("Vous n'avez pas les droits pour effectuer cette action.")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("A4 mission ouverte avec cet étudiant retenu : not_in_progress, aucune écriture", async () => {
    const { client, writes } = makeService({ reads: [ok({ ...base, status: "open" })] })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ error: "Cette mission n'est pas en cours.", code: "not_in_progress" })
    expect(writes).toEqual([])
  })

  it("A5 mission annulée : not_in_progress, aucune écriture", async () => {
    const { client, writes } = makeService({ reads: [ok({ ...base, status: "cancelled" })] })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ error: "Cette mission n'est pas en cours.", code: "not_in_progress" })
    expect(writes).toEqual([])
  })

  it("A6 mission déjà terminée : already_done, aucune écriture", async () => {
    const { client, writes } = makeService({ reads: [ok({ ...base, status: "done", completion_declared_at: DATE })] })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ error: "Cette mission est déjà terminée.", code: "already_done" })
    expect(writes).toEqual([])
  })

  it("A7 double déclaration : alreadyDeclared, un seul UPDATE sur deux appels", async () => {
    const first = makeService({ reads: [ok(base)] })
    createServiceClient.mockReturnValue(first.client)
    expect(await declareMissionCompletion(M)).toEqual({ success: true, alreadyDeclared: false, declaredAt: DATE })

    const second = makeService({ reads: [ok({ ...base, completion_declared_at: DATE })] })
    createServiceClient.mockReturnValue(second.client)
    expect(await declareMissionCompletion(M)).toEqual({ success: true, alreadyDeclared: true, declaredAt: DATE })
    expect(first.writes.length + second.writes.length).toBe(1)
  })

  it("A8 course avec confirmMission : UPDATE 0 ligne puis relecture done", async () => {
    const { client } = makeService({
      reads: [ok(base), ok({ ...base, status: "done" })],
      update: { data: [], error: null },
    })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ error: "Cette mission est déjà terminée.", code: "already_done" })
  })

  it("A8 bis course avec un double clic : UPDATE 0 ligne puis relecture déjà déclarée", async () => {
    const { client } = makeService({
      reads: [ok(base), ok({ ...base, completion_declared_at: DATE })],
      update: { data: [], error: null },
    })
    createServiceClient.mockReturnValue(client)
    expect(await declareMissionCompletion(M)).toEqual({ success: true, alreadyDeclared: true, declaredAt: DATE })
  })

  it("A8 ter course : relecture annulée, ou mission redevenue illisible", async () => {
    const cancelled = makeService({ reads: [ok(base), ok({ ...base, status: "cancelled" })], update: { data: [], error: null } })
    createServiceClient.mockReturnValue(cancelled.client)
    expect((await declareMissionCompletion(M)).code).toBe("not_in_progress")

    const gone = makeService({ reads: [ok(base), ok(null)], update: { data: [], error: null } })
    createServiceClient.mockReturnValue(gone.client)
    expect(await declareMissionCompletion(M)).toEqual(NOT_FOUND)

    const stuck = makeService({ reads: [ok(base), ok(base)], update: { data: [], error: null } })
    createServiceClient.mockReturnValue(stuck.client)
    expect((await declareMissionCompletion(M)).code).toBe("generic")
  })

  it("A9 identifiant mal formé : refus sans requête", async () => {
    for (const id of ["", "abc", "1 or 1=1", "../x", null, undefined, 42, {}, [M]]) {
      createServiceClient.mockClear()
      const res = await declareMissionCompletion(id)
      expect(res).toEqual(NOT_FOUND)
      expect(createServiceClient).not.toHaveBeenCalled()
    }
  })

  it("A10 compte suspendu : refus de requireRole, aucune lecture", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await declareMissionCompletion(M)
    expect(res.code).toBe("generic")
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("A11 colonne absente (42703 et PGRST204) : unavailable, aucune écriture ; lecture tolérante available:false", async () => {
    for (const code of ["42703", "PGRST204"]) {
      const onRead = makeService({ reads: [{ data: null, error: { code, message: "boom" } }] })
      createServiceClient.mockReturnValue(onRead.client)
      const res = await declareMissionCompletion(M)
      expect(res).toEqual({ error: "Cette fonction n'est pas encore disponible.", code: "unavailable" })
      expect(onRead.writes).toEqual([])

      const onWrite = makeService({ reads: [ok(base)], update: { data: null, error: { code, message: "boom" } } })
      createServiceClient.mockReturnValue(onWrite.client)
      expect((await declareMissionCompletion(M)).code).toBe("unavailable")

      const select = vi.fn(() => ({ in: async () => ({ data: null, error: { code, message: "boom" } }) }))
      const tolerant = await readCompletionDeclared({ from: () => ({ select }) }, [M])
      expect(tolerant.available).toBe(false)
    }
  })

  it("A12 le corps de l'appel ne peut imposer ni date ni étudiant", async () => {
    expect(declareMissionCompletion.length).toBe(1)
    const { client, writes } = makeService({ reads: [ok(base)] })
    createServiceClient.mockReturnValue(client)
    await declareMissionCompletion(M, "2000-01-01T00:00:00Z", OTHER)
    expect(writes).toHaveLength(1)
    expect(Object.keys(writes[0])).toEqual(["completion_declared_at"])
    expect(Date.parse(writes[0].completion_declared_at)).toBeGreaterThan(Date.parse("2026-01-01"))
  })

  it("une erreur SQL inattendue ne fuit pas dans la réponse", async () => {
    const { client } = makeService({
      reads: [ok(base)],
      update: { data: null, error: { code: "42501", message: `La declaration de fin est reservee au serveur. ${CLIENT}` } },
    })
    createServiceClient.mockReturnValue(client)
    const res = await declareMissionCompletion(M)
    expect(res.code).toBe("generic")
    expectNoLeak(res)
  })
})

describe("garde-fous de structure", () => {
  const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8")
  const actions = read("src/lib/actions/mission-completion.actions.js")
  const core = read("src/lib/actions/mission-completion-core.js")

  it("requireRole(['student']) est la première instruction de l'action", () => {
    const body = actions.slice(actions.indexOf("export async function declareMissionCompletion"))
    const first = body.split("\n").slice(1).find((l) => l.trim() !== "")
    expect(first.trim()).toBe('const auth = await requireRole(["student"])')
  })

  it("aucun portefeuille, aucune notification, aucun e-mail dans la fondation", () => {
    for (const source of [actions, core]) {
      expect(source).not.toMatch(/callWalletRpc|wallet_|notify|sendEmail|stripe/i)
    }
  })

  it("le module de lecture est réservé au serveur et l'action est une server action", () => {
    expect(core).toMatch(/^import "server-only"/m)
    expect(actions.startsWith('"use server"')).toBe(true)
  })

  it("aucun tiret cadratin dans les textes", () => {
    const bad = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    expect(actions).not.toMatch(bad)
    expect(core).not.toMatch(bad)
  })
})
