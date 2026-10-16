import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { recordContactEvent, maybeOpenAutoReport } from "./moderation-log"

const SENDER = "00000000-0000-4000-8000-000000000001"
const MISSION = "11111111-1111-4111-8111-111111111111"
const MESSAGE = "55555555-5555-4555-8555-555555555555"

let calls
let results
let warn

// Faux client : enregistre chaque requête et renvoie le résultat prévu pour `table.op`.
function fakeClient() {
  return {
    from: (table) => {
      const q = { table, op: "select", payload: null, filters: [], limit: null }
      calls.push(q)
      const done = () => {
        const planned = results[`${table}.${q.op}`]
        if (planned instanceof Error) return Promise.reject(planned)
        return Promise.resolve(planned ?? { data: [], error: null })
      }
      const b = {
        insert: (payload) => ((q.op = "insert"), (q.payload = payload), b),
        select: () => b,
        eq: (c, v) => (q.filters.push(["eq", c, v]), b),
        gte: (c, v) => (q.filters.push(["gte", c, v]), b),
        limit: (n) => ((q.limit = n), b),
        then: (ok, ko) => done().then(ok, ko),
      }
      return b
    },
  }
}

beforeEach(() => {
  calls = []
  results = {}
  createServiceClient.mockReset()
  createServiceClient.mockImplementation(fakeClient)
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const event = (over) => ({ messageId: MESSAGE, missionId: MISSION, senderId: SENDER, kinds: ["phone"], count: 1, action: "masked", ...over })

describe("recordContactEvent", () => {
  it("écrit le type, le nombre et l'action, jamais d'autre donnée", async () => {
    expect(await recordContactEvent(event({ kinds: ["phone", "email", "phone"], count: 2 }))).toBe("ok")
    expect(calls[0].table).toBe("message_contact_events")
    expect(calls[0].payload).toEqual({
      message_id: MESSAGE,
      mission_id: MISSION,
      sender_id: SENDER,
      kinds: ["phone", "email"],
      match_count: 2,
      action: "masked",
    })
  })

  it("borne le nombre entre 1 et 50 et ignore un nombre invalide", async () => {
    await recordContactEvent(event({ count: 999 }))
    await recordContactEvent(event({ count: 0 }))
    await recordContactEvent(event({ count: Number.NaN }))
    expect(calls.map((c) => c.payload.match_count)).toEqual([50, 1, 1])
  })

  it("ne garde que les types connus et refuse une liste vide ou une action inconnue", async () => {
    expect(await recordContactEvent(event({ kinds: ["phone", "+22901970000"] }))).toBe("ok")
    expect(calls[0].payload.kinds).toEqual(["phone"])
    expect(await recordContactEvent(event({ kinds: ["+22901970000"] }))).toBe("error")
    expect(await recordContactEvent(event({ kinds: [] }))).toBe("error")
    expect(await recordContactEvent(event({ kinds: undefined }))).toBe("error")
    expect(await recordContactEvent(event({ action: "deleted" }))).toBe("error")
    expect(calls).toHaveLength(1)
  })

  for (const code of ["42P01", "PGRST205", "42703", "PGRST204"]) {
    it(`table ou colonne absente (${code}) : indisponible, avertissement court, aucun lancer`, async () => {
      results["message_contact_events.insert"] = { error: { code, message: "relation absente" } }
      expect(await recordContactEvent(event())).toBe("unavailable")
      expect(warn).toHaveBeenCalledWith("[moderation-log] journal indisponible", code)
    })
  }

  it("autre erreur de la base ou exception : error, jamais de lancer, aucun détail dans la console", async () => {
    results["message_contact_events.insert"] = { error: { code: "23514", message: "valeur 0197000000" } }
    expect(await recordContactEvent(event())).toBe("error")
    results["message_contact_events.insert"] = new Error("réseau 0197000000")
    expect(await recordContactEvent(event())).toBe("error")
    createServiceClient.mockImplementation(() => {
      throw new Error("Configuration serveur incomplète")
    })
    expect(await recordContactEvent(event())).toBe("error")
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/0197000000|réseau|Configuration/)
  })

  it("utilise le client fourni sans en créer un autre", async () => {
    const inserted = []
    const client = { from: () => ({ insert: (p) => (inserted.push(p), Promise.resolve({ error: null })) }) }
    expect(await recordContactEvent(event({ client }))).toBe("ok")
    expect(inserted).toHaveLength(1)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("maybeOpenAutoReport", () => {
  const report = (over) => ({ senderId: SENDER, missionId: MISSION, messageId: MESSAGE, ...over })
  const rows = (n) => ({ data: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })), error: null })

  it("sous le seuil : aucune alerte", async () => {
    results["message_contact_events.select"] = rows(2)
    expect(await maybeOpenAutoReport(report())).toBe("below")
    expect(calls.some((c) => c.table === "reports")).toBe(false)
  })

  it("compte les masquages de l'expéditeur sur 30 jours par une lecture GET plafonnée au seuil", async () => {
    results["message_contact_events.select"] = rows(1)
    const before = Date.now()
    await maybeOpenAutoReport(report())
    const count = calls[0]
    expect(count.op).toBe("select")
    expect(count.limit).toBe(3)
    expect(count.filters).toContainEqual(["eq", "sender_id", SENDER])
    expect(count.filters).toContainEqual(["eq", "action", "masked"])
    const since = Date.parse(count.filters.find((f) => f[1] === "created_at")[2])
    expect(before - since).toBeGreaterThanOrEqual(30 * 24 * 3600 * 1000 - 1000)
    expect(before - since).toBeLessThanOrEqual(30 * 24 * 3600 * 1000 + 5000)
  })

  it("au seuil : un signalement automatique pour contact_details", async () => {
    results["message_contact_events.select"] = rows(3)
    expect(await maybeOpenAutoReport(report())).toBe("opened")
    expect(calls.at(-1).table).toBe("reports")
    expect(calls.at(-1).payload).toEqual({
      source: "auto",
      target_type: "message",
      message_id: MESSAGE,
      mission_id: MISSION,
      reporter_id: null,
      reported_user_id: SENDER,
      reason: "contact_details",
      status: "open",
    })
  })

  it("23505 : alerte déjà ouverte, ignorée sans avertissement", async () => {
    results["message_contact_events.select"] = rows(3)
    results["reports.insert"] = { error: { code: "23505", message: "duplicate" } }
    expect(await maybeOpenAutoReport(report())).toBe("exists")
    expect(warn).not.toHaveBeenCalled()
  })

  it("journal absent : indisponible, sans lecture ni écriture de signalement", async () => {
    results["message_contact_events.select"] = { data: null, error: { code: "PGRST205", message: "absente" } }
    expect(await maybeOpenAutoReport(report())).toBe("unavailable")
    expect(calls.some((c) => c.table === "reports")).toBe(false)
    expect(warn).toHaveBeenCalledWith("[moderation-log] journal indisponible", "PGRST205")
  })

  it("signalements absents : indisponible", async () => {
    results["message_contact_events.select"] = rows(3)
    results["reports.insert"] = { error: { code: "42P01", message: "absente" } }
    expect(await maybeOpenAutoReport(report())).toBe("unavailable")
    expect(warn).toHaveBeenCalledWith("[moderation-log] signalements indisponibles", "42P01")
  })

  it("autre erreur ou exception : error, jamais de lancer", async () => {
    results["message_contact_events.select"] = { data: null, error: { code: "57014", message: "timeout" } }
    expect(await maybeOpenAutoReport(report())).toBe("error")
    results["message_contact_events.select"] = rows(3)
    results["reports.insert"] = { error: { code: "23503", message: "fk" } }
    expect(await maybeOpenAutoReport(report())).toBe("error")
    results["reports.insert"] = new Error("réseau")
    expect(await maybeOpenAutoReport(report())).toBe("error")
  })
})
