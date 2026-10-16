import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
const requireRole = vi.fn()
const createServiceClient = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

const { listAdminReports, getAdminReport, takeReport, resolveReport, dismissReport, countOpenAdminReports } =
  await import("./admin-reports.actions")

const ADMIN = { user: { id: "00000000-0000-4000-8000-0000000000aa" }, role: "admin", profile: { full_name: "Awa Admin" } }
const DENIED = { error: "Vous n'avez pas les droits pour effectuer cette action." }
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const R1 = "20000000-0000-4000-8000-000000000001"
const R2 = "20000000-0000-4000-8000-000000000002"
const R3 = "20000000-0000-4000-8000-000000000003"
const RAUTO = "20000000-0000-4000-8000-000000000004"
const MISSION = "10000000-0000-4000-8000-000000000001"
const MSG_TEXT = "30000000-0000-4000-8000-000000000001"
const MSG_IMG = "30000000-0000-4000-8000-000000000002"
const MSG_LOC = "30000000-0000-4000-8000-000000000003"
const SENDER = uid(2)
const REPORTER = uid(1)

const state = {}

function resetState() {
  state.reports = [
    { id: R1, number: 1, source: "user", target_type: "message", message_id: MSG_TEXT, mission_id: MISSION, reporter_id: REPORTER, reported_user_id: SENDER, reason: "scam", status: "open", handled_by: null, handled_at: null, created_at: "2026-10-10T08:00:00Z", details: "Il demande de l'argent", resolution_note: null, updated_at: "2026-10-10T08:00:00Z" },
    { id: R2, number: 2, source: "user", target_type: "message", message_id: MSG_IMG, mission_id: MISSION, reporter_id: REPORTER, reported_user_id: SENDER, reason: "inappropriate", status: "in_progress", handled_by: ADMIN.user.id, handled_at: "2026-10-11T08:00:00Z", created_at: "2026-10-11T08:00:00Z", details: null, resolution_note: null, updated_at: "2026-10-11T08:00:00Z" },
    { id: R3, number: 3, source: "user", target_type: "message", message_id: MSG_TEXT, mission_id: MISSION, reporter_id: uid(9), reported_user_id: SENDER, reason: "other", status: "resolved", handled_by: ADMIN.user.id, handled_at: "2026-10-12T08:00:00Z", created_at: "2026-10-12T08:00:00Z", details: null, resolution_note: "Traité", updated_at: "2026-10-12T08:00:00Z" },
    { id: RAUTO, number: 4, source: "auto", target_type: "message", message_id: null, mission_id: MISSION, reporter_id: null, reported_user_id: SENDER, reason: "contact_details", status: "open", handled_by: null, handled_at: null, created_at: "2026-10-13T08:00:00Z", details: null, resolution_note: null, updated_at: "2026-10-13T08:00:00Z" },
  ]
  state.messages = [
    { id: MSG_TEXT, sender_id: SENDER, receiver_id: REPORTER, type: "text", content: "Appelez-moi au [coordonnées masquées]", media_url: null, created_at: "2026-10-09T08:00:00Z" },
    { id: MSG_IMG, sender_id: SENDER, receiver_id: REPORTER, type: "image", content: "", media_url: `${SENDER}/photo.jpg`, created_at: "2026-10-09T09:00:00Z" },
  ]
  state.profiles = [
    { user_id: REPORTER, full_name: "Koffi Client", phone: "+22901000000" },
    { user_id: SENDER, full_name: "Esther Etudiante", phone: "+22901111111" },
    { user_id: ADMIN.user.id, full_name: "Awa Admin" },
    { user_id: uid(9), full_name: "Yao Autre" },
  ]
  state.missions = [{ id: MISSION, title: "Aide au déménagement" }]
  state.events = [
    { sender_id: SENDER, kinds: ["phone"], action: "masked", created_at: new Date().toISOString() },
    { sender_id: SENDER, kinds: ["phone", "link"], action: "masked", created_at: new Date().toISOString() },
    { sender_id: SENDER, kinds: ["contact_keyword"], action: "flagged", created_at: new Date().toISOString() },
    { sender_id: SENDER, kinds: ["email"], action: "masked", created_at: "2020-01-01T00:00:00Z" },
    { sender_id: uid(9), kinds: ["email"], action: "masked", created_at: new Date().toISOString() },
  ]
  state.missing = new Set()
  state.queries = []
  state.signFails = false
  state.raceLost = false
}

const TABLES = { reports: "reports", messages: "messages", profiles: "profiles", missions: "missions", message_contact_events: "events" }

function missingError() {
  return { code: "PGRST205", message: "Could not find the table 'public.reports' in the schema cache" }
}

function makeService() {
  return {
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path, ttl) => {
          state.queries.push({ table: `storage:${bucket}`, path, ttl })
          return state.signFails ? { data: null, error: { message: "x" } } : { data: { signedUrl: `https://signed.test/${path}?t=1` }, error: null }
        },
      }),
    },
    from(table) {
      const q = { table, op: "select", cols: null, options: null, values: null, filters: [], order: [], range: null, limit: null }
      state.queries.push(q)
      const b = {
        select(cols, options) {
          q.cols = cols
          if (options) q.options = options
          return b
        },
        update(values) {
          q.op = "update"
          q.values = values
          return b
        },
        eq(c, v) { q.filters.push((r) => r[c] === v); return b },
        in(c, vs) { q.filters.push((r) => vs.includes(r[c])); return b },
        gte(c, v) { q.filters.push((r) => r[c] >= v); return b },
        order(c, o) { q.order.push([c, o?.ascending !== false]); return b },
        range(a, z) { q.range = [a, z]; return b },
        limit(n) { q.limit = n; return b },
        maybeSingle() { q.single = true; return b },
        then(ok, ko) { return Promise.resolve(run(q)).then(ok, ko) },
      }
      return b
    },
  }
}

function run(q) {
  const name = TABLES[q.table]
  if (state.missing.has(q.table)) return { data: null, error: missingError(), count: null }
  const rows = state[name]
  let hit = rows.filter((r) => q.filters.every((f) => f(r)))
  if (q.op === "update") {
    if (state.raceLost) return { data: [], error: null }
    for (const r of hit) Object.assign(r, q.values)
    return { data: hit.map((r) => ({ id: r.id })), error: null }
  }
  for (const [c, asc] of [...q.order].reverse()) hit = [...hit].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1))
  const total = hit.length
  if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
  if (q.limit != null) hit = hit.slice(0, q.limit)
  const project = (r) => (q.cols && q.cols !== "*" ? Object.fromEntries(q.cols.split(",").map((s) => s.trim()).map((c) => [c, r[c]])) : { ...r })
  if (q.single) return { data: hit[0] ? project(hit[0]) : null, error: null }
  return { data: hit.map(project), error: null, count: q.options?.count ? total : null }
}

beforeEach(() => {
  resetState()
  requireRole.mockReset()
  createServiceClient.mockReset()
  requireRole.mockResolvedValue(ADMIN)
  createServiceClient.mockImplementation(() => makeService())
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const ACTIONS = [
  ["listAdminReports", () => listAdminReports({})],
  ["countOpenAdminReports", () => countOpenAdminReports()],
  ["getAdminReport", () => getAdminReport(R1)],
  ["takeReport", () => takeReport(R1)],
  ["resolveReport", () => resolveReport(R2, { note: "ok" })],
  ["dismissReport", () => dismissReport(R2, { note: "ok" })],
]

describe("accès admin", () => {
  it.each(ACTIONS)("%s : refuse un non admin sans ouvrir le client service ni modifier", async (_n, call) => {
    requireRole.mockResolvedValue(DENIED)
    expect(await call()).toEqual(DENIED)
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
    expect(state.reports.find((r) => r.id === R2).status).toBe("in_progress")
  })

  it.each(ACTIONS)("%s : refuse un compte suspendu", async (_n, call) => {
    requireRole.mockResolvedValue({ error: "Votre compte est suspendu." })
    expect((await call()).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("listAdminReports", () => {
  it("par défaut : à traiter, plus anciens d'abord, avec référence, motif, parties et mission", async () => {
    const res = await listAdminReports()
    expect(res.tab).toBe("a-traiter")
    expect(res.items.map((i) => i.id)).toEqual([R1, R2, RAUTO])
    expect(res.total).toBe(3)
    expect(res.items[0]).toMatchObject({
      reference: "SIG-0001",
      source: "user",
      reasonLabel: "Arnaque ou demande d'argent",
      status: "open",
      missionTitle: "Aide au déménagement",
      reporter: { id: REPORTER, name: "Koffi C." },
      reported: { id: SENDER, name: "Esther E." },
      handledBy: null,
    })
    expect(res.items[1].handledBy).toEqual({ id: ADMIN.user.id, name: "Awa A." })
    expect(res.items[2]).toMatchObject({ source: "auto", reporter: null, reference: "SIG-0004" })
  })

  it("renvoie le nombre de signalements de chaque onglet, quel que soit l'onglet affiché", async () => {
    expect((await listAdminReports()).counts).toEqual({ "a-traiter": 3, resolus: 1, classes: 0 })
    expect((await listAdminReports({ statut: "resolus" })).counts).toEqual({ "a-traiter": 3, resolus: 1, classes: 0 })
  })

  it("filtre par onglet et trie du plus récent au plus ancien", async () => {
    expect((await listAdminReports({ statut: "resolus" })).items.map((i) => i.id)).toEqual([R3])
    expect((await listAdminReports({ statut: "classes" })).items).toEqual([])
    expect((await listAdminReports({ tri: "recents" })).items.map((i) => i.id)).toEqual([RAUTO, R2, R1])
  })

  it("valeurs invalides : retombe sur les défauts sans les passer à la requête", async () => {
    const res = await listAdminReports({ statut: "open' or 1=1", tri: "x", page: "-3" })
    expect(res).toMatchObject({ tab: "a-traiter", sort: "anciens", page: 1 })
    expect(res.items).toHaveLength(3)
  })

  it("pagine par 20", async () => {
    for (let i = 10; i < 35; i++) state.reports.push({ ...state.reports[0], id: uid(500 + i), number: i, created_at: `2026-10-20T08:${String(i).padStart(2, "0")}:00Z` })
    const p1 = await listAdminReports({ page: "1" })
    const p2 = await listAdminReports({ page: ["2"] })
    expect(p1.items).toHaveLength(20)
    expect(p2.items).toHaveLength(8)
    expect(p2.total).toBe(28)
  })

  it("n'expose aucune colonne privée de profil ni select étoile", async () => {
    const res = await listAdminReports()
    expect(JSON.stringify(res)).not.toMatch(/phone|\+2290/)
    for (const q of state.queries) expect(q.cols).not.toBe("*")
    const profileCols = state.queries.filter((q) => q.table === "profiles").map((q) => q.cols)
    expect(profileCols.every((c) => c === "user_id, full_name")).toBe(true)
  })

  it.each(["PGRST205", "42P01"])("table absente (%s) : liste vide indisponible, sans erreur", async (code) => {
    state.missing.add("reports")
    createServiceClient.mockImplementation(() => {
      const s = makeService()
      const from = s.from.bind(s)
      s.from = (t) => {
        if (t !== "reports") return from(t)
        const b = { select: () => b, in: () => b, order: () => b, range: () => b, then: (ok) => Promise.resolve({ data: null, error: { code, message: "relation does not exist" } }).then(ok) }
        return b
      }
      return s
    })
    const res = await listAdminReports({})
    expect(res.error).toBeUndefined()
    expect(res).toMatchObject({ unavailable: true, items: [], total: 0 })
    expect(res.message).toMatch(/Réessayez/)
  })

  it("erreur de lecture : message neutre", async () => {
    createServiceClient.mockImplementation(() => {
      throw new Error("boom")
    })
    expect((await listAdminReports()).error).toBeTruthy()
  })
})

describe("countOpenAdminReports", () => {
  it("compte les signalements ouverts et en cours avec une sonde GET (pas head)", async () => {
    expect(await countOpenAdminReports()).toEqual({ count: 3 })
    const q = state.queries.find((x) => x.table === "reports")
    expect(q.options).toEqual({ count: "exact" })
    expect(q.options.head).toBeUndefined()
  })

  it("table absente : 0 indisponible, sans lever", async () => {
    state.missing.add("reports")
    expect(await countOpenAdminReports()).toEqual({ count: 0, unavailable: true })
  })
})

describe("getAdminReport", () => {
  it.each([[""], ["abc"], [undefined], [null], [42], ["1 or 1=1"]])("identifiant %j : introuvable sans lecture", async (id) => {
    expect(await getAdminReport(id)).toEqual({ notFound: true })
    expect(state.queries).toHaveLength(0)
  })

  it("signalement inexistant : introuvable", async () => {
    expect(await getAdminReport(uid(777))).toEqual({ notFound: true })
  })

  it("message texte : texte stocké, sans media_url ni coordonnées de profil, et journal d'audit", async () => {
    const res = await getAdminReport(R1)
    expect(res.report).toMatchObject({ id: R1, reference: "SIG-0001", details: "Il demande de l'argent", missionTitle: "Aide au déménagement" })
    expect(res.message).toMatchObject({ type: "text", text: "Appelez-moi au [coordonnées masquées]", mediaUrl: null })
    expect(res.events).toBeNull()
    expect(JSON.stringify(res)).not.toMatch(/media_url|phone|\+2290/)
    expect(console.info).toHaveBeenCalledWith("[admin-audit]", expect.stringContaining("report_viewed"))
  })

  it("image : URL signée de 300 s, jamais le chemin brut du stockage", async () => {
    const res = await getAdminReport(R2)
    expect(res.message).toMatchObject({ type: "image", text: null, mediaAvailable: true })
    expect(res.message.mediaUrl).toBe(`https://signed.test/${SENDER}/photo.jpg?t=1`)
    expect(state.queries.find((q) => q.table === "storage:message-media")).toMatchObject({ ttl: 300 })
    expect(Object.keys(res.message)).not.toContain("media_url")
  })

  it("position : coordonnées renvoyées pour les liens de carte, sans média", async () => {
    state.messages.push({ id: MSG_LOC, sender_id: SENDER, receiver_id: REPORTER, type: "location", content: "Position partagée", media_url: null, location_lat: 6.37, location_lng: 2.39, created_at: "2026-10-09T10:00:00Z" })
    state.reports[0].message_id = MSG_LOC
    const res = await getAdminReport(R1)
    expect(res.message).toMatchObject({ type: "location", text: null, mediaUrl: null, mediaAvailable: null, lat: 6.37, lng: 2.39 })
  })

  it("texte ou image : pas de coordonnées", async () => {
    expect((await getAdminReport(R1)).message).toMatchObject({ lat: null, lng: null })
  })

  it("image hors du dossier de l'expéditeur ou signature en échec : média indisponible", async () => {
    state.messages[1].media_url = `${uid(99)}/autre.jpg`
    expect((await getAdminReport(R2)).message).toMatchObject({ mediaUrl: null, mediaAvailable: false })
    state.messages[1].media_url = `${SENDER}/photo.jpg`
    state.signFails = true
    expect((await getAdminReport(R2)).message).toMatchObject({ mediaUrl: null, mediaAvailable: false })
  })

  it("message supprimé : message null, détail tout de même rendu", async () => {
    state.messages = []
    const res = await getAdminReport(R1)
    expect(res.message).toBeNull()
    expect(res.report.id).toBe(R1)
  })

  it("signalement automatique : nombre d'événements par type sur 30 jours, jamais de valeur", async () => {
    const res = await getAdminReport(RAUTO)
    expect(res.events).toEqual({ windowDays: 30, total: 3, byKind: { phone: 2, link: 1, contact_keyword: 1 } })
    expect(res.message).toBeNull()
  })

  it("journal de détection absent : événements null, sans erreur", async () => {
    state.missing.add("message_contact_events")
    const res = await getAdminReport(RAUTO)
    expect(res.error).toBeUndefined()
    expect(res.events).toBeNull()
  })

  it("table reports absente : indisponible", async () => {
    state.missing.add("reports")
    expect(await getAdminReport(R1)).toMatchObject({ unavailable: true })
  })
})

describe("transitions", () => {
  it("takeReport : open -> in_progress, pris en charge par l'admin", async () => {
    expect(await takeReport(R1)).toEqual({ success: true, status: "in_progress" })
    const row = state.reports.find((r) => r.id === R1)
    expect(row).toMatchObject({ status: "in_progress", handled_by: ADMIN.user.id })
    expect(row.handled_at).toBeTruthy()
    expect(console.info).toHaveBeenCalledWith("[admin-audit]", expect.stringContaining("report_taken"))
  })

  it("resolveReport : statut, note, handled_by, handled_at, updated_at, journal", async () => {
    expect(await resolveReport(R2, { note: "  Avertissement envoyé  " })).toEqual({ success: true, status: "resolved" })
    const row = state.reports.find((r) => r.id === R2)
    expect(row).toMatchObject({ status: "resolved", resolution_note: "Avertissement envoyé", handled_by: ADMIN.user.id })
    expect(row.updated_at).not.toBe("2026-10-11T08:00:00Z")
    expect(console.info).toHaveBeenCalledWith("[admin-audit]", expect.stringContaining("report_resolved"))
  })

  it("resolveReport : la note masquée reste sous 500 caractères (contrainte de base)", async () => {
    const note = `${"a".repeat(460)} wa.me/1 a@b.co c@d.fr e@f.io g@h.com`
    expect(note.length).toBeLessThanOrEqual(500)
    expect((await resolveReport(R2, { note })).success).toBe(true)
    const stored = state.reports.find((r) => r.id === R2).resolution_note
    expect(stored.length).toBeLessThanOrEqual(500)
    expect(stored).not.toMatch(/\[[^\]]*$/)
  })

  it("dismissReport : classé, note facultative", async () => {
    expect(await dismissReport(R2)).toEqual({ success: true, status: "dismissed" })
    expect(state.reports.find((r) => r.id === R2)).toMatchObject({ status: "dismissed", resolution_note: null })
  })

  it("la note passe par maskContacts", async () => {
    await resolveReport(R2, { note: "Il a donné le 0197000000 en privé" })
    const note = state.reports.find((r) => r.id === R2).resolution_note
    expect(note).not.toMatch(/0197000000/)
    expect(note).toContain("[coordonnées masquées]")
  })

  it("note de 500 caractères acceptée, 501 refusée sans écriture", async () => {
    expect((await resolveReport(R2, { note: "a".repeat(500) })).success).toBe(true)
    state.reports.find((r) => r.id === R2).status = "in_progress"
    const res = await dismissReport(R2, { note: "a".repeat(501) })
    expect(res.error).toMatch(/500/)
    expect(state.reports.find((r) => r.id === R2).status).toBe("in_progress")
  })

  it.each([[42], [{}], [["x"]], [true]])("note non texte %j refusée", async (note) => {
    expect((await resolveReport(R2, { note })).error).toBeTruthy()
    expect(state.reports.find((r) => r.id === R2).status).toBe("in_progress")
  })

  it("double clôture refusée, la première décision est conservée", async () => {
    expect((await resolveReport(R2, { note: "Première" })).success).toBe(true)
    expect((await dismissReport(R2, { note: "Seconde" })).error).toBeTruthy()
    expect((await resolveReport(R2, { note: "Seconde" })).error).toBeTruthy()
    expect(state.reports.find((r) => r.id === R2)).toMatchObject({ status: "resolved", resolution_note: "Première" })
  })

  it("transitions invalides : clôture d'un signalement non pris en charge, prise en charge répétée", async () => {
    expect((await resolveReport(R1, { note: "x" })).error).toBeTruthy()
    expect((await dismissReport(RAUTO, {})).error).toBeTruthy()
    expect((await takeReport(R2)).error).toBeTruthy()
    expect((await takeReport(R3)).error).toBeTruthy()
    expect(state.reports.find((r) => r.id === R1).status).toBe("open")
  })

  it("course perdue (statut changé entre lecture et écriture) : refus", async () => {
    state.raceLost = true
    expect((await resolveReport(R2, { note: "x" })).error).toBeTruthy()
  })

  it.each([takeReport, resolveReport, dismissReport])("signalement inexistant ou identifiant invalide : erreur neutre", async (fn) => {
    expect((await fn(uid(777), { note: "x" })).error).toMatch(/introuvable/)
    const before = state.queries.length
    expect((await fn("not-a-uuid", { note: "x" })).error).toMatch(/introuvable/)
    expect(state.queries).toHaveLength(before)
  })

  it("table absente : indisponible, aucune levée", async () => {
    state.missing.add("reports")
    expect(await takeReport(R1)).toMatchObject({ unavailable: true })
  })

  it("ne touche jamais au compte de l'utilisateur signalé (pas de suspension automatique)", async () => {
    await takeReport(R1)
    await resolveReport(R1, { note: "x" })
    const tables = state.queries.filter((q) => q.op === "update").map((q) => q.table)
    expect(new Set(tables)).toEqual(new Set(["reports"]))
  })
})
