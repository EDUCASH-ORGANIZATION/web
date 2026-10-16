import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"

vi.mock("server-only", () => ({}))

import { readAcceptedAt, isMissingAcceptedColumn, validAcceptedAt } from "./application-accepted-core"

const A = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const B = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"

function makeSupabase(resolver) {
  const inFn = vi.fn(async (_col, ids) => resolver(ids))
  const select = vi.fn(() => ({ in: inFn }))
  const from = vi.fn(() => ({ select }))
  return { client: { from }, from, select, inFn }
}

function uuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("isMissingAcceptedColumn", () => {
  it("vrai pour 42703 et PGRST204 seulement", () => {
    expect(isMissingAcceptedColumn({ code: "42703" })).toBe(true)
    expect(isMissingAcceptedColumn({ code: "PGRST204" })).toBe(true)
    expect(isMissingAcceptedColumn({ code: "57014" })).toBe(false)
    expect(isMissingAcceptedColumn({ message: "" })).toBe(false)
    expect(isMissingAcceptedColumn(null)).toBe(false)
    expect(isMissingAcceptedColumn(undefined)).toBe(false)
  })
})

describe("readAcceptedAt", () => {
  it("lit id et date en une requête et renvoie une Map", async () => {
    const { client, from, select, inFn } = makeSupabase(() => ({
      data: [
        { id: A, accepted_at: "2026-10-14T09:30:00+00:00" },
        { id: B, accepted_at: null },
      ],
      error: null,
    }))
    const res = await readAcceptedAt(client, [A, B, A])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith("applications")
    expect(select).toHaveBeenCalledWith("id, accepted_at")
    expect(inFn).toHaveBeenCalledWith("id", [A, B])
    expect(res.available).toBe(true)
    expect(res.byId.get(A)).toBe("2026-10-14T09:30:00+00:00")
    expect(res.byId.get(B)).toBeNull()
  })

  it("ids vides, absents ou non uuid : aucune requête", async () => {
    const { client, from } = makeSupabase(() => ({ data: [], error: null }))
    expect(await readAcceptedAt(client, [])).toEqual({ available: true, byId: new Map() })
    expect(await readAcceptedAt(client, undefined)).toEqual({ available: true, byId: new Map() })
    expect(await readAcceptedAt(client, ["x", "1 or 1=1", null, 3])).toEqual({ available: true, byId: new Map() })
    expect(from).not.toHaveBeenCalled()
  })

  it("42703 et PGRST204 : colonne absente, aucune exception, byId vide, journal par code seulement", async () => {
    for (const code of ["42703", "PGRST204"]) {
      const { client } = makeSupabase(() => ({ data: null, error: { code, message: "column applications.accepted_at does not exist" } }))
      const res = await readAcceptedAt(client, [A])
      expect(res.available).toBe(false)
      expect(res.byId.size).toBe(0)
      expect(console.error).toHaveBeenCalledWith("[accepted] colonne accepted_at absente", code)
    }
  })

  it("toute autre erreur est levée", async () => {
    const boom = { code: "57014", message: "timeout" }
    const { client } = makeSupabase(() => ({ data: null, error: boom }))
    await expect(readAcceptedAt(client, [A])).rejects.toBe(boom)
    const noCode = { message: "" }
    const second = makeSupabase(() => ({ data: null, error: noCode }))
    await expect(readAcceptedAt(second.client, [A])).rejects.toBe(noCode)
  })

  it("ligne manquante : absente de byId, colonne disponible", async () => {
    const { client } = makeSupabase(() => ({ data: [{ id: A, accepted_at: "2026-10-14T09:30:00Z" }], error: null }))
    const res = await readAcceptedAt(client, [A, B])
    expect(res.available).toBe(true)
    expect(res.byId.has(A)).toBe(true)
    expect(res.byId.has(B)).toBe(false)
  })

  it("data null sans erreur : byId vide", async () => {
    const { client } = makeSupabase(() => ({ data: null, error: null }))
    const res = await readAcceptedAt(client, [A])
    expect(res).toEqual({ available: true, byId: new Map() })
  })

  it("250 ids : 3 lots de 100, 100 et 50", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => uuid(i + 1))
    const { client, inFn } = makeSupabase((batch) => ({
      data: batch.map((id) => ({ id, accepted_at: "2026-10-14T09:30:00Z" })),
      error: null,
    }))
    const res = await readAcceptedAt(client, ids)
    expect(inFn).toHaveBeenCalledTimes(3)
    expect(inFn.mock.calls.map((c) => c[1].length)).toEqual([100, 100, 50])
    expect(res.byId.size).toBe(250)
  })

  it("colonne absente détectée sur un lot suivant : available false et byId vide", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => uuid(i + 1))
    let call = 0
    const { client } = makeSupabase((batch) => {
      call += 1
      return call === 1
        ? { data: batch.map((id) => ({ id, accepted_at: null })), error: null }
        : { data: null, error: { code: "42703" } }
    })
    const res = await readAcceptedAt(client, ids)
    expect(res).toEqual({ available: false, byId: new Map() })
  })

  it("aucune requête head et aucun select joker dans le module", () => {
    const src = readFileSync(new URL("./application-accepted-core.js", import.meta.url), "utf8")
    expect(src).not.toMatch(/head\s*:\s*true/)
    expect(src).not.toContain('"*"')
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})

describe("validAcceptedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renvoie la chaîne pour une date ISO valide passée", () => {
    expect(validAcceptedAt("2026-10-14T09:30:00+00:00")).toBe("2026-10-14T09:30:00+00:00")
    expect(validAcceptedAt("2026-10-16T11:59:00.123Z")).toBe("2026-10-16T11:59:00.123Z")
  })

  it("tolère quelques minutes d'avance, refuse le futur au-delà", () => {
    expect(validAcceptedAt("2026-10-16T12:03:00Z")).toBe("2026-10-16T12:03:00Z")
    expect(validAcceptedAt("2026-10-16T12:10:00Z")).toBeNull()
    expect(validAcceptedAt("2027-01-01T00:00:00Z")).toBeNull()
  })

  it("null pour null, undefined, chaîne vide, espaces, nombre, objet et texte invalide", () => {
    for (const v of [null, undefined, "", "   ", 0, 1760000000000, {}, [], true, "pas une date", "2026-13-45T99:00:00Z"]) {
      expect(validAcceptedAt(v)).toBeNull()
    }
  })

  it("ne lève jamais, même pour un objet piégé", () => {
    const trap = { toString() { throw new Error("boom") } }
    expect(() => validAcceptedAt(trap)).not.toThrow()
    expect(validAcceptedAt(trap)).toBeNull()
  })
})
