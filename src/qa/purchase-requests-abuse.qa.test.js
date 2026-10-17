import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(async () => ({ ok: true })) }))

import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import * as actions from "@/lib/actions/purchase-request.actions"
import { IDS, SUPABASE_URL, createFakeDb, missionRow, proof, requestRow } from "@/lib/actions/purchase-fake-db.test-support"

// Entrées hostiles et garde-fous de structure des actions de demandes de paiement d'achats (RD-ACHATS-01 ST-04).

const ROOT = process.cwd()
const read = (file) => readFileSync(path.join(ROOT, file), "utf8")
const ACTIONS_FILE = "src/lib/actions/purchase-request.actions.js"
const OWNED = [
  ACTIONS_FILE,
  "src/lib/actions/purchase-request-core.js",
  "src/lib/purchases/purchase-messages.js",
  "src/lib/purchases/purchase-notify.js",
]

const { client: CLIENT, student: STUDENT, mission: MISSION, request: REQ } = IDS

let db

function asRole(role, id) {
  requireRole.mockResolvedValue({ supabase: db.session(id), user: { id }, role, profile: { role, full_name: "Test Personne", is_suspended: false } })
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  db = createFakeDb({
    missions: [missionRow()],
    profiles: [
      { user_id: STUDENT, phone: "+2290197000001", is_suspended: false },
      { user_id: CLIENT, phone: "+2290197000002", is_suspended: false },
    ],
  })
  createServiceClient.mockReset()
  createServiceClient.mockImplementation(() => db.service())
  requireRole.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const createInput = (overrides = {}) => ({
  missionId: MISSION,
  requestId: REQ,
  payeeKind: "merchant",
  payeeNumber: "123456",
  payeePhotoPath: proof(STUDENT, REQ, "payee"),
  vendorName: "Poissonnerie Dossa",
  items: "Poisson",
  amount: 6000,
  ticketPhotoPath: proof(STUDENT, REQ, "ticket"),
  ...overrides,
})

describe("entrées hostiles : création", () => {
  it("montants invalides sous toutes leurs formes : refusés avant le service role", async () => {
    asRole("student", STUDENT)
    db.objects.add(proof(STUDENT, REQ, "payee"))
    db.objects.add(proof(STUDENT, REQ, "ticket"))
    const amounts = [
      150.5, 0.1, -1, -100000, 99, 500001, 1e9, 1e21, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity, -Infinity,
      "1e5", "0x10", "150.5", "150,5", "-150", "+150", "١٥٠", "150abc", "abc", "", " ", null, undefined, true, {}, [], [150], () => 150, 10n,
      "9".repeat(40),
    ]
    for (const amount of amounts) {
      const res = await actions.createPurchaseRequest(createInput({ amount }))
      expect(res.error, String(typeof amount === "function" ? "fn" : amount)).toEqual(expect.any(String))
      expect(res.success).toBeUndefined()
    }
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(db.writes).toHaveLength(0)
  })

  it("identifiants forgés, injections et chemins : refusés avant le service role", async () => {
    asRole("student", STUDENT)
    const hostile = [
      { missionId: "../../etc/passwd" },
      { missionId: `${MISSION}' or '1'='1` },
      { missionId: `${MISSION}\n` },
      { requestId: "00000000-0000-0000-0000-00000000000" },
      { requestId: ["a"] },
      { requestId: { toString: () => REQ } },
      { payeeNumber: "<script>alert(1)</script>" },
      { payeeNumber: "1".repeat(5000) },
      { payeeNumber: "0197123456" },
      { payeeKind: "__proto__" },
      { payeeKind: ["merchant"] },
      { vendorName: "x".repeat(5000) },
      { vendorName: ["Dossa"] },
      { items: "y".repeat(5000) },
      { items: { a: 1 } },
      { payeePhotoPath: "../../../service-role.json" },
      { payeePhotoPath: "%2e%2e/%2e%2e/x.jpg" },
      { payeePhotoPath: `${STUDENT}\\${REQ}\\payee-a1b2c3d4e5.jpg` },
      { ticketPhotoPath: `${STUDENT}/${REQ}//ticket-a1b2c3d4e5.jpg` },
      { ticketPhotoPath: "x".repeat(5000) },
      { ticketPhotoPath: null },
    ]
    for (const patch of hostile) {
      const res = await actions.createPurchaseRequest(createInput(patch))
      expect(res.error, JSON.stringify(patch).slice(0, 80)).toEqual(expect.any(String))
    }
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(db.writes).toHaveLength(0)
  })

  it("les messages d'erreur de validation sont tous en français (aucun message par défaut de la bibliothèque)", async () => {
    asRole("student", STUDENT)
    const inputs = [null, "x", 12, [], {}, createInput({ amount: "x" }), createInput({ missionId: 5 })]
    for (const input of inputs) {
      const res = await actions.createPurchaseRequest(input)
      expect(res.error).not.toMatch(/^(Invalid|Expected|Required)|\bstring\b|\bundefined\b/i)
    }
  })

  it("clés dangereuses (__proto__, constructor) : ignorées, jamais écrites en base", async () => {
    asRole("student", STUDENT)
    db.objects.add(proof(STUDENT, REQ, "payee"))
    db.objects.add(proof(STUDENT, REQ, "ticket"))
    const input = JSON.parse(`{"__proto__":{"status":"paid","student_id":"x"},"constructor":{"prototype":{"x":1}}}`)
    Object.assign(input, createInput())
    const res = await actions.createPurchaseRequest(input)
    expect(res.success).toBe(true)
    const row = db.tables.purchase_requests[0]
    expect(row.status).toBe("pending")
    expect(Object.keys(row)).not.toContain("constructor")
    expect({}.status).toBeUndefined()
  })

  it("un nom de vendeur hostile (HTML, URL, numéro) ne ressort jamais comme coordonnée", async () => {
    asRole("student", STUDENT)
    db.objects.add(proof(STUDENT, REQ, "payee"))
    db.objects.add(proof(STUDENT, REQ, "ticket"))
    await actions.createPurchaseRequest(createInput({ vendorName: "Paul https://wa.me/22997123456", items: "Appelez 01 97 12 34 56" }))
    const row = db.tables.purchase_requests[0]
    expect(row.vendor_name).not.toMatch(/wa\.me|97123456/)
    expect(row.items).not.toMatch(/97 12 34 56/)
  })
})

describe("entrées hostiles : transitions, paiement et signalement", () => {
  it("identifiant ou version forgés sur chaque action : refus sans service role", async () => {
    const calls = [
      ["student", actions.cancelPurchaseRequest, { requestId: "../x", expectedVersion: 1 }],
      ["student", actions.cancelPurchaseRequest, { requestId: REQ, expectedVersion: -1 }],
      ["student", actions.cancelPurchaseRequest, { requestId: REQ, expectedVersion: Number.MAX_SAFE_INTEGER + 2 }],
      ["student", actions.confirmPurchaseReceived, { requestId: REQ, expectedVersion: "1" }],
      ["student", actions.editPurchaseRequest, { requestId: REQ }],
      ["client", actions.markPurchasePaid, { requestId: REQ, expectedVersion: 1, beneficiaryConfirmed: true, smsPhotoPath: `${CLIENT}/${REQ}/../x.jpg` }],
      ["client", actions.markPurchasePaid, { requestId: REQ, expectedVersion: 1, beneficiaryConfirmed: 1, smsPhotoPath: proof(CLIENT, REQ, "sms") }],
      ["client", actions.markPurchasePaid, { requestId: REQ, expectedVersion: 1, beneficiaryConfirmed: true, smsPhotoPath: proof(CLIENT, REQ, "sms"), paidReference: "<b>x</b>" }],
      ["client", actions.reportPurchaseRequestAsClient, { requestId: REQ, reason: "<script>", details: "Une explication assez longue." }],
      ["student", actions.reportPurchaseRequestAsStudent, { requestId: REQ, reason: "other", details: "x".repeat(5000) }],
      ["student", actions.reportPurchaseRequestAsStudent, { requestId: REQ, reason: "other", details: ["Une explication assez longue."] }],
    ]
    for (const [role, fn, input] of calls) {
      asRole(role, role === "student" ? STUDENT : CLIENT)
      const res = await fn(input)
      expect(res.error, JSON.stringify(input).slice(0, 80)).toEqual(expect.any(String))
    }
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(db.writes).toHaveLength(0)
  })

  it("un étudiant ne peut jamais produire d'action de client et inversement (rôle vérifié en base)", async () => {
    db.tables.purchase_requests.push(requestRow({ status: "paid", paid_at: "2026-10-17T09:00:00.000Z", sms_photo_path: proof(CLIENT, REQ, "sms"), beneficiary_confirmed: true }))
    // Le compte student appelle les actions du client : requireRole refuse (profil student).
    requireRole.mockImplementation(async (roles) => (roles.includes("student") ? { error: "ok" } : { error: "Vous n'avez pas les droits pour effectuer cette action." }))
    expect((await actions.markPurchasePaid({})).error).toMatch(/droits/)
    expect((await actions.getClientPurchaseRequests({ missionId: MISSION })).error).toMatch(/droits/)
    expect((await actions.reportPurchaseRequestAsClient({})).error).toMatch(/droits/)
    requireRole.mockImplementation(async (roles) => (roles.includes("client") ? { error: "ok" } : { error: "Vous n'avez pas les droits pour effectuer cette action." }))
    for (const fn of [actions.createPurchaseRequest, actions.editPurchaseRequest, actions.cancelPurchaseRequest, actions.confirmPurchaseReceived, actions.getStudentPurchaseRequests, actions.reportPurchaseRequestAsStudent]) {
      expect((await fn({})).error).toMatch(/droits/)
    }
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(db.tables.purchase_requests[0].status).toBe("paid")
  })

  it("le compte admin connecté en tant que client ou étudiant est refusé par requireRole", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    for (const fn of Object.values(actions)) {
      expect((await fn({ missionId: MISSION, requestId: REQ })).error).toBeTruthy()
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

describe("structure du code des actions", () => {
  const source = read(ACTIONS_FILE)

  it("fichier \"use server\" : n'exporte que des fonctions asynchrones", () => {
    expect(source.trimStart().startsWith('"use server"')).toBe(true)
    const exports = [...source.matchAll(/^export\s+(.*)$/gm)].map((m) => m[1])
    expect(exports.length).toBeGreaterThan(0)
    for (const line of exports) expect(line).toMatch(/^async function \w+\(/)
    expect(Object.keys(actions).sort()).toEqual([
      "cancelPurchaseRequest",
      "confirmPurchaseReceived",
      "createPurchaseRequest",
      "editPurchaseRequest",
      "getClientPurchaseRequests",
      "getStudentPurchaseRequests",
      "markPurchasePaid",
      "reportPurchaseRequestAsClient",
      "reportPurchaseRequestAsStudent",
    ])
  })

  it("requireRole est la première instruction de chaque action (ou du seul assistant de signalement)", () => {
    const bodies = [...source.matchAll(/^export async function (\w+)\([^)]*\) \{\n([^\n]*)/gm)]
    expect(bodies.length).toBe(9)
    for (const [, name, first] of bodies) {
      if (name.startsWith("reportPurchaseRequestAs")) expect(first, name).toMatch(/return reportPurchase\("(student|client)", input\)/)
      else expect(first, name).toMatch(/const auth = await requireRole\(\["(student|client)"\]\)/)
    }
    expect(source).toMatch(/async function reportPurchase\(role, input\) \{\n  const auth = await requireRole\(\[role\]\)/)
  })

  it("le service role est créé dans un seul assistant, jamais à l'import", () => {
    expect(source.match(/createServiceClient\(/g)).toHaveLength(1)
    expect(source).toMatch(/function openService\(\) \{\n  try \{\n    return createServiceClient\(\)/)
  })

  it("aucun module des fichiers possédés n'appelle un portefeuille, ne modifie ni ne supprime un message", () => {
    for (const file of OWNED) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
      expect(code, file).not.toMatch(/wallet|\.rpc\(|callWalletRpc|netAmount|COMMISSION_RATE|escrow/i)
      expect(code, file).not.toMatch(/\.delete\(/)
      expect(code, file).not.toMatch(/from\("messages"\)\s*\.(update|delete|upsert)/)
      expect(code, file).not.toMatch(/head:\s*true/)
      expect(code, file).not.toMatch(/select\(\s*["'`]\*["'`]/)
      expect(code, file).not.toMatch(/user_metadata/)
    }
  })

  it("seul le client service role écrit : le client de session ne fait aucun insert, update ni delete", () => {
    expect(source).not.toMatch(/supabase\s*\.from\([^)]*\)\s*\.(insert|update|delete|upsert)/)
    expect(source).not.toMatch(/\bsupabase\.storage/)
  })

  it("les modules d'insertion et de notification ne sont pas dans un fichier \"use server\"", () => {
    for (const file of ["src/lib/purchases/purchase-messages.js", "src/lib/purchases/purchase-notify.js", "src/lib/actions/purchase-request-core.js"]) {
      expect(read(file), file).not.toMatch(/^\s*["']use server["']/m)
    }
  })

  it("aucune colonne privée de profils dans les actions ni dans le cœur : seul payee-phone.js lit `phone`", () => {
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
    const privateColumns = ["phone", "fcm_token", "rejection_reason", "verification_submitted_at", "card_url"]
    for (const file of [ACTIONS_FILE, "src/lib/actions/purchase-request-core.js", "src/lib/purchases/purchase-messages.js", "src/lib/purchases/purchase-notify.js"]) {
      const code = strip(read(file)).replace(/^import .*$/gm, "")
      for (const column of privateColumns) expect(code, `${file} : ${column}`).not.toMatch(new RegExp(`\\b${column}\\b`))
    }
    const phoneModule = strip(read("src/lib/purchases/payee-phone.js"))
    expect(phoneModule).toMatch(/service\.from\("profiles"\)\.select\("user_id, phone"\)\.eq\("user_id", userId\)/)
    for (const column of privateColumns.filter((c) => c !== "phone")) {
      expect(phoneModule, column).not.toMatch(new RegExp(`\\b${column}\\b`))
    }
    expect(phoneModule.match(/\bphone\b/g)).toHaveLength(2)
    expect(phoneModule).toMatch(/return \{ same: isProfilePhone\(payeeNumber, data\?\.phone\) \}/)
  })

  it("seul payee-phone.js figure dans la liste d'autorisation du garde des colonnes privées", () => {
    const guard = read("src/lib/actions/profile.actions.test.js")
    const list = guard.slice(guard.indexOf("const SERVER_ALLOWLIST = ["), guard.indexOf("]", guard.indexOf("const SERVER_ALLOWLIST = [")))
    expect(list).toContain('"lib/purchases/payee-phone.js"')
    expect(list).not.toContain("purchase-request")
  })
})
