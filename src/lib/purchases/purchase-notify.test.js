import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(async () => ({ ok: true })) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/email/index", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }))

import { notify } from "@/lib/notifications/notify"
import { createServiceClient } from "@/lib/supabase/service"
import { sendEmail } from "@/lib/email/index"
import { NOTIFICATION_TYPES, isValidNotification } from "@/lib/notifications/catalog"
import { notifyPurchaseEvent } from "./purchase-notify"
import { IDS } from "@/lib/actions/purchase-fake-db.test-support"

const { client: CLIENT, student: STUDENT, mission: MISSION, request: REQ } = IDS
const request = { id: REQ, mission_id: MISSION, student_id: STUDENT, client_id: CLIENT }
const mission = { id: MISSION, title: "Courses au marché" }

// Service role factice : table `notifications` (marqueur d'idempotence) et adresses de `auth.admin`.
const EMAILS = { [CLIENT]: "client@exemple.bj", [STUDENT]: "etudiant@exemple.bj" }
let existing
let lookupError
let getUserById

function fakeService() {
  return {
    from: vi.fn(() => {
      const filters = {}
      const query = {
        select: () => query,
        eq: (column, value) => {
          filters[column] = value
          return query
        },
        limit: async () => {
          if (lookupError) return { data: null, error: lookupError }
          const rows = existing.filter((r) => r.recipient_id === filters.recipient_id && r.dedupe_key === filters.dedupe_key)
          return { data: rows, error: null }
        },
      }
      return query
    }),
    auth: { admin: { getUserById } },
  }
}

beforeEach(() => {
  notify.mockClear()
  notify.mockResolvedValue({ ok: true })
  existing = []
  lookupError = null
  getUserById = vi.fn(async (id) => ({ data: { user: { email: EMAILS[id] } } }))
  createServiceClient.mockReset()
  createServiceClient.mockImplementation(fakeService)
  sendEmail.mockReset()
  sendEmail.mockResolvedValue({ success: true })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const send = (event, actorId, extra = {}) =>
  notifyPurchaseEvent({ event, request, mission, actorId, actorName: actorId === STUDENT ? "Ulrich Dossou" : "Awa Sossou", version: 1, ...extra })

describe("notifyPurchaseEvent", () => {
  it("destinataire = l'autre partie, type du catalogue, clé d'idempotence purchase:<id>:<événement>:<version>", async () => {
    const cases = [
      ["requested", STUDENT, CLIENT, "purchase_requested"],
      ["updated", STUDENT, CLIENT, "purchase_updated"],
      ["cancelled", STUDENT, CLIENT, "purchase_cancelled"],
      ["received", STUDENT, CLIENT, "purchase_received"],
      ["paid", CLIENT, STUDENT, "purchase_paid"],
      ["reported", STUDENT, CLIENT, "purchase_reported"],
      ["reported", CLIENT, STUDENT, "purchase_reported"],
    ]
    for (const [event, actor, recipient, type] of cases) {
      notify.mockClear()
      expect(await send(event, actor, { version: 3 })).toEqual({ ok: true })
      const call = notify.mock.calls[0][0]
      expect(call).toMatchObject({ recipientId: recipient, type, missionId: MISSION, dedupeKey: `purchase:${REQ}:${event}:3` })
      expect(NOTIFICATION_TYPES).toContain(call.type)
      expect(isValidNotification(call)).toBe(true)
    }
  })

  it("le texte ne contient ni numéro, ni vendeur, ni montant, ni tutoiement, ni tiret cadratin", async () => {
    for (const [event, actor] of [["requested", STUDENT], ["paid", CLIENT], ["reported", CLIENT], ["updated", STUDENT]]) {
      notify.mockClear()
      await send(event, actor)
      const { title, body } = notify.mock.calls[0][0]
      expect(`${title} ${body}`).not.toMatch(/\d{4,}|FCFA/)
      expect(`${title} ${body}`).not.toContain(String.fromCharCode(0x2014))
    }
  })

  it("jamais de destinataire autre que l'autre partie : aucune notification aux administrateurs", async () => {
    await send("requested", STUDENT)
    await send("paid", CLIENT)
    await send("reported", CLIENT)
    expect(notify.mock.calls.map(([n]) => n.recipientId).every((id) => [CLIENT, STUDENT].includes(id))).toBe(true)
    expect(notify.mock.calls.map(([n]) => n.recipientId)).not.toContain(IDS.admin)
  })

  it("refuse un acteur tiers, un événement inconnu et un acteur du mauvais rôle", async () => {
    expect(await send("paid", STUDENT)).toEqual({ ok: false })
    expect(await send("requested", CLIENT)).toEqual({ ok: false })
    expect(await send("updated", IDS.otherStudent)).toEqual({ ok: false })
    expect(await send("report_closed", STUDENT)).toEqual({ ok: false })
    expect(await send("requested", "pas-un-uuid")).toEqual({ ok: false })
    expect(await notifyPurchaseEvent()).toEqual({ ok: false })
    expect(await notifyPurchaseEvent({ event: "requested", request: { ...request, id: "x" }, mission, actorId: STUDENT })).toEqual({ ok: false })
    expect(notify).not.toHaveBeenCalled()
  })

  it("ne lève jamais : échec du service de notification ou exception", async () => {
    notify.mockResolvedValueOnce({ ok: false })
    expect(await send("requested", STUDENT)).toEqual({ ok: false })
    notify.mockRejectedValueOnce(Object.assign(new Error("boom secret"), { code: "XX000" }))
    expect(await send("requested", STUDENT)).toEqual({ ok: false })
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/secret/)
  })

  it("une version invalide retombe sur 1", async () => {
    await send("updated", STUDENT, { version: 0 })
    expect(notify.mock.calls[0][0].dedupeKey).toBe(`purchase:${REQ}:updated:1`)
  })
})

// E-mails (ST-17)
describe("notifyPurchaseEvent : e-mails", () => {
  it("demande : e-mail au client avec le gabarit purchase-requested, sans donnée du vendeur", async () => {
    await send("requested", STUDENT)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [template, to, data] = sendEmail.mock.calls[0]
    expect(template).toBe("purchase-requested")
    expect(to).toBe(EMAILS[CLIENT])
    expect(data).toEqual({ recipient: "client", missionTitle: "Courses au marché", missionId: MISSION, studentId: STUDENT, requestId: REQ })
  })

  it("paiement indiqué : e-mail à l'étudiant avec le gabarit purchase-paid", async () => {
    await send("paid", CLIENT)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toBe("purchase-paid")
    expect(sendEmail.mock.calls[0][1]).toBe(EMAILS[STUDENT])
  })

  it("signalement : e-mail à l'autre partie seulement, avec son rôle", async () => {
    await send("reported", STUDENT)
    await send("reported", CLIENT, { version: 2 })
    expect(sendEmail.mock.calls.map(([t, to, d]) => [t, to, d.recipient])).toEqual([
      ["purchase-reported", EMAILS[CLIENT], "client"],
      ["purchase-reported", EMAILS[STUDENT], "student"],
    ])
  })

  it("aucun e-mail pour modification, annulation ni réception", async () => {
    await send("updated", STUDENT)
    await send("cancelled", STUDENT)
    await send("received", STUDENT)
    expect(notify).toHaveBeenCalledTimes(3)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("idempotence : une notification déjà écrite pour cet événement ne renvoie aucun e-mail", async () => {
    existing = [{ recipient_id: CLIENT, dedupe_key: `purchase:${REQ}:requested:1` }]
    expect(await send("requested", STUDENT)).toEqual({ ok: true })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("idempotence : une autre version du même événement est un nouvel événement", async () => {
    existing = [{ recipient_id: CLIENT, dedupe_key: `purchase:${REQ}:reported:1` }]
    await send("reported", STUDENT, { version: 2 })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("la clé est lue pour le bon destinataire : la notification de l'autre partie ne bloque pas l'e-mail", async () => {
    existing = [{ recipient_id: STUDENT, dedupe_key: `purchase:${REQ}:reported:1` }]
    await send("reported", STUDENT)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("notification non écrite : aucun e-mail (un rejeu enverra l'e-mail une seule fois)", async () => {
    notify.mockResolvedValueOnce({ ok: false })
    expect(await send("requested", STUDENT)).toEqual({ ok: false })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("lecture d'idempotence en échec ou service indisponible : notification conservée, aucun e-mail", async () => {
    lookupError = { code: "XX000", message: "boom client@exemple.bj" }
    expect(await send("requested", STUDENT)).toEqual({ ok: true })
    lookupError = null
    createServiceClient.mockImplementation(() => {
      throw new Error("config manquante")
    })
    expect(await send("paid", CLIENT)).toEqual({ ok: true })
    expect(notify).toHaveBeenCalledTimes(2)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/exemple\.bj|config manquante/)
  })

  it("destinataire sans adresse : aucun envoi, aucune exception", async () => {
    getUserById = vi.fn(async () => ({ data: { user: {} } }))
    expect(await send("requested", STUDENT)).toEqual({ ok: true })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("échec d'envoi (403 Resend, exception) : le résultat et la notification ne changent pas, rien de privé journalisé", async () => {
    sendEmail.mockResolvedValueOnce({ error: "domain not verified for client@exemple.bj" })
    expect(await send("requested", STUDENT)).toEqual({ ok: true })
    sendEmail.mockRejectedValueOnce(Object.assign(new Error("boom client@exemple.bj"), { code: "XX000" }))
    expect(await send("paid", CLIENT)).toEqual({ ok: true })
    getUserById = vi.fn(async () => {
      throw new Error("auth indisponible client@exemple.bj")
    })
    expect(await send("reported", STUDENT)).toEqual({ ok: true })
    expect(notify).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/exemple\.bj|domain not verified|boom|indisponible/)
  })

  it("titre de mission tronqué dans l'e-mail", async () => {
    await send("requested", STUDENT, { mission: { id: MISSION, title: "T".repeat(300) } })
    expect(sendEmail.mock.calls[0][2].missionTitle).toHaveLength(80)
  })

  it("acteur refusé : ni notification ni e-mail ni lecture", async () => {
    await send("paid", STUDENT)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
