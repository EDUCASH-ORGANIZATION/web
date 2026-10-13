import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { createClientReview, getClientReviewPage } from "./review.actions"

const ME = "11111111-1111-4111-8111-111111111111"
const STUDENT = "22222222-2222-4222-8222-222222222222"
const OTHER_CLIENT = "33333333-3333-4333-8333-333333333333"
const MISSION = "44444444-4444-4444-8444-444444444444"

// Faux client Supabase : consigne les filtres de chaque requête et les insertions.
function makeDb({ missions = [], reviews = [], profiles = [], insertError = null, errors = {} } = {}) {
  const log = { inserts: [], filters: [] }
  const tables = { missions, reviews, profiles }
  function from(table) {
    const filters = []
    const builder = {
      select: () => builder,
      eq: (col, val) => {
        filters.push([col, val])
        log.filters.push([table, col, val])
        return builder
      },
      maybeSingle: async () => {
        if (errors[table]) return { data: null, error: { message: `boom ${table}` } }
        const row = (tables[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v)) ?? null
        return { data: row, error: null }
      },
      insert: async (payload) => {
        log.inserts.push({ table, payload })
        return { error: insertError }
      },
    }
    return builder
  }
  return { client: { from }, log }
}

function asClient(db) {
  requireRole.mockResolvedValue({ supabase: db.client, user: { id: ME }, role: "client", profile: {} })
}

const doneMission = { id: MISSION, client_id: ME, status: "done", selected_student_id: STUDENT, title: "Garde", budget: 10000 }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("createClientReview : garde et propriété", () => {
  it("appelle requireRole(['client']) en premier et refuse sans toucher la base", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await createClientReview({ missionId: MISSION, rating: 5 })
    expect(res).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(requireRole).toHaveBeenCalledWith(["client"])
  })

  it("refuse une mission d'un autre client avec le message neutre d'une mission inexistante", async () => {
    const db = makeDb({ missions: [{ ...doneMission, client_id: OTHER_CLIENT }] })
    asClient(db)
    const other = await createClientReview({ missionId: MISSION, rating: 5 })
    const db2 = makeDb({ missions: [] })
    asClient(db2)
    const missing = await createClientReview({ missionId: MISSION, rating: 5 })
    expect(other).toEqual(missing)
    expect(other.error).toBe("Cette mission est introuvable.")
    expect(db.log.inserts).toEqual([])
    expect(db.log.filters).toContainEqual(["missions", "client_id", ME])
  })

  it.each([
    ["in_progress", "Vous pourrez noter l'étudiant une fois la mission terminée."],
    ["open", "Vous pourrez noter l'étudiant une fois la mission terminée."],
    ["cancelled", "Vous pourrez noter l'étudiant une fois la mission terminée."],
  ])("refuse une mission au statut %s", async (status, message) => {
    const db = makeDb({ missions: [{ ...doneMission, status }] })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating: 4 })).toEqual({ error: message })
    expect(db.log.inserts).toEqual([])
  })

  it("refuse une mission terminée sans étudiant retenu", async () => {
    const db = makeDb({ missions: [{ ...doneMission, selected_student_id: null }] })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating: 4 })).toEqual({
      error: "Aucun étudiant n'est associé à cette mission.",
    })
    expect(db.log.inserts).toEqual([])
  })

  it("refuse un second avis du même auteur sur la même mission", async () => {
    const db = makeDb({ missions: [doneMission], reviews: [{ id: "r1", mission_id: MISSION, reviewer_id: ME }] })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating: 5 })).toEqual({
      error: "Vous avez déjà noté l'étudiant pour cette mission.",
    })
    expect(db.log.inserts).toEqual([])
  })

  it("traite la violation de la contrainte unique (double envoi simultané) comme un avis déjà donné", async () => {
    const db = makeDb({ missions: [doneMission], insertError: { code: "23505", message: "duplicate key" } })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating: 5 })).toEqual({
      error: "Vous avez déjà noté l'étudiant pour cette mission.",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("renvoie un message neutre quand l'insertion échoue, sans détail technique", async () => {
    const db = makeDb({ missions: [doneMission], insertError: { code: "XX000", message: 'relation "secret" broke' } })
    asClient(db)
    const res = await createClientReview({ missionId: MISSION, rating: 5 })
    expect(res.error).toBe("Impossible d'enregistrer votre avis. Réessayez dans un instant.")
    expect(res.error).not.toMatch(/secret/)
  })

  it.each(["missions", "reviews"])("renvoie un message neutre quand la lecture de %s échoue", async (table) => {
    const db = makeDb({ missions: [doneMission], errors: { [table]: true } })
    asClient(db)
    const res = await createClientReview({ missionId: MISSION, rating: 5 })
    expect(res.error).toBe("Impossible d'enregistrer votre avis. Réessayez dans un instant.")
    expect(db.log.inserts).toEqual([])
  })
})

describe("createClientReview : enregistrement", () => {
  it("déduit la personne notée de la mission et ignore tout champ reviewedId du formulaire", async () => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    const res = await createClientReview({
      missionId: MISSION,
      rating: 5,
      comment: "  Très bien  ",
      reviewedId: OTHER_CLIENT,
      reviewerId: OTHER_CLIENT,
      studentId: OTHER_CLIENT,
    })
    expect(res).toEqual({ success: true, review: { rating: 5, comment: "Très bien" } })
    expect(db.log.inserts).toEqual([
      {
        table: "reviews",
        payload: { mission_id: MISSION, reviewer_id: ME, reviewed_id: STUDENT, rating: 5, comment: "Très bien" },
      },
    ])
  })

  it("enregistre un commentaire absent ou blanc comme null", async () => {
    for (const comment of [undefined, null, "", "   \n  "]) {
      const db = makeDb({ missions: [doneMission] })
      asClient(db)
      await createClientReview({ missionId: MISSION, rating: 3, comment })
      expect(db.log.inserts[0].payload.comment).toBeNull()
    }
  })

  it("accepte un commentaire de 300 caractères avec retours à la ligne", async () => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    const comment = `ligne 1\nligne 2\t${"a".repeat(300 - 16)}`
    expect(comment.length).toBe(300)
    expect((await createClientReview({ missionId: MISSION, rating: 3, comment })).success).toBe(true)
  })

  it("revalide le profil public de l'étudiant et les pages du client", async () => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    await createClientReview({ missionId: MISSION, rating: 4 })
    expect(revalidatePath).toHaveBeenCalledWith(`/talents/${STUDENT}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/client/missions/${MISSION}`)
  })
})

describe("createClientReview : tests d'abus de la note", () => {
  const bad = [
    ["0", 0],
    ["6", 6],
    ["-1", -1],
    ["décimal 4.5", 4.5],
    ["décimal 0.5", 0.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["chaîne numérique", "5"],
    ["chaîne vide", ""],
    ["chaîne texte", "excellent"],
    ["null", null],
    ["undefined", undefined],
    ["booléen", true],
    ["tableau", [5]],
    ["objet", { valueOf: () => 5 }],
    ["bigint", 5n],
  ]
  it.each(bad)("refuse la note : %s", async (_label, rating) => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating })).toEqual({
      error: "Choisissez une note de 1 à 5 étoiles.",
    })
    expect(db.log.inserts).toEqual([])
  })

  it.each([1, 2, 3, 4, 5])("accepte la note entière %s", async (rating) => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    expect((await createClientReview({ missionId: MISSION, rating })).success).toBe(true)
  })
})

describe("createClientReview : tests d'abus du commentaire et de l'identifiant", () => {
  it.each([
    ["trop long", "a".repeat(301), "Votre commentaire ne doit pas dépasser 300 caractères."],
    ["caractère nul", "bon\u0000travail", "Votre commentaire contient des caractères non autorisés."],
    ["code d'échappement", "bon\u001btravail", "Votre commentaire contient des caractères non autorisés."],
    ["inversion de sens du texte", "bon‮travail", "Votre commentaire contient des caractères non autorisés."],
    ["espace de largeur nulle", "bon​travail", "Votre commentaire contient des caractères non autorisés."],
    ["objet", { text: "x" }, "Votre commentaire n'est pas valide."],
    ["nombre", 12, "Votre commentaire n'est pas valide."],
    ["tableau", ["x"], "Votre commentaire n'est pas valide."],
  ])("refuse un commentaire : %s", async (_label, comment, message) => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    expect(await createClientReview({ missionId: MISSION, rating: 5, comment })).toEqual({ error: message })
    expect(db.log.inserts).toEqual([])
  })

  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["injection de filtre", `${MISSION},client_id.neq.x`],
    ["chemin", "../../x"],
    ["nombre", 42],
    ["objet", { id: MISSION }],
    ["tableau", [MISSION]],
  ])("refuse un identifiant de mission : %s", async (_label, missionId) => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    expect(await createClientReview({ missionId, rating: 5 })).toEqual({ error: "Cette mission est introuvable." })
    expect(db.log.filters).toEqual([])
  })

  it.each([undefined, null, "texte", 12, []])("refuse une entrée qui n'est pas un objet : %j", async (input) => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    const res = await createClientReview(input)
    expect(res.error).toBe("Cette mission est introuvable.")
    expect(db.log.inserts).toEqual([])
  })

  it("n'échappe pas le commentaire à l'enregistrement : il est stocké tel quel et échappé à l'affichage", async () => {
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    await createClientReview({ missionId: MISSION, rating: 5, comment: "<b>gras</b> & 'x'" })
    expect(db.log.inserts[0].payload.comment).toBe("<b>gras</b> & 'x'")
  })
})

describe("getClientReviewPage", () => {
  const student = { user_id: STUDENT, full_name: "Afiavi Dossou", avatar_url: null }
  const me = { user_id: ME, full_name: "Rosine Houngbédji" }

  it("refuse sans rôle client et pour un identifiant mal formé, sans lecture", async () => {
    requireRole.mockResolvedValue({ error: "refus" })
    expect(await getClientReviewPage(MISSION)).toBeNull()
    const db = makeDb({ missions: [doneMission] })
    asClient(db)
    expect(await getClientReviewPage("pas-un-uuid")).toBeNull()
    expect(db.log.filters).toEqual([])
  })

  it("renvoie null pour une mission d'un autre client ou inexistante", async () => {
    const db = makeDb({ missions: [{ ...doneMission, client_id: OTHER_CLIENT }] })
    asClient(db)
    expect(await getClientReviewPage(MISSION)).toBeNull()
  })

  it("état formulaire pour une mission terminée non notée", async () => {
    const db = makeDb({ missions: [doneMission], profiles: [student, me] })
    asClient(db)
    const page = await getClientReviewPage(MISSION)
    expect(page.state).toBe("form")
    expect(page.student).toEqual({ id: STUDENT, fullName: "Afiavi Dossou", avatarUrl: null })
    expect(page.mission).toEqual({ id: MISSION, title: "Garde", budget: 10000, status: "done" })
    expect(page.authorName).toBe("Rosine Houngbédji")
    expect(page.review).toBeNull()
  })

  it("état déjà noté avec l'avis donné", async () => {
    const db = makeDb({
      missions: [doneMission],
      profiles: [student, me],
      reviews: [{ mission_id: MISSION, reviewer_id: ME, rating: 4, comment: "Bien", created_at: "2026-10-08T16:05:00Z" }],
    })
    asClient(db)
    const page = await getClientReviewPage(MISSION)
    expect(page.state).toBe("already")
    expect(page.review).toEqual({ rating: 4, comment: "Bien", createdAt: "2026-10-08T16:05:00Z" })
  })

  it.each(["open", "in_progress", "cancelled"])("état mission non terminée (%s)", async (status) => {
    const db = makeDb({ missions: [{ ...doneMission, status }], profiles: [student, me] })
    asClient(db)
    expect((await getClientReviewPage(MISSION)).state).toBe("not_done")
  })

  it("état mission non terminée quand aucun étudiant n'est retenu", async () => {
    const db = makeDb({ missions: [{ ...doneMission, selected_student_id: null }], profiles: [me] })
    asClient(db)
    const page = await getClientReviewPage(MISSION)
    expect(page.state).toBe("not_done")
    expect(page.student).toBeNull()
  })

  it("lève une erreur neutre quand la lecture échoue", async () => {
    const db = makeDb({ missions: [doneMission], errors: { missions: true } })
    asClient(db)
    await expect(getClientReviewPage(MISSION)).rejects.toThrow("Impossible de charger cette page.")
  })
})
