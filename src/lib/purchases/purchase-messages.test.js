import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import { insertPurchaseMessage } from "./purchase-messages"
import { purchaseMessageContent } from "./requests"
import { IDS, createFakeDb, missionRow, requestRow } from "@/lib/actions/purchase-fake-db.test-support"

const { client: CLIENT, student: STUDENT, otherStudent: OTHER, otherClient: OTHER_CLIENT, mission: MISSION, request: REQ } = IDS

let db
let service

const profiles = () => [
  { user_id: STUDENT, is_suspended: false },
  { user_id: CLIENT, is_suspended: false },
  { user_id: OTHER, is_suspended: false },
]

beforeEach(() => {
  db = createFakeDb({ missions: [missionRow()], profiles: profiles(), purchase_requests: [requestRow()] })
  service = db.service()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const request = () => db.tables.purchase_requests[0]
const card = (overrides = {}) => ({
  request: request(),
  type: "purchase_request",
  actorId: STUDENT,
  content: purchaseMessageContent("purchase_request", 1),
  ...overrides,
})
const event = (name, overrides = {}) => ({
  request: request(),
  type: "purchase_event",
  actorId: CLIENT,
  content: purchaseMessageContent("purchase_event", 1, name),
  ...overrides,
})

describe("insertPurchaseMessage : chemin nominal", () => {
  it("carte de l'étudiant : destinataire forcé au client, texte fixe, lien vers la demande", async () => {
    const res = await insertPurchaseMessage(service, card())
    expect(res.ok).toBe(true)
    expect(db.tables.messages[0]).toMatchObject({
      mission_id: MISSION,
      sender_id: STUDENT,
      receiver_id: CLIENT,
      type: "purchase_request",
      purchase_request_id: REQ,
      content: "Demande de paiement d'achats N° 1",
      read: false,
    })
    expect(res.message.id).toEqual(expect.any(String))
  })

  it("ligne système du client : destinataire forcé à l'étudiant", async () => {
    expect((await insertPurchaseMessage(service, event("paid"))).ok).toBe(true)
    expect(db.tables.messages[0]).toMatchObject({ sender_id: CLIENT, receiver_id: STUDENT, type: "purchase_event" })
  })

  it("chaque événement de la machine à états est accepté, des deux côtés", async () => {
    for (const name of ["updated", "cancelled", "paid", "received", "reported"]) {
      expect((await insertPurchaseMessage(service, event(name, { actorId: STUDENT }))).ok, name).toBe(true)
    }
    expect(db.tables.messages.every((m) => m.sender_id === STUDENT && m.receiver_id === CLIENT)).toBe(true)
  })
})

describe("insertPurchaseMessage : règles refaites pour le service role", () => {
  const refused = async (input) => {
    const res = await insertPurchaseMessage(service, input)
    expect(res).toEqual({ ok: false, reason: "refused" })
    expect(db.tables.messages).toHaveLength(0)
  }

  it("refuse un type qui n'est pas un type d'achat (texte, image, inconnu)", async () => {
    for (const type of ["text", "image", "voice", "location", "purchase", undefined, null, 5]) {
      await refused(card({ type }))
    }
  })

  it("refuse tout contenu qui n'est pas le texte FIXE du serveur (numéro, vendeur, montant, HTML, 5 000 caractères)", async () => {
    for (const content of [
      "Demande de paiement d'achats N° 2",
      "Payez le 01 97 12 34 56",
      "Demande de paiement d'achats N° 1 pour 6000 FCFA chez Dossa",
      "<script>alert(1)</script>",
      "x".repeat(5000),
      "",
      null,
      undefined,
      42,
    ]) {
      await refused(card({ content }))
    }
    // Une ligne système ne peut pas servir de carte, et inversement.
    await refused(card({ content: purchaseMessageContent("purchase_event", 1, "paid") }))
    await refused(event("paid", { content: purchaseMessageContent("purchase_request", 1) }))
  })

  it("refuse un acteur qui n'est pas l'une des deux parties (tiers, autre étudiant, admin)", async () => {
    for (const actorId of [OTHER, OTHER_CLIENT, IDS.admin, "pas-un-uuid", undefined, null]) {
      await refused(event("paid", { actorId }))
    }
  })

  it("la carte ne peut être envoyée que par l'étudiant", async () => {
    await refused(card({ actorId: CLIENT }))
  })

  it("refuse si expéditeur et destinataire sont la même personne (étudiant égal au client)", async () => {
    const same = { ...request(), client_id: STUDENT }
    await refused(card({ request: same }))
  })

  it("refuse une demande dont les identifiants sont invalides ou absente", async () => {
    await refused(card({ request: undefined }))
    await refused(card({ request: { ...request(), id: "x" } }))
    await refused(card({ request: { ...request(), mission_id: "x" } }))
    await refused(card({ request: { ...request(), seq: 100 } }))
  })

  it("refuse une demande qui ne correspond pas à la base (mission, parties, numéro d'ordre falsifiés)", async () => {
    await refused(card({ request: { ...request(), mission_id: IDS.otherMission } }))
    await refused(card({ request: { ...request(), student_id: OTHER }, actorId: OTHER }))
    await refused(card({ request: { ...request(), client_id: OTHER_CLIENT } }))
    await refused(card({ request: { ...request(), seq: 2 }, content: purchaseMessageContent("purchase_request", 2) }))
    await refused(card({ request: { ...request(), id: IDS.foreignRequest } }))
  })

  it("refuse si la mission ne relie pas ce client et cet étudiant retenu", async () => {
    db.tables.missions[0].selected_student_id = OTHER
    await refused(card())
    db.tables.missions[0].selected_student_id = STUDENT
    db.tables.missions[0].client_id = OTHER_CLIENT
    await refused(card())
    db.tables.missions.length = 0
    await refused(card())
  })

  it("refuse un expéditeur suspendu ou sans profil", async () => {
    db.tables.profiles.find((p) => p.user_id === STUDENT).is_suspended = true
    await refused(card())
    db.tables.profiles.length = 0
    await refused(card())
  })
})

describe("insertPurchaseMessage : erreurs de base", () => {
  it("script 94 absent (table ou colonne) : indisponible", async () => {
    for (const code of ["42P01", "PGRST205", "42703", "PGRST204"]) {
      db.faults["purchase_requests.select"] = { code, message: "x" }
      expect(await insertPurchaseMessage(service, card()), code).toEqual({ ok: false, reason: "unavailable" })
    }
    db.faults["purchase_requests.select"] = null
    db.faults["messages.insert"] = { code: "42703", message: "column purchase_request_id does not exist" }
    expect(await insertPurchaseMessage(service, card())).toEqual({ ok: false, reason: "unavailable" })
  })

  it("erreur de lecture ou d'insertion : échec neutre, seul le code est journalisé", async () => {
    db.faults["missions.select"] = { code: "XX000", message: "secret interne" }
    expect(await insertPurchaseMessage(service, card())).toEqual({ ok: false, reason: "failed" })
    db.faults["missions.select"] = null
    db.faults["messages.insert"] = { code: "XX001", message: "secret interne", details: "ligne privée" }
    expect(await insertPurchaseMessage(service, card())).toEqual({ ok: false, reason: "failed" })
    const logged = JSON.stringify(console.error.mock.calls)
    expect(logged).toContain("XX000")
    expect(logged).toContain("XX001")
    expect(logged).not.toMatch(/secret|privée/)
  })

  it("n'efface et ne modifie jamais un message : aucun update ni delete", async () => {
    await insertPurchaseMessage(service, card())
    await insertPurchaseMessage(service, event("paid"))
    expect(db.writes.every((w) => w.table === "messages" && w.op === "insert")).toBe(true)
  })
})
