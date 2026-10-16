import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(async () => ({ ok: true })) }))

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { notify } from "@/lib/notifications/notify"
import { PURCHASE_ERR } from "./purchase-request-core"
import {
  cancelPurchaseRequest,
  confirmPurchaseReceived,
  createPurchaseRequest,
  editPurchaseRequest,
  getClientPurchaseRequests,
  getStudentPurchaseRequests,
  markPurchasePaid,
  reportPurchaseRequestAsClient,
  reportPurchaseRequestAsStudent,
} from "./purchase-request.actions"
import { IDS, SUPABASE_URL, createFakeDb, missionRow, proof, requestRow } from "./purchase-fake-db.test-support"

const { client: CLIENT, student: STUDENT, otherStudent: OTHER_STUDENT, otherClient: OTHER_CLIENT, mission: MISSION } = IDS
const REQ = IDS.request

let db
let errorSpy

const profiles = () => [
  { user_id: STUDENT, phone: "+2290197000001", is_suspended: false, full_name: "Ulrich Dossou" },
  { user_id: CLIENT, phone: "+2290197000002", is_suspended: false, full_name: "Awa Sossou" },
  { user_id: OTHER_STUDENT, phone: "+2290197000003", is_suspended: false, full_name: "Koffi Adjo" },
  { user_id: OTHER_CLIENT, phone: "+2290197000004", is_suspended: false, full_name: "Marc Zinsou" },
]

function asRole(role, id) {
  requireRole.mockResolvedValue({
    supabase: db.session(id),
    user: { id },
    role,
    profile: { role, full_name: profiles().find((p) => p.user_id === id)?.full_name ?? null, is_suspended: false },
  })
}
const asStudent = (id = STUDENT) => asRole("student", id)
const asClient = (id = CLIENT) => asRole("client", id)

const createInput = (overrides = {}) => ({
  missionId: MISSION,
  requestId: REQ,
  payeeKind: "merchant",
  payeeNumber: "123 456",
  payeePhotoPath: proof(STUDENT, REQ, "payee"),
  vendorName: "Poissonnerie Dossa",
  items: "Poisson fumé",
  amount: 6000,
  ticketPhotoPath: proof(STUDENT, REQ, "ticket"),
  ...overrides,
})

function withProofs(id = REQ) {
  db.objects.add(proof(STUDENT, id, "payee"))
  db.objects.add(proof(STUDENT, id, "ticket"))
}

const written = (table) => db.writes.filter((w) => w.table === table)
const wroteAnything = () => db.writes.length > 0

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  db = createFakeDb({ missions: [missionRow()], profiles: profiles() })
  createServiceClient.mockReset()
  createServiceClient.mockImplementation(() => db.service())
  requireRole.mockReset()
  notify.mockClear()
  revalidatePath.mockClear()
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Création ────────────────────────────────────────────────────────────────────────────────

describe("createPurchaseRequest", () => {
  it("chemin nominal : demande, carte fixe, notification au client, revalidation", async () => {
    asStudent()
    withProofs()
    const res = await createPurchaseRequest(createInput())

    expect(res).toEqual({ success: true, request: { id: REQ, seq: 1, status: "pending", version: 1 } })
    expect(db.tables.purchase_requests).toHaveLength(1)
    expect(db.tables.purchase_requests[0]).toMatchObject({
      id: REQ,
      mission_id: MISSION,
      seq: 1,
      student_id: STUDENT,
      client_id: CLIENT,
      payee_kind: "merchant",
      payee_number: "123456",
      vendor_name: "Poissonnerie Dossa",
      items: "Poisson fumé",
      amount: 6000,
    })
    expect(db.tables.messages).toHaveLength(1)
    expect(db.tables.messages[0]).toMatchObject({
      type: "purchase_request",
      sender_id: STUDENT,
      receiver_id: CLIENT,
      mission_id: MISSION,
      purchase_request_id: REQ,
      content: "Demande de paiement d'achats N° 1",
      read: false,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: CLIENT, type: "purchase_requested", dedupeKey: `purchase:${REQ}:requested:1`, actorId: STUDENT }),
    )
    expect(revalidatePath).toHaveBeenCalledWith(`/messages/${MISSION}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/client/messages/${MISSION}`)
  })

  it("le message de la conversation ne contient ni numéro, ni vendeur, ni montant", async () => {
    asStudent()
    withProofs()
    await createPurchaseRequest(createInput({ vendorName: "Chez Mama Léa", amount: 12345 }))
    const content = db.tables.messages[0].content
    expect(content).not.toMatch(/123456|Mama|12345|12 345/)
  })

  it("n'écrit que dans purchase_requests et messages : aucun portefeuille, aucune transaction", async () => {
    asStudent()
    withProofs()
    await createPurchaseRequest(createInput())
    expect([...new Set(db.writes.map((w) => w.table))].sort()).toEqual(["messages", "purchase_requests"])
  })

  it("le client de session ne fait que lire la mission : jamais d'insertion par la session", async () => {
    asStudent()
    withProofs()
    await createPurchaseRequest(createInput())
    expect(new Set(db.sessionReads)).toEqual(new Set(["missions"]))
  })

  it("ignore les identifiants, le statut et la version fournis par le navigateur", async () => {
    asStudent()
    withProofs()
    await createPurchaseRequest(
      createInput({ student_id: OTHER_STUDENT, client_id: OTHER_CLIENT, status: "paid", version: 9, seq: 50, studentId: OTHER_STUDENT }),
    )
    expect(db.tables.purchase_requests[0]).toMatchObject({ student_id: STUDENT, client_id: CLIENT, status: "pending", version: 1, seq: 1 })
  })

  it("refuse sans créer de client service role si le rôle est refusé (client, non connecté, suspendu)", async () => {
    for (const refusal of ["Vous n'avez pas les droits pour effectuer cette action.", "Vous devez être connecté pour effectuer cette action."]) {
      requireRole.mockResolvedValue({ error: refusal })
      expect(await createPurchaseRequest(createInput())).toEqual({ error: refusal })
    }
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(wroteAnything()).toBe(false)
  })

  it("entrées invalides : jamais de client service role ni d'écriture", async () => {
    asStudent()
    withProofs()
    const bad = [
      null,
      undefined,
      "texte",
      [],
      createInput({ amount: 150.5 }),
      createInput({ amount: "150,5" }),
      createInput({ amount: 99 }),
      createInput({ amount: 500001 }),
      createInput({ amount: -500 }),
      createInput({ amount: 0 }),
      createInput({ amount: "abc" }),
      createInput({ amount: Number.NaN }),
      createInput({ amount: Infinity }),
      createInput({ missionId: "pas-un-uuid" }),
      createInput({ requestId: "1 or 1=1" }),
      createInput({ payeeNumber: "12" }),
      createInput({ payeeKind: "autre" }),
      createInput({ vendorName: "a" }),
      createInput({ vendorName: "x".repeat(81) }),
      createInput({ items: "y".repeat(121) }),
    ]
    for (const input of bad) {
      const res = await createPurchaseRequest(input)
      expect(res.error, JSON.stringify(input)).toEqual(expect.any(String))
      expect(res.success).toBeUndefined()
    }
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(wroteAnything()).toBe(false)
  })

  it("montant : 100 et 500 000 acceptés, la décimale est refusée avec son message", async () => {
    asStudent()
    withProofs()
    const decimal = await createPurchaseRequest(createInput({ amount: 150.5 }))
    expect(decimal.error).toMatch(/nombre entier de FCFA/)
    expect((await createPurchaseRequest(createInput({ amount: 100 }))).success).toBe(true)
    withProofs(IDS.request2)
    const max = await createPurchaseRequest(
      createInput({
        requestId: IDS.request2,
        payeePhotoPath: proof(STUDENT, IDS.request2, "payee"),
        ticketPhotoPath: proof(STUDENT, IDS.request2, "ticket"),
        amount: 500000,
      }),
    )
    expect(max.success).toBe(true)
    expect(db.tables.purchase_requests.map((r) => r.amount)).toEqual([100, 500000])
  })

  it("chemin de preuve forgé : dossier d'autrui, autre demande, `..`, autre nature, extension : refusé sans service role", async () => {
    asStudent()
    withProofs()
    const forged = [
      proof(OTHER_STUDENT, REQ, "payee"),
      proof(STUDENT, IDS.request2, "payee"),
      `${STUDENT}/${REQ}/../${OTHER_STUDENT}/payee-a1b2c3d4e5.jpg`,
      `../${STUDENT}/${REQ}/payee-a1b2c3d4e5.jpg`,
      proof(STUDENT, REQ, "sms"),
      proof(STUDENT, REQ, "ticket"),
      `${STUDENT}/${REQ}/payee-a1b2c3d4e5.exe`,
      `${STUDENT}/${REQ}/payee-a1b2c3d4e5.jpg/../x`,
      "message-media/x.jpg",
    ]
    for (const path of forged) {
      expect(await createPurchaseRequest(createInput({ payeePhotoPath: path }))).toEqual({ error: PURCHASE_ERR.proof })
    }
    expect(await createPurchaseRequest(createInput({ ticketPhotoPath: proof(STUDENT, REQ, "payee") }))).toEqual({ error: PURCHASE_ERR.proof })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(wroteAnything()).toBe(false)
  })

  it("refuse une preuve absente du compartiment", async () => {
    asStudent()
    db.objects.add(proof(STUDENT, REQ, "payee"))
    expect(await createPurchaseRequest(createInput())).toEqual({ error: PURCHASE_ERR.proof })
    expect(db.tables.purchase_requests).toHaveLength(0)
  })

  it("mission d'un autre client, étudiant non retenu, candidat, mission inconnue : refus sans service role", async () => {
    withProofs()
    const cases = [
      [() => db.tables.missions.splice(0, 1, missionRow({ selected_student_id: OTHER_STUDENT })), "non retenu"],
      [() => db.tables.missions.splice(0, 1, missionRow({ selected_student_id: null, status: "open" })), "candidat"],
      [() => db.tables.missions.splice(0, 1, missionRow({ id: IDS.otherMission, client_id: OTHER_CLIENT })), "mission inconnue"],
    ]
    for (const [mutate, label] of cases) {
      db = createFakeDb({ missions: [missionRow()], profiles: profiles() })
      createServiceClient.mockImplementation(() => db.service())
      withProofs()
      mutate()
      asStudent()
      const res = await createPurchaseRequest(createInput())
      expect(res.error, label).toBe(PURCHASE_ERR.conversation)
      expect(db.servicesCreated, label).toBe(0)
    }
  })

  it("une mission qui n'est pas en cours, ou sans achats, est refusée avant le service role", async () => {
    withProofs()
    for (const patch of [{ status: "open" }, { status: "done" }, { status: "cancelled" }, { purchases_estimate: null }]) {
      db.tables.missions.splice(0, 1, missionRow(patch))
      asStudent()
      const res = await createPurchaseRequest(createInput())
      expect(res.error, JSON.stringify(patch)).toEqual(expect.any(String))
      expect(res.success).toBeUndefined()
    }
    expect(db.servicesCreated).toBe(0)
    expect(wroteAnything()).toBe(false)
  })

  it("compte suspendu : la ligne profil du message est refusée, la demande est annulée", async () => {
    asStudent()
    withProofs()
    db.tables.profiles.find((p) => p.user_id === STUDENT).is_suspended = true
    const res = await createPurchaseRequest(createInput())
    expect(res).toEqual({ error: PURCHASE_ERR.generic })
    expect(db.tables.purchase_requests[0].status).toBe("cancelled")
    expect(db.tables.messages).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it("numéro à payer égal au téléphone du profil de l'étudiant, quel que soit le format : refusé", async () => {
    asStudent()
    withProofs()
    for (const phone of ["+2290197000001", "0197000001", "01 97 00 00 01", "00229 01 97 00 00 01", "+229 0197000001"]) {
      db.tables.profiles.find((p) => p.user_id === STUDENT).phone = phone
      const res = await createPurchaseRequest(createInput({ payeeKind: "personal", payeeNumber: "01 97 00 00 01" }))
      expect(res, phone).toEqual({ error: PURCHASE_ERR.payeeSelf })
    }
    expect(db.tables.purchase_requests).toHaveLength(0)
  })

  it("un numéro perso qui n'est pas le téléphone du profil est accepté (et celui du client ne sert pas d'oracle)", async () => {
    asStudent()
    withProofs()
    const res = await createPurchaseRequest(createInput({ payeeKind: "personal", payeeNumber: "01 97 00 00 02" }))
    expect(res.success).toBe(true)
    expect(db.tables.purchase_requests[0].payee_number).toBe("+2290197000002")
  })

  it("le téléphone de profil n'est jamais renvoyé", async () => {
    asStudent()
    withProofs()
    const res = await createPurchaseRequest(createInput())
    expect(JSON.stringify(res)).not.toMatch(/0197000001|0197000002/)
  })

  it("20 demandes non annulées : la 21e est refusée ; les annulées ne comptent pas", async () => {
    asStudent()
    withProofs()
    for (let seq = 1; seq <= 20; seq += 1) {
      db.tables.purchase_requests.push(requestRow({ id: `44444444-4444-4444-8444-${String(seq).padStart(12, "0")}`, seq }))
    }
    const res = await createPurchaseRequest(createInput())
    expect(res.error).toMatch(/limite de 20 demandes/)
    expect(db.tables.purchase_requests).toHaveLength(20)

    for (let i = 0; i < 5; i += 1) db.tables.purchase_requests[i].status = "cancelled"
    const ok = await createPurchaseRequest(createInput())
    expect(ok.success).toBe(true)
    expect(ok.request.seq).toBe(21)
  })

  it("course sur la 21e demande : celle qui dépasse s'annule d'elle-même, sans carte", async () => {
    asStudent()
    withProofs()
    for (let seq = 2; seq <= 20; seq += 1) {
      db.tables.purchase_requests.push(requestRow({ id: `44444444-4444-4444-8444-${String(seq).padStart(12, "0")}`, seq }))
    }
    // Une demande concurrente de rang 1 apparaît pendant l'insertion : la nôtre devient la 21e.
    db.onInsert = (table, row) => {
      if (table === "purchase_requests" && row.id === REQ && !db.tables.purchase_requests.some((r) => r.seq === 1)) {
        db.tables.purchase_requests.push(requestRow({ id: IDS.request2, seq: 1 }))
      }
    }
    const res = await createPurchaseRequest(createInput())
    expect(res.error).toMatch(/limite de 20 demandes/)
    expect(db.tables.purchase_requests.find((r) => r.id === REQ).status).toBe("cancelled")
    expect(db.tables.messages).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it("numéro d'ordre pris pendant l'insertion (23505) : une seule nouvelle tentative", async () => {
    asStudent()
    withProofs()
    let first = true
    db.faults["purchase_requests.insert"] = () => {
      if (!first) return null
      first = false
      db.tables.purchase_requests.push(requestRow({ id: IDS.request2, seq: 1 }))
      return { code: "23505", message: "duplicate key value" }
    }
    const res = await createPurchaseRequest(createInput())
    expect(res.success).toBe(true)
    expect(res.request.seq).toBe(2)
    expect(db.tables.purchase_requests).toHaveLength(2)
  })

  it("double clic : le même requestId répond succès sans seconde ligne, seconde carte ni seconde notification", async () => {
    asStudent()
    withProofs()
    const first = await createPurchaseRequest(createInput())
    const second = await createPurchaseRequest(createInput())
    expect(first.success).toBe(true)
    expect(second).toEqual({ success: true, replay: true, request: first.request })
    expect(db.tables.purchase_requests).toHaveLength(1)
    expect(db.tables.messages).toHaveLength(1)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it("double clic concurrent : une collision sur la clé donne la même réponse de rejeu", async () => {
    asStudent()
    withProofs()
    let first = true
    db.faults["purchase_requests.insert"] = () => {
      if (!first) return null
      first = false
      db.tables.purchase_requests.push(requestRow({ id: REQ, seq: 1 }))
      return { code: "23505", message: "duplicate key value" }
    }
    const res = await createPurchaseRequest(createInput())
    expect(res).toEqual({ success: true, replay: true, request: { id: REQ, seq: 1, status: "pending", version: 1 } })
    expect(db.tables.purchase_requests).toHaveLength(1)
  })

  it("identifiant de demande déjà pris par une demande annulée : pas de rejeu, réponse générique", async () => {
    asStudent()
    withProofs()
    db.tables.purchase_requests.push(requestRow({ status: "cancelled", cancelled_at: "2026-10-17T09:00:00.000Z" }))
    expect(await createPurchaseRequest(createInput())).toEqual({ error: PURCHASE_ERR.generic })
  })

  it("débit : 5 écritures en 10 minutes (créations et modifications) puis refus", async () => {
    asStudent()
    withProofs()
    const now = new Date().toISOString()
    for (let i = 1; i <= 3; i += 1) {
      db.tables.purchase_requests.push(requestRow({ id: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`, seq: i, status: "cancelled", cancelled_at: now, created_at: now }))
    }
    for (let i = 0; i < 2; i += 1) {
      db.tables.messages.push({ id: `66666666-6666-4666-8666-${String(i).padStart(12, "0")}`, sender_id: STUDENT, type: "purchase_event", content: "La demande N° 1 a été modifiée.", created_at: now })
    }
    expect(await createPurchaseRequest(createInput())).toEqual({ error: PURCHASE_ERR.rate })
    expect(db.tables.purchase_requests).toHaveLength(3)
  })

  it("débit : les écritures de plus de 10 minutes ne comptent plus", async () => {
    asStudent()
    withProofs()
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    for (let i = 1; i <= 6; i += 1) {
      db.tables.purchase_requests.push(requestRow({ id: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`, seq: i, status: "cancelled", cancelled_at: old, created_at: old }))
    }
    expect((await createPurchaseRequest(createInput())).success).toBe(true)
  })

  it("masque les coordonnées du vendeur et des articles puis coupe aux limites SQL (80 et 120)", async () => {
    asStudent()
    withProofs()
    const res = await createPurchaseRequest(
      createInput({ vendorName: "Chez Paul 0197123456 appelez", items: "Riz et écrivez à paul@example.com" }),
    )
    expect(res.success).toBe(true)
    const row = db.tables.purchase_requests[0]
    expect(row.vendor_name).not.toMatch(/0197123456/)
    expect(row.vendor_name).toMatch(/masquées/)
    expect(row.items).not.toMatch(/paul@example\.com/)
    expect(row.vendor_name.length).toBeLessThanOrEqual(80)
    expect(row.items.length).toBeLessThanOrEqual(120)
  })

  it("articles absents : null en base", async () => {
    asStudent()
    withProofs()
    await createPurchaseRequest(createInput({ items: "   " }))
    expect(db.tables.purchase_requests[0].items).toBeNull()
  })

  it("script 94 absent (42P01, PGRST205, 42703, PGRST204) : indisponible, rien d'écrit", async () => {
    for (const code of ["42P01", "PGRST205", "42703", "PGRST204"]) {
      db = createFakeDb({ missions: [missionRow()], profiles: profiles() })
      createServiceClient.mockImplementation(() => db.service())
      asStudent()
      withProofs()
      db.faults["purchase_requests.select"] = { code, message: "relation does not exist" }
      const res = await createPurchaseRequest(createInput())
      expect(res, code).toEqual({ error: PURCHASE_ERR.unavailable, unavailable: true })
      expect(wroteAnything(), code).toBe(false)
    }
  })

  it("table absente à l'écriture : indisponible", async () => {
    asStudent()
    withProofs()
    db.faults["purchase_requests.insert"] = { code: "42P01", message: "relation \"purchase_requests\" does not exist" }
    expect(await createPurchaseRequest(createInput())).toEqual({ error: PURCHASE_ERR.unavailable, unavailable: true })
  })

  it("erreur de base : réponse neutre, seul le code est journalisé (aucun détail ne fuit)", async () => {
    asStudent()
    withProofs()
    db.faults["purchase_requests.insert"] = { code: "XX000", message: "detail secret: users_pkey 4242", details: "ligne privée", hint: "indice" }
    const res = await createPurchaseRequest(createInput())
    expect(res).toEqual({ error: PURCHASE_ERR.generic })
    expect(JSON.stringify(res)).not.toMatch(/secret|4242|privée|indice/)
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).toContain("XX000")
    expect(logged).not.toMatch(/secret|4242|privée|indice/)
  })

  it("refus du trigger SQL (42501) : conversation indisponible", async () => {
    asStudent()
    withProofs()
    db.faults["purchase_requests.insert"] = { code: "42501", message: "Demande d'achats : la mission doit etre en cours" }
    expect(await createPurchaseRequest(createInput())).toEqual({ error: PURCHASE_ERR.conversation })
  })

  it("carte impossible à écrire après deux essais : la demande est annulée, erreur neutre", async () => {
    asStudent()
    withProofs()
    db.faults["messages.insert"] = { code: "XX000", message: "boom" }
    const res = await createPurchaseRequest(createInput())
    expect(res).toEqual({ error: PURCHASE_ERR.generic })
    expect(db.tables.purchase_requests[0].status).toBe("cancelled")
    expect(notify).not.toHaveBeenCalled()
  })

  it("service role non configuré : erreur neutre", async () => {
    asStudent()
    withProofs()
    createServiceClient.mockImplementation(() => {
      throw new Error("Configuration serveur incomplète : SUPABASE_SERVICE_ROLE_KEY")
    })
    const res = await createPurchaseRequest(createInput())
    expect(res).toEqual({ error: PURCHASE_ERR.generic })
    expect(JSON.stringify(res)).not.toMatch(/SUPABASE/)
  })
})

// ─── Modification ────────────────────────────────────────────────────────────────────────────

const editInput = (overrides = {}) => ({
  requestId: REQ,
  expectedVersion: 1,
  payeeKind: "merchant",
  payeeNumber: "123456",
  payeePhotoPath: proof(STUDENT, REQ, "payee"),
  vendorName: "Poissonnerie Dossa",
  items: "Poisson",
  amount: 7500,
  ticketPhotoPath: proof(STUDENT, REQ, "ticket"),
  ...overrides,
})

function seedPending(overrides = {}) {
  db.tables.purchase_requests.push(requestRow(overrides))
  withProofs(overrides.id ?? REQ)
}

describe("editPurchaseRequest", () => {
  it("chemin nominal : version incrémentée, date de modification, ligne système et notification", async () => {
    asStudent()
    seedPending()
    const res = await editPurchaseRequest(editInput())
    expect(res).toEqual({ success: true, request: { id: REQ, seq: 1, status: "pending", version: 2 } })
    const row = db.tables.purchase_requests[0]
    expect(row).toMatchObject({ amount: 7500, version: 2 })
    expect(row.edited_at).toEqual(expect.any(String))
    expect(db.tables.messages.at(-1)).toMatchObject({
      type: "purchase_event",
      sender_id: STUDENT,
      receiver_id: CLIENT,
      content: "La demande N° 1 a été modifiée.",
    })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: CLIENT, type: "purchase_updated", dedupeKey: `purchase:${REQ}:updated:2` }))
  })

  it("version périmée : stale, rien d'écrit", async () => {
    asStudent()
    seedPending({ version: 2, edited_at: "2026-10-17T09:00:00.000Z" })
    const res = await editPurchaseRequest(editInput({ expectedVersion: 1 }))
    expect(res).toEqual({ error: PURCHASE_ERR.stale, stale: true })
    expect(wroteAnything()).toBe(false)
  })

  it("double clic sur Enregistrer : une seule modification (la seconde est périmée)", async () => {
    asStudent()
    seedPending()
    const first = await editPurchaseRequest(editInput())
    const second = await editPurchaseRequest(editInput())
    expect(first.success).toBe(true)
    expect(second.stale).toBe(true)
    expect(db.tables.purchase_requests[0].version).toBe(2)
    expect(db.tables.messages.filter((m) => m.type === "purchase_event")).toHaveLength(1)
  })

  it("course : la version change entre la lecture et l'écriture, aucune ligne modifiée : stale", async () => {
    asStudent()
    seedPending()
    db.faults["purchase_requests.update"] = () => {
      db.tables.purchase_requests[0].version = 2
      return null
    }
    const res = await editPurchaseRequest(editInput())
    expect(res.stale).toBe(true)
    expect(db.tables.purchase_requests[0].amount).toBe(6000)
    expect(db.tables.messages).toHaveLength(0)
  })

  it("demande d'un autre étudiant, ou inconnue : introuvable, sans écriture", async () => {
    seedPending()
    asStudent(OTHER_STUDENT)
    expect(await editPurchaseRequest(editInput({
      payeePhotoPath: proof(OTHER_STUDENT, REQ, "payee"),
      ticketPhotoPath: proof(OTHER_STUDENT, REQ, "ticket"),
    }))).toEqual({ error: PURCHASE_ERR.notFound })
    asStudent()
    expect(await editPurchaseRequest(editInput({ requestId: IDS.foreignRequest }))).toEqual({ error: PURCHASE_ERR.proof })
    expect(wroteAnything()).toBe(false)
  })

  it("rôle client refusé sans service role", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    seedPending()
    const res = await editPurchaseRequest(editInput())
    expect(res.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("demande payée : plus modifiable (stale), mission terminée : action impossible", async () => {
    asStudent()
    seedPending({ status: "paid", paid_at: "2026-10-17T09:00:00.000Z", sms_photo_path: "x", beneficiary_confirmed: true })
    expect((await editPurchaseRequest(editInput())).stale).toBe(true)
    db.tables.purchase_requests[0].status = "pending"
    db.tables.missions[0].status = "done"
    expect(await editPurchaseRequest(editInput())).toEqual({ error: PURCHASE_ERR.notAllowed })
    expect(wroteAnything()).toBe(false)
  })

  it("modification sans changement : refusée", async () => {
    asStudent()
    seedPending()
    const res = await editPurchaseRequest(editInput({ amount: 6000 }))
    expect(res).toEqual({ error: PURCHASE_ERR.noChange, unchanged: true })
    expect(wroteAnything()).toBe(false)
  })

  it("numéro devenu le téléphone du profil : refusé", async () => {
    asStudent()
    seedPending()
    const res = await editPurchaseRequest(editInput({ payeeKind: "personal", payeeNumber: "0197000001" }))
    expect(res).toEqual({ error: PURCHASE_ERR.payeeSelf })
    expect(wroteAnything()).toBe(false)
  })

  it("photo remplacée absente du compartiment : refusée ; photo conservée non revérifiée", async () => {
    asStudent()
    seedPending()
    const fresh = proof(STUDENT, REQ, "ticket", "zzzzzzzz99")
    expect(await editPurchaseRequest(editInput({ ticketPhotoPath: fresh }))).toEqual({ error: PURCHASE_ERR.proof })
    db.objects.add(fresh)
    expect((await editPurchaseRequest(editInput({ ticketPhotoPath: fresh }))).success).toBe(true)
    expect(db.tables.purchase_requests[0].ticket_photo_path).toBe(fresh)
  })

  it("chemin de preuve d'autrui refusé", async () => {
    asStudent()
    seedPending()
    expect(await editPurchaseRequest(editInput({ payeePhotoPath: proof(OTHER_STUDENT, REQ, "payee") }))).toEqual({ error: PURCHASE_ERR.proof })
  })

  it("débit : 5 écritures en 10 minutes, refus", async () => {
    asStudent()
    seedPending()
    const now = new Date().toISOString()
    for (let i = 0; i < 5; i += 1) {
      db.tables.messages.push({ id: `66666666-6666-4666-8666-${String(i).padStart(12, "0")}`, sender_id: STUDENT, type: "purchase_event", content: "La demande N° 1 a été modifiée.", created_at: now })
    }
    expect(await editPurchaseRequest(editInput())).toEqual({ error: PURCHASE_ERR.rate })
  })

  it("masque les coordonnées du vendeur modifié", async () => {
    asStudent()
    seedPending()
    await editPurchaseRequest(editInput({ vendorName: "Chez Paul 0197123456" }))
    expect(db.tables.purchase_requests[0].vendor_name).not.toMatch(/0197123456/)
  })

  it("table absente : indisponible", async () => {
    asStudent()
    db.faults["purchase_requests.select"] = { code: "PGRST205", message: "Could not find the table in the schema cache" }
    expect(await editPurchaseRequest(editInput())).toEqual({ error: PURCHASE_ERR.unavailable, unavailable: true })
  })

  it("trigger SQL qui refuse (mission plus en cours entre-temps) : action impossible, sans fuite", async () => {
    asStudent()
    seedPending()
    db.faults["purchase_requests.update"] = { code: "42501", message: "Demande d'achats : la mission n'est plus en cours." }
    const res = await editPurchaseRequest(editInput())
    expect(res).toEqual({ error: PURCHASE_ERR.notAllowed })
  })
})

// ─── Annulation ──────────────────────────────────────────────────────────────────────────────

describe("cancelPurchaseRequest", () => {
  it("chemin nominal", async () => {
    asStudent()
    seedPending()
    const res = await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })
    expect(res).toEqual({ success: true, request: { id: REQ, seq: 1, status: "cancelled", version: 1 } })
    expect(db.tables.purchase_requests[0].cancelled_at).toEqual(expect.any(String))
    expect(db.tables.messages[0]).toMatchObject({ type: "purchase_event", content: "La demande N° 1 a été annulée." })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: CLIENT, type: "purchase_cancelled", dedupeKey: `purchase:${REQ}:cancelled:1` }))
  })

  it("double clic : la seconde annulation répond succès sans rien réécrire", async () => {
    asStudent()
    seedPending()
    await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })
    const writesBefore = db.writes.length
    const second = await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })
    expect(second).toEqual({ success: true, already: true, request: { id: REQ, seq: 1, status: "cancelled", version: 1 } })
    expect(db.writes.length).toBe(writesBefore)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it("version périmée, demande déjà payée : stale", async () => {
    asStudent()
    seedPending({ version: 2, edited_at: "2026-10-17T09:00:00.000Z" })
    expect((await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })).stale).toBe(true)
    db.tables.purchase_requests[0].status = "paid"
    expect((await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 2 })).stale).toBe(true)
    expect(db.tables.purchase_requests[0].status).toBe("paid")
  })

  it("demande d'un autre étudiant : introuvable ; le client ne peut pas annuler", async () => {
    seedPending()
    asStudent(OTHER_STUDENT)
    expect(await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })).toEqual({ error: PURCHASE_ERR.notFound })
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const callsBefore = createServiceClient.mock.calls.length
    expect((await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })).error).toBeTruthy()
    expect(createServiceClient.mock.calls.length).toBe(callsBefore)
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("mission terminée ou annulée : impossible d'annuler", async () => {
    asStudent()
    seedPending()
    for (const status of ["done", "cancelled"]) {
      db.tables.missions[0].status = status
      expect(await cancelPurchaseRequest({ requestId: REQ, expectedVersion: 1 })).toEqual({ error: PURCHASE_ERR.notAllowed })
    }
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("identifiant forgé ou version absurde : refus sans service role", async () => {
    asStudent()
    for (const input of [{ requestId: "../x", expectedVersion: 1 }, { requestId: REQ, expectedVersion: 0 }, { requestId: REQ, expectedVersion: 1.5 }, { requestId: REQ }, null]) {
      expect((await cancelPurchaseRequest(input)).error).toBeTruthy()
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

// ─── Paiement ────────────────────────────────────────────────────────────────────────────────

const paidInput = (overrides = {}) => ({
  requestId: REQ,
  expectedVersion: 1,
  smsPhotoPath: proof(CLIENT, REQ, "sms"),
  beneficiaryConfirmed: true,
  paidReference: "MP2610-1234",
  ...overrides,
})

describe("markPurchasePaid", () => {
  beforeEach(() => {
    asClient()
    seedPending()
    db.objects.add(proof(CLIENT, REQ, "sms"))
  })

  it("chemin nominal : statut payé, capture, case, référence, ligne système, notification à l'étudiant", async () => {
    const res = await markPurchasePaid(paidInput())
    expect(res).toEqual({ success: true, request: { id: REQ, seq: 1, status: "paid", version: 1 } })
    expect(db.tables.purchase_requests[0]).toMatchObject({
      status: "paid",
      sms_photo_path: proof(CLIENT, REQ, "sms"),
      beneficiary_confirmed: true,
      paid_reference: "MP2610-1234",
    })
    expect(db.tables.purchase_requests[0].paid_at).toEqual(expect.any(String))
    expect(db.tables.messages[0]).toMatchObject({ type: "purchase_event", sender_id: CLIENT, receiver_id: STUDENT, content: "La demande N° 1 est marquée « Payé »." })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: STUDENT, type: "purchase_paid", dedupeKey: `purchase:${REQ}:paid:1` }))
    expect([...new Set(db.writes.map((w) => w.table))].sort()).toEqual(["messages", "purchase_requests"])
  })

  it("référence facultative : null en base", async () => {
    await markPurchasePaid(paidInput({ paidReference: "" }))
    expect(db.tables.purchase_requests[0].paid_reference).toBeNull()
  })

  it("mission terminée : « Payé » reste possible (D5)", async () => {
    db.tables.missions[0].status = "done"
    expect((await markPurchasePaid(paidInput())).success).toBe(true)
  })

  it("mission annulée : impossible", async () => {
    db.tables.missions[0].status = "cancelled"
    expect(await markPurchasePaid(paidInput())).toEqual({ error: PURCHASE_ERR.notAllowed })
  })

  it("capture obligatoire, case obligatoire, référence valide : refus sans service role", async () => {
    const calls = createServiceClient.mock.calls.length
    const bad = [
      paidInput({ smsPhotoPath: undefined }),
      paidInput({ smsPhotoPath: "" }),
      paidInput({ beneficiaryConfirmed: false }),
      paidInput({ beneficiaryConfirmed: undefined }),
      paidInput({ beneficiaryConfirmed: "true" }),
      paidInput({ paidReference: "a b!" }),
      paidInput({ paidReference: "x".repeat(41) }),
      paidInput({ expectedVersion: "1" }),
    ]
    for (const input of bad) {
      const res = await markPurchasePaid(input)
      expect(res.error, JSON.stringify(input)).toEqual(expect.any(String))
    }
    expect(createServiceClient.mock.calls.length).toBe(calls)
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("capture hors du dossier du client (dossier de l'étudiant, d'un autre client, `..`, autre demande, autre nature) : refusée", async () => {
    const calls = createServiceClient.mock.calls.length
    for (const path of [
      proof(STUDENT, REQ, "sms"),
      proof(OTHER_CLIENT, REQ, "sms"),
      proof(CLIENT, IDS.request2, "sms"),
      proof(CLIENT, REQ, "payee"),
      `${CLIENT}/${REQ}/../${STUDENT}/sms-a1b2c3d4e5.jpg`,
    ]) {
      expect(await markPurchasePaid(paidInput({ smsPhotoPath: path }))).toEqual({ error: PURCHASE_ERR.proof })
    }
    expect(createServiceClient.mock.calls.length).toBe(calls)
  })

  it("capture jamais téléversée : refusée", async () => {
    db.objects.delete(proof(CLIENT, REQ, "sms"))
    expect(await markPurchasePaid(paidInput())).toEqual({ error: PURCHASE_ERR.proof })
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("version périmée (l'étudiant a modifié la demande) : stale, rien d'écrit", async () => {
    db.tables.purchase_requests[0].version = 2
    db.tables.purchase_requests[0].edited_at = "2026-10-17T09:00:00.000Z"
    const res = await markPurchasePaid(paidInput({ expectedVersion: 1 }))
    expect(res).toEqual({ error: PURCHASE_ERR.stale, stale: true })
    expect(db.tables.purchase_requests[0].status).toBe("pending")
    expect(wroteAnything()).toBe(false)
  })

  it("l'étudiant a annulé entre-temps : stale", async () => {
    db.tables.purchase_requests[0].status = "cancelled"
    db.tables.purchase_requests[0].cancelled_at = "2026-10-17T09:00:00.000Z"
    expect((await markPurchasePaid(paidInput())).stale).toBe(true)
  })

  it("double clic : un seul paiement, une seule ligne système, une seule notification", async () => {
    const first = await markPurchasePaid(paidInput())
    const second = await markPurchasePaid(paidInput())
    expect(first.success).toBe(true)
    expect(second).toEqual({ success: true, already: true, request: { id: REQ, seq: 1, status: "paid", version: 1 } })
    expect(db.tables.messages).toHaveLength(1)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(written("purchase_requests")).toHaveLength(1)
  })

  it("course : l'étudiant modifie entre la lecture et l'écriture : stale, la demande reste en attente", async () => {
    db.faults["purchase_requests.update"] = () => {
      db.tables.purchase_requests[0].version = 2
      return null
    }
    expect((await markPurchasePaid(paidInput())).stale).toBe(true)
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("demande d'un autre client : introuvable ; mission d'un autre client : aucune fuite", async () => {
    asClient(OTHER_CLIENT)
    db.objects.add(proof(OTHER_CLIENT, REQ, "sms"))
    expect(await markPurchasePaid(paidInput({ smsPhotoPath: proof(OTHER_CLIENT, REQ, "sms") }))).toEqual({ error: PURCHASE_ERR.notFound })
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("la mission de la demande ne correspond plus aux parties (étudiant remplacé) : introuvable", async () => {
    db.tables.missions[0].selected_student_id = OTHER_STUDENT
    expect(await markPurchasePaid(paidInput())).toEqual({ error: PURCHASE_ERR.notFound })
  })

  it("l'étudiant ne peut pas marquer payé", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const calls = createServiceClient.mock.calls.length
    expect((await markPurchasePaid(paidInput())).error).toBeTruthy()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(createServiceClient.mock.calls.length).toBe(calls)
  })

  it("aucun montant d'achat dans le portefeuille : aucune écriture hors demandes et messages", async () => {
    await markPurchasePaid(paidInput())
    expect(db.writes.every((w) => ["purchase_requests", "messages"].includes(w.table))).toBe(true)
  })

  it("script 94 absent : indisponible", async () => {
    db.faults["purchase_requests.select"] = { code: "42P01", message: "relation does not exist" }
    expect(await markPurchasePaid(paidInput())).toEqual({ error: PURCHASE_ERR.unavailable, unavailable: true })
  })
})

// ─── Réception ───────────────────────────────────────────────────────────────────────────────

describe("confirmPurchaseReceived", () => {
  const paidRow = (overrides = {}) =>
    requestRow({
      status: "paid",
      paid_at: "2026-10-17T09:00:00.000Z",
      sms_photo_path: proof(CLIENT, REQ, "sms"),
      beneficiary_confirmed: true,
      ...overrides,
    })

  it("chemin nominal : reçu, ligne système, notification au client", async () => {
    asStudent()
    db.tables.purchase_requests.push(paidRow())
    const res = await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })
    expect(res).toEqual({ success: true, request: { id: REQ, seq: 1, status: "received", version: 1 } })
    expect(db.tables.purchase_requests[0].received_at).toEqual(expect.any(String))
    expect(db.tables.messages[0]).toMatchObject({ sender_id: STUDENT, receiver_id: CLIENT, content: "Le vendeur a bien reçu le paiement de la demande N° 1." })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: CLIENT, type: "purchase_received", dedupeKey: `purchase:${REQ}:received:1` }))
  })

  it("demande encore en attente : stale ; déjà reçue : succès sans réécriture", async () => {
    asStudent()
    db.tables.purchase_requests.push(requestRow())
    expect((await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).stale).toBe(true)
    db.tables.purchase_requests[0] = paidRow({ status: "received", received_at: "2026-10-17T10:00:00.000Z" })
    const before = db.writes.length
    expect(await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).toEqual({
      success: true,
      already: true,
      request: { id: REQ, seq: 1, status: "received", version: 1 },
    })
    expect(db.writes.length).toBe(before)
  })

  it("mission terminée : la confirmation reste possible (D5) ; mission annulée : non", async () => {
    asStudent()
    db.tables.purchase_requests.push(paidRow())
    db.tables.missions[0].status = "cancelled"
    expect(await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).toEqual({ error: PURCHASE_ERR.notAllowed })
    db.tables.missions[0].status = "done"
    expect((await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).success).toBe(true)
  })

  it("autre étudiant : introuvable ; client : refusé", async () => {
    db.tables.purchase_requests.push(paidRow())
    asStudent(OTHER_STUDENT)
    expect(await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).toEqual({ error: PURCHASE_ERR.notFound })
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect((await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })).error).toBeTruthy()
    expect(db.tables.purchase_requests[0].status).toBe("paid")
  })

  it("double clic concurrent : l'autre onglet a déjà confirmé entre la lecture et l'écriture : succès sans doublon", async () => {
    asStudent()
    db.tables.purchase_requests.push(paidRow())
    db.faults["purchase_requests.update"] = () => {
      Object.assign(db.tables.purchase_requests[0], { status: "received", received_at: "2026-10-17T10:00:00.000Z" })
      return null
    }
    const res = await confirmPurchaseReceived({ requestId: REQ, expectedVersion: 1 })
    expect(res.success).toBe(true)
    expect(res.already).toBe(true)
    expect(db.tables.messages).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
  })
})

// ─── Signalement ─────────────────────────────────────────────────────────────────────────────

const reportInput = (overrides = {}) => ({
  requestId: REQ,
  reason: "purchase_amount_mismatch",
  details: "Le montant payé ne correspond pas au ticket.",
  ...overrides,
})

describe("signalement d'une demande", () => {
  beforeEach(() => {
    seedPending()
  })

  it("étudiant : signalement, demande à Signalé, ligne système, notification au client seulement", async () => {
    asStudent()
    const res = await reportPurchaseRequestAsStudent(reportInput())
    expect(res).toEqual({ success: true, reference: "SIG-0001" })
    expect(db.tables.reports).toHaveLength(1)
    expect(db.tables.reports[0]).toMatchObject({
      source: "user",
      target_type: "purchase_request",
      purchase_request_id: REQ,
      mission_id: MISSION,
      reporter_id: STUDENT,
      reported_user_id: CLIENT,
      reason: "purchase_amount_mismatch",
    })
    expect(db.tables.purchase_requests[0].status).toBe("reported")
    expect(db.tables.purchase_requests[0].reported_at).toEqual(expect.any(String))
    expect(db.tables.messages[0]).toMatchObject({ type: "purchase_event", sender_id: STUDENT, receiver_id: CLIENT, content: "La demande N° 1 a été signalée." })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: CLIENT, type: "purchase_reported" }))
  })

  it("client : signalement, notification à l'étudiant seulement, aucune notification admin", async () => {
    asClient()
    const res = await reportPurchaseRequestAsClient(reportInput({ reason: "purchase_payee_mismatch" }))
    expect(res.success).toBe(true)
    expect(db.tables.reports[0]).toMatchObject({ reporter_id: CLIENT, reported_user_id: STUDENT })
    const recipients = notify.mock.calls.map(([n]) => n.recipientId)
    expect(recipients).toEqual([STUDENT])
    expect(recipients).not.toContain(IDS.admin)
  })

  it("signale une demande payée ou reçue, et une mission terminée (D5), mais pas une demande annulée", async () => {
    asClient()
    db.tables.purchase_requests[0].status = "paid"
    db.tables.purchase_requests[0].paid_at = "2026-10-17T09:00:00.000Z"
    db.tables.missions[0].status = "done"
    expect((await reportPurchaseRequestAsClient(reportInput())).success).toBe(true)

    db = createFakeDb({ missions: [missionRow()], profiles: profiles() })
    createServiceClient.mockImplementation(() => db.service())
    seedPending({ status: "cancelled", cancelled_at: "2026-10-17T09:00:00.000Z" })
    asClient()
    expect(await reportPurchaseRequestAsClient(reportInput())).toEqual({ error: PURCHASE_ERR.notAllowed })
    expect(db.tables.reports).toHaveLength(0)
  })

  it("double signalement de la même partie : succès idempotent, même référence, une seule ligne", async () => {
    asStudent()
    const first = await reportPurchaseRequestAsStudent(reportInput())
    const second = await reportPurchaseRequestAsStudent(reportInput({ reason: "other", details: "Une autre explication, plus longue." }))
    expect(second).toEqual({ success: true, already: true, reference: first.reference })
    expect(db.tables.reports).toHaveLength(1)
    expect(db.tables.messages.filter((m) => m.type === "purchase_event")).toHaveLength(1)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it("les deux parties peuvent signaler : deux lignes, la seconde ne change plus le statut et prévient la première", async () => {
    asStudent()
    await reportPurchaseRequestAsStudent(reportInput())
    notify.mockClear()
    asClient()
    const res = await reportPurchaseRequestAsClient(reportInput({ reason: "purchase_vendor_not_paid" }))
    expect(res).toEqual({ success: true, reference: "SIG-0002" })
    expect(db.tables.reports).toHaveLength(2)
    expect(db.tables.purchase_requests[0].status).toBe("reported")
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: STUDENT, type: "purchase_reported" }))
  })

  it("échec du passage à Signalé : rattrapé au rejeu du même signalement", async () => {
    asStudent()
    let first = true
    db.faults["purchase_requests.update"] = () => {
      if (!first) return null
      first = false
      return { code: "XX000", message: "boom" }
    }
    const res = await reportPurchaseRequestAsStudent(reportInput())
    expect(res.success).toBe(true)
    expect(db.tables.purchase_requests[0].status).toBe("pending")
    const again = await reportPurchaseRequestAsStudent(reportInput())
    expect(again.already).toBe(true)
    expect(db.tables.purchase_requests[0].status).toBe("reported")
  })

  it("tiers, autre étudiant, autre client : introuvable, aucune écriture", async () => {
    asStudent(OTHER_STUDENT)
    expect(await reportPurchaseRequestAsStudent(reportInput())).toEqual({ error: PURCHASE_ERR.notFound })
    asClient(OTHER_CLIENT)
    expect(await reportPurchaseRequestAsClient(reportInput())).toEqual({ error: PURCHASE_ERR.notFound })
    expect(wroteAnything()).toBe(false)
  })

  it("l'étudiant ne peut pas appeler le signalement client et inversement, l'admin non plus", async () => {
    for (const [fn, role] of [[reportPurchaseRequestAsClient, "client"], [reportPurchaseRequestAsStudent, "student"]]) {
      requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
      expect((await fn(reportInput())).error).toBeTruthy()
      expect(requireRole).toHaveBeenLastCalledWith([role])
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("la mission de la demande ne correspond pas aux parties : introuvable", async () => {
    asStudent()
    db.tables.missions[0].client_id = OTHER_CLIENT
    expect(await reportPurchaseRequestAsStudent(reportInput())).toEqual({ error: PURCHASE_ERR.notFound })
    expect(db.tables.reports).toHaveLength(0)
  })

  it("motif de la messagerie, motif inconnu, explication trop courte ou trop longue : refusés sans service role", async () => {
    asStudent()
    for (const input of [
      reportInput({ reason: "harassment" }),
      reportInput({ reason: "n'importe quoi" }),
      reportInput({ reason: undefined }),
      reportInput({ details: "court" }),
      reportInput({ details: "x".repeat(1001) }),
      reportInput({ details: undefined }),
      null,
    ]) {
      expect((await reportPurchaseRequestAsStudent(input)).error).toBeTruthy()
    }
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("explication : coordonnées masquées puis coupée à 1 000 caractères", async () => {
    asStudent()
    await reportPurchaseRequestAsStudent(reportInput({ details: `Appelez le 0197123456 ${"a".repeat(970)}` }))
    const details = db.tables.reports[0].details
    expect(details).not.toMatch(/0197123456/)
    expect(details.length).toBeLessThanOrEqual(1000)
  })

  it("plafond de 10 signalements par 24 h", async () => {
    asStudent()
    const now = new Date().toISOString()
    for (let i = 0; i < 10; i += 1) {
      db.tables.reports.push({ id: `77777777-7777-4777-8777-${String(i).padStart(12, "0")}`, reporter_id: STUDENT, purchase_request_id: null, created_at: now })
    }
    expect(await reportPurchaseRequestAsStudent(reportInput())).toEqual({ error: PURCHASE_ERR.reportLimit })
    expect(db.tables.reports).toHaveLength(10)
    expect(db.tables.purchase_requests[0].status).toBe("pending")
  })

  it("collision d'unicité en course : succès idempotent avec la référence existante", async () => {
    asStudent()
    let first = true
    db.faults["reports.insert"] = () => {
      if (!first) return null
      first = false
      db.tables.reports.push({ id: "r1", number: 7, purchase_request_id: REQ, reporter_id: STUDENT, status: "open", reason: "other", created_at: new Date().toISOString() })
      return { code: "23505", message: "duplicate key" }
    }
    const res = await reportPurchaseRequestAsStudent(reportInput())
    expect(res).toEqual({ success: true, already: true, reference: "SIG-0007" })
  })

  it("table des signalements absente : indisponible ; erreur de base sans fuite", async () => {
    asStudent()
    db.faults["reports.select"] = { code: "42P01", message: "relation does not exist" }
    expect(await reportPurchaseRequestAsStudent(reportInput())).toEqual({ error: PURCHASE_ERR.unavailable, unavailable: true })
    db.faults["reports.select"] = null
    db.faults["reports.insert"] = { code: "XX000", message: "secret interne", details: "ligne privée" }
    const res = await reportPurchaseRequestAsStudent(reportInput())
    expect(res).toEqual({ error: PURCHASE_ERR.reportFailed })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toMatch(/secret|privée/)
  })
})

// ─── Lecteurs ────────────────────────────────────────────────────────────────────────────────

describe("lecteurs", () => {
  function seedPaid() {
    seedPending({
      status: "paid",
      paid_at: "2026-10-17T09:00:00.000Z",
      sms_photo_path: proof(CLIENT, REQ, "sms"),
      beneficiary_confirmed: true,
      paid_reference: "MP-1",
    })
  }

  it("le client voit le numéro à payer, le vendeur et des adresses signées de 120 s, jamais un chemin", async () => {
    asClient()
    seedPaid()
    const res = await getClientPurchaseRequests({ missionId: MISSION })
    expect(res.available).toBe(true)
    expect(res.requests).toHaveLength(1)
    const view = res.requests[0]
    expect(view).toMatchObject({ id: REQ, seq: 1, status: "paid", payeeNumber: "123456", vendorName: "Poissonnerie Dossa", amount: 6000, paidReference: "MP-1" })
    expect(view.payeePhotoUrl).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/sign\/purchase-proofs\//)
    expect(view.smsPhotoUrl).toContain("/sms-")
    expect(db.signedTtl).toEqual([120])
    const withoutUrls = JSON.stringify(res).replace(/https:\/\/[^"]+/g, "")
    expect(withoutUrls).not.toMatch(new RegExp(`${STUDENT}|payee-|ticket-|sms-`))
    expect(view).not.toHaveProperty("payeePhotoPath")
    expect(view).not.toHaveProperty("student_id")
  })

  it("l'étudiant voit sa demande, la capture du client et SES deux chemins pour modifier, rien du client", async () => {
    asStudent()
    seedPaid()
    const res = await getStudentPurchaseRequests({ missionId: MISSION })
    const view = res.requests[0]
    expect(view.payeePhotoPath).toBe(proof(STUDENT, REQ, "payee"))
    expect(view.ticketPhotoPath).toBe(proof(STUDENT, REQ, "ticket"))
    expect(view).not.toHaveProperty("smsPhotoPath")
    expect(view.smsPhotoUrl).toContain("/sms-")
    expect(JSON.stringify(res)).not.toMatch(/0197000002|Awa|Sossou|client_id|sms_photo_path/)
    expect(res.canCreate).toBe(true)
    expect(res.totals).toEqual({ count: 1, requested: 6000, paid: 6000, pending: 0, reported: 0 })
  })

  it("ne renvoie jamais de colonne d'administration ni le commentaire d'un signalement", async () => {
    asClient()
    seedPending({ status: "reported", reported_at: "2026-10-17T10:00:00.000Z" })
    db.tables.reports.push({
      id: "r1",
      number: 3,
      purchase_request_id: REQ,
      reporter_id: STUDENT,
      reported_user_id: CLIENT,
      status: "resolved",
      reason: "purchase_vendor_not_paid",
      details: "Texte privé du signalement",
      handled_by: IDS.admin,
      resolution_note: "Note interne de l'équipe",
    })
    const res = await getClientPurchaseRequests({ missionId: MISSION })
    const view = res.requests[0]
    expect(view).toMatchObject({ status: "reported", reportReason: "purchase_vendor_not_paid", reviewed: true, alreadyReportedByMe: false, reportReference: null })
    expect(JSON.stringify(res)).not.toMatch(/Texte privé|Note interne|handled_by|resolution_note|SIG-0003/)
  })

  it("alreadyReportedByMe et la référence ne concernent que l'appelant", async () => {
    seedPending({ status: "reported", reported_at: "2026-10-17T10:00:00.000Z" })
    db.tables.reports.push({ id: "r1", number: 3, purchase_request_id: REQ, reporter_id: STUDENT, status: "open", reason: "other" })
    asStudent()
    const mine = (await getStudentPurchaseRequests({ missionId: MISSION })).requests[0]
    expect(mine).toMatchObject({ alreadyReportedByMe: true, reportReference: "SIG-0003", reviewed: false })
    expect(mine.actions).not.toContain("report")
  })

  it("mission d'un autre client, identifiant forgé : introuvable ; étudiant non retenu : liste vide", async () => {
    seedPaid()
    asClient(OTHER_CLIENT)
    expect(await getClientPurchaseRequests({ missionId: MISSION })).toEqual({ notFound: true })
    asClient()
    expect(await getClientPurchaseRequests({ missionId: "../x" })).toEqual({ notFound: true })
    expect(await getClientPurchaseRequests()).toEqual({ notFound: true })
    db.tables.missions.push(missionRow({ id: IDS.otherMission, status: "open", selected_student_id: null }))
    asStudent(OTHER_STUDENT)
    const res = await getStudentPurchaseRequests({ missionId: IDS.otherMission })
    expect(res).toMatchObject({ available: true, requests: [], canCreate: false })
    asStudent(OTHER_STUDENT)
    expect(await getStudentPurchaseRequests({ missionId: MISSION })).toEqual({ notFound: true })
  })

  it("un client ne lit jamais la demande d'un autre client sur sa propre mission", async () => {
    seedPaid()
    db.tables.purchase_requests[0].client_id = OTHER_CLIENT
    asClient()
    const res = await getClientPurchaseRequests({ missionId: MISSION })
    expect(res.requests).toEqual([])
  })

  it("script 94 absent : { available: false } ; erreur de base : message neutre", async () => {
    asClient()
    seedPaid()
    db.faults["purchase_requests.select"] = { code: "PGRST205", message: "schema cache" }
    expect(await getClientPurchaseRequests({ missionId: MISSION })).toEqual({ available: false })
    db.faults["purchase_requests.select"] = { code: "XX000", message: "secret" }
    const res = await getClientPurchaseRequests({ missionId: MISSION })
    expect(res).toEqual({ error: PURCHASE_ERR.load })
  })

  it("signature impossible : adresses absentes, la liste reste lisible", async () => {
    asClient()
    seedPaid()
    db.storageFault = { statusCode: "500", message: "boom" }
    const res = await getClientPurchaseRequests({ missionId: MISSION })
    expect(res.requests[0]).toMatchObject({ id: REQ, payeePhotoUrl: null, ticketPhotoUrl: null, smsPhotoUrl: null })
  })

  it("rôle refusé : aucun service role", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect((await getStudentPurchaseRequests({ missionId: MISSION })).error).toBeTruthy()
    expect((await getClientPurchaseRequests({ missionId: MISSION })).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("actions possibles selon le statut de la mission (mission terminée : plus de modification)", async () => {
    asStudent()
    seedPending()
    db.tables.missions[0].status = "done"
    const res = await getStudentPurchaseRequests({ missionId: MISSION })
    expect(res.requests[0].actions).toEqual(["report"])
    expect(res.canCreate).toBe(false)
  })
})
