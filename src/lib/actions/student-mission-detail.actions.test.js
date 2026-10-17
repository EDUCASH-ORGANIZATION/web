import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/actions/profile.actions", () => ({ getMyProfile: vi.fn(), getMyStudentProfile: vi.fn() }))
vi.mock("@/lib/actions/purchase-request.actions", () => ({ getStudentPurchaseRequests: vi.fn() }))

import { requireRole } from "@/lib/auth/require-role"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { getStudentPurchaseRequests } from "@/lib/actions/purchase-request.actions"
import { getStudentMissionDetail } from "./student-mission-detail.actions"

const ME = "00000000-0000-4000-8000-000000000001"
const OTHER = "00000000-0000-4000-8000-000000000002"
const CLIENT = "00000000-0000-4000-8000-0000000000c1"
const MISSION = "11111111-1111-4111-8111-111111111111"

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
        // Lecture tolérante de la date de rétention : requête séparée sur applications, réponse dédiée.
        if (table === "applications" && state.columns === "id, accepted_at") return responses.acceptedAt
        const r = responses[table]
        return typeof r === "function" ? r(state) : (r ?? { data: null, error: null })
      }
      const b = {
        select: (columns) => { state.columns = columns; return b },
        eq: (c, v) => { state.filters.push(["eq", c, v]); return b },
        in: (c, v) => { state.filters.push(["in", c, v]); return b },
        neq: (c, v) => { state.filters.push(["neq", c, v]); return b },
        or: (v) => { state.filters.push(["or", v]); return b },
        order: () => b,
        limit: () => b,
        // Comme PostgrestBuilder : paresseux, chaque `.then()` exécute (et compte) une requête.
        maybeSingle: () => ({
          then: (ok, ko) => {
            state.runs = (state.runs ?? 0) + 1
            return Promise.resolve(resolve()).then(ok, ko)
          },
        }),
        then: (ok, ko) => Promise.resolve(resolve()).then(ok, ko),
      }
      return b
    },
  }
}

const baseMission = {
  id: MISSION, title: "Cours de maths", description: "Niveau 3e", type: "Cours particuliers", city: "Cotonou",
  budget: 10000, urgency: "low", deadline: "2999-11-01", status: "open", created_at: "2026-10-01T08:00:00Z",
  client_id: CLIENT, selected_student_id: null,
}

// Missions : la lecture minimale (porte) et la lecture complète se distinguent par leurs colonnes.
function missionsFor(row) {
  return (state) => {
    if (state.columns?.includes("title") && state.filters.some(([, c]) => c === "type")) {
      return { data: [{ id: "s1", title: "Autre", type: "Cours particuliers", city: null, budget: 5000 }], error: null }
    }
    return { data: row, error: null }
  }
}

beforeEach(() => {
  calls = []
  responses = {
    missions: missionsFor(baseMission),
    applications: { data: null, error: null },
    profiles: { data: { full_name: "Mawuli Adjovi", city: "Cotonou", avatar_url: null, rating: 4.7, missions_done: 5, is_verified: true }, error: null },
    wallet_transactions: { data: [], error: null },
    reviews: { data: null, error: null },
    completion: { data: [{ id: MISSION, completion_declared_at: null }], error: null },
    acceptedAt: { data: [], error: null },
  }
  requireRole.mockResolvedValue({ supabase: makeSupabase(), user: { id: ME }, role: "student", profile: {} })
  getStudentPurchaseRequests.mockReset()
  getStudentPurchaseRequests.mockResolvedValue({ available: false })
  getMyProfile.mockResolvedValue({ profile: { is_verified: true, verified_until: null, rejection_reason: null } })
  getMyStudentProfile.mockResolvedValue({ studentProfile: { card_url: "student-cards/x.png" } })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const callsOn = (table) => calls.filter((c) => c.table === table)

describe("getStudentMissionDetail : accès", () => {
  it("exige le rôle étudiant avant toute lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getStudentMissionDetail(MISSION)).toBeNull()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toHaveLength(0)
  })

  it("appelle requireRole en premier, même avec un identifiant invalide", async () => {
    requireRole.mockClear()
    expect(await getStudentMissionDetail("pas-un-uuid")).toBeNull()
    expect(requireRole).toHaveBeenCalledWith(["student"])
    expect(calls).toHaveLength(0)
  })

  it.each([undefined, null, 42, "", "1; drop table missions", "../../etc"])("id invalide %j : null sans lecture", async (id) => {
    expect(await getStudentMissionDetail(id)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("mission inexistante : null", async () => {
    responses.missions = { data: null, error: null }
    expect(await getStudentMissionDetail(MISSION)).toBeNull()
  })

  it("lecture en échec : erreur neutre sans message SQL", async () => {
    responses.missions = { data: null, error: { message: "relation boom" } }
    await expect(getStudentMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
  })
})

describe("getStudentMissionDetail : mission ouverte", () => {
  it("renvoie la mission, le client public, le statut de vérification et les similaires", async () => {
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("open")
    expect(detail.mission).toMatchObject({ id: MISSION, title: "Cours de maths", budget: 10000, status: "open" })
    expect(detail.client).toEqual({
      name: "Mawuli A.", avatarUrl: null, city: "Cotonou", rating: 4.7, missionsPublished: 5, isVerified: true,
    })
    expect(detail.application).toBeNull()
    expect(detail.verification).toMatchObject({ key: "verified", canApply: true })
    expect(detail.similar).toEqual([{ id: "s1", title: "Autre", type: "Cours particuliers", city: null, budget: 5000 }])
    expect(detail.ledger).toEqual([])
    expect(detail.review).toBeNull()
  })

  it("avatar du client : l'URL du projet est gardée, une URL externe (pixel de suivi) devient null", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
    try {
      const own = "https://proj.supabase.co/storage/v1/object/public/avatars/c1/a.png"
      for (const [raw, expected] of [
        [own, own],
        ["https://evil.example/pixel.png", null],
        ["https://evil.example/storage/v1/object/public/avatars/c1/a.png", null],
        ["https://proj.supabase.co/storage/v1/object/public/avatars/..%2F..%2Fx", null],
      ]) {
        responses.profiles = { data: { full_name: "Mawuli Adjovi", city: "Cotonou", avatar_url: raw }, error: null }
        expect((await getStudentMissionDetail(MISSION)).client.avatarUrl).toBe(expected)
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("ne renvoie aucune colonne privée ni identifiant du client", async () => {
    const detail = await getStudentMissionDetail(MISSION)
    const json = JSON.stringify(detail)
    for (const secret of ["card_url", "student-cards", "rejection_reason", "phone", "client_id", CLIENT, "verified_until"]) {
      expect(json).not.toContain(secret)
    }
    expect(Object.keys(detail.verification).sort()).toEqual(["action", "canApply", "daysLeft", "key", "label"])
  })

  it("candidature de la session : filtrée sur l'étudiant connecté", async () => {
    responses.applications = {
      data: { id: "a1", status: "pending", message: "Bonjour", created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
      error: null,
    }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.application).toMatchObject({ id: "a1", status: "pending" })
    const [app] = callsOn("applications")
    expect(app.filters).toContainEqual(["eq", "student_id", ME])
    expect(app.filters).toContainEqual(["eq", "mission_id", MISSION])
  })

  it("statut de vérification bloquant : canApply faux sans exposer de colonne brute", async () => {
    getMyProfile.mockResolvedValue({ profile: { is_verified: false, verified_until: null, rejection_reason: "Photo floue" } })
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.verification).toMatchObject({ key: "rejected", canApply: false })
    expect(JSON.stringify(detail)).not.toContain("Photo floue")
  })

  it("lecture de vérification en échec : erreur neutre (échec fermé)", async () => {
    getMyProfile.mockResolvedValue({ error: "boom" })
    await expect(getStudentMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
  })

  it("similaires : ouvertes, non expirées, hors mission courante", async () => {
    await getStudentMissionDetail(MISSION)
    const similar = callsOn("missions").find((c) => c.filters.some(([, col]) => col === "type"))
    expect(similar.filters).toContainEqual(["eq", "status", "open"])
    expect(similar.filters).toContainEqual(["neq", "id", MISSION])
    expect(similar.filters.find(([op]) => op === "or")[1]).toMatch(/^deadline\.is\.null,deadline\.gte\.\d{4}-\d{2}-\d{2}$/)
  })

  it("jamais de select(*) ni de lecture du grand livre ou des avis pour une mission ouverte", async () => {
    await getStudentMissionDetail(MISSION)
    for (const c of calls) {
      expect(c.columns).toBeTruthy()
      expect(c.columns).not.toContain("*")
    }
    expect(callsOn("wallet_transactions")).toHaveLength(0)
    expect(callsOn("reviews")).toHaveLength(0)
  })
})

describe("getStudentMissionDetail : mission non ouverte", () => {
  it("étudiant non retenu : SEULEMENT l'état plus ouverte, aucune donnée", async () => {
    responses.missions = { data: { ...baseMission, status: "in_progress", selected_student_id: OTHER }, error: null }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail).toEqual({ state: "closed", mission: { id: MISSION } })
    const json = JSON.stringify(detail)
    for (const leak of ["Cours de maths", "10000", "Niveau 3e", "Mawuli", "ledger", "message"]) {
      expect(json).not.toContain(leak)
    }
  })

  it("étudiant non retenu : une seule lecture de la mission, ni grand livre ni client ni candidature", async () => {
    responses.missions = { data: { ...baseMission, status: "done", selected_student_id: OTHER }, error: null }
    await getStudentMissionDetail(MISSION)
    expect(calls.map((c) => c.table)).toEqual(["missions"])
    for (const col of ["id", "status", "selected_student_id"]) expect(calls[0].columns.split(", ")).toContain(col)
    expect(calls[0].columns).not.toContain("*")
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it("une seule lecture de la mission : le même état décide closed et le détail (pas de fenêtre de course)", async () => {
    let reads = 0
    responses.missions = (state) => {
      if (state.filters.some(([, c]) => c === "type")) return { data: [], error: null }
      reads += 1
      return { data: reads === 1 ? { ...baseMission, status: "in_progress", selected_student_id: OTHER } : baseMission, error: null }
    }
    const detail = await getStudentMissionDetail(MISSION)
    expect(reads).toBe(1)
    expect(detail).toEqual({ state: "closed", mission: { id: MISSION } })
  })

  it("mission annulée sans retenu : état plus ouverte", async () => {
    responses.missions = { data: { ...baseMission, status: "cancelled", selected_student_id: null }, error: null }
    expect(await getStudentMissionDetail(MISSION)).toEqual({ state: "closed", mission: { id: MISSION } })
  })

  it("étudiant retenu : suivi avec ses lignes de grand livre (release net) et son avis", async () => {
    responses.missions = { data: { ...baseMission, status: "done", selected_student_id: ME }, error: null }
    responses.wallet_transactions = { data: [{ type: "release", amount: 8800, created_at: "2026-10-20T10:00:00Z" }], error: null }
    responses.reviews = { data: { id: "r1", rating: 5, comment: "Super", created_at: "2026-10-21T10:00:00Z" }, error: null }
    responses.applications = {
      data: { id: "a1", status: "accepted", message: "Bonjour", created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" },
      error: null,
    }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("selected")
    expect(detail.isSelected).toBe(true)
    expect(detail.ledger).toEqual([{ type: "release", amount: 8800, createdAt: "2026-10-20T10:00:00Z" }])
    expect(detail.review).toMatchObject({ id: "r1", rating: 5 })
    expect(detail.verification).toBeNull()
    expect(detail.similar).toEqual([])
    expect(getMyProfile).not.toHaveBeenCalled()
  })

  it("grand livre : filtré sur le user_id de l'étudiant et sur release seulement (ni brut du client ni commission)", async () => {
    responses.missions = { data: { ...baseMission, status: "in_progress", selected_student_id: ME }, error: null }
    await getStudentMissionDetail(MISSION)
    const [ledger] = callsOn("wallet_transactions")
    expect(ledger.filters).toContainEqual(["eq", "user_id", ME])
    expect(ledger.filters).toContainEqual(["eq", "mission_id", MISSION])
    expect(ledger.filters).toContainEqual(["eq", "type", "release"])
    expect(ledger.columns).toBe("type, amount, created_at")
    const [review] = callsOn("reviews")
    expect(review.filters).toContainEqual(["eq", "reviewer_id", ME])
  })

  it("l'identifiant du client n'est jamais renvoyé à l'étudiant retenu", async () => {
    responses.missions = { data: { ...baseMission, status: "in_progress", selected_student_id: ME }, error: null }
    expect(JSON.stringify(await getStudentMissionDetail(MISSION))).not.toContain(CLIENT)
  })
})

describe("getStudentMissionDetail : mission avec achats", () => {
  it.each([
    [15000, 15000],
    ["12000", 12000],
    [null, null],
    [0, null],
    [-4, null],
    ["abc", null],
    [1e12, null],
  ])("estimation %j renvoyée comme %j", async (raw, expected) => {
    responses.missions = missionsFor({ ...baseMission, purchases_estimate: raw })
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.mission.purchasesEstimate).toBe(expected)
  })

  it("lit la colonne par une liste explicite, jamais select(*)", async () => {
    await getStudentMissionDetail(MISSION)
    const full = callsOn("missions").find((c) => c.columns?.includes("client_id"))
    expect(full.columns).toContain("purchases_estimate")
    expect(full.columns).not.toContain("*")
  })
})

describe("getStudentMissionDetail : fin déclarée (RD-DONE-01)", () => {
  const selected = { ...baseMission, status: "in_progress", selected_student_id: ME }
  const completionCalls = () => callsOn("missions").filter((c) => c.columns === "id, completion_declared_at")

  it("selected non déclaré : completion disponible, declaredAt null, lecture sur cette mission seulement", async () => {
    responses.missions = missionsFor(selected)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("selected")
    expect(detail.completion).toEqual({ available: true, declaredAt: null })
    expect(completionCalls()).toHaveLength(1)
    expect(completionCalls()[0].filters).toEqual([["in", "id", [MISSION]]])
  })

  it("selected déclaré : declaredAt renvoyé", async () => {
    responses.missions = missionsFor(selected)
    responses.completion = { data: [{ id: MISSION, completion_declared_at: "2026-10-12T10:00:00Z" }], error: null }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.completion).toEqual({ available: true, declaredAt: "2026-10-12T10:00:00Z" })
  })

  it.each(["done", "cancelled"])("mission %s pour l'étudiant retenu : date conservée", async (status) => {
    responses.missions = missionsFor({ ...selected, status })
    responses.completion = { data: [{ id: MISSION, completion_declared_at: "2026-10-12T10:00:00Z" }], error: null }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("selected")
    expect(detail.completion).toEqual({ available: true, declaredAt: "2026-10-12T10:00:00Z" })
  })

  it("ligne non renvoyée (RLS, réattribution) : indisponible, jamais un faux non déclaré", async () => {
    responses.missions = missionsFor(selected)
    responses.completion = { data: [], error: null }
    expect((await getStudentMissionDetail(MISSION)).completion).toEqual({ available: false, declaredAt: null })
  })

  it("mission ouverte : aucune lecture de la colonne, completion neutre", async () => {
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("open")
    expect(detail.completion).toEqual({ available: false, declaredAt: null })
    expect(completionCalls()).toHaveLength(0)
  })

  it("état closed : aucune lecture de la colonne", async () => {
    responses.missions = missionsFor({ ...baseMission, status: "in_progress", selected_student_id: OTHER })
    expect((await getStudentMissionDetail(MISSION)).state).toBe("closed")
    expect(completionCalls()).toHaveLength(0)
  })

  it.each(["42703", "PGRST204"])("colonne absente (%s) : page rendue, available false", async (code) => {
    responses.missions = missionsFor(selected)
    responses.completion = { data: null, error: { code, message: "column missions.completion_declared_at does not exist" } }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("selected")
    expect(detail.mission.id).toBe(MISSION)
    expect(detail.completion).toEqual({ available: false, declaredAt: null })
  })

  it("autre erreur : erreur neutre sans message SQL", async () => {
    responses.missions = missionsFor(selected)
    responses.completion = { data: null, error: { code: "XX000", message: "relation boom" } }
    await expect(getStudentMissionDetail(MISSION)).rejects.toThrow("Impossible de charger la mission.")
  })
})

describe("getStudentMissionDetail : date de rétention (RD-ACCEPT-01, accepted_at)", () => {
  const APP = "22222222-2222-4222-8222-222222222222"
  const selected = { ...baseMission, status: "in_progress", selected_student_id: ME }
  // updated_at porte volontairement une valeur différente : il ne doit jamais alimenter la date de rétention.
  const appRow = (status = "accepted") => ({
    id: APP, status, message: "Bonjour", created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-09T00:00:00Z",
  })
  const acceptedCalls = () => callsOn("applications").filter((c) => c.columns === "id, accepted_at")
  const load = async (over = {}) => {
    responses.missions = missionsFor({ ...selected, ...over })
    responses.applications = { data: appRow(), error: null }
    return getStudentMissionDetail(MISSION)
  }

  it("date valide : acceptedAt vient d'accepted_at, lue sur cette candidature par la session", async () => {
    responses.acceptedAt = { data: [{ id: APP, accepted_at: "2026-10-08T08:00:00Z" }], error: null }
    const detail = await load()
    expect(detail.application.acceptedAt).toBe("2026-10-08T08:00:00Z")
    expect(acceptedCalls()).toHaveLength(1)
    expect(acceptedCalls()[0].filters).toEqual([["in", "id", [APP]], ["eq", "student_id", ME]])
  })

  it("la candidature n'est lue qu'une seule fois (builder paresseux exécuté une fois)", async () => {
    responses.acceptedAt = { data: [{ id: APP, accepted_at: "2026-10-08T08:00:00Z" }], error: null }
    await load()
    const reads = callsOn("applications").filter((c) => c.columns === "id, status, message, created_at")
    expect(reads).toHaveLength(1)
    expect(reads[0].runs).toBe(1)
  })

  it("updated_at n'alimente jamais la date, même avec une valeur différente", async () => {
    responses.acceptedAt = { data: [{ id: APP, accepted_at: "2026-10-08T08:00:00Z" }], error: null }
    const detail = await load()
    expect(detail.application).not.toHaveProperty("updatedAt")
    expect(JSON.stringify(detail.application)).not.toContain("2026-10-09")
    responses.acceptedAt = { data: [{ id: APP, accepted_at: null }], error: null }
    expect((await load()).application.acceptedAt).toBeNull()
  })

  it("accepted_at NULL : acceptedAt null", async () => {
    responses.acceptedAt = { data: [{ id: APP, accepted_at: null }], error: null }
    expect((await load()).application.acceptedAt).toBeNull()
  })

  it.each(["42703", "PGRST204"])("colonne absente (%s) : page rendue, acceptedAt null, journal par code", async (code) => {
    responses.acceptedAt = { data: null, error: { code, message: "column applications.accepted_at does not exist" } }
    const detail = await load()
    expect(detail.state).toBe("selected")
    expect(detail.mission.id).toBe(MISSION)
    expect(detail.application.acceptedAt).toBeNull()
    expect(console.error).toHaveBeenCalledWith("[accepted] colonne accepted_at absente", code)
  })

  it("autre erreur : la page se rend sans date, journal par code seulement (jamais le message)", async () => {
    responses.acceptedAt = { data: null, error: { code: "XX000", message: "relation boom" } }
    const detail = await load()
    expect(detail.state).toBe("selected")
    expect(detail.application.acceptedAt).toBeNull()
    expect(console.error).toHaveBeenCalledWith("[getStudentMissionDetail] date de rétention", "XX000")
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("relation boom")
  })

  it("ligne manquante (RLS, réattribution) : acceptedAt null", async () => {
    responses.acceptedAt = { data: [], error: null }
    expect((await load()).application.acceptedAt).toBeNull()
  })

  it.each(["pas une date", "2999-01-01T00:00:00Z", ""])("date invalide ou future (%s) : acceptedAt null", async (bad) => {
    responses.acceptedAt = { data: [{ id: APP, accepted_at: bad }], error: null }
    expect((await load()).application.acceptedAt).toBeNull()
  })

  it("candidature non acceptée (état selected) : aucune lecture, acceptedAt null", async () => {
    responses.missions = missionsFor(selected)
    responses.applications = { data: appRow("pending"), error: null }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.application.acceptedAt).toBeNull()
    expect(acceptedCalls()).toHaveLength(0)
  })

  it("mission ouverte : aucune lecture d'accepted_at", async () => {
    responses.applications = { data: appRow(), error: null }
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("open")
    expect(acceptedCalls()).toHaveLength(0)
  })

  it("étudiant non retenu (closed) : aucune lecture d'accepted_at", async () => {
    responses.missions = missionsFor({ ...selected, selected_student_id: OTHER })
    expect((await getStudentMissionDetail(MISSION)).state).toBe("closed")
    expect(acceptedCalls()).toHaveLength(0)
  })

  it("aucune candidature : acceptedAt absent, aucune lecture", async () => {
    responses.missions = missionsFor(selected)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.application).toBeNull()
    expect(acceptedCalls()).toHaveLength(0)
  })

  it("la source n'utilise jamais updated_at comme date de rétention ni le client service", () => {
    const src = readFileSync("src/lib/actions/student-mission-detail.actions.js", "utf8")
    expect(src).not.toMatch(/acceptedAt:\s*application\.updated_at/)
    expect(src).not.toContain("createServiceClient")
    expect(src).not.toContain("head: true")
  })
})

describe("getStudentMissionDetail : demandes de paiement d'achats (RD-ACHATS-01)", () => {
  const retained = { ...baseMission, status: "in_progress", selected_student_id: ME, purchases_estimate: 20000 }
  const view = (over = {}) => ({ id: "r1", seq: 1, status: "pending", version: 1, amount: 6000, vendorName: "Dossa", actions: ["edit", "cancel"], ...over })

  it("étudiant retenu, 0 demande : bloc disponible, totaux nuls, estimation séparée", async () => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue({ available: true, requests: [], canCreate: true })
    const detail = await getStudentMissionDetail(MISSION)
    expect(getStudentPurchaseRequests).toHaveBeenCalledWith({ missionId: MISSION })
    expect(detail.purchases).toEqual({
      available: true,
      requests: [],
      totals: { count: 0, requested: 0, paid: 0, pending: 0, reported: 0 },
      exceedsEstimate: false,
      canCreate: true,
    })
    expect(detail.mission.purchasesEstimate).toBe(20000)
  })

  it("1 demande puis 3 demandes : liste dans l'ordre reçu, totaux recalculés, annulée exclue des totaux", async () => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue({ available: true, requests: [view()], canCreate: true })
    let detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases.requests).toHaveLength(1)
    expect(detail.purchases.totals).toEqual({ count: 1, requested: 6000, paid: 0, pending: 6000, reported: 0 })

    getStudentPurchaseRequests.mockResolvedValue({
      available: true,
      requests: [
        view(),
        view({ id: "r2", seq: 2, status: "received", amount: 4000 }),
        view({ id: "r3", seq: 3, status: "cancelled", amount: 9000 }),
        view({ id: "r4", seq: 4, status: "reported", amount: 2500 }),
      ],
      canCreate: false,
    })
    detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases.requests.map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4"])
    expect(detail.purchases.totals).toEqual({ count: 3, requested: 12500, paid: 4000, pending: 6000, reported: 2500 })
    expect(detail.purchases.canCreate).toBe(false)
    // L'estimation n'entre jamais dans les totaux ni dans le grand livre.
    expect(detail.purchases.totals.requested).not.toBe(12500 + 20000)
    expect(detail.ledger).toEqual([])
  })

  it("dépassement : vrai seulement au-delà de 1,5 fois l'estimation", async () => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue({ available: true, requests: [view({ amount: 30000 })], canCreate: true })
    expect((await getStudentMissionDetail(MISSION)).purchases.exceedsEstimate).toBe(false)
    getStudentPurchaseRequests.mockResolvedValue({ available: true, requests: [view({ amount: 30001 })], canCreate: true })
    expect((await getStudentMissionDetail(MISSION)).purchases.exceedsEstimate).toBe(true)
  })

  it("ligne invalide ignorée : statut inconnu, montant non entier, négatif ou sans identifiant", async () => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue({
      available: true,
      requests: [
        view(),
        view({ id: "x1", status: "mystere" }),
        view({ id: "x2", amount: 150.5 }),
        view({ id: "x3", amount: -100 }),
        view({ id: undefined }),
        null,
        "texte",
      ],
      canCreate: true,
    })
    const { purchases } = await getStudentMissionDetail(MISSION)
    expect(purchases.requests.map((r) => r.id)).toEqual(["r1"])
    expect(purchases.totals.requested).toBe(6000)
  })

  it("étudiant candidat (mission ouverte) : aucune demande lue, bloc indisponible", async () => {
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.state).toBe("open")
    expect(detail.purchases).toEqual({ available: false })
    expect(getStudentPurchaseRequests).not.toHaveBeenCalled()
  })

  it("étudiant retenu d'une autre mission en cours : état fermé, aucune demande lue", async () => {
    responses.missions = missionsFor({ ...retained, selected_student_id: OTHER })
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail).toEqual({ state: "closed", mission: { id: MISSION } })
    expect(getStudentPurchaseRequests).not.toHaveBeenCalled()
  })

  it("mission sans achats : aucune lecture des demandes, rendu actuel inchangé", async () => {
    responses.missions = missionsFor({ ...retained, purchases_estimate: null })
    const detail = await getStudentMissionDetail(MISSION)
    expect(getStudentPurchaseRequests).not.toHaveBeenCalled()
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.state).toBe("selected")
  })

  it.each([
    ["table absente", { available: false }],
    ["introuvable", { notFound: true }],
    ["réponse sans liste", { available: true }],
    ["réponse vide", undefined],
  ])("%s : bloc indisponible, aucune erreur, le reste du détail est rendu", async (_label, answer) => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue(answer)
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.state).toBe("selected")
    expect(detail.mission.title).toBe("Cours de maths")
  })

  it("lecture des achats en échec : achats indisponibles, la mission reste lisible, sans message de base", async () => {
    responses.missions = missionsFor(retained)
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    getStudentPurchaseRequests.mockResolvedValue({ error: "Impossible de charger les demandes de paiement. Veuillez réessayer.", code: "XX000" })
    const detail = await getStudentMissionDetail(MISSION)
    expect(detail.purchases).toEqual({ available: false })
    expect(detail.mission.title).toBe("Cours de maths")
    expect(log).toHaveBeenCalledWith("[getStudentMissionDetail] demandes d'achats", "XX000")
    expect(JSON.stringify(detail)).not.toContain("Impossible de charger les demandes")
  })

  it("n'expose ni identifiant du client ni colonne d'une autre partie, et ne lit pas purchase_requests lui-même", async () => {
    responses.missions = missionsFor(retained)
    getStudentPurchaseRequests.mockResolvedValue({ available: true, requests: [view()], canCreate: true })
    const detail = await getStudentMissionDetail(MISSION)
    expect(JSON.stringify(detail)).not.toContain(CLIENT)
    expect(callsOn("purchase_requests")).toHaveLength(0)
    expect(callsOn("reports")).toHaveLength(0)
  })

  it("la source réutilise le lecteur d'ST-04 : ni service role, ni sonde HEAD, ni écriture", () => {
    const src = readFileSync("src/lib/actions/student-mission-detail.actions.js", "utf8")
    expect(src).toContain("getStudentPurchaseRequests")
    expect(src).not.toContain("createServiceClient")
    expect(src).not.toMatch(/head:\s*true|\.head\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
    expect(src).not.toMatch(/from "@\/lib\/(app\/money|constants\/missions|wallet\/[^"]*)"/)
    expect(src).not.toContain("0.12")
  })
})
