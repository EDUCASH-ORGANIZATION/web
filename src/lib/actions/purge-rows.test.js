import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
const { purgeContactEvents, purgeClosedReports } = await import("./purge-rows")
const { ROW_BATCH, emptySummary, summaryHasNoIdentifiers } = await import("@/lib/purge/purge-rules")

const NOW = new Date("2026-10-17T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString()

/**
 * Faux client PostgREST : applique lt / gt / in, ignore `or` (enregistré). `leaky` : la lecture ignore tous les
 * filtres (simule une requête qui renverrait des lignes à tort). `beforeDelete` : hook appelé juste avant une
 * suppression (simule une écriture concurrente). `errors` : erreur par "table.opération" et numéro d'appel.
 */
function fakeService({ tables = {}, leaky = false, beforeDelete, errors = {} } = {}) {
  const log = { selects: [], deletes: [], from: [] }
  const counts = {}
  const service = {
    from(table) {
      log.from.push(table)
      const rows = tables[table]
      return {
        select(columns) {
          return builder(table, rows, "select", columns)
        },
        delete() {
          return builder(table, rows, "delete")
        },
      }
    },
  }
  function builder(table, rows, op, columns) {
    const filters = []
    const q = {
      lt: (c, v) => (filters.push({ k: "lt", c, v }), q),
      gt: (c, v) => (filters.push({ k: "gt", c, v }), q),
      in: (c, v) => (filters.push({ k: "in", c, v }), q),
      or: (v) => (filters.push({ k: "or", v }), q),
      order: () => q,
      limit: (n) => (filters.push({ k: "limit", n }), q),
      select: () => q,
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    function run() {
      const key = `${table}.${op}`
      counts[key] = (counts[key] ?? 0) + 1
      const err = errors[`${key}#${counts[key]}`] ?? errors[key]
      if (err) return { data: null, error: err }
      if (rows === undefined) return { data: null, error: { code: "42P01", message: "relation does not exist" } }
      const match = (row) =>
        filters.every((f) => {
          if (f.k === "lt") return new Date(row[f.c]).getTime() < new Date(f.v).getTime()
          if (f.k === "gt") return row[f.c] > f.v
          if (f.k === "in") return f.v.includes(row[f.c])
          return true
        })
      if (op === "select") {
        log.selects.push({ table, columns, filters })
        const limit = filters.find((f) => f.k === "limit")?.n ?? Infinity
        const picked = (leaky ? rows.slice() : rows.filter(match)).sort((a, b) => (a.id < b.id ? -1 : 1))
        return { data: picked.slice(0, limit).map((r) => ({ ...r })), error: null }
      }
      log.deletes.push({ table, filters })
      beforeDelete?.(rows)
      const gone = rows.filter(match)
      tables[table] = rows.filter((r) => !gone.includes(r))
      rows.length = 0
      rows.push(...tables[table])
      return { data: gone.map((r) => ({ id: r.id })), error: null }
    }
    return q
  }
  return { service, log, tables }
}

let errorSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  vi.useRealTimers()
})

const event = (n, days) => ({ id: uuid(n), created_at: ago(days) })
const report = (n, status, { handled = null, updated = ago(1) } = {}) => ({
  id: uuid(n),
  status,
  handled_at: handled,
  updated_at: updated,
})

describe("purgeContactEvents", () => {
  it("simulation : compte les candidats sans jamais supprimer", async () => {
    const events = [event(1, 200), event(2, 181), event(3, 10)]
    const { service, log } = fakeService({ tables: { message_contact_events: events } })
    const s = await purgeContactEvents(service, { now: NOW, mode: "dry" })
    expect(s.mode).toBe("dry")
    expect(s.categories.contact_events).toMatchObject({ examines: 2, candidats: 2, supprimes: 0, erreurs: 0 })
    expect(log.deletes).toHaveLength(0)
    expect(events).toHaveLength(3)
  })

  it("réel : supprime seulement les lignes de plus de 180 jours (bornes)", async () => {
    const events = [
      event(1, 181),
      { id: uuid(2), created_at: new Date(NOW.getTime() - 180 * DAY).toISOString() },
      { id: uuid(3), created_at: new Date(NOW.getTime() - 180 * DAY - 1).toISOString() },
      event(4, 179),
    ]
    const { service, log } = fakeService({ tables: { message_contact_events: events } })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real" })
    expect(s.categories.contact_events).toMatchObject({ candidats: 2, supprimes: 2, erreurs: 0 })
    expect(events.map((e) => e.id).sort()).toEqual([uuid(2), uuid(4)])
    expect(new Set(log.deletes.map((d) => d.table))).toEqual(new Set(["message_contact_events"]))
  })

  it("revérifie chaque ligne : une ligne récente renvoyée à tort n'est pas supprimée", async () => {
    const events = [event(1, 200), event(2, 5)]
    const { service } = fakeService({ tables: { message_contact_events: events }, leaky: true })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real" })
    expect(s.categories.contact_events).toMatchObject({ examines: 2, candidats: 1, supprimes: 1 })
    expect(events.map((e) => e.id)).toEqual([uuid(2)])
  })

  it("lots multiples : parcourt tout en simulation comme en réel", async () => {
    const total = ROW_BATCH * 2 + 3
    const make = () => Array.from({ length: total }, (_, i) => event(i + 1, 300))
    const dry = fakeService({ tables: { message_contact_events: make() } })
    const sd = await purgeContactEvents(dry.service, { now: NOW, mode: "dry" })
    expect(sd.categories.contact_events).toMatchObject({ examines: total, candidats: total, supprimes: 0 })
    expect(dry.log.selects).toHaveLength(3)

    const real = fakeService({ tables: { message_contact_events: make() } })
    const sr = await purgeContactEvents(real.service, { now: NOW, mode: "real" })
    expect(sr.categories.contact_events).toMatchObject({ examines: total, candidats: total, supprimes: total })
    expect(real.log.deletes).toHaveLength(3)
    expect(real.tables.message_contact_events).toHaveLength(0)
  })

  it("budget atteint : aucun lot n'est lancé et l'arrêt est noté", async () => {
    const { service, log } = fakeService({ tables: { message_contact_events: [event(1, 300)] } })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real", deadline: Date.now() - 1 })
    expect(log.selects).toHaveLength(0)
    expect(log.deletes).toHaveLength(0)
    expect(s.arrets).toEqual([{ categorie: "contact_events", motif: "deadline" }])
  })

  it("budget atteint entre deux lots : le premier lot est traité, pas le suivant", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const rows = Array.from({ length: ROW_BATCH + 5 }, (_, i) => event(i + 1, 300))
    const { service, log } = fakeService({
      tables: { message_contact_events: rows },
      beforeDelete: () => vi.setSystemTime(new Date(NOW.getTime() + 1000)),
    })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real", deadline: NOW.getTime() + 500 })
    expect(log.deletes).toHaveLength(1)
    expect(s.categories.contact_events.supprimes).toBe(ROW_BATCH)
    expect(s.arrets).toEqual([{ categorie: "contact_events", motif: "deadline" }])
  })

  it("table absente (42P01 ou PGRST205) : ignorée sans erreur", async () => {
    for (const code of ["42P01", "PGRST205"]) {
      const { service } = fakeService({
        tables: { message_contact_events: [] },
        errors: { "message_contact_events.select": { code, message: "missing" } },
      })
      const s = await purgeContactEvents(service, { now: NOW, mode: "real" })
      expect(s.categories.contact_events).toMatchObject({ ignores: 1, erreurs: 0 })
      expect(s.arrets).toEqual([])
    }
    const absent = fakeService({ tables: {} })
    const s = await purgeContactEvents(absent.service, { now: NOW, mode: "real" })
    expect(s.categories.contact_events).toMatchObject({ ignores: 1, erreurs: 0 })
  })

  it("erreur de base au deuxième lot : arrêt, compteur d'erreur, aucune fuite", async () => {
    const rows = Array.from({ length: ROW_BATCH + 5 }, (_, i) => event(i + 1, 300))
    const { service } = fakeService({
      tables: { message_contact_events: rows },
      errors: {
        "message_contact_events.select#2": {
          code: "XX000",
          message: `secret ${uuid(9)} +22901234567`,
          details: "chemin/secret.png",
        },
      },
    })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real" })
    expect(s.categories.contact_events).toMatchObject({ supprimes: ROW_BATCH, erreurs: 1 })
    expect(s.arrets).toEqual([{ categorie: "contact_events", motif: "error" }])
    expect(summaryHasNoIdentifiers(s)).toBe(true)
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).not.toContain("secret")
    expect(logged).not.toContain("22901234567")
    expect(logged).toContain("XX000")
  })

  it("erreur de suppression ou exception : arrêt sans lever", async () => {
    const a = fakeService({
      tables: { message_contact_events: [event(1, 300)] },
      errors: { "message_contact_events.delete": { code: "42501", message: "denied" } },
    })
    const sa = await purgeContactEvents(a.service, { now: NOW, mode: "real" })
    expect(sa.categories.contact_events).toMatchObject({ erreurs: 1, supprimes: 0 })

    const boom = {
      from: () => {
        throw new Error("boom " + uuid(1))
      },
    }
    const sb = await purgeContactEvents(boom, { now: NOW, mode: "real" })
    expect(sb.categories.contact_events.erreurs).toBe(1)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(uuid(1))
  })

  it("date de référence illisible : erreur, aucune lecture", async () => {
    const { service, log } = fakeService({ tables: { message_contact_events: [] } })
    const s = await purgeContactEvents(service, { now: "pas une date", mode: "real" })
    expect(s.categories.contact_events.erreurs).toBe(1)
    expect(log.from).toHaveLength(0)
  })

  it("complète le résumé partagé fourni", async () => {
    const shared = emptySummary("real")
    const { service } = fakeService({ tables: { message_contact_events: [event(1, 300)] } })
    const s = await purgeContactEvents(service, { now: NOW, mode: "real", summary: shared })
    expect(s).toBe(shared)
    expect(shared.categories.contact_events.supprimes).toBe(1)
  })
})

describe("purgeClosedReports", () => {
  it("simulation : compte les signalements clos expirés, jamais de suppression", async () => {
    const reports = [
      report(1, "resolved", { handled: ago(400) }),
      report(2, "dismissed", { handled: ago(400) }),
      report(3, "resolved", { handled: ago(30) }),
    ]
    const { service, log } = fakeService({ tables: { reports } })
    const s = await purgeClosedReports(service, { now: NOW, mode: "dry" })
    expect(s.categories.closed_reports).toMatchObject({ candidats: 2, supprimes: 0 })
    expect(log.deletes).toHaveLength(0)
    expect(reports).toHaveLength(3)
  })

  it("réel : repli sur updated_at quand handled_at est nul, bornes de 12 mois", async () => {
    const reports = [
      report(1, "resolved", { handled: null, updated: ago(400) }),
      report(2, "dismissed", { handled: "2025-10-16T11:59:59Z" }),
      report(3, "dismissed", { handled: "2025-10-17T12:00:00Z" }),
      report(4, "resolved", { handled: null, updated: ago(100) }),
      report(5, "resolved", { handled: ago(10), updated: ago(500) }),
    ]
    const { service, log } = fakeService({ tables: { reports } })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ candidats: 2, supprimes: 2 })
    expect(reports.map((r) => r.id).sort()).toEqual([uuid(3), uuid(4), uuid(5)])
    expect(new Set(log.deletes.map((d) => d.table))).toEqual(new Set(["reports"]))
  })

  it("le filtre de statut est dans la lecture et dans la suppression", async () => {
    const reports = [report(1, "resolved", { handled: ago(400) })]
    const { service, log } = fakeService({ tables: { reports } })
    await purgeClosedReports(service, { now: NOW, mode: "real" })
    const statusFilter = (f) => f.find((x) => x.k === "in" && x.c === "status")?.v
    expect(statusFilter(log.selects[0].filters)).toEqual(["resolved", "dismissed"])
    expect(statusFilter(log.deletes[0].filters)).toEqual(["resolved", "dismissed"])
    expect(log.deletes[0].filters.some((f) => f.k === "or")).toBe(true)
  })

  it("open et in_progress ne sont jamais supprimés, même renvoyés à tort par la requête", async () => {
    const reports = [
      report(1, "open", { handled: ago(900), updated: ago(900) }),
      report(2, "in_progress", { handled: ago(900), updated: ago(900) }),
      report(3, "resolved", { handled: ago(400) }),
    ]
    const { service } = fakeService({ tables: { reports }, leaky: true })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ examines: 3, candidats: 1, supprimes: 1 })
    expect(reports.map((r) => r.status).sort()).toEqual(["in_progress", "open"])
  })

  it("signalement rouvert entre la lecture et la suppression : non supprimé", async () => {
    const reports = [report(1, "resolved", { handled: ago(400) }), report(2, "dismissed", { handled: ago(400) })]
    const { service } = fakeService({
      tables: { reports },
      beforeDelete: (rows) => {
        rows.find((r) => r.id === uuid(1)).status = "open"
      },
    })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ candidats: 2, supprimes: 1 })
    expect(reports).toEqual([expect.objectContaining({ id: uuid(1), status: "open" })])
  })

  it("lots multiples", async () => {
    const total = ROW_BATCH + 7
    const reports = Array.from({ length: total }, (_, i) => report(i + 1, "resolved", { handled: ago(500) }))
    const { service, log } = fakeService({ tables: { reports } })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ examines: total, candidats: total, supprimes: total })
    expect(log.deletes).toHaveLength(2)
  })

  it("budget atteint : rien n'est lu", async () => {
    const { service, log } = fakeService({ tables: { reports: [] } })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real", deadline: Date.now() - 1 })
    expect(log.selects).toHaveLength(0)
    expect(s.arrets).toEqual([{ categorie: "closed_reports", motif: "deadline" }])
  })

  it("table absente : ignorée sans erreur", async () => {
    const { service } = fakeService({ tables: {} })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ ignores: 1, erreurs: 0 })
  })

  it("erreur de base : compteur d'erreur, journal sans fuite, résumé sans identifiant", async () => {
    const { service } = fakeService({
      tables: { reports: [report(1, "resolved", { handled: ago(400) })] },
      errors: { "reports.delete": { code: "XX000", message: `fuite ${uuid(1)}` } },
    })
    const s = await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(s.categories.closed_reports).toMatchObject({ erreurs: 1, supprimes: 0 })
    expect(summaryHasNoIdentifiers(s)).toBe(true)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("fuite")
  })
})

describe("liste blanche des tables", () => {
  it("seules message_contact_events et reports reçoivent un delete", async () => {
    const { service, log } = fakeService({
      tables: {
        message_contact_events: [event(1, 300)],
        reports: [report(1, "resolved", { handled: ago(400) })],
      },
    })
    await purgeContactEvents(service, { now: NOW, mode: "real" })
    await purgeClosedReports(service, { now: NOW, mode: "real" })
    expect(new Set(log.deletes.map((d) => d.table))).toEqual(new Set(["message_contact_events", "reports"]))
    expect(new Set(log.from)).toEqual(new Set(["message_contact_events", "reports"]))
  })
})
