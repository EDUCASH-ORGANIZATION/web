import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/actions/profile.actions", () => ({ getMyProfile: vi.fn(), getMyStudentProfile: vi.fn() }))

import { requireRole } from "@/lib/auth/require-role"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
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
        maybeSingle: () => Promise.resolve(resolve()),
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
  }
  requireRole.mockResolvedValue({ supabase: makeSupabase(), user: { id: ME }, role: "student", profile: {} })
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
