import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn(async () => ({ ok: true })) }))
vi.mock("@/lib/actions/profile.actions", () => ({
  getMyProfile: vi.fn(async () => ({ profile: { is_verified: true, verified_until: null, rejection_reason: null } })),
  getMyStudentProfile: vi.fn(async () => ({ studentProfile: { card_url: "student-cards/x.png" } })),
}))

import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { getStudentMissionDetail } from "@/lib/actions/student-mission-detail.actions"
import { getClientMissionDetail } from "@/lib/actions/client-mission-detail.actions"
import { IDS, SUPABASE_URL, createFakeDb, missionRow, proof, requestRow } from "@/lib/actions/purchase-fake-db.test-support"

// Lecteurs de détail de mission (E05, C08, C09, C11) branchés sur les VRAIS lecteurs de demandes d'achats (ST-04) et
// une base en mémoire : accès croisés, mission sans achats, table absente, totaux et données exposées à chaque partie
// (RD-ACHATS-01 ST-07).

const { client: CLIENT, otherClient: OTHER_CLIENT, student: STUDENT, otherStudent: OTHER_STUDENT, mission: MISSION } = IDS

let db

// Lecteur de table sans donnée (candidatures, grand livre, avis, profils...) : seules les missions sont réelles.
function emptyBuilder() {
  const b = {
    select: () => b,
    eq: () => b,
    in: () => b,
    neq: () => b,
    or: () => b,
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (ok, ko) => Promise.resolve({ data: [], error: null }).then(ok, ko),
  }
  return b
}

// Missions réelles (RLS imitée). Le faux client ne connaît ni `or` ni `neq` (lecture des missions similaires d'une
// mission ouverte) : ils sont sans effet ici, les similaires ne sont pas l'objet de ces tests.
function missionsBuilder(session) {
  const b = session.from("missions")
  b.or = () => b
  b.neq = () => b
  return b
}

function sessionFor(userId) {
  const missions = db.session(userId)
  return {
    from: (table) => (table === "missions" ? missionsBuilder(missions) : emptyBuilder()),
  }
}

function asRole(role, id) {
  requireRole.mockResolvedValue({ supabase: sessionFor(id), user: { id }, role, profile: { role, full_name: "Test Personne", is_suspended: false } })
}

// Les adresses signées contiennent le dossier du déposant (identifiant de la partie) : on les écarte pour chercher une
// fuite hors de ces adresses de photos.
const withoutSignedUrls = (value) => JSON.stringify(value).replace(/https:\/\/proj\.supabase\.co[^"]*/g, "")

const card = (requestId) => ({ id: `msg-${requestId}`, type: "purchase_request", purchase_request_id: requestId })

function seed({ mission = {}, requests = [] } = {}) {
  db = createFakeDb({
    missions: [missionRow({ budget: 10000, ...mission })],
    profiles: [
      { user_id: STUDENT, phone: "+2290197000001", is_suspended: false },
      { user_id: CLIENT, phone: "+2290197000002", is_suspended: false },
    ],
    purchase_requests: requests,
    messages: requests.filter((r) => r.status === "cancelled").map((r) => card(r.id)),
  })
  createServiceClient.mockReset()
  createServiceClient.mockImplementation(() => db.service())
}

const R1 = "33333333-3333-4333-8333-333333333331"
const R2 = "33333333-3333-4333-8333-333333333332"
const R3 = "33333333-3333-4333-8333-333333333333"
const R4 = "33333333-3333-4333-8333-333333333334"
const R5 = "33333333-3333-4333-8333-333333333335"

const threeRequests = () => [
  requestRow({ id: R1, seq: 1, status: "pending", amount: 6000 }),
  requestRow({
    id: R2,
    seq: 2,
    status: "received",
    amount: 4000,
    paid_at: "2026-01-02T08:00:00.000Z",
    received_at: "2026-01-02T09:00:00.000Z",
    sms_photo_path: proof(CLIENT, R2, "sms"),
    beneficiary_confirmed: true,
  }),
  requestRow({ id: R3, seq: 3, status: "reported", amount: 2500, reported_at: "2026-01-03T08:00:00.000Z" }),
]

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  requireRole.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("étudiant : détail de mission avec demandes d'achats", () => {
  it("retenu, 0 demande : bloc disponible, création possible, estimation séparée", async () => {
    seed()
    asRole("student", STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("selected")
    expect(detail.purchases).toMatchObject({ available: true, requests: [], canCreate: true, exceedsEstimate: false })
    expect(detail.purchases.totals).toEqual({ count: 0, requested: 0, paid: 0, pending: 0, reported: 0 })
    expect(detail.mission.purchasesEstimate).toBe(20000)
  })

  it("retenu, 1 demande : vue complète avec les actions de l'étudiant", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    asRole("student", STUDENT)
    const { purchases } = await getStudentMissionDetail(MISSION)
    expect(purchases.requests).toHaveLength(1)
    expect(purchases.requests[0]).toMatchObject({ id: R1, seq: 1, status: "pending", amount: 6000, vendorName: "Poissonnerie Dossa" })
    expect(purchases.requests[0].actions).toEqual(expect.arrayContaining(["edit", "cancel"]))
    expect(purchases.totals).toEqual({ count: 1, requested: 6000, paid: 0, pending: 6000, reported: 0 })
  })

  it("retenu, 3 demandes plus une annulée avec carte et une annulée sans carte : totaux justes, estimation jamais additionnée", async () => {
    seed({
      requests: [
        ...threeRequests(),
        requestRow({ id: R4, seq: 4, status: "cancelled", amount: 9000, cancelled_at: "2026-01-04T08:00:00.000Z" }),
        requestRow({ id: R5, seq: 5, status: "cancelled", amount: 7000, cancelled_at: "2026-01-04T08:00:00.000Z" }),
      ],
    })
    // Seule la carte de R4 existe : R5 (annulation de repli, sans carte) n'est jamais affichée.
    db.tables.messages = [card(R4)]
    asRole("student", STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    const { purchases } = detail
    expect(purchases.requests.map((r) => r.id)).toEqual([R1, R2, R3, R4])
    expect(purchases.totals).toEqual({ count: 3, requested: 12500, paid: 4000, pending: 6000, reported: 2500 })
    expect(purchases.totals.requested).toBeLessThan(20000)
    expect(detail.mission.purchasesEstimate).toBe(20000)
    expect(detail.ledger).toEqual([])
  })

  it("le plafond d'une fois et demie l'estimation est un indicateur, la création reste possible", async () => {
    seed({ requests: [requestRow({ id: R1, amount: 30001 })] })
    asRole("student", STUDENT)
    const { purchases } = await getStudentMissionDetail(MISSION)
    expect(purchases.exceedsEstimate).toBe(true)
    expect(purchases.canCreate).toBe(true)
  })

  it("accès croisé : un candidat d'une mission ouverte ne voit aucune demande et aucune lecture n'a lieu", async () => {
    seed({ mission: { status: "open", selected_student_id: null }, requests: [requestRow({ id: R1 })] })
    asRole("student", OTHER_STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("open")
    expect(detail.purchases).toEqual({ available: false })
    expect(db.servicesCreated).toBe(0)
  })

  it("accès croisé : un étudiant non retenu d'une mission en cours n'a rien (état fermé, aucune demande)", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    asRole("student", OTHER_STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail === null || detail.state === "closed").toBe(true)
    expect(JSON.stringify(detail)).not.toContain("Poissonnerie")
    expect(db.servicesCreated).toBe(0)
  })

  it("accès croisé : le client connecté sous le rôle étudiant est refusé par requireRole, rien n'est lu", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getStudentMissionDetail(MISSION)).toBeNull()
    expect(db.servicesCreated).toBe(0)
  })

  it("la demande d'un autre étudiant sur la même mission n'est jamais listée", async () => {
    seed({ requests: [requestRow({ id: R1 }), requestRow({ id: R2, seq: 2, student_id: OTHER_STUDENT })] })
    asRole("student", STUDENT)
    const { purchases } = await getStudentMissionDetail(MISSION)
    expect(purchases.requests.map((r) => r.id)).toEqual([R1])
  })

  it("mission sans achats : aucune lecture du service role, bloc indisponible", async () => {
    seed({ mission: { purchases_estimate: null }, requests: [] })
    asRole("student", STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.mission.purchasesEstimate).toBeNull()
    expect(db.servicesCreated).toBe(0)
  })

  it.each(["42P01", "PGRST205", "42703", "PGRST204"])("script 94 non appliqué (%s) : indisponible, aucune erreur, détail inchangé", async (code) => {
    seed({ requests: [requestRow({ id: R1 })] })
    db.faults["purchase_requests.select"] = { code, message: "relation does not exist" }
    asRole("student", STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.state).toBe("selected")
    expect(detail.mission.purchasesEstimate).toBe(20000)
  })

  it("table des signalements absente : indisponible, aucune erreur", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    db.faults["reports.select"] = { code: "42P01", message: "relation does not exist" }
    asRole("student", STUDENT)
    expect((await getStudentMissionDetail(MISSION)).purchases).toEqual({ available: false })
  })

  it("erreur de base inattendue : erreur neutre, aucun message SQL", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    db.faults["purchase_requests.select"] = { code: "XX000", message: "secret: connexion à db.internal" }
    asRole("student", STUDENT)
    await expect(getStudentMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
    await getStudentMissionDetail(MISSION).catch((e) => expect(e.message).not.toMatch(/secret|internal|XX000/))
  })

  it("aucune information privée du client : ni identifiant, ni téléphone, ni chemin de la capture du SMS", async () => {
    seed({ requests: threeRequests() })
    asRole("student", STUDENT)
    const detail = await getStudentMissionDetail(MISSION)
    const text = withoutSignedUrls(detail)
    expect(text).not.toContain(CLIENT)
    expect(text).not.toContain("+2290197000002")
    expect(text).not.toContain(proof(CLIENT, R2, "sms"))
    expect(text).not.toContain("sms-")
    for (const request of detail.purchases.requests) {
      for (const key of ["client_id", "clientId", "student_id", "studentId", "smsPhotoPath", "sms_photo_path", "updated_at"]) {
        expect(request, key).not.toHaveProperty(key)
      }
    }
  })

  it("photos : adresses signées de 120 s sur le compartiment privé", async () => {
    seed({ requests: [requestRow({ id: R1 })] })
    asRole("student", STUDENT)
    const { purchases } = await getStudentMissionDetail(MISSION)
    expect(db.signedTtl.length).toBeGreaterThan(0)
    expect(new Set(db.signedTtl)).toEqual(new Set([120]))
    expect(purchases.requests[0].ticketPhotoUrl).toMatch(new RegExp(`^${SUPABASE_URL}/storage/v1/object/sign/purchase-proofs/`))
  })

  it("aucune écriture : ni demande, ni message, ni signalement, ni portefeuille", async () => {
    seed({ requests: threeRequests() })
    asRole("student", STUDENT)
    await getStudentMissionDetail(MISSION)
    expect(db.writes).toEqual([])
  })
})

describe("client : détail de mission avec demandes d'achats", () => {
  it("propriétaire : numéro à payer, vendeur et actions du client", async () => {
    seed({ requests: threeRequests() })
    asRole("client", CLIENT)
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.available).toBe(true)
    const [pending, received, reported] = purchases.requests
    expect(pending).toMatchObject({ id: R1, payeeKind: "merchant", payeeNumber: "123456", vendorName: "Poissonnerie Dossa" })
    expect(pending.actions).toEqual(expect.arrayContaining(["markPaid", "report"]))
    expect(received.status).toBe("received")
    expect(reported.status).toBe("reported")
    expect(purchases.totals).toEqual({ count: 3, requested: 12500, paid: 4000, pending: 6000, reported: 2500 })
  })

  it("aucun chemin de fichier ni information privée de l'étudiant", async () => {
    seed({ requests: threeRequests() })
    asRole("client", CLIENT)
    const detail = await getClientMissionDetail(MISSION)
    const text = withoutSignedUrls(detail.purchases)
    expect(text).not.toContain("+2290197000001")
    expect(text).not.toContain(STUDENT)
    expect(text).not.toContain("payee-a1b2")
    for (const request of detail.purchases.requests) {
      for (const key of ["payeePhotoPath", "ticketPhotoPath", "payee_photo_path", "ticket_photo_path", "sms_photo_path", "client_id", "student_id"]) {
        expect(request, key).not.toHaveProperty(key)
      }
    }
    expect(new Set(db.signedTtl)).toEqual(new Set([120]))
  })

  it("accès croisé : un autre client ne reçoit rien (null), aucune lecture des demandes", async () => {
    seed({ requests: threeRequests() })
    asRole("client", OTHER_CLIENT)
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(db.servicesCreated).toBe(0)
  })

  it("accès croisé : le compte étudiant ou admin sous le rôle client est refusé, rien n'est lu", async () => {
    seed({ requests: threeRequests() })
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(db.servicesCreated).toBe(0)
  })

  it("C09 : demande en attente ou signalée, avertissement affiché sans rien bloquer", async () => {
    seed({ requests: threeRequests() })
    asRole("client", CLIENT)
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases.confirmWarning).toEqual({ show: true, pending: 1, reported: 1 })
    expect(detail.mission.status).toBe("in_progress")
  })

  it("C09 : seulement des demandes payées ou reçues, aucun avertissement", async () => {
    seed({ requests: [threeRequests()[1]] })
    asRole("client", CLIENT)
    expect((await getClientMissionDetail(MISSION)).purchases.confirmWarning.show).toBe(false)
  })

  it("C11 : mission terminée, coût total = service plus achats payés (reçu seulement)", async () => {
    seed({ mission: { status: "done" }, requests: threeRequests() })
    asRole("client", CLIENT)
    const { purchases, mission } = await getClientMissionDetail(MISSION)
    expect(purchases.costTotal).toEqual({ service: 10000, purchasesPaid: 4000, total: 14000 })
    expect(purchases.confirmWarning.show).toBe(false)
    expect(mission.budget).toBe(10000)
  })

  it("C11 : l'estimation n'entre jamais dans le coût total", async () => {
    seed({ mission: { status: "done", purchases_estimate: 99000 }, requests: [threeRequests()[1]] })
    asRole("client", CLIENT)
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.costTotal).toEqual({ service: 10000, purchasesPaid: 4000, total: 14000 })
  })

  it("mission en cours : pas de coût total, il est réservé au reçu", async () => {
    seed({ requests: threeRequests() })
    asRole("client", CLIENT)
    expect((await getClientMissionDetail(MISSION)).purchases.costTotal).toBeNull()
  })

  it("mission sans achats : aucune lecture des demandes, bloc indisponible", async () => {
    seed({ mission: { purchases_estimate: null } })
    asRole("client", CLIENT)
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(db.servicesCreated).toBe(0)
  })

  it.each(["42P01", "PGRST205", "42703", "PGRST204"])("script 94 non appliqué (%s) : indisponible, aucune erreur, détail inchangé", async (code) => {
    seed({ requests: threeRequests() })
    db.faults["purchase_requests.select"] = { code, message: "relation does not exist" }
    asRole("client", CLIENT)
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.mission.id).toBe(MISSION)
    expect(detail.mission.purchasesEstimate).toBe(20000)
  })

  it("erreur de base inattendue : erreur neutre, aucun message SQL", async () => {
    seed({ requests: threeRequests() })
    db.faults["purchase_requests.select"] = { code: "XX000", message: "secret: connexion à db.internal" }
    asRole("client", CLIENT)
    await expect(getClientMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
  })

  it("aucune écriture : ni demande, ni message, ni signalement, ni portefeuille", async () => {
    seed({ requests: threeRequests() })
    asRole("client", CLIENT)
    await getClientMissionDetail(MISSION)
    expect(db.writes).toEqual([])
  })
})
