import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { readCompletionDeclared, isMissingCompletionColumn } from "./mission-completion-core"

const A = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const B = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"

function makeSupabase(result) {
  const inFn = vi.fn(async () => result)
  const select = vi.fn(() => ({ in: inFn }))
  const from = vi.fn(() => ({ select }))
  return { client: { from }, from, select, inFn }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("readCompletionDeclared", () => {
  it("lit id et date en une seule requête et renvoie une Map", async () => {
    const { client, from, select, inFn } = makeSupabase({
      data: [
        { id: A, completion_declared_at: "2026-10-14T09:30:00+00:00" },
        { id: B, completion_declared_at: null },
      ],
      error: null,
    })
    const res = await readCompletionDeclared(client, [A, B, A])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith("missions")
    expect(select).toHaveBeenCalledWith("id, completion_declared_at")
    expect(inFn).toHaveBeenCalledWith("id", [A, B])
    expect(res.available).toBe(true)
    expect(res.byId.get(A)).toBe("2026-10-14T09:30:00+00:00")
    expect(res.byId.get(B)).toBeNull()
  })

  it("ignore les identifiants non uuid et ne requête pas sans identifiant valide", async () => {
    const { client, from } = makeSupabase({ data: [], error: null })
    const res = await readCompletionDeclared(client, ["x", "1 or 1=1", null, 3])
    expect(from).not.toHaveBeenCalled()
    expect(res).toEqual({ available: true, byId: new Map() })
    expect((await readCompletionDeclared(client, undefined)).available).toBe(true)
  })

  it("42703 et PGRST204 : colonne absente, aucune erreur, byId vide", async () => {
    for (const code of ["42703", "PGRST204"]) {
      const { client } = makeSupabase({ data: null, error: { code, message: "column missions.completion_declared_at does not exist" } })
      const res = await readCompletionDeclared(client, [A])
      expect(res.available).toBe(false)
      expect(res.byId.size).toBe(0)
    }
    expect(console.error).toHaveBeenCalledWith("[completion] colonne completion_declared_at absente", "42703")
  })

  it("toute autre erreur est levée", async () => {
    const boom = { code: "57014", message: "timeout" }
    const { client } = makeSupabase({ data: null, error: boom })
    await expect(readCompletionDeclared(client, [A])).rejects.toBe(boom)
  })
})

describe("isMissingCompletionColumn", () => {
  it("reconnaît seulement les deux codes de colonne absente", () => {
    expect(isMissingCompletionColumn({ code: "42703" })).toBe(true)
    expect(isMissingCompletionColumn({ code: "PGRST204" })).toBe(true)
    expect(isMissingCompletionColumn({ code: "42P01" })).toBe(false)
    expect(isMissingCompletionColumn(null)).toBe(false)
    expect(isMissingCompletionColumn(undefined)).toBe(false)
  })
})
