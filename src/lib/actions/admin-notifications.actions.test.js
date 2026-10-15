import { describe, it, expect, vi, beforeEach } from "vitest"

// Faux client de session : `profiles` répond au rôle ; `notifications` consigne chaque opération.
let user
let profile
let notifResult
const notifOps = []
const fromCalls = []

function client() {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table) => {
      fromCalls.push(table)
      if (table === "profiles") {
        const p = { select: () => p, eq: () => p, maybeSingle: async () => ({ data: profile, error: null }) }
        return p
      }
      const op = { table, ops: [] }
      notifOps.push(op)
      const b = {
        select: (...a) => { op.ops.push(["select", ...a]); return b },
        update: (v) => { op.ops.push(["update", v]); return b },
        eq: (...a) => { op.ops.push(["eq", ...a]); return b },
        is: (...a) => { op.ops.push(["is", ...a]); return b },
        or: (a) => { op.ops.push(["or", a]); return b },
        order: () => b,
        limit: (n) => { op.ops.push(["limit", n]); return b },
        then: (res, rej) => Promise.resolve(notifResult).then(res, rej),
      }
      return b
    },
  }
}

const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: (...a) => revalidatePath(...a) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client()) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => { throw new Error("service role interdit") } }) }))

import {
  getAdminNotifications,
  getAdminUnreadNotificationCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "./admin-notifications.actions"

const ME = "admin-1"
const ID = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const ROW = { id: ID, type: "application_accepted", title: "T", body: "B", mission_id: null, actor_id: null, read_at: null, created_at: "2026-10-15T10:00:00+00:00" }
const ok = () => ({ role: "admin", full_name: "Awa", is_suspended: false })
const opsOf = (name) => notifOps.flatMap((o) => o.ops.filter((x) => x[0] === name))

beforeEach(() => {
  user = { id: ME, user_metadata: { role: "admin" } }
  profile = ok()
  notifResult = { data: [ROW], count: 1, error: null }
  notifOps.length = 0
  fromCalls.length = 0
  revalidatePath.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("admin : lecture", () => {
  it("renvoie les notifications de l'appelant, le curseur et le compteur", async () => {
    const res = await getAdminNotifications()
    expect(res).toEqual({ items: [ROW], nextCursor: null, unreadCount: 1 })
    expect(opsOf("eq")).toContainEqual(["eq", "recipient_id", ME])
    expect(fromCalls[0]).toBe("profiles")
  })

  it("le filtre non-lues ajoute read_at is null ; toute autre valeur est ignorée", async () => {
    await getAdminNotifications({ filtre: "non-lues" })
    expect(opsOf("is").length).toBeGreaterThanOrEqual(2)
    notifOps.length = 0
    await getAdminNotifications({ filtre: "tout; drop table" })
    // seul le compteur filtre sur read_at
    expect(opsOf("is")).toHaveLength(1)
  })

  it("un curseur forgé revient à la première page", async () => {
    await getAdminNotifications({ curseur: "forgé" })
    expect(opsOf("or")).toEqual([])
  })

  it("compteur : nombre de non lues", async () => {
    notifResult = { data: null, count: 7, error: null }
    expect(await getAdminUnreadNotificationCount()).toEqual({ count: 7 })
  })

  it("table absente : erreur neutre et compteur à 0", async () => {
    notifResult = { data: null, count: null, error: { code: "42P01", message: "relation does not exist" } }
    const res = await getAdminNotifications()
    expect(res).toMatchObject({ error: expect.stringMatching(/indisponibles/), unavailable: true })
    expect(await getAdminUnreadNotificationCount()).toEqual({ count: 0, unavailable: true })
  })

  it("erreur de lecture : message vouvoyé sans détail technique", async () => {
    notifResult = { data: null, count: null, error: { code: "XX000", message: "secret interne" } }
    const res = await getAdminNotifications()
    expect(res.error).toMatch(/Réessayez/)
    expect(res.error).not.toMatch(/secret/)
  })
})

describe("admin : marquage", () => {
  it("marque sa notification : filtre id et destinataire, puis revalide la page", async () => {
    expect(await markAdminNotificationRead(ID)).toEqual({ success: true })
    expect(opsOf("eq")).toEqual([["eq", "id", ID], ["eq", "recipient_id", ME]])
    expect(opsOf("update")[0][1].read_at).toBeTruthy()
  })

  it("l'identifiant d'une autre notification donne le même succès silencieux (la base filtre sur le destinataire)", async () => {
    notifResult = { data: [], error: null }
    expect(await markAdminNotificationRead("1c9f2d2e-3d2c-4c64-8b63-0e7c7b7a4b21")).toEqual({ success: true })
    expect(opsOf("eq")).toContainEqual(["eq", "recipient_id", ME])
  })

  it("identifiant non uuid : succès sans requête sur les notifications", async () => {
    for (const id of ["abc", "", null, undefined, 3, "1' or '1'='1"]) {
      expect(await markAdminNotificationRead(id)).toEqual({ success: true })
    }
    expect(notifOps).toEqual([])
  })

  it("tout marquer : seulement les non lues de l'appelant", async () => {
    expect(await markAllAdminNotificationsRead()).toEqual({ success: true })
    expect(opsOf("eq")).toEqual([["eq", "recipient_id", ME]])
    expect(opsOf("is")).toContainEqual(["is", "read_at", null])
  })

  it("table absente ou erreur : message vouvoyé, aucune revalidation", async () => {
    notifResult = { error: { code: "PGRST205" } }
    expect(await markAdminNotificationRead(ID)).toEqual({ error: expect.stringMatching(/indisponibles/) })
    expect(await markAllAdminNotificationsRead()).toEqual({ error: expect.stringMatching(/indisponibles/) })
    notifResult = { error: { code: "XX000" } }
    expect(await markAdminNotificationRead(ID)).toEqual({ error: expect.stringMatching(/Réessayez/) })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("admin : abus", () => {
  const calls = [
    ["getAdminNotifications", () => getAdminNotifications()],
    ["getAdminUnreadNotificationCount", () => getAdminUnreadNotificationCount()],
    ["markAdminNotificationRead", () => markAdminNotificationRead(ID)],
    ["markAllAdminNotificationsRead", () => markAllAdminNotificationsRead()],
  ]

  for (const [name, call] of calls) {
    it(`${name} : refus sans session, aucune lecture des notifications`, async () => {
      user = null
      const res = await call()
      expect(res).toEqual({ error: expect.any(String) })
      expect(notifOps).toEqual([])
    })

    it(`${name} : refus d'un autre rôle, même si user_metadata prétend le rôle`, async () => {
      profile = { ...ok(), role: "student" }
      expect(await call()).toEqual({ error: expect.any(String) })
      expect(notifOps).toEqual([])
    })

    it(`${name} : refus d'un compte suspendu`, async () => {
      profile = { ...ok(), is_suspended: true }
      expect(await call()).toEqual({ error: expect.any(String) })
      expect(notifOps).toEqual([])
    })

    it(`${name} : refus sans profil`, async () => {
      profile = null
      expect(await call()).toEqual({ error: expect.any(String) })
      expect(notifOps).toEqual([])
    })
  }

  it("le profil est lu avant toute requête sur les notifications", async () => {
    await markAllAdminNotificationsRead()
    expect(fromCalls[0]).toBe("profiles")
    expect(fromCalls.indexOf("notifications")).toBeGreaterThan(0)
  })
})
