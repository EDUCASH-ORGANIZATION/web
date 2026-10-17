import { describe, it, expect, vi, beforeEach } from "vitest"

// RD-NOTIF-01 : verification independante (testeur). Abus des actions par espace, curseurs forges, liens, textes
// du catalogue et producteurs branches sur le VRAI module `notify` avec un client service role en panne.

let user
let profile
const sessionOps = []
let serviceBehaviour = "ok" // ok | throw | 42P01 | PGRST205 | other
const serviceWrites = []

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table) => {
      if (table === "profiles") {
        const p = { select: () => p, eq: () => p, maybeSingle: async () => ({ data: profile, error: null }) }
        return p
      }
      const op = { table, ops: [] }
      sessionOps.push(op)
      const b = {
        select: (...a) => { op.ops.push(["select", ...a]); return b },
        update: (v) => { op.ops.push(["update", v]); return b },
        eq: (...a) => { op.ops.push(["eq", ...a]); return b },
        is: (...a) => { op.ops.push(["is", ...a]); return b },
        or: (a) => { op.ops.push(["or", a]); return b },
        order: () => b,
        limit: (n) => { op.ops.push(["limit", n]); return b },
        then: (res, rej) => Promise.resolve({ data: [], count: 0, error: null }).then(res, rej),
      }
      return b
    },
  }
}

let roleOverride = null
vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, requireRole: (...a) => (roleOverride ? roleOverride(...a) : actual.requireRole(...a)) }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => sessionClient()) }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table) => ({
      upsert: async (rows, options) => {
        serviceWrites.push({ table, rows, options })
        if (serviceBehaviour === "throw") throw new Error("reseau coupe a@b.com 0197000000")
        if (serviceBehaviour === "42P01") return { error: { code: "42P01", message: "relation absente" } }
        if (serviceBehaviour === "PGRST205") return { error: { code: "PGRST205", message: "table absente du cache" } }
        if (serviceBehaviour === "other") return { error: { code: "XX000", message: "boom" } }
        return { error: null }
      },
    }),
  }),
}))

import * as client from "@/lib/actions/client-notifications.actions"
import * as student from "@/lib/actions/student-notifications.actions"
import * as admin from "@/lib/actions/admin-notifications.actions"
import { decodeCursor, encodeCursor, boundedPageSize, listNotifications, markRead } from "@/lib/notifications/read"
import * as catalog from "@/lib/notifications/catalog"
import { createClientReview, createStudentReview } from "@/lib/actions/review.actions"

const ID = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const M = "11111111-1111-4111-8111-111111111111"
const A = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  user = { id: "u-1", user_metadata: {} }
  profile = { role: "client", full_name: "Awa", is_suspended: false }
  sessionOps.length = 0
  serviceWrites.length = 0
  serviceBehaviour = "ok"
  roleOverride = null
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("matrice espace x role : une action ne sert que son espace", () => {
  const spaces = {
    client: client,
    student: student,
    admin: admin,
  }
  const names = {
    client: ["getClientNotifications", "getClientUnreadNotificationCount", "markClientNotificationRead", "markAllClientNotificationsRead"],
    student: ["getStudentNotifications", "getStudentUnreadNotificationCount", "markStudentNotificationRead", "markAllStudentNotificationsRead"],
    admin: ["getAdminNotifications", "getAdminUnreadNotificationCount", "markAdminNotificationRead", "markAllAdminNotificationsRead"],
  }

  for (const [space, mod] of Object.entries(spaces)) {
    for (const role of ["client", "student", "admin"]) {
      if (role === space) continue
      for (const name of names[space]) {
        it(`${name} refuse le role ${role}`, async () => {
          expect(typeof mod[name]).toBe("function")
          profile = { role, full_name: "X", is_suspended: false }
          const res = await mod[name](ID)
          expect(res).toEqual({ error: expect.any(String) })
          expect(sessionOps).toEqual([])
        })
      }
    }
    it(`${space} : un administrateur suspendu ou un role inconnu est refuse partout`, async () => {
      for (const p of [
        { role: space, full_name: "X", is_suspended: true },
        { role: "superadmin", full_name: "X", is_suspended: false },
        { role: null, full_name: "X", is_suspended: false },
      ]) {
        profile = p
        for (const name of names[space]) {
          expect(await mod[name](ID)).toEqual({ error: expect.any(String) })
        }
      }
      expect(sessionOps).toEqual([])
    })
  }
})

describe("identifiants et curseurs forges", () => {
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64url")
  const FORGED = [
    undefined, null, 12, {}, [], "", " ", "%%%", "!!!!", "not base64 at all", "A".repeat(201),
    b64("x"),
    b64(`2026-10-15T10:00:00Z|${ID}|extra`),
    b64(`2026-10-15T10:00:00Z|not-a-uuid`),
    b64(`2026-10-15T10:00:00Z)|${ID}`),
    b64(`2026-10-15T10:00:00Z,id.gt.0|${ID}`),
    b64(`2026-10-15T10:00:00Z|${ID})`),
    b64(`2026-10-15T10:00:00Z|${ID}\n`),
    b64(`' or 1=1 --|${ID}`),
    b64(`2026-13-45T25:61:61Z|${ID}`),
    b64(`0000-00-00T00:00:00Z|${ID}`),
    b64(`2026-10-15T10:00:00Z ${ID}`),
    b64(`2026-10-15T10:00:00Z\u0000|${ID}`),
  ]

  it.each(FORGED.map((c, i) => [i, c]))("curseur forge %s : page 1, aucun filtre ajoute", async (_i, cursor) => {
    expect(decodeCursor(cursor)).toBeNull()
    const ops = []
    const q = { select: () => q, eq: () => q, is: () => q, order: () => q, limit: () => q, or: (a) => { ops.push(a); return q }, then: (r) => r({ data: [], error: null }) }
    await listNotifications({ from: () => q }, "u-1", { cursor })
    expect(ops).toEqual([])
  })

  it("un curseur valide ne produit qu'un filtre compose de caracteres surs", async () => {
    const valid = encodeCursor({ created_at: "2026-10-15T10:00:00.123456+00:00", id: ID })
    const ops = []
    const q = { select: () => q, eq: () => q, is: () => q, order: () => q, limit: () => q, or: (a) => { ops.push(a); return q }, then: (r) => r({ data: [], error: null }) }
    await listNotifications({ from: () => q }, "u-1", { cursor: valid })
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatch(/^created_at\.lt\.[0-9T:.+\-Z]+,and\(created_at\.eq\.[0-9T:.+\-Z]+,id\.lt\.[0-9a-f-]{36}\)$/)
  })

  it("limite hors bornes : toujours entre 1 et 50", () => {
    for (const v of [undefined, null, NaN, "abc", -5, 0, 0.4, Infinity, -Infinity, 1e12, "1e9", {}, [], true]) {
      const n = boundedPageSize(v)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(50)
    }
    expect(boundedPageSize(7)).toBe(7)
    expect(boundedPageSize("8")).toBe(8)
  })

  it("id non uuid (casse, espaces, tableau, objet, injection) : aucune requete, succes silencieux", async () => {
    const calls = []
    const supabase = { from: (t) => { calls.push(t); throw new Error("ne doit pas etre appele") } }
    for (const bad of [undefined, null, "", ` ${ID}`, `${ID}\n`, `${ID}' or '1'='1`, [ID], { id: ID }, 7, "../../x", `${ID},read_at.is.null`]) {
      expect(await markRead(supabase, "u-1", bad)).toEqual({ ok: true })
    }
    expect(calls).toEqual([])
  })

  it("l'identifiant de l'appelant vient de la session, jamais d'un parametre", async () => {
    profile = { role: "client", full_name: "Awa", is_suspended: false }
    await client.markClientNotificationRead(ID, { userId: "autre" }, "autre")
    await client.markAllClientNotificationsRead("autre")
    const eqs = sessionOps.flatMap((o) => o.ops.filter((x) => x[0] === "eq"))
    expect(eqs.every(([, col, val]) => col !== "recipient_id" || val === "u-1")).toBe(true)
    expect(eqs.some(([, col]) => col === "recipient_id")).toBe(true)
  })

  it("appels repetes de tout marquer lu : idempotents, toujours le meme succes et filtre sur ses non lues", async () => {
    const results = []
    for (let i = 0; i < 5; i += 1) results.push(await client.markAllClientNotificationsRead())
    expect(results).toEqual(Array(5).fill({ success: true }))
    const updates = sessionOps.map((o) => o.ops)
    for (const ops of updates) {
      expect(ops).toContainEqual(["eq", "recipient_id", "u-1"])
      expect(ops).toContainEqual(["is", "read_at", null])
      const upd = ops.find((x) => x[0] === "update")[1]
      expect(Object.keys(upd)).toEqual(["read_at"])
    }
  })
})

describe("notificationHref : chemins internes seulement", () => {
  const hostile = [
    null, undefined, "", "abc", "//evil.example", "https://evil.example", "javascript:alert(1)", "../../etc",
    `${M}/../x`, `${M}?next=//evil`, `${M}#x`, `${M} `, "%2e%2e", ["x"], { toString: () => M },
  ]
  // Espaces inconnus : null. (Les noms "__proto__" et "constructor" font lever notificationHref : l'espace est une
  // constante serveur, jamais une entree utilisateur, voir le rapport de verification.)
  const spaces = ["client", "student", "admin", "autre", undefined, null]

  it("toujours un chemin interne ou null, quels que soient type, ids et espace", () => {
    for (const space of spaces) {
      for (const type of [...catalog.NOTIFICATION_TYPES, "inconnu", "__proto__", "constructor", undefined, null, 5]) {
        for (const id of hostile) {
          const href = catalog.notificationHref({ type, mission_id: id, actor_id: id }, space)
          if (href !== null) {
            expect(catalog.isInternalPath(href), `${space}/${type}/${String(id)} -> ${href}`).toBe(true)
            expect(href).not.toMatch(/evil|javascript|\.\./)
          }
        }
      }
    }
  })

  it("un type d'un autre espace n'a pas de lien (aucune redirection croisee)", () => {
    expect(catalog.notificationHref({ type: "card_submitted" }, "client")).toBeNull()
    expect(catalog.notificationHref({ type: "card_submitted" }, "student")).toBeNull()
    expect(catalog.notificationHref({ type: "application_received" }, "student")).toBeNull()
    expect(catalog.notificationHref({ type: "application_received" }, "admin")).toBeNull()
    expect(catalog.notificationHref({ type: "payment_released" }, "client")).toBeNull()
    expect(catalog.notificationHref({ type: "badge_revoked" }, "admin")).toBeNull()
  })

  it("lien de l'espace client sous /client, administrateur sous /admin", () => {
    for (const type of ["application_received", "review_received", "account_reactivated", "message_received", "completion_declared"]) {
      expect(catalog.notificationHref({ type, mission_id: M, actor_id: A }, "client")).toMatch(/^\/client(\/|\?|$)/)
    }
    for (const type of ["card_submitted", "account_reactivated"]) {
      expect(catalog.notificationHref({ type }, "admin")).toMatch(/^\/admin(\/|\?|$)/)
    }
  })

  it("achats : liens client sous /client, lien étudiant interne, aucun lien administrateur", () => {
    const clientTypes = ["purchase_requested", "purchase_updated", "purchase_cancelled", "purchase_received", "purchase_reported", "purchase_report_closed"]
    for (const type of clientTypes) {
      expect(catalog.notificationHref({ type, mission_id: M, actor_id: A }, "client")).toMatch(/^\/client(\/|\?|$)/)
      expect(catalog.notificationHref({ type, mission_id: M, actor_id: A }, "admin")).toBeNull()
    }
    for (const type of ["purchase_paid", "purchase_reported", "purchase_report_closed"]) {
      expect(catalog.isInternalPath(catalog.notificationHref({ type, mission_id: M, actor_id: A }, "student"))).toBe(true)
      expect(catalog.notificationHref({ type, mission_id: M, actor_id: A }, "admin")).toBeNull()
    }
    expect(catalog.notificationHref({ type: "purchase_paid", mission_id: M, actor_id: A }, "client")).toBeNull()
    expect(catalog.notificationHref({ type: "purchase_requested", mission_id: M, actor_id: A }, "student")).toBeNull()
  })
})

describe("catalogue : textes bornes, sans donnee personnelle, sans tiret cadratin", () => {
  const evil = {
    email: "a@b.com", phone: "+22997000000", signedUrl: "https://x.supabase.co/storage/v1/object/sign/cards/a.jpg?token=eyJ",
    cardUrl: "cards/a.jpg", reason: "texte libre admin",
  }
  const long = "é".repeat(500)
  const built = () => [
    catalog.applicationReceived({ missionId: M, missionTitle: long, studentId: A, studentName: long, ...evil }),
    catalog.applicationAccepted({ missionId: M, missionTitle: long, clientId: A, clientName: long, studentId: A, ...evil }),
    catalog.applicationRejected({ missionId: M, missionTitle: long, clientId: A, studentId: A, ...evil }),
    catalog.missionCancelled({ missionId: M, missionTitle: long, clientId: A, ...evil }),
    catalog.paymentReleased({ missionId: M, missionTitle: long, clientId: A, amount: 123456789, ...evil }),
    catalog.reviewReceived({ missionId: M, missionTitle: long, reviewerId: A, reviewerName: long, ...evil }),
    catalog.verificationApproved({ verifiedUntil: "2027-01-01", ...evil }),
    catalog.verificationRejected({ reasonLabel: "Carte illisible", fingerprint: "0123456789ab", ...evil }),
    catalog.verificationReset({ fingerprint: "0123456789ab", ...evil }),
    catalog.badgeRevoked({ at: new Date(), ...evil }),
    catalog.accountReactivated({ at: new Date(), ...evil }),
    catalog.cardSubmitted({ studentId: A, studentName: long, at: new Date(), ...evil }),
    catalog.purchaseRequested({ requestId: ID, missionId: M, missionTitle: long, studentId: A, studentName: long, version: 1, ...evil }),
    catalog.purchaseUpdated({ requestId: ID, missionId: M, missionTitle: long, studentId: A, studentName: long, version: 2, ...evil }),
    catalog.purchaseCancelled({ requestId: ID, missionId: M, missionTitle: long, studentId: A, studentName: long, version: 3, ...evil }),
    catalog.purchasePaid({ requestId: ID, missionId: M, missionTitle: long, clientId: A, clientName: long, version: 1, ...evil }),
    catalog.purchaseReceived({ requestId: ID, missionId: M, missionTitle: long, studentId: A, studentName: long, version: 1, ...evil }),
    catalog.purchaseReported({ requestId: ID, missionId: M, missionTitle: long, actorId: A, version: 1, ...evil }),
    catalog.purchaseReportClosed({ requestId: ID, missionId: M, missionTitle: long, actorId: A, version: 1, ...evil }),
  ]

  it("titre <= 120, corps <= 280, cle <= 200, valides", () => {
    for (const n of built()) {
      expect(Array.from(n.title).length).toBeLessThanOrEqual(120)
      expect(Array.from(n.body).length).toBeLessThanOrEqual(280)
      expect(n.dedupeKey.length).toBeLessThanOrEqual(200)
      expect(catalog.isValidNotification(n)).toBe(true)
    }
  })

  it("ni e-mail, ni telephone, ni URL signee, ni motif libre dans titre, corps ou cle", () => {
    for (const n of built()) {
      const all = `${n.title}|${n.body}|${n.dedupeKey}`
      expect(all).not.toMatch(/@|\+229|supabase|token=|cards\/|texte libre admin/)
    }
  })

  it("aucun tiret cadratin ni demi-cadratin, vouvoiement (pas de tutoiement)", () => {
    for (const n of built()) {
      const all = `${n.title} ${n.body}`
      expect(all).not.toMatch(/[\u2013\u2014]/)
      expect(all).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
    }
  })

  it("verification_rejected : seul le libelle fourni, jamais le champ message ou reason", () => {
    const n = catalog.verificationRejected({ reasonLabel: "Carte illisible", message: "SECRET libre", reason: "SECRET libre", fingerprint: "0123456789ab" })
    expect(n.body).toContain("carte illisible")
    expect(n.body).not.toContain("SECRET")
  })

  it("badge_revoked : texte generique, quel que soit le motif passe", () => {
    const a = catalog.badgeRevoked({ at: new Date(0), reason: "motif A" })
    const b = catalog.badgeRevoked({ at: new Date(0), reason: "motif B", message: "autre" })
    expect(a.body).toBe(b.body)
    expect(a.body).not.toMatch(/motif/i)
  })

  it("titre de mission hostile : reste du texte (le rendu React echappe), controles retires", () => {
    const n = catalog.applicationReceived({ missionId: M, missionTitle: "<script>alert(1)</script>\u0000\n'; drop table x;--", studentId: A, studentName: "Awa Dossou" })
    expect(n.body).not.toMatch(/[\u0000-\u001f]/)
    expect(catalog.isValidNotification(n)).toBe(true)
  })

  it("identifiants non uuid : mission_id et actor_id deviennent null (cle etrangere jamais violee par une entree libre)", () => {
    const n = catalog.applicationReceived({ missionId: "x'; --", missionTitle: "t", studentId: "pas-un-uuid", studentName: "A" })
    expect(n.missionId).toBeNull()
    expect(n.actorId).toBeNull()
  })

  it("noms : seul « Prenom I. » est expose", () => {
    const n = catalog.applicationReceived({ missionId: M, missionTitle: "t", studentId: A, studentName: "Jean Pierre Dossou-Yovo" })
    expect(n.body).toContain("Jean D.")
    expect(n.body).not.toContain("Dossou")
  })
})

describe("producteurs branches sur le vrai notify : le resultat metier ne depend pas de la notification", () => {
  const ME = "11111111-1111-4111-8111-1111111111aa"
  const STUDENT = "22222222-2222-4222-8222-2222222222bb"
  const MISSION = "44444444-4444-4444-8444-444444444444"

  function db() {
    const log = { inserts: 0 }
    return {
      log,
      client: {
        from: (table) => {
          const b = {
            select: () => b,
            eq: () => b,
            maybeSingle: async () => ({
              data: table === "missions"
                ? { id: MISSION, title: "Garde", status: "done", selected_student_id: STUDENT, client_id: ME }
                : null,
              error: null,
            }),
            insert: async () => { log.inserts += 1; return { error: null } },
          }
          return b
        },
      },
    }
  }

  it.each(["throw", "42P01", "PGRST205", "other"])("avis : meme resultat que si la notification reussit (%s)", async (mode) => {
    const results = {}
    for (const behaviour of ["ok", mode]) {
      serviceBehaviour = behaviour
      const d = db()
      roleOverride = async () => ({ supabase: d.client, user: { id: ME }, role: "client", profile: { full_name: "Awa Dossou" } })
      results[behaviour] = await createClientReview({ missionId: MISSION, rating: 5, comment: "Très bien" })
      expect(d.log.inserts).toBe(1)
      expect(serviceWrites.length).toBeGreaterThan(0)
      serviceWrites.length = 0
    }
    expect(results[mode]).toEqual(results.ok)
    expect(results.ok).toMatchObject({ success: true })
    roleOverride = null
  })
})
