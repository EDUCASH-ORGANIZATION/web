import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(async () => ({ ok: true })) }))

import { notify } from "@/lib/notifications/notify"
import { NOTIFICATION_TYPES, isValidNotification } from "@/lib/notifications/catalog"
import { notifyPurchaseEvent } from "./purchase-notify"
import { IDS } from "@/lib/actions/purchase-fake-db.test-support"

const { client: CLIENT, student: STUDENT, mission: MISSION, request: REQ } = IDS
const request = { id: REQ, mission_id: MISSION, student_id: STUDENT, client_id: CLIENT }
const mission = { id: MISSION, title: "Courses au marché" }

beforeEach(() => {
  notify.mockClear()
  notify.mockResolvedValue({ ok: true })
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
