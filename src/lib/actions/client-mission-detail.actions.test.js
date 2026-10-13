import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { requireRole } from "@/lib/auth/require-role"
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
    profiles: {
      data: [
        { user_id: S1, full_name: "Awa Kouassi", avatar_url: null, city: "Cotonou", rating: 4.5, missions_done: 3, is_verified: true, verified_until: "2027-01-01" },
        { user_id: S2, full_name: "Koffi Dossou", avatar_url: "u.png", city: null, rating: null, missions_done: null, is_verified: false, verified_until: null },
      ],
      error: null,
    },
    student_profiles: { data: [{ user_id: S1, school: "UAC", level: "L3", skills: ["Babysitting"] }], error: null },
  }
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
      budget: 10000, urgency: "low", deadline: "2026-11-01", status: "in_progress", createdAt: "2026-10-01T08:00:00Z",
      selectedStudentId: S1,
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
