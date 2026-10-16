import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import {
  PURCHASE_ERR,
  cleanItems,
  cleanReportDetails,
  cleanVendorName,
  isMissingPurchaseSchema,
  loadMission,
  loadOwnRequest,
  proofExists,
  proofsExist,
  readMissionPurchaseRequests,
  readRequestReports,
  reportLimitReached,
  safeProofUrl,
  signProofs,
  toPurchaseRequestView,
  writeLimitReached,
} from "./purchase-request-core"
import { IDS, SUPABASE_URL, createFakeDb, missionRow, proof, requestRow } from "./purchase-fake-db.test-support"

const { client: CLIENT, student: STUDENT, otherStudent: OTHER, mission: MISSION, request: REQ } = IDS

// Le caractère est construit pour que ce fichier ne le contienne jamais (garde no-em-dash).
const EM_DASH = String.fromCharCode(0x2014)

let db

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  db = createFakeDb({ missions: [missionRow()], purchase_requests: [requestRow()] })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("isMissingPurchaseSchema", () => {
  it("reconnaît table et colonne absentes, pas les autres erreurs", () => {
    for (const code of ["42P01", "PGRST205", "42703", "PGRST204"]) expect(isMissingPurchaseSchema({ code })).toBe(true)
    expect(isMissingPurchaseSchema({ code: "XX000", message: "Could not find the table in the schema cache" })).toBe(true)
    expect(isMissingPurchaseSchema({ code: "23505" })).toBe(false)
    expect(isMissingPurchaseSchema({ code: "42501" })).toBe(false)
    expect(isMissingPurchaseSchema(null)).toBe(false)
    expect(isMissingPurchaseSchema(undefined)).toBe(false)
  })
})

describe("messages d'erreur", () => {
  it("vouvoiement, sans tiret cadratin, aucun détail technique", () => {
    for (const message of Object.values(PURCHASE_ERR)) {
      expect(message).not.toContain(EM_DASH)
      expect(message).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i)
      expect(message).not.toMatch(/supabase|postgres|sql|pgrst|42\d{3}/i)
    }
  })
})

describe("loadMission", () => {
  it("lit la mission par le client de session, avec la propriété du client si demandée", async () => {
    const ok = await loadMission(db.session(CLIENT), MISSION, { clientId: CLIENT })
    expect(ok).toMatchObject({ status: "ok", mission: { id: MISSION, clientId: CLIENT, selectedStudentId: STUDENT, purchasesEstimate: 20000, status: "in_progress" } })
    expect(await loadMission(db.session(IDS.otherClient), MISSION, { clientId: IDS.otherClient })).toEqual({ status: "forbidden" })
    expect(await loadMission(db.session(OTHER), MISSION)).toEqual({ status: "forbidden" })
    expect(await loadMission(db.session(CLIENT), "../x")).toEqual({ status: "forbidden" })
  })

  it("erreur de base : échec sans détail", async () => {
    db.faults["missions.select"] = { code: "XX000", message: "secret" }
    expect(await loadMission(db.session(CLIENT), MISSION)).toEqual({ status: "error" })
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("secret")
  })

  it("estimation invalide ou absente : null", async () => {
    db.tables.missions[0].purchases_estimate = null
    const res = await loadMission(db.session(CLIENT), MISSION)
    expect(res.mission.purchasesEstimate).toBeNull()
  })
})

describe("loadOwnRequest", () => {
  it("ne lit que les demandes de la partie de l'appelant", async () => {
    const service = db.service()
    expect((await loadOwnRequest(service, { requestId: REQ, role: "student", userId: STUDENT })).status).toBe("ok")
    expect((await loadOwnRequest(service, { requestId: REQ, role: "client", userId: CLIENT })).status).toBe("ok")
    expect((await loadOwnRequest(service, { requestId: REQ, role: "student", userId: OTHER })).status).toBe("missing")
    expect((await loadOwnRequest(service, { requestId: REQ, role: "student", userId: CLIENT })).status).toBe("missing")
    expect((await loadOwnRequest(service, { requestId: REQ, role: "admin", userId: STUDENT })).status).toBe("missing")
    expect((await loadOwnRequest(service, { requestId: "1 or 1=1", role: "student", userId: STUDENT })).status).toBe("missing")
  })

  it("table absente : unavailable ; autre erreur : error", async () => {
    const service = db.service()
    db.faults["purchase_requests.select"] = { code: "42P01" }
    expect((await loadOwnRequest(service, { requestId: REQ, role: "student", userId: STUDENT })).status).toBe("unavailable")
    db.faults["purchase_requests.select"] = { code: "XX000" }
    expect((await loadOwnRequest(service, { requestId: REQ, role: "student", userId: STUDENT })).status).toBe("error")
  })
})

describe("lectures de liste", () => {
  it("demandes de la mission pour la partie, par numéro d'ordre", async () => {
    db.tables.purchase_requests.push(requestRow({ id: IDS.request2, seq: 2 }), requestRow({ id: IDS.foreignRequest, seq: 3, client_id: IDS.otherClient }))
    const res = await readMissionPurchaseRequests(db.service(), { missionId: MISSION, role: "client", userId: CLIENT })
    expect(res.available).toBe(true)
    expect(res.rows.map((r) => r.seq)).toEqual([1, 2])
    expect(await readMissionPurchaseRequests(db.service(), { missionId: "x", role: "client", userId: CLIENT })).toEqual({ error: true })
    db.faults["purchase_requests.select"] = { code: "PGRST205" }
    expect(await readMissionPurchaseRequests(db.service(), { missionId: MISSION, role: "client", userId: CLIENT })).toEqual({ available: false })
  })

  it("signalements : liste vide sans requête, table absente, erreur", async () => {
    expect(await readRequestReports(db.service(), [])).toEqual({ available: true, rows: [] })
    expect(await readRequestReports(db.service(), ["x"])).toEqual({ available: true, rows: [] })
    db.faults["reports.select"] = { code: "42703" }
    expect(await readRequestReports(db.service(), [REQ])).toEqual({ available: false })
    db.faults["reports.select"] = { code: "XX000" }
    expect(await readRequestReports(db.service(), [REQ])).toEqual({ error: true })
  })
})

describe("signProofs et safeProofUrl", () => {
  it("signe pour 120 s en un seul appel, sans doublon, et n'expose que des adresses du projet", async () => {
    const row = requestRow({ sms_photo_path: proof(CLIENT, REQ, "sms") })
    const signed = await signProofs(db.service(), [row, row])
    expect(Object.keys(signed)).toHaveLength(3)
    expect(db.signedTtl).toEqual([120])
    for (const url of Object.values(signed)) expect(url).toContain("/storage/v1/object/sign/purchase-proofs/")
  })

  it("aucune preuve : aucun appel ; erreur de stockage : résultat vide", async () => {
    expect(await signProofs(db.service(), [])).toEqual({})
    expect(db.signedTtl).toEqual([])
    db.storageFault = { statusCode: "500", message: "secret" }
    expect(await signProofs(db.service(), [requestRow()])).toEqual({})
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("secret")
  })

  it("refuse une adresse d'un autre domaine, un autre compartiment, un chemin remonté", () => {
    const base = `${SUPABASE_URL}/storage/v1/object/sign/purchase-proofs`
    expect(safeProofUrl(`${base}/a/b.jpg?token=1`)).toBe(`${base}/a/b.jpg?token=1`)
    for (const bad of [
      "https://evil.example/storage/v1/object/sign/purchase-proofs/a.jpg",
      `${SUPABASE_URL}/storage/v1/object/sign/message-media/a.jpg`,
      `${SUPABASE_URL}/storage/v1/object/public/purchase-proofs/a.jpg`,
      `${base}/`,
      `${base}/../x`,
      `${base}/%2e%2e/x`,
      "javascript:alert(1)",
      "",
      null,
      42,
    ]) {
      expect(safeProofUrl(bad), String(bad)).toBeNull()
    }
  })
})

describe("proofExists", () => {
  it("lit la liste du dossier (jamais HEAD) et compare le nom exact", async () => {
    const path = proof(STUDENT, REQ, "payee")
    db.objects.add(path)
    expect(await proofExists(db.service(), path)).toEqual({ exists: true })
    expect(await proofExists(db.service(), proof(STUDENT, REQ, "ticket"))).toEqual({ exists: false })
    expect(await proofExists(db.service(), "sans-dossier.jpg")).toEqual({ exists: false })
    expect(await proofExists(db.service(), undefined)).toEqual({ exists: false })
  })

  it("erreur de stockage : error ; proofsExist distingue absent et erreur", async () => {
    const a = proof(STUDENT, REQ, "payee")
    const b = proof(STUDENT, REQ, "ticket")
    db.objects.add(a)
    expect(await proofsExist(db.service(), [a])).toEqual({ ok: true })
    expect(await proofsExist(db.service(), [a, b])).toEqual({ ok: false, reason: "missing" })
    expect(await proofsExist(db.service(), [])).toEqual({ ok: true })
    db.storageFault = { statusCode: "500" }
    expect(await proofsExist(db.service(), [a])).toEqual({ ok: false, reason: "error" })
  })
})

describe("textes libres", () => {
  it("masque les coordonnées puis coupe aux limites SQL", () => {
    expect(cleanVendorName("Chez Paul 0197123456")).not.toMatch(/0197123456/)
    expect(cleanVendorName("a".repeat(500)).length).toBeLessThanOrEqual(80)
    expect(cleanVendorName("Chez Paul 0197123456 ".repeat(20)).length).toBeLessThanOrEqual(80)
    expect(cleanItems("Riz, contactez paul@example.com")).not.toMatch(/example/)
    expect(cleanItems("b".repeat(500)).length).toBeLessThanOrEqual(120)
    expect(cleanItems(null)).toBeNull()
    expect(cleanItems(undefined)).toBeNull()
    expect(cleanItems("   ")).toBeNull()
    expect(cleanReportDetails(`${"c".repeat(2000)}`).length).toBeLessThanOrEqual(1000)
    expect(cleanReportDetails("Appelez le 0197123456")).not.toMatch(/0197123456/)
  })
})

describe("plafonds", () => {
  it("écritures : 5 par 10 minutes, créations et modifications", async () => {
    const now = new Date().toISOString()
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ limited: false })
    for (let i = 0; i < 4; i += 1) db.tables.purchase_requests.push(requestRow({ id: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`, seq: i + 2, created_at: now }))
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ limited: false })
    db.tables.messages.push({ id: "m1", sender_id: STUDENT, type: "purchase_event", content: "La demande N° 2 a été modifiée.", created_at: now })
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ limited: true })
    // Les autres événements ne comptent pas (annulation, paiement, réception, signalement).
    db.tables.messages.length = 0
    db.tables.messages.push({ id: "m2", sender_id: STUDENT, type: "purchase_event", content: "La demande N° 2 a été annulée.", created_at: now })
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ limited: false })
    // La fenêtre est de 10 minutes.
    expect(await writeLimitReached(db.service(), STUDENT, Date.now() + 11 * 60 * 1000)).toEqual({ limited: false })
  })

  it("écritures : table absente et erreur", async () => {
    db.faults["purchase_requests.select"] = { code: "42P01" }
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ available: false })
    db.faults["purchase_requests.select"] = { code: "XX000" }
    expect(await writeLimitReached(db.service(), STUDENT)).toEqual({ error: true })
  })

  it("signalements : 10 par 24 h, tous types confondus", async () => {
    const now = new Date().toISOString()
    for (let i = 0; i < 9; i += 1) db.tables.reports.push({ id: `r${i}`, reporter_id: STUDENT, created_at: now })
    expect(await reportLimitReached(db.service(), STUDENT)).toEqual({ limited: false })
    db.tables.reports.push({ id: "r9", reporter_id: STUDENT, created_at: now })
    expect(await reportLimitReached(db.service(), STUDENT)).toEqual({ limited: true })
    expect(await reportLimitReached(db.service(), OTHER)).toEqual({ limited: false })
    expect(await reportLimitReached(db.service(), STUDENT, Date.now() + 25 * 60 * 60 * 1000)).toEqual({ limited: false })
    db.faults["reports.select"] = { code: "PGRST205" }
    expect(await reportLimitReached(db.service(), STUDENT)).toEqual({ available: false })
    db.faults["reports.select"] = { code: "XX000" }
    expect(await reportLimitReached(db.service(), STUDENT)).toEqual({ error: true })
  })
})

describe("toPurchaseRequestView", () => {
  const urls = {
    [proof(STUDENT, REQ, "payee")]: "https://u/p",
    [proof(STUDENT, REQ, "ticket")]: "https://u/t",
    [proof(CLIENT, REQ, "sms")]: "https://u/s",
  }
  const paid = () => requestRow({ status: "paid", paid_at: "2026-10-17T09:00:00.000Z", sms_photo_path: proof(CLIENT, REQ, "sms"), beneficiary_confirmed: true })

  it("vue du client : adresses, jamais de chemin ni d'identifiant de l'autre partie", () => {
    const view = toPurchaseRequestView(paid(), { id: CLIENT, role: "client", missionStatus: "in_progress" }, [], urls)
    expect(view).toMatchObject({ payeePhotoUrl: "https://u/p", ticketPhotoUrl: "https://u/t", smsPhotoUrl: "https://u/s", payeeNumber: "123456", vendorName: "Poissonnerie Dossa" })
    const keys = Object.keys(view)
    for (const forbidden of ["payeePhotoPath", "ticketPhotoPath", "smsPhotoPath", "student_id", "client_id", "mission_id", "beneficiary_confirmed", "updated_at"]) {
      expect(keys).not.toContain(forbidden)
    }
    expect(view.actions).toEqual(["report"])
  })

  it("vue de l'étudiant : ses deux chemins pour la modification, pas celui de la capture du client", () => {
    const view = toPurchaseRequestView(requestRow(), { id: STUDENT, role: "student", missionStatus: "in_progress" }, [], urls)
    expect(view.payeePhotoPath).toBe(proof(STUDENT, REQ, "payee"))
    expect(view.ticketPhotoPath).toBe(proof(STUDENT, REQ, "ticket"))
    expect(view).not.toHaveProperty("smsPhotoPath")
    expect(view.smsPhotoUrl).toBeNull()
    expect(view.actions).toEqual(["edit", "cancel", "report"])
  })

  it("une adresse absente donne null, jamais le chemin", () => {
    const view = toPurchaseRequestView(paid(), { id: CLIENT, role: "client", missionStatus: "done" }, [], {})
    expect(view.payeePhotoUrl).toBeNull()
    expect(view.smsPhotoUrl).toBeNull()
  })

  it("signalements : état examiné, mon signalement et sa référence, motif du premier signalement", () => {
    const reports = [
      { purchase_request_id: REQ, reporter_id: CLIENT, status: "resolved", reason: "purchase_payee_mismatch", number: 8 },
      { purchase_request_id: REQ, reporter_id: STUDENT, status: "dismissed", reason: "other", number: 5 },
      { purchase_request_id: IDS.request2, reporter_id: STUDENT, status: "open", reason: "other", number: 9 },
    ]
    const view = toPurchaseRequestView(requestRow({ status: "reported", reported_at: "2026-10-17T10:00:00.000Z" }), { id: STUDENT, role: "student", missionStatus: "in_progress" }, reports, urls)
    expect(view).toMatchObject({ reviewed: true, alreadyReportedByMe: true, reportReference: "SIG-0005", reportReason: "other" })
    expect(view.actions).toEqual([])
    const open = toPurchaseRequestView(
      requestRow({ status: "reported", reported_at: "x" }),
      { id: CLIENT, role: "client", missionStatus: "in_progress" },
      [{ purchase_request_id: REQ, reporter_id: STUDENT, status: "open", reason: "other", number: 5 }],
      urls,
    )
    expect(open).toMatchObject({ reviewed: false, alreadyReportedByMe: false, reportReference: null })
  })

  it("sans signalement : pas de motif, pas examiné", () => {
    const view = toPurchaseRequestView(requestRow(), { id: CLIENT, role: "client", missionStatus: "in_progress" }, undefined, urls)
    expect(view).toMatchObject({ reportReason: null, reviewed: false, alreadyReportedByMe: false, reportReference: null })
  })
})
