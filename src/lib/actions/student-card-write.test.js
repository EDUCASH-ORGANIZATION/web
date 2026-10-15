import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// RD-FIX-15 : enregistrement de la carte étudiante par la session de l'étudiant, avec les privilèges réels de la
// base (supabase/schema.sql, catalogue de production). Le rôle `authenticated` a INSERT et UPDATE sur
// `student_profiles`, mais SELECT seulement sur les colonnes publiques : `card_url` est privée (RD-SEC-02).
// PostgreSQL exige SELECT sur toute colonne lue dans `EXCLUDED` d'un `INSERT ... ON CONFLICT DO UPDATE`
// (forme produite par `upsert` de supabase-js) : un upsert qui porte `card_url` échoue en 42501.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/require-role"
import { saveStudentCardUrl } from "./profile.actions"
import { completeStudentOnboarding } from "./onboarding.actions"

const UID = "11111111-1111-1111-1111-111111111111"
const CARD = `${UID}/carte-1760000000000-a1b2c3d4.jpg`

// Colonnes de `student_profiles` lisibles par `authenticated` (schema.sql, « grant select (...) to authenticated »).
const STUDENT_SELECT_GRANT = new Set(["availability", "created_at", "id", "level", "school", "skills", "updated_at", "user_id"])
const DENIED = { code: "42501", message: "permission denied for table student_profiles" }

/**
 * Faux client de session qui applique les règles PostgreSQL utiles ici : privilèges de colonne en lecture (filtre,
 * RETURNING, EXCLUDED d'un upsert), RLS « ligne de l'appelant », contrainte unique sur user_id.
 */
function fakeDb({ studentRow = null, profileRow = {} } = {}) {
  const db = {
    student: studentRow ? { ...studentRow, user_id: UID } : null,
    profile: { role: "student", full_name: null, city: null, is_suspended: false, ...profileRow },
    writes: [],
  }
  const readable = (cols) => cols.every((c) => STUDENT_SELECT_GRANT.has(c))

  const studentTable = {
    upsert: async (row, opts = {}) => {
      db.writes.push({ op: "upsert", row, opts })
      if (row.user_id !== UID) return { error: { code: "42501", message: "new row violates row-level security policy" } }
      if (opts.ignoreDuplicates) {
        if (!db.student) db.student = { ...row }
        return { error: null }
      }
      // ON CONFLICT (user_id) DO UPDATE SET col = EXCLUDED.col pour chaque colonne envoyée.
      if (!readable(Object.keys(row))) return { error: DENIED }
      db.student = { ...(db.student ?? {}), ...row }
      return { error: null }
    },
    insert: async (row) => {
      db.writes.push({ op: "insert", row })
      if (row.user_id !== UID) return { error: { code: "42501", message: "new row violates row-level security policy" } }
      if (db.student) return { error: { code: "23505", message: "duplicate key value violates unique constraint" } }
      db.student = { ...row }
      return { error: null }
    },
    update: (cols, opts = {}) => ({
      eq: (col, value) => {
        const run = (returning) => {
          db.writes.push({ op: "update", cols, filter: [col, value], opts })
          if (!readable([col]) || (returning && !readable(returning))) return { error: DENIED, data: null, count: null }
          const hit = db.student && db.student[col] === value && value === UID
          if (hit) Object.assign(db.student, cols)
          const n = hit ? 1 : 0
          return { error: null, data: returning ? (hit ? [{ user_id: UID }] : []) : null, count: opts.count ? n : null }
        }
        const done = Promise.resolve().then(() => run(null))
        return {
          then: (ok, ko) => done.then(ok, ko),
          select: async (c) => run(c.split(",").map((s) => s.trim())),
        }
      },
    }),
  }

  const profilesTable = {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...db.profile }, error: null }) }) }),
    update: (cols) => ({
      eq: (_col, value) => {
        const apply = () => {
          if (value === UID) Object.assign(db.profile, cols)
          return value === UID
        }
        const done = Promise.resolve().then(() => (apply(), { error: null }))
        return {
          then: (ok, ko) => done.then(ok, ko),
          select: async () => ({ data: apply() ? [{ user_id: UID }] : [], error: null }),
        }
      },
    }),
  }

  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: UID, user_metadata: {} } } }) },
    from: (table) => (table === "student_profiles" ? studentTable : profilesTable),
  }
  return { db, supabase }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("saveStudentCardUrl : privilèges réels de la session étudiante", () => {
  const scenarios = [
    ["premier dépôt, aucune ligne student_profiles", { studentRow: null, profileRow: { full_name: "Awa", city: "Cotonou" } }],
    [
      "renvoi après refus",
      { studentRow: { school: "UAC", card_url: `${UID}/carte-old.jpg` }, profileRow: { is_verified: false, rejection_reason: "floue" } },
    ],
    [
      "renouvellement d'une carte vérifiée",
      { studentRow: { school: "UAC", card_url: `${UID}/card-old.jpg` }, profileRow: { is_verified: true, rejection_reason: null } },
    ],
  ]

  it.each(scenarios)("%s : la carte est enregistrée et le dossier repasse en attente", async (_label, seed) => {
    const { db, supabase } = fakeDb(seed)
    requireRole.mockResolvedValue({ supabase, user: { id: UID }, role: "student" })

    const res = await saveStudentCardUrl(CARD)

    expect(console.error).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true })
    expect(db.student.card_url).toBe(CARD)
    expect(db.student.user_id).toBe(UID)
    expect(db.profile).toMatchObject({ is_verified: false, rejection_reason: null })
    expect(Date.parse(db.profile.verification_submitted_at)).not.toBeNaN()
  })

  it("renouvellement : les autres colonnes de la ligne sont conservées", async () => {
    const { db, supabase } = fakeDb({ studentRow: { school: "UAC", level: "L3", card_url: `${UID}/old.jpg` } })
    requireRole.mockResolvedValue({ supabase, user: { id: UID }, role: "student" })
    expect(await saveStudentCardUrl(CARD)).toEqual({ success: true })
    expect(db.student).toMatchObject({ school: "UAC", level: "L3", card_url: CARD })
  })

  it("aucune écriture de student_profiles ne lit card_url (ni upsert sur la carte, ni RETURNING de la carte)", async () => {
    const { db, supabase } = fakeDb({ studentRow: { school: "UAC" } })
    requireRole.mockResolvedValue({ supabase, user: { id: UID }, role: "student" })
    await saveStudentCardUrl(CARD)
    for (const w of db.writes.filter((x) => x.op === "upsert" && !x.opts.ignoreDuplicates)) {
      expect(Object.keys(w.row)).not.toContain("card_url")
    }
  })

  it("échec réel de l'écriture de la carte : erreur neutre vouvoyée et détail journalisé", async () => {
    const { supabase } = fakeDb({ studentRow: { school: "UAC" } })
    const failing = {
      ...supabase,
      from: (t) => {
        const table = supabase.from(t)
        if (t !== "student_profiles") return table
        return { ...table, update: () => ({ eq: async () => ({ error: DENIED, count: null }) }) }
      },
    }
    requireRole.mockResolvedValue({ supabase: failing, user: { id: UID }, role: "student" })
    const res = await saveStudentCardUrl(CARD)
    expect(res).toEqual({ error: "Impossible d'enregistrer votre carte étudiante." })
    expect(console.error).toHaveBeenCalledWith("[saveStudentCardUrl]", DENIED.message)
  })

  it("mise à jour de la carte qui ne touche aucune ligne : échec signalé, jamais un succès silencieux", async () => {
    const { supabase } = fakeDb({ studentRow: { school: "UAC" } })
    const ghost = {
      ...supabase,
      from: (t) => {
        const table = supabase.from(t)
        if (t !== "student_profiles") return table
        return { ...table, update: () => ({ eq: async () => ({ error: null, count: 0 }) }) }
      },
    }
    requireRole.mockResolvedValue({ supabase: ghost, user: { id: UID }, role: "student" })
    expect(await saveStudentCardUrl(CARD)).toEqual({ error: "Impossible d'enregistrer votre carte étudiante." })
  })
})

describe("completeStudentOnboarding : carte déposée pendant l'inscription", () => {
  const payload = {
    fullName: "Sèna Agossou",
    city: "Cotonou",
    phone: "01 97 45 21 08",
    school: "UAC",
    level: "Licence 2",
    skills: ["Livraison"],
    availability: ["Matin"],
    cardUrl: CARD,
  }

  it.each([
    ["aucune ligne student_profiles", null],
    ["ligne déjà présente", { school: "EPAC" }],
  ])("%s : la carte et les études sont enregistrées", async (_label, studentRow) => {
    const { db, supabase } = fakeDb({ studentRow })
    vi.mocked(createClient).mockResolvedValue(supabase)

    const res = await completeStudentOnboarding(payload)

    expect(res).toMatchObject({ ok: true })
    expect(db.student).toMatchObject({ user_id: UID, school: "UAC", level: "Licence 2", card_url: CARD })
    expect(Date.parse(db.profile.verification_submitted_at)).not.toBeNaN()
  })
})
