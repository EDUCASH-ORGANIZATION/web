import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import {
  getOnboardingState,
  completeStudentOnboarding,
  completeClientOnboarding,
} from "./onboarding.actions"

const SUPABASE_URL = "https://abc.supabase.co"
const UID = "user-1"

// Faux client Supabase : enregistre les écritures et sert un profil prédéfini.
function fakeSupabase({ user = { id: UID, user_metadata: {} }, profile = null, updateRows = [{ user_id: UID }] } = {}) {
  const calls = { update: [], insert: [], upsert: [], updateUser: [] }
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      updateUser: vi.fn(async (arg) => {
        calls.updateUser.push(arg)
        return { error: null }
      }),
    },
    from: vi.fn((table) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
          update: (cols) => {
            calls.update.push({ table, cols })
            return { eq: () => ({ select: async () => ({ data: updateRows, error: null }) }) }
          },
          insert: async (row) => {
            calls.insert.push({ table, row })
            return { error: null }
          },
        }
      }
      return {
        upsert: async (row, opts) => {
          calls.upsert.push({ table, row, opts })
          return { error: null }
        },
      }
    }),
  }
  return { supabase, calls }
}

function use(options) {
  const fake = fakeSupabase(options)
  vi.mocked(createClient).mockResolvedValue(fake.supabase)
  return fake
}

const studentProfile = { role: "student", full_name: null, city: null, is_suspended: false }
const clientProfile = { role: "client", full_name: null, city: null, is_suspended: false }

const studentPayload = {
  fullName: "Sèna Agossou",
  city: "Cotonou",
  phone: "01 97 45 21 08",
  bio: "Étudiante en gestion",
  school: "UAC",
  level: "Licence 2",
  skills: ["Livraison"],
  availability: ["Matin", "Soir"],
}

const clientPayload = {
  clientType: "pme",
  name: "Boulangerie Dossou",
  city: "Porto-Novo",
  phone: "+229 0197452108",
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(createClient).mockReset()
})

describe("getOnboardingState", () => {
  it("non connecté : unauthenticated", async () => {
    use({ user: null })
    expect((await getOnboardingState("student")).status).toBe("unauthenticated")
  })

  it("rôle attendu : ok avec profil incomplet", async () => {
    use({ profile: studentProfile })
    const state = await getOnboardingState("student")
    expect(state).toMatchObject({ status: "ok", role: "student", profileComplete: false })
  })

  it("profil complet signalé", async () => {
    use({ profile: { ...studentProfile, full_name: "Sèna", city: "Cotonou" } })
    expect((await getOnboardingState("student")).profileComplete).toBe(true)
  })

  it("client sur l'écran étudiant : wrong_role avec son rôle", async () => {
    use({ profile: clientProfile })
    expect(await getOnboardingState("student")).toMatchObject({ status: "wrong_role", role: "client" })
  })

  it("metadata admin mais profil étudiant : étudiant, jamais admin", async () => {
    use({ user: { id: UID, user_metadata: { role: "admin" } }, profile: studentProfile })
    expect(await getOnboardingState("student")).toMatchObject({ status: "ok", role: "student" })
  })

  it("compte suspendu : suspended", async () => {
    use({ profile: { ...studentProfile, is_suspended: true } })
    expect((await getOnboardingState("student")).status).toBe("suspended")
  })
})

describe("completeStudentOnboarding", () => {
  it("écrit une liste blanche et ignore les colonnes sensibles", async () => {
    const { calls } = use({ profile: studentProfile })
    const result = await completeStudentOnboarding({
      ...studentPayload,
      role: "admin",
      is_verified: true,
      isVerified: true,
      is_suspended: false,
      verified_until: "2099-01-01",
      user_id: "autre",
      rating: 5,
    })

    expect(result).toEqual({ ok: true, destination: "/dashboard" })
    expect(calls.update).toHaveLength(1)
    expect(calls.update[0].cols).toEqual({
      full_name: "Sèna Agossou",
      city: "Cotonou",
      phone: "+2290197452108",
      bio: "Étudiante en gestion",
    })
    expect(calls.upsert[0].row).toEqual({
      user_id: UID,
      school: "UAC",
      level: "Licence 2",
      skills: ["Livraison"],
      availability: "Matin, Soir",
    })
  })

  it("carte fournie : verification_submitted_at seulement, jamais is_verified", async () => {
    const { calls } = use({ profile: studentProfile })
    const cardUrl = `${SUPABASE_URL}/storage/v1/object/public/student-cards/${UID}/card.jpg`
    const result = await completeStudentOnboarding({ ...studentPayload, cardUrl })

    expect(result.ok).toBe(true)
    const cols = calls.update[0].cols
    expect(cols.verification_submitted_at).toEqual(expect.any(String))
    expect(cols).not.toHaveProperty("is_verified")
    expect(cols).not.toHaveProperty("role")
    expect(calls.upsert[0].row.card_url).toBe(cardUrl)
  })

  it("sans carte : pas de verification_submitted_at ni de card_url", async () => {
    const { calls } = use({ profile: studentProfile })
    await completeStudentOnboarding(studentPayload)
    expect(calls.update[0].cols).not.toHaveProperty("verification_submitted_at")
    expect(calls.upsert[0].row).not.toHaveProperty("card_url")
  })

  it("avatar du projet et de l'utilisateur : enregistré", async () => {
    const { calls } = use({ profile: studentProfile })
    const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${UID}/avatar.png`
    await completeStudentOnboarding({ ...studentPayload, avatarUrl })
    expect(calls.update[0].cols.avatar_url).toBe(avatarUrl)
  })

  it.each([
    ["autre utilisateur", `${SUPABASE_URL}/storage/v1/object/public/avatars/autre/avatar.png`],
    ["autre domaine", `https://evil.example/storage/v1/object/public/avatars/${UID}/avatar.png`],
    ["autre bucket", `${SUPABASE_URL}/storage/v1/object/public/student-cards/${UID}/avatar.png`],
    ["traversée de dossier", `${SUPABASE_URL}/storage/v1/object/public/avatars/${UID}/../autre/a.png`],
    ["pas une URL", "javascript:alert(1)"],
  ])("avatar refusé (%s) : aucune écriture", async (_label, avatarUrl) => {
    const { calls } = use({ profile: studentProfile })
    const result = await completeStudentOnboarding({ ...studentPayload, avatarUrl })
    expect(result).toMatchObject({ ok: false, code: "invalid" })
    expect(result.fieldErrors.avatarUrl).toBeDefined()
    expect(calls.update).toHaveLength(0)
    expect(calls.upsert).toHaveLength(0)
  })

  it("carte d'un autre utilisateur refusée", async () => {
    const { calls } = use({ profile: studentProfile })
    const cardUrl = `${SUPABASE_URL}/storage/v1/object/public/student-cards/autre/card.jpg`
    const result = await completeStudentOnboarding({ ...studentPayload, cardUrl })
    expect(result.fieldErrors.cardUrl).toBeDefined()
    expect(calls.update).toHaveLength(0)
  })

  it("téléphone invalide et ville hors liste : erreurs de champ, aucune écriture", async () => {
    const { calls } = use({ profile: studentProfile })
    const result = await completeStudentOnboarding({ ...studentPayload, phone: "0297452108", city: "Paris" })
    expect(result.code).toBe("invalid")
    expect(result.fieldErrors.phone).toBeDefined()
    expect(result.fieldErrors.city).toBeDefined()
    expect(calls.update).toHaveLength(0)
    expect(calls.insert).toHaveLength(0)
    expect(calls.upsert).toHaveLength(0)
  })

  it("client : wrong_role sans écriture", async () => {
    const { calls } = use({ profile: clientProfile })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ ok: false, code: "wrong_role" })
    expect(calls.update).toHaveLength(0)
  })

  it("profil déjà complet : already_done sans écriture, avec destination", async () => {
    const { calls } = use({ profile: { ...studentProfile, full_name: "Sèna", city: "Cotonou" } })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({
      ok: false,
      code: "already_done",
      destination: "/dashboard",
    })
    expect(calls.update).toHaveLength(0)
    expect(calls.insert).toHaveLength(0)
  })

  it("admin : refusé", async () => {
    const { calls } = use({ profile: { ...studentProfile, role: "admin" } })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ ok: false, code: "wrong_role" })
    expect(calls.update).toHaveLength(0)
  })

  it("metadata admin sans profil : refusé", async () => {
    use({ user: { id: UID, user_metadata: { role: "admin" } }, profile: null })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ code: "wrong_role" })
  })

  it("non connecté : unauthenticated", async () => {
    use({ user: null })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ code: "unauthenticated" })
  })

  it("compte suspendu : suspended", async () => {
    const { calls } = use({ profile: { ...studentProfile, is_suspended: true } })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ code: "suspended" })
    expect(calls.update).toHaveLength(0)
  })

  it("profil absent : insertion avec le rôle serveur (metadata student), pas celui du payload", async () => {
    const { calls } = use({ user: { id: UID, user_metadata: { role: "student" } }, profile: null })
    const result = await completeStudentOnboarding({ ...studentPayload, role: "admin" })
    expect(result.ok).toBe(true)
    expect(calls.update).toHaveLength(0)
    expect(calls.insert[0].row).toMatchObject({ user_id: UID, role: "student", full_name: "Sèna Agossou" })
    expect(calls.insert[0].row).not.toHaveProperty("is_verified")
  })

  it("mise à jour qui ne touche aucune ligne : save_failed", async () => {
    use({ profile: studentProfile, updateRows: [] })
    expect(await completeStudentOnboarding(studentPayload)).toMatchObject({ ok: false, code: "save_failed" })
  })

  it("destination : next autorisé conservé, next client refusé pour un étudiant", async () => {
    use({ profile: studentProfile })
    const ok = await completeStudentOnboarding({ ...studentPayload, next: "/student/missions" })
    expect(ok.destination).toBe("/student/missions")

    use({ profile: studentProfile })
    const refused = await completeStudentOnboarding({ ...studentPayload, next: "/client/missions/new" })
    expect(refused.destination).toBe("/dashboard")

    use({ profile: studentProfile })
    const external = await completeStudentOnboarding({ ...studentPayload, next: "//evil.example" })
    expect(external.destination).toBe("/dashboard")
  })

  it("payload absent ou non objet : invalid", async () => {
    use({ profile: studentProfile })
    expect(await completeStudentOnboarding(null)).toMatchObject({ ok: false, code: "invalid" })
    expect(await completeStudentOnboarding("x")).toMatchObject({ ok: false, code: "invalid" })
  })
})

describe("completeClientOnboarding", () => {
  it("écrit la liste blanche, vouvoie, et garde le type en metadata", async () => {
    const { calls } = use({ profile: clientProfile })
    const result = await completeClientOnboarding({
      ...clientPayload,
      role: "admin",
      is_verified: true,
      is_suspended: false,
      verified_until: "2099-01-01",
      user_id: "autre",
      bio: "ignorée",
    })

    expect(result).toEqual({ ok: true, destination: "/client/dashboard" })
    expect(calls.update[0].cols).toEqual({
      full_name: "Boulangerie Dossou",
      city: "Porto-Novo",
      phone: "+2290197452108",
    })
    expect(calls.updateUser).toEqual([{ data: { client_type: "pme" } }])
    expect(calls.upsert).toHaveLength(0)
  })

  it("next de publication conservé avec le pré-remplissage", async () => {
    use({ profile: clientProfile })
    const next = "/client/missions/new?besoin=Repas&ville=Cotonou"
    const result = await completeClientOnboarding({ ...clientPayload, next })
    expect(result.destination).toBe(next)
  })

  it("client avec profil déjà complet : already_done sans écriture", async () => {
    const { calls } = use({ profile: { ...clientProfile, full_name: "Dossou", city: "Cotonou" } })
    expect(await completeClientOnboarding(clientPayload)).toMatchObject({
      ok: false,
      code: "already_done",
      destination: "/client/dashboard",
    })
    expect(calls.update).toHaveLength(0)
    expect(calls.updateUser).toHaveLength(0)
  })

  it("étudiant : wrong_role sans écriture", async () => {
    const { calls } = use({ profile: studentProfile })
    expect(await completeClientOnboarding(clientPayload)).toMatchObject({ ok: false, code: "wrong_role" })
    expect(calls.update).toHaveLength(0)
    expect(calls.updateUser).toHaveLength(0)
  })

  it("admin : refusé", async () => {
    use({ profile: { ...clientProfile, role: "admin" } })
    expect(await completeClientOnboarding(clientPayload)).toMatchObject({ code: "wrong_role" })
  })

  it("type inconnu et téléphone invalide : erreurs de champ, aucune écriture, message vouvoyé", async () => {
    const { calls } = use({ profile: clientProfile })
    const result = await completeClientOnboarding({ ...clientPayload, clientType: "admin", phone: "123" })
    expect(result.code).toBe("invalid")
    expect(result.fieldErrors.clientType).toBeDefined()
    expect(result.fieldErrors.phone).toBeDefined()
    expect(result.message).toMatch(/Vérifiez/)
    expect(calls.update).toHaveLength(0)
    expect(calls.updateUser).toHaveLength(0)
  })

  it("logo d'un autre utilisateur refusé", async () => {
    const { calls } = use({ profile: clientProfile })
    const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/autre/logo.png`
    const result = await completeClientOnboarding({ ...clientPayload, avatarUrl })
    expect(result.fieldErrors.avatarUrl).toBeDefined()
    expect(calls.update).toHaveLength(0)
  })

  it("profil absent : insertion avec le rôle client", async () => {
    const { calls } = use({ user: { id: UID, user_metadata: { role: "client" } }, profile: null })
    const result = await completeClientOnboarding(clientPayload)
    expect(result.ok).toBe(true)
    expect(calls.insert[0].row).toMatchObject({ user_id: UID, role: "client" })
  })
})
