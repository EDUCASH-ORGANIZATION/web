import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => makeService() }))

import { requireRole } from "@/lib/auth/require-role"
import { reportClientMessage, reportStudentMessage } from "./message-report.actions"

const CLIENT = "00000000-0000-4000-8000-000000000001"
const STUDENT = "22222222-2222-4222-8222-222222222221"
const OTHER = "22222222-2222-4222-8222-222222222229"
const MISSION = "11111111-1111-4111-8111-111111111111"
const MSG_TO_CLIENT = "33333333-3333-4333-8333-333333333331"
const MSG_TO_STUDENT = "33333333-3333-4333-8333-333333333332"
const MSG_TO_OTHER = "33333333-3333-4333-8333-333333333333"
const MSG_UNKNOWN = "33333333-3333-4333-8333-333333333339"

let db
let reportInserts
let reportErrors
let sessionErrors

function query(table, rows, errorFor) {
  const filters = []
  let pending = null
  const run = () => {
    const err = errorFor?.(table)
    if (err) return { data: null, error: err }
    const data = rows(table).filter((r) => filters.every(([c, v, op]) => (op === "gte" ? r[c] >= v : r[c] === v)))
    return { data, error: null }
  }
  const q = {
    select: () => q,
    eq: (c, v) => (filters.push([c, v, "eq"]), q),
    gte: (c, v) => (filters.push([c, v, "gte"]), q),
    limit: (n) => ((pending = n), q),
    maybeSingle: async () => {
      const r = run()
      return r.error ? r : { data: r.data[0] ?? null, error: null }
    },
    then: (resolve) => {
      const r = run()
      resolve(r.error ? r : { data: r.data.slice(0, pending ?? undefined), error: null })
    },
  }
  return q
}

function makeSession() {
  return {
    from: (table) => query(table, (t) => db[t] ?? [], (t) => sessionErrors[t]),
  }
}

function makeService() {
  return {
    from: (table) => {
      if (table !== "reports") throw new Error(`table inattendue ${table}`)
      const base = query(table, (t) => db[t], () => reportErrors.read)
      base.insert = (row) => {
        reportInserts.push(row)
        if (reportErrors.raceRow) db.reports.push(reportErrors.raceRow)
        const result = reportErrors.insert
          ? { data: null, error: reportErrors.insert }
          : { data: { number: 42 }, error: null }
        if (!reportErrors.insert) db.reports.push({ ...row, id: `r${db.reports.length}`, number: 42, created_at: new Date().toISOString() })
        const chain = { select: () => chain, single: async () => result }
        return chain
      }
      return base
    },
  }
}

const msg = (id, sender, receiver, type = "text") => ({ id, mission_id: MISSION, sender_id: sender, receiver_id: receiver, type })

function asRole(role, id) {
  requireRole.mockResolvedValue({ supabase: makeSession(), user: { id }, role, profile: { role } })
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  reportInserts = []
  reportErrors = {}
  sessionErrors = {}
  db = {
    messages: [
      msg(MSG_TO_CLIENT, STUDENT, CLIENT),
      msg(MSG_TO_STUDENT, CLIENT, STUDENT, "voice"),
      msg(MSG_TO_OTHER, CLIENT, OTHER),
    ],
    missions: [{ id: MISSION, client_id: CLIENT, selected_student_id: STUDENT }],
    applications: [],
    reports: [],
  }
  requireRole.mockReset()
})

const input = (messageId, extra = {}) => ({ messageId, reason: "harassment", ...extra })

describe.each([
  ["client", reportClientMessage, CLIENT, MSG_TO_CLIENT, STUDENT, MSG_TO_STUDENT],
  ["student", reportStudentMessage, STUDENT, MSG_TO_STUDENT, CLIENT, MSG_TO_CLIENT],
])("signalement côté %s", (role, action, me, received, sender, sent) => {
  it("signale un message reçu et renvoie la référence", async () => {
    asRole(role, me)
    const res = await action(input(received, { details: "  Insultes répétées  " }))
    expect(res).toEqual({ success: true, reference: "SIG-0042" })
    expect(reportInserts).toEqual([
      {
        source: "user",
        target_type: "message",
        message_id: received,
        mission_id: MISSION,
        reporter_id: me,
        reported_user_id: sender,
        reason: "harassment",
        details: "Insultes répétées",
      },
    ])
  })

  it("refuse le message qu'on a soi-même envoyé", async () => {
    asRole(role, me)
    const res = await action(input(sent))
    expect(res.error).toMatch(/pas disponible/)
    expect(reportInserts).toHaveLength(0)
  })

  it("refuse un message inconnu", async () => {
    asRole(role, me)
    expect((await action(input(MSG_UNKNOWN))).error).toMatch(/pas disponible/)
    expect(reportInserts).toHaveLength(0)
  })

  it("refuse le message d'un tiers lisible mais adressé à un autre", async () => {
    asRole(role, me)
    db.messages.push(msg("33333333-3333-4333-8333-333333333340", CLIENT, OTHER))
    const res = await action(input(role === "client" ? MSG_TO_OTHER : "33333333-3333-4333-8333-333333333340"))
    expect(res.error).toMatch(/pas disponible/)
    expect(reportInserts).toHaveLength(0)
  })

  it("refuse une mission sans lien entre les deux parties", async () => {
    asRole(role, me)
    db.missions[0].selected_student_id = null
    const res = await action(input(received))
    expect(res.error).toMatch(/pas disponible/)
    db.missions[0].selected_student_id = OTHER
    expect((await action(input(received))).error).toMatch(/pas disponible/)
    expect(reportInserts).toHaveLength(0)
  })

  it("accepte un candidat non retenu ayant une candidature", async () => {
    asRole(role, me)
    db.missions[0].selected_student_id = null
    db.applications.push({ mission_id: MISSION, student_id: STUDENT, status: "pending" })
    expect((await action(input(received))).success).toBe(true)
  })

  it("refuse une mission d'un autre client", async () => {
    asRole(role, me)
    db.missions[0].client_id = OTHER
    expect((await action(input(received))).error).toMatch(/pas disponible/)
  })

  it("refuse un identifiant, un motif ou des détails invalides", async () => {
    asRole(role, me)
    for (const bad of [
      { messageId: "pas-un-uuid", reason: "harassment" },
      { messageId: received, reason: "inconnu" },
      { messageId: received, reason: "other", details: "x".repeat(1001) },
      { messageId: received, reason: "other", details: "a\u0000b" },
      { messageId: received, reason: "other", details: "a\u001Bb" },
      null,
    ]) {
      expect((await action(bad)).error).toMatch(/pas valide/)
    }
    expect(reportInserts).toHaveLength(0)
  })

  it("masque les coordonnées du commentaire libre avant stockage", async () => {
    asRole(role, me)
    await action(input(received, { details: "Il demande de l'appeler au +229 01 97 12 34 56 ou 0197123456" }))
    expect(reportInserts[0].details).toContain("[coordonnées masquées]")
    expect(reportInserts[0].details).not.toMatch(/97 ?12 ?34 ?56|0197123456/)
  })

  it("stocke null pour un commentaire vide", async () => {
    asRole(role, me)
    await action(input(received, { details: "   " }))
    expect(reportInserts[0].details).toBeNull()
  })

  it("renvoie la référence existante sur un doublon, sans nouvelle écriture", async () => {
    asRole(role, me)
    db.reports.push({ message_id: received, reporter_id: me, number: 7, created_at: new Date().toISOString() })
    expect(await action(input(received))).toEqual({ success: true, reference: "SIG-0007" })
    expect(reportInserts).toHaveLength(0)
  })

  it("traite la violation d'unicité (course) comme un succès avec la référence existante", async () => {
    asRole(role, me)
    reportErrors.insert = { code: "23505", message: "duplicate key value violates unique constraint" }
    reportErrors.raceRow = { message_id: received, reporter_id: me, number: 9, created_at: new Date().toISOString() }
    expect(await action(input(received))).toEqual({ success: true, reference: "SIG-0009" })
  })

  it("applique le plafond de 10 signalements par 24 h", async () => {
    asRole(role, me)
    const now = new Date().toISOString()
    for (let i = 0; i < 10; i++) db.reports.push({ message_id: `m${i}`, reporter_id: me, number: i + 1, created_at: now })
    const res = await action(input(received))
    expect(res.error).toMatch(/limite de signalements/)
    expect(reportInserts).toHaveLength(0)
  })

  it("ignore les signalements de plus de 24 h pour le plafond", async () => {
    asRole(role, me)
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString()
    for (let i = 0; i < 10; i++) db.reports.push({ message_id: `m${i}`, reporter_id: me, number: i + 1, created_at: old })
    expect((await action(input(received))).success).toBe(true)
  })

  it.each([
    ["42P01", "relation \"public.reports\" does not exist"],
    ["PGRST205", "Could not find the table 'public.reports' in the schema cache"],
  ])("répond indisponible sans erreur brute si la table est absente (%s)", async (code, message) => {
    asRole(role, me)
    reportErrors.read = { code, message }
    const res = await action(input(received))
    expect(res).toEqual({ error: "Le signalement est momentanément indisponible. Veuillez réessayer plus tard." })
  })

  it("répond indisponible si seule l'écriture signale la table absente", async () => {
    asRole(role, me)
    reportErrors.insert = { code: "42P01", message: "relation does not exist" }
    expect((await action(input(received))).error).toMatch(/momentanément indisponible/)
  })

  it("ne divulgue pas le détail d'une erreur de base", async () => {
    asRole(role, me)
    reportErrors.insert = { code: "XX000", message: "secret interne de la base" }
    const res = await action(input(received))
    expect(res.error).toMatch(/n'a pas pu être envoyé/)
    expect(JSON.stringify(res)).not.toMatch(/secret/)
  })

  it("répond par une erreur neutre si la lecture du message échoue", async () => {
    asRole(role, me)
    sessionErrors.messages = { message: "boom interne" }
    const res = await action(input(received))
    expect(res.error).toMatch(/n'a pas pu être envoyé/)
    expect(JSON.stringify(res)).not.toMatch(/boom/)
  })

  it("propage le refus de requireRole sans rien lire", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect((await action(input(received))).error).toMatch(/droits/)
    expect(reportInserts).toHaveLength(0)
  })
})

describe("rôle", () => {
  it("demande le rôle client ou étudiant selon l'action", async () => {
    requireRole.mockResolvedValue({ error: "non" })
    await reportClientMessage(input(MSG_TO_CLIENT))
    await reportStudentMessage(input(MSG_TO_STUDENT))
    expect(requireRole.mock.calls).toEqual([[["client"]], [["student"]]])
  })
})
