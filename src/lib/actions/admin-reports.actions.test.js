import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
const requireRole = vi.fn()
const createServiceClient = vi.fn()
const notify = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/notifications/notify", () => ({ notify: (...a) => notify(...a) }))
// Les adresses signées des preuves ne sont acceptées que sur le projet Supabase.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co"

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
  state.purchase_requests = []
  state.signFails = false
  state.raceLost = false
  state.noPurchaseColumn = false
}

const TABLES = {
  reports: "reports",
  messages: "messages",
  profiles: "profiles",
  missions: "missions",
  message_contact_events: "events",
  purchase_requests: "purchase_requests",
}

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
        createSignedUrls: async (paths, ttl) => {
          state.queries.push({ table: `storage:${bucket}`, paths, ttl })
          if (state.signFails) return { data: null, error: { message: "x" } }
          return {
            data: paths.map((path) => ({ path, signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t`, error: null })),
            error: null,
          }
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
  if (state.noPurchaseColumn && q.table === "reports" && q.cols?.includes("purchase_request_id")) {
    return { data: null, error: { code: "42703", message: "column reports.purchase_request_id does not exist" }, count: null }
  }
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
  notify.mockReset()
  notify.mockResolvedValue({ ok: true })
  requireRole.mockResolvedValue(ADMIN)
  createServiceClient.mockImplementation(() => makeService())
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const RP1 = "20000000-0000-4000-8000-000000000011"
const RP2 = "20000000-0000-4000-8000-000000000012"
const PR = "40000000-0000-4000-8000-000000000001"
const OTHER_MISSION = "10000000-0000-4000-8000-000000000002"
const CLIENT = REPORTER
const STUDENT = SENDER

// Demande d'achats signalée par le client (RP1, ouvert) et par l'étudiant (RP2, en cours), à la même version.
function addPurchaseFixture() {
  state.purchase_requests = [
    {
      id: PR, mission_id: MISSION, seq: 2, student_id: STUDENT, client_id: CLIENT, status: "reported", payee_kind: "merchant", payee_number: "123456",
      payee_photo_path: `${STUDENT}/${PR}/payee-abcdefgh1.jpg`, ticket_photo_path: `${STUDENT}/${PR}/ticket-abcdefgh2.jpg`,
      vendor_name: "Librairie Notre-Dame", items: "2 cahiers", amount: 12500, version: 2, paid_at: "2026-10-09T10:31:00Z",
      sms_photo_path: `${CLIENT}/${PR}/sms-abcdefgh3.jpg`, paid_reference: "MP2610", beneficiary_confirmed: true, received_at: null,
      cancelled_at: null, reported_at: "2026-10-10T08:00:00Z", created_at: "2026-10-09T10:12:00Z", edited_at: null,
    },
  ]
  const base = { source: "user", target_type: "purchase_request", message_id: null, purchase_request_id: PR, mission_id: MISSION, handled_by: null, handled_at: null, resolution_note: null }
  state.reports.push(
    { ...base, id: RP1, number: 11, reporter_id: CLIENT, reported_user_id: STUDENT, reason: "purchase_amount_mismatch", status: "open", created_at: "2026-10-14T08:00:00Z", details: "Le ticket dit 9 500", updated_at: "2026-10-14T08:00:00Z" },
    { ...base, id: RP2, number: 12, reporter_id: STUDENT, reported_user_id: CLIENT, reason: "other", status: "in_progress", handled_by: ADMIN.user.id, handled_at: "2026-10-15T08:00:00Z", created_at: "2026-10-15T08:00:00Z", details: "Le client conteste", updated_at: "2026-10-15T08:00:00Z" },
  )
}

const ACTIONS = [
  ["listAdminReports", () => listAdminReports({})],
  ["countOpenAdminReports", () => countOpenAdminReports()],
  ["getAdminReport", () => getAdminReport(R1)],
  ["takeReport", () => takeReport(R1)],
  ["resolveReport", () => resolveReport(R2, { note: "ok" })],
  ["dismissReport", () => dismissReport(R2, { note: "ok" })],
  ["getAdminReport (achat)", () => getAdminReport(RP1)],
  ["resolveReport (achat)", () => resolveReport(RP2, { note: "ok" })],
  ["dismissReport (achat)", () => dismissReport(RP2, { note: "ok" })],
  ["listAdminReports (filtre achats)", () => listAdminReports({ type: "demande-paiement-achats" })],
]

describe("accès admin", () => {
  it.each(ACTIONS)("%s : refuse un non admin sans ouvrir le client service ni modifier", async (_n, call) => {
    requireRole.mockResolvedValue(DENIED)
    expect(await call()).toEqual(DENIED)
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
    expect(state.reports.find((r) => r.id === R2).status).toBe("in_progress")
  })

  it.each(ACTIONS)("%s : refuse un compte suspendu", async (_n, call) => {
    requireRole.mockResolvedValue({ error: "Votre compte est suspendu." })
    expect((await call()).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
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

describe("listAdminReports : demandes de paiement d'achats", () => {
  beforeEach(addPurchaseFixture)

  it("file mixte : l'argent d'abord (demandes d'achats avant les messages), puis du plus ancien au plus récent", async () => {
    const res = await listAdminReports()
    expect(res.items.map((i) => i.id)).toEqual([RP1, RP2, R1, R2, RAUTO])
    expect(res.total).toBe(5)
    expect(res.items[0]).toMatchObject({
      reference: "SIG-0011",
      targetType: "purchase_request",
      typeLabel: "Demande de paiement d'achats",
      reasonLabel: "Montant différent du ticket",
      reporter: { id: CLIENT, name: "Koffi C." },
      reported: { id: STUDENT, name: "Esther E." },
    })
    expect(res.items[0].targetDetail).toMatch(/^N° 2 · Librairie Notre-Dame · 12\s500\sFCFA$/)
    expect(res.items[2]).toMatchObject({ targetType: "message", typeLabel: "Message", targetDetail: "" })
  })

  it("l'argent reste en tête avec le tri « plus récents d'abord »", async () => {
    const res = await listAdminReports({ tri: "recents" })
    expect(res.items.map((i) => i.id)).toEqual([RP2, RP1, RAUTO, R2, R1])
  })

  it("filtre de type : demandes d'achats seules, messages seuls, valeur inconnue ignorée", async () => {
    const purchases = await listAdminReports({ type: "demande-paiement-achats" })
    expect(purchases.type).toBe("demande-paiement-achats")
    expect(purchases.items.map((i) => i.id)).toEqual([RP1, RP2])
    expect(purchases.total).toBe(2)
    const messages = await listAdminReports({ type: ["messages"] })
    expect(messages.items.map((i) => i.id)).toEqual([R1, R2, RAUTO])
    const unknown = await listAdminReports({ type: "purchase_request' or 1=1" })
    expect(unknown.type).toBeNull()
    expect(unknown.items).toHaveLength(5)
  })

  it("le filtre se combine avec l'onglet ; les compteurs des onglets restent ceux de toute la file", async () => {
    const res = await listAdminReports({ type: "demande-paiement-achats", statut: "resolus" })
    expect(res.items).toEqual([])
    expect(res.counts).toEqual({ "a-traiter": 5, resolus: 1, classes: 0 })
  })

  it("motif d'une demande d'achats : libellé tiré des motifs d'achats, « Autre » commun aux deux familles", async () => {
    const res = await listAdminReports()
    expect(res.items.find((i) => i.id === RP1).reasonLabel).toBe("Montant différent du ticket")
    expect(res.items.find((i) => i.id === RP2).reasonLabel).toBe("Autre")
  })

  it("sans le script 94 (colonne absente) : la file des messages fonctionne telle quelle", async () => {
    state.noPurchaseColumn = true
    state.reports = state.reports.filter((r) => r.target_type === "message")
    const res = await listAdminReports()
    expect(res.error).toBeUndefined()
    expect(res.unavailable).toBeUndefined()
    expect(res.items.map((i) => i.id)).toEqual([R1, R2, RAUTO])
    const columns = state.queries.filter((q) => q.table === "reports" && q.cols).map((q) => q.cols)
    expect(columns.some((c) => c.includes("purchase_request_id"))).toBe(true)
    expect(columns.some((c) => !c.includes("purchase_request_id") && c.includes("target_type"))).toBe(true)
  })

  it("table des demandes absente : la ligne reste listée, sans résumé, sans erreur", async () => {
    state.missing.add("purchase_requests")
    const res = await listAdminReports()
    expect(res.error).toBeUndefined()
    expect(res.items.find((i) => i.id === RP1)).toMatchObject({ typeLabel: "Demande de paiement d'achats", targetDetail: "" })
  })

  it("aucune colonne de chemin de preuve ni de numéro à payer dans la liste, aucun select étoile", async () => {
    const res = await listAdminReports()
    expect(JSON.stringify(res)).not.toMatch(/photo_path|payee_number|123456|supabase\.co|signed/)
    for (const q of state.queries) expect(q.cols).not.toBe("*")
    const listed = state.queries.filter((q) => q.table === "purchase_requests").map((q) => q.cols)
    expect(listed).toEqual(["id, seq, vendor_name, amount"])
    expect(state.queries.some((q) => q.table.startsWith("storage:"))).toBe(false)
  })
})

describe("getAdminReport : demande de paiement d'achats", () => {
  beforeEach(addPurchaseFixture)

  it("renvoie la demande, ses parties, le paiement et trois preuves signées pour 120 s", async () => {
    const res = await getAdminReport(RP1)
    expect(res.error).toBeUndefined()
    expect(res.message).toBeNull()
    expect(res.report).toMatchObject({
      id: RP1,
      reference: "SIG-0011",
      targetType: "purchase_request",
      typeLabel: "Demande de paiement d'achats",
      details: "Le ticket dit 9 500",
      reasonLabel: "Montant différent du ticket",
    })
    expect(res.purchase).toMatchObject({
      id: PR,
      number: "N° 2",
      status: "reported",
      statusLabel: "Signalé",
      amount: 12500,
      vendorName: "Librairie Notre-Dame",
      items: "2 cahiers",
      payeeKindLabel: "Numéro marchand MoMo",
      payeeNumber: "123456",
      paidAt: "2026-10-09T10:31:00Z",
      paidReference: "MP2610",
      beneficiaryConfirmed: true,
      student: { id: STUDENT, name: "Esther E." },
      client: { id: CLIENT, name: "Koffi C." },
    })
    expect(res.purchase.proofs.map((p) => p.kind)).toEqual(["payee", "ticket", "sms"])
    for (const proof of res.purchase.proofs) {
      expect(proof.url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/purchase-proofs\//)
    }
    const signing = state.queries.filter((q) => q.table === "storage:purchase-proofs")
    expect(signing).toHaveLength(1)
    expect(signing[0].ttl).toBe(120)
    expect(res.report.targetDetail).toMatch(/^N° 2 · Librairie Notre-Dame · 12\s500\sFCFA$/)
  })

  it("jamais de chemin brut ni de colonne de stockage dans la réponse, ni de téléphone", async () => {
    const res = await getAdminReport(RP1)
    const keys = JSON.stringify(res, (k, v) => (k ? v : v)).match(/"[a-z_]*_path"/g)
    expect(keys).toBeNull()
    const values = res.purchase.proofs.map((p) => p.url)
    for (const raw of [`${STUDENT}/${PR}/payee-abcdefgh1.jpg`, `${STUDENT}/${PR}/ticket-abcdefgh2.jpg`, `${CLIENT}/${PR}/sms-abcdefgh3.jpg`]) {
      expect(values).not.toContain(raw)
    }
    expect(JSON.stringify(res)).not.toMatch(/phone|\+2290/)
    const profileCols = state.queries.filter((q) => q.table === "profiles").map((q) => q.cols)
    expect(profileCols.every((c) => c === "user_id, full_name")).toBe(true)
  })

  it("le détail est journalisé avec l'identifiant de la demande, sans adresse signée", async () => {
    await getAdminReport(RP1)
    const line = console.info.mock.calls.map((c) => c[1]).find((l) => l.includes("report_viewed"))
    expect(line).toContain(PR)
    expect(line).not.toMatch(/supabase\.co|token/)
  })

  it("demande non payée : pas de capture du SMS parmi les preuves", async () => {
    Object.assign(state.purchase_requests[0], { status: "pending", paid_at: null, sms_photo_path: null, paid_reference: null, beneficiary_confirmed: false })
    const res = await getAdminReport(RP1)
    expect(res.purchase.proofs.map((p) => p.kind)).toEqual(["payee", "ticket"])
  })

  it("preuve hors du dossier de son déposant, d'une autre demande ou mal formée : jamais signée, url null", async () => {
    const row = state.purchase_requests[0]
    row.payee_photo_path = `${CLIENT}/${PR}/payee-abcdefgh1.jpg`
    row.ticket_photo_path = `${STUDENT}/${PR}/../${uid(99)}/ticket-abcdefgh2.jpg`
    row.sms_photo_path = `${STUDENT}/${PR}/sms-abcdefgh3.jpg`
    const res = await getAdminReport(RP1)
    expect(res.purchase.proofs.map((p) => p.url)).toEqual([null, null, null])
    expect(state.queries.filter((q) => q.table === "storage:purchase-proofs")).toHaveLength(0)
  })

  it("une preuve manquante n'empêche pas les autres : seule sa vignette est absente", async () => {
    state.purchase_requests[0].ticket_photo_path = null
    const res = await getAdminReport(RP1)
    expect(res.purchase.proofs.map((p) => [p.kind, p.url !== null])).toEqual([["payee", true], ["ticket", false], ["sms", true]])
  })

  it("signature en échec : adresses absentes, le détail est tout de même rendu", async () => {
    state.signFails = true
    const res = await getAdminReport(RP1)
    expect(res.error).toBeUndefined()
    expect(res.purchase.proofs.map((p) => p.url)).toEqual([null, null, null])
  })

  it("demande d'une autre mission : aucune demande renvoyée, aucune preuve signée", async () => {
    state.purchase_requests[0].mission_id = OTHER_MISSION
    const res = await getAdminReport(RP1)
    expect(res.purchase).toBeNull()
    expect(res.report.id).toBe(RP1)
    expect(state.queries.some((q) => q.table.startsWith("storage:"))).toBe(false)
  })

  it("auteur du signalement étranger à la demande : aucune demande renvoyée", async () => {
    state.reports.find((r) => r.id === RP1).reporter_id = uid(9)
    const res = await getAdminReport(RP1)
    expect(res.purchase).toBeNull()
    expect(state.queries.some((q) => q.table.startsWith("storage:"))).toBe(false)
  })

  it("signalement sans lien valide ou demande supprimée : aucune demande, sans erreur", async () => {
    state.reports.find((r) => r.id === RP1).purchase_request_id = "pas-un-uuid"
    expect((await getAdminReport(RP1)).purchase).toBeNull()
    state.reports.find((r) => r.id === RP1).purchase_request_id = PR
    state.purchase_requests = []
    const res = await getAdminReport(RP1)
    expect(res.error).toBeUndefined()
    expect(res.purchase).toBeNull()
  })

  it("signalement de message : la demande n'est jamais lue, même avec un lien d'achat forgé", async () => {
    state.reports.find((r) => r.id === R1).purchase_request_id = PR
    const res = await getAdminReport(R1)
    expect(res.purchase).toBeNull()
    expect(state.queries.some((q) => q.table === "purchase_requests")).toBe(false)
    expect(state.queries.some((q) => q.table === "storage:purchase-proofs")).toBe(false)
  })

  it("table des demandes absente (script 94) : détail rendu sans la demande", async () => {
    state.missing.add("purchase_requests")
    const res = await getAdminReport(RP1)
    expect(res.error).toBeUndefined()
    expect(res.unavailable).toBeUndefined()
    expect(res.report.id).toBe(RP1)
    expect(res.purchase).toBeNull()
  })

  it("colonne du lien absente (script 94) : le signalement de message reste lisible, sans erreur", async () => {
    state.noPurchaseColumn = true
    const res = await getAdminReport(R1)
    expect(res.error).toBeUndefined()
    expect(res.unavailable).toBeUndefined()
    expect(res.report).toMatchObject({ id: R1, reference: "SIG-0001", targetType: "message" })
    expect(res.message).toMatchObject({ type: "text" })
    expect(res.purchase).toBeNull()
  })
})

describe("clôture d'un signalement de demande d'achats", () => {
  beforeEach(addPurchaseFixture)

  const calls = () => notify.mock.calls.map((c) => c[0])

  it("resolveReport prévient les deux parties (type, destinataire, lien vers l'autre partie, clé par signalement)", async () => {
    expect(await resolveReport(RP2, { note: "Explications reçues" })).toEqual({ success: true, status: "resolved" })
    const sent = calls()
    expect(sent).toHaveLength(2)
    expect(sent.map((n) => n.recipientId).sort()).toEqual([CLIENT, STUDENT].sort())
    for (const n of sent) {
      expect(n).toMatchObject({ type: "purchase_report_closed", missionId: MISSION, dedupeKey: `purchase:${PR}:report_closed:12` })
      expect(n.body).toContain("Aide au déménagement")
    }
    expect(sent.find((n) => n.recipientId === CLIENT).actorId).toBe(STUDENT)
    expect(sent.find((n) => n.recipientId === STUDENT).actorId).toBe(CLIENT)
    expect(state.reports.find((r) => r.id === RP2)).toMatchObject({ status: "resolved", resolution_note: "Explications reçues" })
  })

  it("dismissReport prévient aussi les deux parties", async () => {
    expect((await dismissReport(RP2)).success).toBe(true)
    expect(calls().map((n) => n.type)).toEqual(["purchase_report_closed", "purchase_report_closed"])
  })

  it("deux signalements à la même version de la demande : la seconde clôture a sa propre clé d'idempotence", async () => {
    await takeReport(RP1)
    expect((await resolveReport(RP1)).success).toBe(true)
    expect((await dismissReport(RP2)).success).toBe(true)
    expect(state.purchase_requests[0].version).toBe(2)
    const keys = calls().map((n) => n.dedupeKey)
    expect(keys).toHaveLength(4)
    expect(new Set(keys)).toEqual(new Set([`purchase:${PR}:report_closed:11`, `purchase:${PR}:report_closed:12`]))
    for (const recipient of [CLIENT, STUDENT]) {
      const own = calls().filter((n) => n.recipientId === recipient).map((n) => n.dedupeKey)
      expect(new Set(own).size).toBe(2)
    }
  })

  it("un second essai de clôture est refusé et ne renvoie aucune notification", async () => {
    await resolveReport(RP2)
    notify.mockClear()
    expect((await resolveReport(RP2)).error).toBeTruthy()
    expect((await dismissReport(RP2)).error).toBeTruthy()
    expect(notify).not.toHaveBeenCalled()
  })

  it("la prise en charge ne notifie personne", async () => {
    await takeReport(RP1)
    expect(notify).not.toHaveBeenCalled()
  })

  it("jamais de notification aux administrateurs", async () => {
    await resolveReport(RP2)
    expect(calls().map((n) => n.recipientId)).not.toContain(ADMIN.user.id)
  })

  it("signalement de message : aucune notification d'achat, la demande n'est pas lue", async () => {
    expect((await resolveReport(R2)).success).toBe(true)
    expect(notify).not.toHaveBeenCalled()
    expect(state.queries.some((q) => q.table === "purchase_requests")).toBe(false)
  })

  it("signalement de message portant un lien d'achat forgé : aucune notification d'achat", async () => {
    state.reports.find((r) => r.id === R2).purchase_request_id = PR
    expect((await resolveReport(R2)).success).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it.each([
    ["demande d'une autre mission", () => { state.purchase_requests[0].mission_id = OTHER_MISSION }],
    ["auteur étranger à la demande", () => { state.reports.find((r) => r.id === RP2).reporter_id = uid(9) }],
    ["demande supprimée", () => { state.purchase_requests = [] }],
    ["table des demandes absente", () => { state.missing.add("purchase_requests") }],
    ["lien d'achat invalide", () => { state.reports.find((r) => r.id === RP2).purchase_request_id = "x" }],
  ])("%s : la clôture réussit mais personne n'est notifié", async (_name, mutate) => {
    mutate()
    expect((await resolveReport(RP2)).success).toBe(true)
    expect(notify).not.toHaveBeenCalled()
    expect(state.reports.find((r) => r.id === RP2).status).toBe("resolved")
  })

  it("échec de la notification : la clôture reste valable, sans exception", async () => {
    notify.mockRejectedValue(new Error("boom"))
    expect(await resolveReport(RP2)).toEqual({ success: true, status: "resolved" })
    expect(state.reports.find((r) => r.id === RP2).status).toBe("resolved")
  })

  it("course perdue : aucune clôture, aucune notification", async () => {
    state.raceLost = true
    expect((await resolveReport(RP2)).error).toBeTruthy()
    expect(notify).not.toHaveBeenCalled()
  })

  it("aucune action d'argent ni de suspension : seule la table des signalements est modifiée", async () => {
    await takeReport(RP1)
    await resolveReport(RP1, { note: "Clos" })
    await dismissReport(RP2)
    const touched = state.queries.filter((q) => q.op === "update").map((q) => q.table)
    expect(new Set(touched)).toEqual(new Set(["reports"]))
    const read = new Set(state.queries.map((q) => q.table))
    for (const table of read) expect(["reports", "purchase_requests", "missions", "profiles"].includes(table)).toBe(true)
    expect(state.purchase_requests[0]).toMatchObject({ status: "reported", amount: 12500, version: 2 })
  })

  it("la note de clôture d'une demande passe toujours par maskContacts", async () => {
    await resolveReport(RP2, { note: "Appelez le 0197000000" })
    expect(state.reports.find((r) => r.id === RP2).resolution_note).toContain("[coordonnées masquées]")
  })
})
