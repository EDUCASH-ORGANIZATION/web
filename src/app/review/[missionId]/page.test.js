import { describe, it, expect, vi, beforeEach } from "vitest"

// /review/[missionId] est partagé : l'étudiant garde son formulaire tel quel, le client est renvoyé vers
// /client/review/[missionId]. Ces tests prouvent le comportement étudiant (mêmes champs, messages,
// redirections) et la garde de rôle (compte suspendu refusé).

const redirect = vi.fn((url) => {
  throw new Error(`redirect:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("notFound")
})
vi.mock("next/navigation", () => ({ redirect, notFound }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))
vi.mock("@/components/review/review-form", () => ({ ReviewForm: function ReviewForm() { return null } }))

const { requireRole } = await import("@/lib/auth/require-role")
const { revalidatePath } = await import("next/cache")
const { ReviewForm } = await import("@/components/review/review-form")
const { default: ReviewPage, metadata } = await import("./page")

const STUDENT = "student-1"
const CLIENT = "client-1"
const MISSION = "mission-1"

// Faux client Supabase : missions (single) et reviews (maybeSingle, insert).
function makeSupabase({ mission, existingReview = null, insertError = null }) {
  const log = { inserts: [], tables: [] }
  return {
    log,
    client: {
      from(table) {
        log.tables.push(table)
        const builder = {
          select: () => builder,
          eq: () => builder,
          single: async () => ({ data: mission, error: null }),
          maybeSingle: async () => ({ data: existingReview, error: null }),
          insert: async (payload) => {
            log.inserts.push({ table, payload })
            return { error: insertError }
          },
        }
        return builder
      },
    },
  }
}

function as(role, db, id = STUDENT) {
  requireRole.mockResolvedValue({ supabase: db.client, user: { id }, role, profile: {} })
}

function findElements(node, type, out = []) {
  if (node == null || typeof node !== "object") return out
  if (Array.isArray(node)) {
    node.forEach((n) => findElements(n, type, out))
    return out
  }
  if (node.type === type) out.push(node)
  findElements(node.props?.children, type, out)
  return out
}

function texts(node, out = []) {
  if (node == null || typeof node === "boolean") return out
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => texts(n, out))
    return out
  }
  texts(node.props?.children, out)
  return out
}

const doneMission = { title: "Cours de maths", client_id: CLIENT, selected_student_id: STUDENT, status: "done" }
const params = Promise.resolve({ missionId: MISSION })

async function renderPage() {
  return ReviewPage({ params })
}

function formData(entries) {
  const map = new Map(Object.entries(entries))
  return { get: (k) => map.get(k) ?? null }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("garde de rôle de /review", () => {
  it("la page exige requireRole(['client','student']) et redirige vers la connexion quand il refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(renderPage()).rejects.toThrow("redirect:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["client", "student"])
  })

  it("l'action createReview refuse un compte suspendu ou sans rôle avant toute écriture", async () => {
    const db = makeSupabase({ mission: doneMission })
    as("student", db)
    const tree = await renderPage()
    const action = findElements(tree, ReviewForm)[0].props.action

    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    const res = await action(formData({ rating: "5", comment: "Bien" }))
    expect(res).toEqual({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    expect(requireRole).toHaveBeenLastCalledWith(["client", "student"])
    expect(db.log.inserts).toEqual([])
  })

  it("un client est renvoyé vers /client/review/<id> sans lire la mission", async () => {
    const db = makeSupabase({ mission: doneMission })
    as("client", db, CLIENT)
    await expect(renderPage()).rejects.toThrow(`redirect:/client/review/${MISSION}`)
    expect(db.log.tables).toEqual([])
  })

  it("l'identifiant de la redirection est encodé", async () => {
    const db = makeSupabase({ mission: doneMission })
    as("client", db, CLIENT)
    await expect(ReviewPage({ params: Promise.resolve({ missionId: "a/b?c" }) })).rejects.toThrow(
      "redirect:/client/review/a%2Fb%3Fc",
    )
  })
})

describe("comportement étudiant inchangé", () => {
  it("garde le même titre de page", () => {
    expect(metadata).toEqual({ title: "Laisser un avis - EduCash" })
  })

  it("rend le même formulaire avec la mission", async () => {
    as("student", makeSupabase({ mission: doneMission }))
    const tree = await renderPage()
    const text = texts(tree).join(" ")
    expect(text).toContain("Laisser un avis")
    expect(text).toContain("Comment s'est passée la mission ?")
    expect(text).toContain("Cours de maths")
    expect(findElements(tree, ReviewForm)).toHaveLength(1)
  })

  it("404 pour une mission absente, non terminée ou sans lien avec l'étudiant", async () => {
    as("student", makeSupabase({ mission: null }))
    await expect(renderPage()).rejects.toThrow("notFound")
    as("student", makeSupabase({ mission: { ...doneMission, status: "in_progress" } }))
    await expect(renderPage()).rejects.toThrow("notFound")
    as("student", makeSupabase({ mission: { ...doneMission, selected_student_id: "autre", client_id: "autre-2" } }))
    await expect(renderPage()).rejects.toThrow("notFound")
  })

  it("redirige vers /dashboard quand l'étudiant a déjà donné son avis", async () => {
    as("student", makeSupabase({ mission: doneMission, existingReview: { id: "r1" } }))
    await expect(renderPage()).rejects.toThrow("redirect:/dashboard")
  })

  async function actionFor(db) {
    as("student", db)
    const tree = await renderPage()
    return findElements(tree, ReviewForm)[0].props.action
  }

  it("enregistre l'avis de l'étudiant sur le client de la mission puis redirige vers /dashboard", async () => {
    const db = makeSupabase({ mission: doneMission })
    const action = await actionFor(db)
    await expect(action(formData({ rating: "4", comment: "  Très bien  " }))).rejects.toThrow("redirect:/dashboard")
    expect(db.log.inserts).toEqual([
      {
        table: "reviews",
        payload: { mission_id: MISSION, reviewer_id: STUDENT, reviewed_id: CLIENT, rating: 4, comment: "Très bien" },
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith(`/talents/${CLIENT}`)
  })

  it("garde les messages d'origine : note manquante, avis existant, échec d'enregistrement", async () => {
    const db = makeSupabase({ mission: doneMission })
    const action = await actionFor(db)
    expect(await action(formData({ rating: "0" }))).toEqual({ error: "Veuillez sélectionner une note entre 1 et 5 étoiles." })
    expect(await action(formData({ rating: "6" }))).toEqual({ error: "Veuillez sélectionner une note entre 1 et 5 étoiles." })
    expect(db.log.inserts).toEqual([])

    const dup = makeSupabase({ mission: doneMission, existingReview: { id: "r1" } })
    as("student", makeSupabase({ mission: doneMission }))
    const tree = await renderPage()
    const dupAction = findElements(tree, ReviewForm)[0].props.action
    as("student", dup)
    expect(await dupAction(formData({ rating: "5" }))).toEqual({ error: "Vous avez déjà laissé un avis pour cette mission." })

    const failing = makeSupabase({ mission: doneMission, insertError: { message: "boom" } })
    const failAction = await actionFor(failing)
    expect(await failAction(formData({ rating: "5" }))).toEqual({ error: "Impossible d'enregistrer votre avis." })
  })
})
