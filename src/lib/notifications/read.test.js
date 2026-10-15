import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import {
  listNotifications,
  countUnread,
  markRead,
  markAllRead,
  boundedPageSize,
  encodeCursor,
  decodeCursor,
} from "./read"

const ID = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const OTHER = "1c9f2d2e-3d2c-4c64-8b63-0e7c7b7a4b21"
const TS = "2026-10-15T10:00:00.123456+00:00"

let result
let query
function client() {
  query = { table: null, ops: [] }
  const chain = {
    select: (...a) => { query.ops.push(["select", ...a]); return chain },
    update: (v) => { query.ops.push(["update", v]); return chain },
    eq: (...a) => { query.ops.push(["eq", ...a]); return chain },
    is: (...a) => { query.ops.push(["is", ...a]); return chain },
    or: (a) => { query.ops.push(["or", a]); return chain },
    order: (...a) => { query.ops.push(["order", ...a]); return chain },
    limit: (n) => { query.ops.push(["limit", n]); return chain },
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return { from: (t) => { query.table = t; return chain } }
}
const op = (name) => query.ops.filter((o) => o[0] === name)

beforeEach(() => {
  result = { data: [], error: null, count: 0 }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("listNotifications", () => {
  it("filtre toujours sur le destinataire, colonnes listées, jamais dedupe_key", async () => {
    await listNotifications(client(), "u1")
    expect(query.table).toBe("notifications")
    expect(op("eq")).toContainEqual(["eq", "recipient_id", "u1"])
    const columns = op("select")[0][1]
    expect(columns).not.toContain("*")
    expect(columns).not.toContain("dedupe_key")
    expect(op("limit")[0][1]).toBe(21)
  })

  it("filtre Non lues : read_at null", async () => {
    await listNotifications(client(), "u1", { filter: "unread" })
    expect(op("is")).toContainEqual(["is", "read_at", null])
    await listNotifications(client(), "u1", { filter: "all" })
    expect(op("is")).toEqual([])
  })

  it("renvoie la page et le curseur suivant quand il reste des lignes", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: ID, created_at: `2026-10-1${i}T10:00:00+00:00` }))
    result = { data: rows, error: null }
    const out = await listNotifications(client(), "u1", { limit: 2 })
    expect(out.items).toHaveLength(2)
    expect(decodeCursor(out.nextCursor)).toEqual({ createdAt: rows[1].created_at, id: ID })
    result = { data: rows.slice(0, 2), error: null }
    expect((await listNotifications(client(), "u1", { limit: 2 })).nextCursor).toBeNull()
  })

  it("curseur valide : pagination par (created_at, id)", async () => {
    await listNotifications(client(), "u1", { cursor: encodeCursor({ created_at: TS, id: ID }) })
    expect(op("or")[0][1]).toBe(`created_at.lt.${TS},and(created_at.eq.${TS},id.lt.${ID})`)
  })

  it("curseur forgé ou invalide : page 1, aucune injection dans le filtre", async () => {
    const forged = [
      "n'importe quoi",
      Buffer.from("2026-10-15|x").toString("base64url"),
      Buffer.from(`${TS})%2Cid.gt.0|${ID}`).toString("base64url"),
      Buffer.from(`${TS}|${ID}|extra`).toString("base64url"),
      Buffer.from(`2026-10-15T10:00:00Z,or=(id.neq.0)|${ID}`).toString("base64url"),
      "a".repeat(500),
      42,
      null,
    ]
    for (const cursor of forged) {
      await listNotifications(client(), "u1", { cursor })
      expect(op("or"), String(cursor)).toEqual([])
    }
  })

  it("limite bornée", async () => {
    expect(boundedPageSize(undefined)).toBe(20)
    expect(boundedPageSize(0)).toBe(20)
    expect(boundedPageSize(-5)).toBe(20)
    expect(boundedPageSize("abc")).toBe(20)
    expect(boundedPageSize(1000)).toBe(50)
    expect(boundedPageSize(7.9)).toBe(7)
    await listNotifications(client(), "u1", { limit: 9999 })
    expect(op("limit")[0][1]).toBe(51)
  })

  it("table absente (42P01 ou PGRST205) : unavailable", async () => {
    for (const code of ["42P01", "PGRST205"]) {
      result = { data: null, error: { code, message: "x" } }
      expect(await listNotifications(client(), "u1")).toEqual({ unavailable: true })
    }
  })

  it("autre erreur : { error: true } sans message dans le journal", async () => {
    result = { data: null, error: { code: "XX000", message: "secret@example.com" } }
    expect(await listNotifications(client(), "u1")).toEqual({ error: true })
    expect(String(console.error.mock.calls[0])).not.toContain("@")
  })
})

describe("countUnread", () => {
  it("compte les non lues du destinataire", async () => {
    result = { count: 4, error: null }
    expect(await countUnread(client(), "u1")).toEqual({ count: 4 })
    expect(op("select")[0][2]).toEqual({ count: "exact", head: true })
    expect(op("eq")).toContainEqual(["eq", "recipient_id", "u1"])
    expect(op("is")).toContainEqual(["is", "read_at", null])
  })

  it("table absente et erreur", async () => {
    result = { count: null, error: { code: "42P01" } }
    expect(await countUnread(client(), "u1")).toEqual({ unavailable: true })
    result = { count: null, error: { code: "XX000" } }
    expect(await countUnread(client(), "u1")).toEqual({ error: true })
  })
})

describe("markRead", () => {
  it("met read_at pour sa propre notification non lue seulement", async () => {
    expect(await markRead(client(), "u1", ID)).toEqual({ ok: true })
    expect(op("update")[0][1].read_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(op("eq")).toEqual([["eq", "id", ID], ["eq", "recipient_id", "u1"]])
    expect(op("is")).toContainEqual(["is", "read_at", null])
  })

  it("identifiant non uuid : succès silencieux, aucune requête", async () => {
    const c = client()
    const from = vi.fn(c.from)
    for (const id of ["abc", "", null, undefined, 12, "1; drop table notifications"]) {
      expect(await markRead({ from }, "u1", id)).toEqual({ ok: true })
    }
    expect(from).not.toHaveBeenCalled()
  })

  it("zéro ligne touchée (id d'un autre) : même réponse que pour un succès", async () => {
    result = { data: [], error: null }
    expect(await markRead(client(), "u1", OTHER)).toEqual({ ok: true })
  })

  it("table absente et erreur", async () => {
    result = { error: { code: "PGRST205" } }
    expect(await markRead(client(), "u1", ID)).toEqual({ unavailable: true })
    result = { error: { code: "XX000" } }
    expect(await markRead(client(), "u1", ID)).toEqual({ error: true })
  })
})

describe("markAllRead", () => {
  it("ne touche que les non lues du destinataire", async () => {
    expect(await markAllRead(client(), "u1")).toEqual({ ok: true })
    expect(op("eq")).toEqual([["eq", "recipient_id", "u1"]])
    expect(op("is")).toContainEqual(["is", "read_at", null])
  })

  it("table absente et erreur", async () => {
    result = { error: { code: "42P01" } }
    expect(await markAllRead(client(), "u1")).toEqual({ unavailable: true })
    result = { error: { code: "XX000" } }
    expect(await markAllRead(client(), "u1")).toEqual({ error: true })
  })
})
