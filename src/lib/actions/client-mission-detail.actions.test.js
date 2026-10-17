import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/actions/purchase-request.actions", () => ({ getClientPurchaseRequests: vi.fn() }))

import { readFileSync } from "node:fs"
import { requireRole } from "@/lib/auth/require-role"
import { getClientPurchaseRequests } from "@/lib/actions/purchase-request.actions"
import { getClientMissionDetail, getCandidateProfile } from "./client-mission-detail.actions"

const CLIENT = "00000000-0000-4000-8000-000000000001"
const MISSION = "11111111-1111-4111-8111-111111111111"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const REVIEWER = "33333333-3333-4333-8333-333333333333"

let responses
let calls

// Faux client : chaque requête consigne table, colonnes et filtres, puis se résout avec `responses[table]`.
function makeSupabase() {
  return {
    from: (table) => {
      const state = { table, columns: null, filters: [] }
      calls.push(state)
      const resolve = () => {
        // Lecture tolérante de la fin déclarée : requête séparée, réponse dédiée.
        if (table === "missions" && state.columns === "id, completion_declared_at") return responses.completion
        const r = responses[table]
        return typeof r === "function" ? r(state) : (r ?? { data: null, error: null })
      }
      const b = {
        select: (columns) => { state.columns = columns; return b },
        eq: (c, v) => { state.filters.push(["eq", c, v]); return b },
        in: (c, v) => { state.filters.push(["in", c, v]); return b },
        order: () => b,
        limit: () => b,
        maybeSingle: () => Promise.resolve(resolve()),
        then: (ok, ko) => Promise.resolve(resolve()).then(ok, ko),
      }
      return b
    },
  }
}

const mission = {
  id: MISSION, title: "Cours de maths", description: "Niveau 3e", type: "Cours particuliers", city: "Cotonou",
  budget: 10000, urgency: "low", deadline: "2026-11-01", status: "in_progress", created_at: "2026-10-01T08:00:00Z",
  selected_student_id: S1,
}

beforeEach(() => {
  calls = []
  responses = {
    missions: { data: mission, error: null },
    applications: {
      data: [
        { id: "a2", student_id: S2, message: "Bonjour", status: "rejected", created_at: "2026-10-03T00:00:00Z" },
        { id: "a1", student_id: S1, message: null, status: "accepted", created_at: "2026-10-02T00:00:00Z" },
      ],
      error: null,
    },
    wallet_transactions: { data: [{ type: "reserve", amount: 10000, created_at: "2026-10-01T09:00:00Z" }], error: null },
    reviews: { data: null, error: null },
    completion: { data: [{ id: MISSION, completion_declared_at: null }], error: null },
    profiles: {
      data: [
        { user_id: S1, full_name: "Awa Kouassi", avatar_url: null, city: "Cotonou", rating: 4.5, missions_done: 3, is_verified: true, verified_until: "2027-01-01" },
        { user_id: S2, full_name: "Koffi Dossou", avatar_url: "u.png", city: null, rating: null, missions_done: null, is_verified: false, verified_until: null },
      ],
      error: null,
    },
    student_profiles: { data: [{ user_id: S1, school: "UAC", level: "L3", skills: ["Babysitting"] }], error: null },
  }
  getClientPurchaseRequests.mockReset()
  getClientPurchaseRequests.mockResolvedValue({ available: false })
  requireRole.mockResolvedValue({ supabase: makeSupabase(), user: { id: CLIENT }, role: "client", profile: {} })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const callsOn = (table) => calls.filter((c) => c.table === table)

describe("getClientMissionDetail", () => {
  it("exige le rôle client avant toute lecture et ne lit rien en cas de refus", async () => {
    requireRole.mockResolvedValue({ error: "Tu n'as pas les droits pour effectuer cette action." })
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(calls).toEqual([])
  })

  it("renvoie null pour un identifiant mal formé sans interroger la base", async () => {
    expect(await getClientMissionDetail("pas-un-uuid")).toBeNull()
    expect(await getClientMissionDetail(undefined)).toBeNull()
    expect(calls).toEqual([])
  })

  it("vérifie la propriété : mission filtrée par id ET client_id, null si absente (autre client ou inexistante)", async () => {
    responses.missions = { data: null, error: null }
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(callsOn("missions")[0].filters).toEqual([["eq", "id", MISSION], ["eq", "client_id", CLIENT]])
    // aucune autre lecture quand la mission n'est pas au client
    expect(calls.map((c) => c.table)).toEqual(["missions"])
  })

  it("renvoie la forme documentée : mission, candidatures avec profils publics, étudiant retenu, grand livre, avis", async () => {
    responses.reviews = { data: { id: "r1", rating: 5, comment: "Super", created_at: "2026-10-09T00:00:00Z" }, error: null }
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.mission).toEqual({
      id: MISSION, title: "Cours de maths", description: "Niveau 3e", type: "Cours particuliers", city: "Cotonou",
      budget: 10000, purchasesEstimate: null, urgency: "low", deadline: "2026-11-01", status: "in_progress",
      createdAt: "2026-10-01T08:00:00Z", selectedStudentId: S1,
    })
    expect(detail.applications.map((a) => a.id)).toEqual(["a2", "a1"])
    expect(detail.applications[1].student).toEqual({
      id: S1, fullName: "Awa Kouassi", avatarUrl: null, city: "Cotonou", rating: 4.5, missionsDone: 3,
      isVerified: true, verifiedUntil: "2027-01-01", school: "UAC", level: "L3", skills: ["Babysitting"],
    })
    // profil lacunaire : valeurs neutres
    expect(detail.applications[0].student).toMatchObject({ rating: 0, missionsDone: 0, school: null, skills: [] })
    expect(detail.selectedStudent.id).toBe(S1)
    expect(detail.ledger).toEqual([{ type: "reserve", amount: 10000, createdAt: "2026-10-01T09:00:00Z" }])
    expect(detail.review).toEqual({ id: "r1", rating: 5, comment: "Super", createdAt: "2026-10-09T00:00:00Z" })
  })

  it("filtre candidatures, grand livre et avis sur CETTE mission, le grand livre sur le client seulement", async () => {
    await getClientMissionDetail(MISSION)
    expect(callsOn("applications")[0].filters).toEqual([["eq", "mission_id", MISSION]])
    expect(callsOn("wallet_transactions")[0].filters).toEqual([
      ["eq", "user_id", CLIENT],
      ["eq", "mission_id", MISSION],
      ["in", "type", ["reserve", "release", "commission", "refund"]],
    ])
    expect(callsOn("reviews")[0].filters).toEqual([["eq", "mission_id", MISSION], ["eq", "reviewer_id", CLIENT]])
  })

  it("n'utilise que des colonnes publiques explicites : jamais select(*), aucune colonne privée", async () => {
    await getClientMissionDetail(MISSION)
    for (const c of calls) expect(c.columns, c.table).not.toMatch(/\*/)
    const profileColumns = callsOn("profiles")[0].columns.split(",").map((s) => s.trim())
    expect(profileColumns).toEqual([
      "user_id", "full_name", "avatar_url", "city", "rating", "missions_done", "is_verified", "verified_until",
    ])
    const studentColumns = callsOn("student_profiles")[0].columns.split(",").map((s) => s.trim())
    expect(studentColumns).toEqual(["user_id", "school", "level", "skills"])
    const all = calls.map((c) => c.columns).join(" ")
    for (const priv of ["phone", "card_url", "rejection_reason", "fcm_token", "verification_submitted_at"]) {
      expect(all).not.toContain(priv)
    }
  })

  it("ne renvoie aucune colonne privée même si la base en renvoyait", async () => {
    responses.profiles = {
      data: [{ user_id: S1, full_name: "Awa", phone: "+22901000000", card_url: "secret", rejection_reason: "x" }],
      error: null,
    }
    const detail = await getClientMissionDetail(MISSION)
    expect(JSON.stringify(detail)).not.toMatch(/phone|card_url|rejection|22901000000|secret/)
  })

  it("ne lit les profils que des étudiants de cette mission (candidats et étudiant retenu)", async () => {
    await getClientMissionDetail(MISSION)
    const ids = callsOn("profiles")[0].filters[0][2]
    expect([...ids].sort()).toEqual([S1, S2].sort())
  })

  it("sans candidature ni étudiant retenu, ne lit aucun profil", async () => {
    responses.applications = { data: [], error: null }
    responses.missions = { data: { ...mission, status: "open", selected_student_id: null }, error: null }
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.applications).toEqual([])
    expect(detail.selectedStudent).toBeNull()
    expect(callsOn("profiles")).toEqual([])
  })

  it("lève une erreur neutre sans message SQL quand une lecture échoue", async () => {
    responses.wallet_transactions = { data: null, error: { message: "relation \"wallet_transactions\" does not exist" } }
    await expect(getClientMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
    responses.missions = { data: null, error: { message: "SELECT secret FROM x" } }
    await expect(getClientMissionDetail(MISSION)).rejects.toThrow(/^Impossible de charger la mission\.$/)
  })
})

describe("getCandidateProfile", () => {
  beforeEach(() => {
    responses.missions = { data: { id: MISSION }, error: null }
    responses.applications = {
      data: { id: "a2", student_id: S2, message: "Disponible le soir", status: "pending", created_at: "2026-10-03T00:00:00Z" },
      error: null,
    }
    responses.reviews = {
      data: [
        { id: "r1", rating: 5, comment: "Parfait", created_at: "2026-09-01T00:00:00Z", reviewer_id: REVIEWER },
        { id: "r2", rating: 4, comment: null, created_at: "2026-08-01T00:00:00Z", reviewer_id: "inconnu" },
      ],
      count: 7,
      error: null,
    }
    const profiles = responses.profiles
    responses.profiles = (state) => {
      const ids = state.filters[0][2]
      if (state.columns === "user_id, full_name") {
        return { data: [{ user_id: REVIEWER, full_name: "Marie Agbo" }], error: null }
      }
      return { data: profiles.data.filter((p) => ids.includes(p.user_id)), error: null }
    }
  })

  it("exige le rôle client avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getCandidateProfile(MISSION, S2)).toBeNull()
    expect(requireRole).toHaveBeenCalledWith(["client"])
    expect(calls).toEqual([])
  })

  it("refuse (null) des identifiants mal formés", async () => {
    expect(await getCandidateProfile("x", S2)).toBeNull()
    expect(await getCandidateProfile(MISSION, "x")).toBeNull()
    expect(calls).toEqual([])
  })

  it("refuse sur une mission qui n'est pas au client, sans lire de candidature ni de profil", async () => {
    responses.missions = { data: null, error: null }
    expect(await getCandidateProfile(MISSION, S2)).toBeNull()
    expect(callsOn("missions")[0].filters).toEqual([["eq", "id", MISSION], ["eq", "client_id", CLIENT]])
    expect(calls.map((c) => c.table)).toEqual(["missions"])
  })

  it("refuse un étudiant qui n'a pas candidaté à cette mission, sans lire son profil ni ses avis", async () => {
    responses.applications = { data: null, error: null }
    expect(await getCandidateProfile(MISSION, S2)).toBeNull()
    expect(callsOn("applications")[0].filters).toEqual([["eq", "mission_id", MISSION], ["eq", "student_id", S2]])
    expect(callsOn("profiles")).toEqual([])
    expect(callsOn("student_profiles")).toEqual([])
    expect(callsOn("reviews")).toEqual([])
  })

  it("renvoie le profil public, la candidature et les avis reçus avec le prénom de l'auteur", async () => {
    const candidate = await getCandidateProfile(MISSION, S2)
    expect(candidate).toMatchObject({
      studentId: S2, applicationId: "a2", applicationStatus: "pending", message: "Disponible le soir",
      appliedAt: "2026-10-03T00:00:00Z", reviewsTotal: 7,
    })
    expect(candidate.student).toMatchObject({ id: S2, fullName: "Koffi Dossou" })
    expect(candidate.reviews).toEqual([
      { id: "r1", rating: 5, comment: "Parfait", createdAt: "2026-09-01T00:00:00Z", authorFirstName: "Marie" },
      { id: "r2", rating: 4, comment: null, createdAt: "2026-08-01T00:00:00Z", authorFirstName: "Client" },
    ])
    expect(JSON.stringify(candidate)).not.toContain("Agbo")
    expect(callsOn("reviews")[0].filters).toEqual([["eq", "reviewed_id", S2]])
  })

  it("colonnes publiques explicites seulement", async () => {
    await getCandidateProfile(MISSION, S2)
    for (const c of calls) expect(c.columns, c.table).not.toMatch(/\*/)
    const all = calls.map((c) => c.columns).join(" ")
    for (const priv of ["phone", "card_url", "rejection_reason", "fcm_token"]) expect(all).not.toContain(priv)
  })

  it("lève une erreur neutre quand une lecture échoue", async () => {
    responses.reviews = { data: null, error: { message: "boom SQL" } }
    await expect(getCandidateProfile(MISSION, S2)).rejects.toThrow("Impossible de charger ce candidat.")
  })
})

describe("getClientMissionDetail : mission avec achats", () => {
  it.each([
    [15000, 15000],
    [null, null],
    [0, null],
    [-1, null],
    ["x", null],
  ])("estimation %j renvoyée comme %j", async (raw, expected) => {
    responses.missions = { data: { ...mission, purchases_estimate: raw }, error: null }
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.mission.purchasesEstimate).toBe(expected)
  })

  it("lit la colonne par une liste explicite", async () => {
    await getClientMissionDetail(MISSION)
    expect(callsOn("missions")[0].columns).toContain("purchases_estimate")
    expect(callsOn("missions")[0].columns).not.toContain("*")
  })
})

describe("getClientMissionDetail : fin déclarée (RD-DONE-01)", () => {
  const completionCalls = () => callsOn("missions").filter((c) => c.columns === "id, completion_declared_at")

  it("in_progress non déclaré : completion disponible, declaredAt null", async () => {
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.completion).toEqual({ available: true, declaredAt: null })
    expect(completionCalls()[0].filters).toEqual([["in", "id", [MISSION]]])
  })

  it("in_progress déclaré : declaredAt renvoyé", async () => {
    responses.completion = { data: [{ id: MISSION, completion_declared_at: "2026-10-12T10:00:00Z" }], error: null }
    expect((await getClientMissionDetail(MISSION)).completion).toEqual({ available: true, declaredAt: "2026-10-12T10:00:00Z" })
  })

  it("done : la date conservée est renvoyée", async () => {
    responses.missions = { data: { ...mission, status: "done" }, error: null }
    responses.completion = { data: [{ id: MISSION, completion_declared_at: "2026-10-12T10:00:00Z" }], error: null }
    expect((await getClientMissionDetail(MISSION)).completion).toEqual({ available: true, declaredAt: "2026-10-12T10:00:00Z" })
  })

  it("ligne non renvoyée (RLS, réattribution) : indisponible, jamais un faux non déclaré", async () => {
    responses.completion = { data: [], error: null }
    expect((await getClientMissionDetail(MISSION)).completion).toEqual({ available: false, declaredAt: null })
  })

  it("la lecture part en parallèle des autres lectures, après le contrôle de propriété", async () => {
    await getClientMissionDetail(MISSION)
    const order = calls.map((c) => `${c.table}:${c.columns}`)
    expect(order[0]).toMatch(/^missions:/)
    expect(order.slice(1, 5)).toContain("missions:id, completion_declared_at")
  })

  it.each(["open", "cancelled"])("mission %s : aucune lecture de la colonne", async (status) => {
    responses.missions = { data: { ...mission, status, selected_student_id: null }, error: null }
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.completion).toEqual({ available: false, declaredAt: null })
    expect(completionCalls()).toHaveLength(0)
  })

  it("mission d'un autre client : null, aucune lecture de la colonne", async () => {
    responses.missions = { data: null, error: null }
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(completionCalls()).toHaveLength(0)
  })

  it.each(["42703", "PGRST204"])("colonne absente (%s) : page rendue, available false", async (code) => {
    responses.completion = { data: null, error: { code, message: "column does not exist" } }
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.mission.id).toBe(MISSION)
    expect(detail.completion).toEqual({ available: false, declaredAt: null })
  })

  it("autre erreur : erreur neutre sans message SQL", async () => {
    responses.completion = { data: null, error: { code: "XX000", message: "relation boom" } }
    await expect(getClientMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
  })
})

describe("getClientMissionDetail : demandes de paiement d'achats (RD-ACHATS-01)", () => {
  const withPurchases = (over = {}) => {
    responses.missions = { data: { ...mission, purchases_estimate: 20000, ...over }, error: null }
  }
  const view = (over = {}) => ({
    id: "r1", seq: 1, status: "pending", version: 1, amount: 6000, vendorName: "Dossa", payeeNumber: "123456", actions: ["paid", "report"], ...over,
  })
  const answer = (requests) => getClientPurchaseRequests.mockResolvedValue({ available: true, requests })

  it("client propriétaire : demandes, numéro à payer et vendeur, totaux hors séquestre", async () => {
    withPurchases()
    answer([view(), view({ id: "r2", seq: 2, status: "paid", amount: 4000 })])
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(getClientPurchaseRequests).toHaveBeenCalledWith({ missionId: MISSION })
    expect(purchases.available).toBe(true)
    expect(purchases.requests[0]).toMatchObject({ vendorName: "Dossa", payeeNumber: "123456", actions: ["paid", "report"] })
    expect(purchases.totals).toEqual({ count: 2, requested: 10000, paid: 4000, pending: 6000, reported: 0 })
    expect(purchases.exceedsEstimate).toBe(false)
  })

  it("0 demande : totaux nuls, aucun avertissement, aucun coût total", async () => {
    withPurchases()
    answer([])
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.requests).toEqual([])
    expect(purchases.totals).toEqual({ count: 0, requested: 0, paid: 0, pending: 0, reported: 0 })
    expect(purchases.confirmWarning).toEqual({ show: false, pending: 0, reported: 0 })
    expect(purchases.costTotal).toBeNull()
  })

  it("la ligne du grand livre et le budget ne contiennent jamais d'achat", async () => {
    withPurchases()
    answer([view({ status: "received", amount: 4000 })])
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.mission.budget).toBe(10000)
    expect(detail.ledger).toEqual([{ type: "reserve", amount: 10000, createdAt: "2026-10-01T09:00:00Z" }])
  })

  it.each([
    ["en attente", [view()], { show: true, pending: 1, reported: 0 }],
    ["signalée", [view({ status: "reported" })], { show: true, pending: 0, reported: 1 }],
    ["attente et signalée", [view(), view({ id: "r2", status: "reported" })], { show: true, pending: 1, reported: 1 }],
    ["payée", [view({ status: "paid" })], { show: false, pending: 0, reported: 0 }],
    ["reçue", [view({ status: "received" })], { show: false, pending: 0, reported: 0 }],
    ["annulée", [view({ status: "cancelled" })], { show: false, pending: 0, reported: 0 }],
  ])("C09, demande %s : avertissement %j", async (_label, requests, expected) => {
    withPurchases()
    answer(requests)
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.confirmWarning).toEqual(expected)
  })

  it("C09 : l'avertissement n'apparaît que mission en cours, et ne retire rien à la confirmation de fin", async () => {
    withPurchases({ status: "done" })
    answer([view()])
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases.confirmWarning.show).toBe(false)
    expect(detail.mission.status).toBe("done")
  })

  it("C11 : coût total = service plus achats payés ou reçus seulement (ni attente, ni signalée, ni annulée, ni estimation)", async () => {
    withPurchases({ status: "done" })
    answer([
      view({ id: "a", status: "paid", amount: 4000 }),
      view({ id: "b", status: "received", amount: 3000 }),
      view({ id: "c", status: "pending", amount: 2000 }),
      view({ id: "d", status: "reported", amount: 1500 }),
      view({ id: "e", status: "cancelled", amount: 900 }),
    ])
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.costTotal).toEqual({ service: 10000, purchasesPaid: 7000, total: 17000 })
  })

  it.each(["in_progress", "cancelled", "open"])("coût total absent quand la mission est %s", async (status) => {
    withPurchases({ status })
    answer([view({ status: "paid", amount: 4000 })])
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.costTotal).toBeNull()
  })

  it("C11 : aucun achat payé, pas de coût total (le reçu reste inchangé)", async () => {
    withPurchases({ status: "done" })
    answer([view({ status: "reported" })])
    expect((await getClientMissionDetail(MISSION)).purchases.costTotal).toBeNull()
  })

  it("dépassement de l'estimation : simple indicateur, jamais bloquant", async () => {
    withPurchases()
    answer([view({ amount: 30001 })])
    expect((await getClientMissionDetail(MISSION)).purchases.exceedsEstimate).toBe(true)
  })

  it("ligne invalide ignorée : statut inconnu, montant décimal ou négatif, sans identifiant", async () => {
    withPurchases()
    answer([view(), view({ id: "x1", status: "?" }), view({ id: "x2", amount: 10.5 }), view({ id: "x3", amount: -5 }), view({ id: 7 }), null])
    const { purchases } = await getClientMissionDetail(MISSION)
    expect(purchases.requests.map((r) => r.id)).toEqual(["r1"])
    expect(purchases.totals.requested).toBe(6000)
  })

  it("mission sans achats ou sans étudiant retenu : aucune lecture, bloc indisponible", async () => {
    responses.missions = { data: { ...mission, purchases_estimate: null }, error: null }
    expect((await getClientMissionDetail(MISSION)).purchases).toEqual({ available: false })
    responses.missions = { data: { ...mission, status: "open", purchases_estimate: 20000, selected_student_id: null }, error: null }
    expect((await getClientMissionDetail(MISSION)).purchases).toEqual({ available: false })
    expect(getClientPurchaseRequests).not.toHaveBeenCalled()
  })

  it("autre client ou mission inexistante : null, aucune demande lue", async () => {
    responses.missions = { data: null, error: null }
    expect(await getClientMissionDetail(MISSION)).toBeNull()
    expect(getClientPurchaseRequests).not.toHaveBeenCalled()
  })

  it.each([
    ["table absente", { available: false }],
    ["introuvable", { notFound: true }],
    ["réponse sans liste", { available: true }],
    ["réponse vide", undefined],
  ])("%s : bloc indisponible, aucune erreur, le reste du détail est rendu", async (_label, response) => {
    withPurchases()
    getClientPurchaseRequests.mockResolvedValue(response)
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.mission.title).toBe("Cours de maths")
    expect(detail.selectedStudent).not.toBeNull()
  })

  it("lecture des achats en échec : achats indisponibles, la mission reste lisible, sans message de base", async () => {
    withPurchases()
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    getClientPurchaseRequests.mockResolvedValue({ error: "Impossible de charger les demandes de paiement. Veuillez réessayer.", code: "XX000" })
    const detail = await getClientMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.mission.id).toBe(MISSION)
    expect(log).toHaveBeenCalledWith("[getClientMissionDetail] demandes d'achats", "XX000")
    expect(JSON.stringify(detail)).not.toContain("Impossible de charger les demandes")
  })

  it("la source réutilise le lecteur d'ST-04 : ni service role, ni sonde HEAD, ni écriture, ni calcul de commission", () => {
    const src = readFileSync("src/lib/actions/client-mission-detail.actions.js", "utf8")
    expect(src).toContain("getClientPurchaseRequests")
    expect(src).not.toContain("createServiceClient")
    expect(src).not.toMatch(/head:\s*true|\.head\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
    expect(src).not.toMatch(/from "@\/lib\/(app\/money|constants\/missions|wallet\/[^"]*)"/)
    expect(src).not.toContain("0.12")
  })
})
