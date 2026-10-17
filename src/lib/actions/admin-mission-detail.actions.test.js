import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
const requireRole = vi.fn()
const createServiceClient = vi.fn()
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...a) => requireRole(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))

const { getAdminMissionDetail } = await import("./admin-mission-detail.actions")

const ADMIN = { user: { id: "00000000-0000-4000-8000-0000000000aa" }, role: "admin", profile: { full_name: "Awa Admin" } }
const MISSION_ID = "10000000-0000-4000-8000-000000000001"
const CLIENT = "00000000-0000-4000-8000-000000000001"
const STUDENT = "00000000-0000-4000-8000-000000000002"
const OTHER = "00000000-0000-4000-8000-000000000003"

function makeService(resolve) {
  const queries = []
  return {
    queries,
    from(table) {
      const q = { table, select: null, options: null, calls: [] }
      queries.push(q)
      const b = new Proxy(
        {},
        {
          get(_, name) {
            if (name === "then") return (ok, ko) => Promise.resolve(resolve(q)).then(ok, ko)
            if (name === "select") {
              return (cols, options) => {
                q.select = cols
                q.options = options ?? null
                return b
              }
            }
            return (...args) => {
              q.calls.push([String(name), ...args])
              return b
            }
          },
        },
      )
      return b
    },
  }
}

const MISSION = {
  id: MISSION_ID,
  title: "Aide au déménagement",
  description: "Porter des cartons.",
  type: "Livraison",
  city: "Cotonou",
  budget: 10000,
  urgency: "low",
  deadline: "2026-10-20",
  status: "in_progress",
  created_at: "2026-10-10T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
  client_id: CLIENT,
  selected_student_id: STUDENT,
}

function resolver(over = {}) {
  const data = {
    missions: MISSION,
    applications: [
      { id: "a1", student_id: STUDENT, status: "accepted", created_at: "2026-10-11T08:00:00Z" },
      { id: "a2", student_id: OTHER, status: "rejected", created_at: "2026-10-11T09:00:00Z" },
    ],
    mission_completions: { created_at: "2026-10-13T08:00:00Z" },
    declared: [{ id: MISSION_ID, completion_declared_at: "2026-10-12T08:00:00Z" }],
    reviews: [{ id: "r1", reviewer_id: CLIENT, rating: 5, comment: "Parfait", created_at: "2026-10-14T08:00:00Z" }],
    wallet_transactions: [
      { id: "w1", user_id: CLIENT, type: "reserve", amount: 10000, created_at: "2026-10-10T08:01:00Z" },
    ],
    profiles: [
      { user_id: CLIENT, full_name: "Koffi Client" },
      { user_id: STUDENT, full_name: "Esther Etudiante" },
      { user_id: OTHER, full_name: "Yao Autre" },
    ],
    ...over,
  }
  return (q) => {
    if (q.table === "missions" && q.select === "id, completion_declared_at") {
      const value = data.declared
      if (value && typeof value === "object" && "error" in value) return { data: null, error: value.error }
      return { data: value, error: null }
    }
    const value = data[q.table]
    if (value && typeof value === "object" && "error" in value) return { data: null, error: value.error }
    return { data: value, error: null, count: Array.isArray(value) ? value.length : undefined }
  }
}

beforeEach(() => {
  requireRole.mockReset()
  createServiceClient.mockReset()
  requireRole.mockResolvedValue(ADMIN)
})

describe("getAdminMissionDetail : accès et identifiants", () => {
  it("refuse un non admin sans ouvrir le client service", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(await getAdminMissionDetail(MISSION_ID)).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(requireRole).toHaveBeenCalledWith(["admin"])
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("refuse un administrateur suspendu", async () => {
    requireRole.mockResolvedValue({ error: "Votre compte est suspendu." })
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([[""], ["abc"], ["1 or 1=1"], [MISSION_ID.slice(0, 20)], [undefined], [null], [42], [{ id: MISSION_ID }]])(
    "identifiant non uuid %j : introuvable, aucune lecture",
    async (id) => {
      const service = makeService(resolver())
      createServiceClient.mockReturnValue(service)
      expect(await getAdminMissionDetail(id)).toEqual({ notFound: true })
      expect(service.queries).toHaveLength(0)
    },
  )

  it("mission inexistante : introuvable", async () => {
    createServiceClient.mockReturnValue(makeService(resolver({ missions: null })))
    expect(await getAdminMissionDetail(MISSION_ID)).toEqual({ notFound: true })
  })
})

describe("getAdminMissionDetail : lecture", () => {
  it("renvoie mission, parties, candidatures, fin, avis et grand livre", async () => {
    createServiceClient.mockReturnValue(makeService(resolver()))
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeUndefined()
    expect(result.mission).toMatchObject({ id: MISSION_ID, status: "in_progress", budget: 10000, clientId: CLIENT })
    expect(result.client).toEqual({ id: CLIENT, name: "Koffi Client" })
    expect(result.student).toEqual({ id: STUDENT, name: "Esther Etudiante" })
    expect(result.applications.total).toBe(2)
    expect(result.applications.items[0]).toMatchObject({ name: "Esther Etudiante", status: "accepted", selected: true })
    expect(result.applications.items[1]).toMatchObject({ name: "Yao Autre", selected: false })
    expect(result.completion).toEqual({ declaredAt: "2026-10-12T08:00:00Z", finishedAt: "2026-10-13T08:00:00Z" })
    expect(result.reviews[0]).toMatchObject({ rating: 5, byRole: "client" })
    expect(result.ledger[0]).toMatchObject({ type: "reserve", party: "client", amount: 10000 })
  })

  it("mission sans étudiant ni fin : champs vides explicites", async () => {
    createServiceClient.mockReturnValue(
      makeService(resolver({ missions: { ...MISSION, status: "open", selected_student_id: null }, mission_completions: null, declared: [{ id: MISSION_ID, completion_declared_at: null }], applications: [], reviews: [], wallet_transactions: [] })),
    )
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.student).toBeNull()
    expect(result.completion).toEqual({ declaredAt: null, finishedAt: null })
    expect(result.applications).toEqual({ total: 0, items: [] })
  })

  it("colonne de déclaration absente : la page se rend, sans déclaration", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ declared: { error: { code: "42703" } } })))
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeUndefined()
    expect(result.completion).toEqual({ declaredAt: null, finishedAt: "2026-10-13T08:00:00Z" })
    spy.mockRestore()
  })

  it("autre erreur sur la lecture de la déclaration : message neutre", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(makeService(resolver({ declared: { error: { code: "XX000" } } })))
    expect((await getAdminMissionDetail(MISSION_ID)).error).toBeTruthy()
    spy.mockRestore()
  })

  it("n'écrit jamais la colonne de déclaration", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    for (const q of service.queries) {
      expect(q.calls.find((c) => ["update", "insert", "upsert", "delete"].includes(c[0]))).toBeUndefined()
    }
  })

  it("ne lit jamais les messages, jamais select(*), aucune donnée privée de profil", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    expect(service.queries.map((q) => q.table).sort()).toEqual(
      [
        "applications",
        "mission_completions",
        "missions",
        "missions",
        "profiles",
        "purchase_requests",
        "reviews",
        "wallet_transactions",
      ].sort(),
    )
    for (const q of service.queries) {
      expect(q.select).not.toBe("*")
      expect(q.select).not.toMatch(/phone|email|fcm_token|card_url|rejection_reason/)
    }
  })

  it("le grand livre est limité à cette mission et aux types liés à la mission", async () => {
    const service = makeService(resolver())
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    const ledger = service.queries.find((q) => q.table === "wallet_transactions")
    expect(ledger.calls).toContainEqual(["eq", "mission_id", MISSION_ID])
    expect(ledger.calls.find((c) => c[0] === "in")[2]).toEqual(["reserve", "release", "commission", "refund"])
  })

  it("une lecture en erreur renvoie un message neutre sans détail technique", async () => {
    createServiceClient.mockReturnValue(makeService(resolver({ wallet_transactions: { error: { message: "permission denied for table secret" } } })))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await getAdminMissionDetail(MISSION_ID)
    spy.mockRestore()
    expect(result.error).toMatch(/Réessayez/)
    expect(JSON.stringify(result)).not.toMatch(/secret|permission/)
  })
})

// ─── Achats pour le compte du client (RD-ACHATS-01 ST-15) ────────────────────────────────────

const SUPABASE_URL = "https://proj.supabase.co"
const REQ1 = "20000000-0000-4000-8000-000000000001"
const REQ2 = "20000000-0000-4000-8000-000000000002"
const REPORT1 = "30000000-0000-4000-8000-000000000001"
const OWNER_PATH = (name) => `${STUDENT}/${REQ1}/${name}`

function requestRow(over = {}) {
  return {
    id: REQ1,
    mission_id: MISSION_ID,
    seq: 1,
    student_id: STUDENT,
    client_id: CLIENT,
    status: "received",
    payee_kind: "merchant",
    payee_number: "123456",
    payee_photo_path: OWNER_PATH("payee-aaaaaaaa.jpg"),
    ticket_photo_path: OWNER_PATH("ticket-bbbbbbbb.jpg"),
    vendor_name: "Étal de Maman Tossou",
    items: "Légumes",
    amount: 8750,
    version: 3,
    paid_at: "2026-10-12T12:24:00Z",
    sms_photo_path: `${CLIENT}/${REQ1}/sms-cccccccc.jpg`,
    paid_reference: "MP123",
    beneficiary_confirmed: true,
    received_at: "2026-10-12T12:31:00Z",
    cancelled_at: null,
    reported_at: null,
    created_at: "2026-10-12T12:10:00Z",
    edited_at: null,
    ...over,
  }
}

function signedStorage({ failWith = null } = {}) {
  const calls = []
  return {
    calls,
    from(bucket) {
      return {
        createSignedUrls: async (paths, seconds) => {
          calls.push({ bucket, paths, seconds })
          if (failWith) return { data: null, error: failWith }
          return {
            data: paths.map((path) => ({
              path,
              error: null,
              signedUrl: `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}?token=short`,
            })),
            error: null,
          }
        },
      }
    },
  }
}

function withStorage(service, storage = signedStorage()) {
  service.storage = storage
  return service
}

describe("getAdminMissionDetail : achats", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  })

  it("mission sans achats ni estimation : bloc vide, aucune lecture de signalement ni signature", async () => {
    const service = withStorage(makeService(resolver()))
    createServiceClient.mockReturnValue(service)
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.purchases).toMatchObject({ available: true, estimate: null, items: [], reportsAvailable: true })
    expect(result.purchases.totals).toMatchObject({ count: 0, requested: 0, paid: 0, pending: 0, reported: 0 })
    expect(service.queries.some((q) => q.table === "reports")).toBe(false)
    expect(service.storage.calls).toHaveLength(0)
  })

  it("estimation sans demande : l'estimation est renvoyée, jamais additionnée", async () => {
    createServiceClient.mockReturnValue(
      withStorage(makeService(resolver({ missions: { ...MISSION, purchases_estimate: 15000 } }))),
    )
    const { purchases } = await getAdminMissionDetail(MISSION_ID)
    expect(purchases.estimate).toBe(15000)
    expect(purchases.items).toEqual([])
    expect(purchases.totals).toMatchObject({ requested: 0, paid: 0, estimate: 15000 })
  })

  it("table des demandes absente (script 94 non appliqué) : bloc indisponible, la page se rend", async () => {
    for (const code of ["42P01", "PGRST205", "42703", "PGRST204"]) {
      createServiceClient.mockReturnValue(
        withStorage(makeService(resolver({ purchase_requests: { error: { code } }, missions: { ...MISSION, purchases_estimate: 9000 } }))),
      )
      const result = await getAdminMissionDetail(MISSION_ID)
      expect(result.error).toBeUndefined()
      expect(result.mission.id).toBe(MISSION_ID)
      expect(result.purchases).toEqual({ available: false, reason: "missing", estimate: 9000 })
    }
  })

  it("autre erreur de lecture des demandes : mission lisible, bloc en erreur sans détail technique", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(
      withStorage(makeService(resolver({ purchase_requests: { error: { code: "XX000", message: "permission denied secret" } } }))),
    )
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result.error).toBeUndefined()
    expect(result.purchases).toMatchObject({ available: false, reason: "error" })
    expect(JSON.stringify(result)).not.toMatch(/secret|permission/)
    expect(spy.mock.calls.flat().join(" ")).not.toMatch(/secret|permission/)
    spy.mockRestore()
  })

  it("deux demandes : preuves en URL signées de 120 s, jamais de chemin brut, totaux hors EduCash", async () => {
    const second = requestRow({
      id: REQ2,
      seq: 2,
      status: "pending",
      amount: 7500,
      vendor_name: "Boutique Saint-Michel",
      sms_photo_path: null,
      paid_at: null,
      received_at: null,
      paid_reference: null,
      payee_photo_path: `${STUDENT}/${REQ2}/payee-dddddddd.jpg`,
      ticket_photo_path: `${STUDENT}/${REQ2}/ticket-eeeeeeee.jpg`,
    })
    const service = withStorage(
      makeService(resolver({ purchase_requests: [requestRow(), second], missions: { ...MISSION, purchases_estimate: 15000 } })),
    )
    createServiceClient.mockReturnValue(service)
    const { purchases } = await getAdminMissionDetail(MISSION_ID)

    expect(service.storage.calls).toHaveLength(1)
    expect(service.storage.calls[0]).toMatchObject({ bucket: "purchase-proofs", seconds: 120 })
    expect(purchases.items).toHaveLength(2)
    const [a, b] = purchases.items
    expect(a).toMatchObject({ number: "N° 1", status: "received", amount: 8750, payeeNumber: "123456", paidReference: "MP123" })
    for (const key of ["payeePhotoUrl", "ticketPhotoUrl", "smsPhotoUrl"]) {
      expect(a[key]).toMatch(new RegExp(`^${SUPABASE_URL}/storage/v1/object/sign/purchase-proofs/`))
    }
    expect(b.smsPhotoUrl).toBeNull()
    // Hors des adresses signées, aucun chemin de fichier ni nom de colonne de chemin ne subsiste.
    const outsideUrls = JSON.stringify(purchases).replace(/"https:[^"]+"/g, '"url"')
    expect(outsideUrls).not.toMatch(/photo_path|payee-|ticket-|sms-|\.jpg/)
    expect(Object.keys(a).some((k) => /path/i.test(k))).toBe(false)
    expect(purchases.totals).toMatchObject({ count: 2, requested: 16250, paid: 8750, pending: 7500, reported: 0, estimate: 15000 })
  })

  it("demande signalée : signalement lié avec référence, motif, statut et auteur (jamais l'identifiant du compte)", async () => {
    const flagged = requestRow({ status: "reported", reported_at: "2026-10-12T14:05:00Z" })
    const service = withStorage(
      makeService(
        resolver({
          purchase_requests: [flagged],
          reports: [
            {
              id: REPORT1,
              number: 7,
              purchase_request_id: REQ1,
              reporter_id: STUDENT,
              reason: "purchase_vendor_not_paid",
              status: "open",
              created_at: "2026-10-12T14:05:00Z",
            },
          ],
        }),
      ),
    )
    createServiceClient.mockReturnValue(service)
    const { purchases } = await getAdminMissionDetail(MISSION_ID)
    expect(purchases.items[0].reports).toEqual([
      {
        id: REPORT1,
        reference: "SIG-0007",
        reason: "purchase_vendor_not_paid",
        status: "open",
        byRole: "student",
        createdAt: "2026-10-12T14:05:00Z",
      },
    ])
    expect(purchases.totals).toMatchObject({ reported: 8750, paid: 0 })
    const reports = service.queries.find((q) => q.table === "reports")
    expect(reports.calls).toContainEqual(["in", "purchase_request_id", [REQ1]])
    expect(reports.select).not.toMatch(/details|resolution_note|handled_by|reported_user_id|\*/)
  })

  it("table des signalements absente : les demandes restent lues, signalements indisponibles", async () => {
    createServiceClient.mockReturnValue(
      withStorage(makeService(resolver({ purchase_requests: [requestRow()], reports: { error: { code: "42P01" } } }))),
    )
    const { purchases } = await getAdminMissionDetail(MISSION_ID)
    expect(purchases.available).toBe(true)
    expect(purchases.reportsAvailable).toBe(false)
    expect(purchases.items).toHaveLength(1)
    expect(purchases.items[0].reports).toEqual([])
  })

  it("signature en échec ou adresse étrangère : preuve absente, aucune adresse de repli", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    createServiceClient.mockReturnValue(
      withStorage(
        makeService(resolver({ purchase_requests: [requestRow()] })),
        signedStorage({ failWith: { statusCode: "500" } }),
      ),
    )
    const { purchases } = await getAdminMissionDetail(MISSION_ID)
    expect(purchases.items[0]).toMatchObject({ payeePhotoUrl: null, ticketPhotoUrl: null, smsPhotoUrl: null })
    spy.mockRestore()

    const foreign = {
      from: () => ({
        createSignedUrls: async (paths) => ({
          data: paths.map((path) => ({ path, error: null, signedUrl: `https://evil.example/storage/v1/object/sign/purchase-proofs/${path}` })),
          error: null,
        }),
      }),
    }
    createServiceClient.mockReturnValue(withStorage(makeService(resolver({ purchase_requests: [requestRow()] })), foreign))
    const other = await getAdminMissionDetail(MISSION_ID)
    expect(other.purchases.items[0].payeePhotoUrl).toBeNull()
  })

  it("lecture seule : demandes et signalements filtrés par mission, aucune écriture, jamais les messages", async () => {
    const service = withStorage(makeService(resolver({ purchase_requests: [requestRow()] })))
    createServiceClient.mockReturnValue(service)
    await getAdminMissionDetail(MISSION_ID)
    const requests = service.queries.find((q) => q.table === "purchase_requests")
    expect(requests.calls).toContainEqual(["eq", "mission_id", MISSION_ID])
    expect(requests.select).not.toBe("*")
    expect(service.queries.some((q) => q.table === "messages")).toBe(false)
    for (const q of service.queries) {
      expect(q.calls.find((c) => ["update", "insert", "upsert", "delete", "rpc"].includes(c[0]))).toBeUndefined()
    }
  })

  it("non admin : refusé avant toute lecture d'achats ou signature", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const service = withStorage(makeService(resolver({ purchase_requests: [requestRow()] })))
    createServiceClient.mockReturnValue(service)
    const result = await getAdminMissionDetail(MISSION_ID)
    expect(result).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(service.queries).toHaveLength(0)
    expect(service.storage.calls).toHaveLength(0)
  })

  it("identifiant mal formé : introuvable, aucune lecture d'achats", async () => {
    const service = withStorage(makeService(resolver()))
    createServiceClient.mockReturnValue(service)
    expect(await getAdminMissionDetail("x' or '1'='1")).toEqual({ notFound: true })
    expect(service.queries).toHaveLength(0)
  })
})
