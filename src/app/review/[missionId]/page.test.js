import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"

// /review/[missionId] est une redirection pure : client -> /client/review/<id>, étudiant -> /student/review/<id>,
// tout autre cas -> connexion. Aucune lecture de mission, aucune écriture : l'avis de chaque rôle passe par
// l'action de son espace (createClientReview, createStudentReview).

const redirect = vi.fn((url) => {
  throw new Error(`redirect:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("notFound")
})
vi.mock("next/navigation", () => ({ redirect, notFound }))
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }))

const { requireRole } = await import("@/lib/auth/require-role")
const { default: ReviewPage } = await import("./page")

const MISSION = "mission-1"
const params = (missionId = MISSION) => Promise.resolve({ missionId })

// Faux client Supabase : toute lecture ou écriture est enregistrée (elle ne doit jamais avoir lieu).
function makeSupabase() {
  const log = { tables: [] }
  return {
    log,
    client: {
      from(table) {
        log.tables.push(table)
        throw new Error("aucune lecture attendue")
      },
    },
  }
}

function as(role, db) {
  requireRole.mockResolvedValue({ supabase: db.client, user: { id: "u1" }, role, profile: {} })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("redirections de /review par rôle", () => {
  it("la page exige requireRole(['client','student']) et redirige vers la connexion quand il refuse", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    await expect(ReviewPage({ params: params() })).rejects.toThrow("redirect:/auth/login")
    expect(requireRole).toHaveBeenCalledWith(["client", "student"])
  })

  it("anonyme, compte suspendu ou administrateur : connexion (requireRole refuse)", async () => {
    requireRole.mockResolvedValue({ error: "Vous n'avez pas les droits pour effectuer cette action." })
    for (const id of [MISSION, "a/b?c"]) {
      await expect(ReviewPage({ params: params(id) })).rejects.toThrow("redirect:/auth/login")
    }
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining("review"))
  })

  it("un client est renvoyé vers /client/review/<id> sans lire la mission", async () => {
    const db = makeSupabase()
    as("client", db)
    await expect(ReviewPage({ params: params() })).rejects.toThrow(`redirect:/client/review/${MISSION}`)
    expect(db.log.tables).toEqual([])
  })

  it("un étudiant est renvoyé vers /student/review/<id> sans lire la mission", async () => {
    const db = makeSupabase()
    as("student", db)
    await expect(ReviewPage({ params: params() })).rejects.toThrow(`redirect:/student/review/${MISSION}`)
    expect(db.log.tables).toEqual([])
  })

  it("l'identifiant de la redirection est encodé pour les deux rôles", async () => {
    as("client", makeSupabase())
    await expect(ReviewPage({ params: params("a/b?c") })).rejects.toThrow("redirect:/client/review/a%2Fb%3Fc")
    as("student", makeSupabase())
    await expect(ReviewPage({ params: params("a/b?c") })).rejects.toThrow("redirect:/student/review/a%2Fb%3Fc")
  })

  it("un identifiant hostile ne devient jamais un chemin externe", async () => {
    as("student", makeSupabase())
    const err = await ReviewPage({ params: params("..//evil.example") }).catch((e) => e)
    const to = err.message.replace("redirect:", "")
    expect(to.startsWith("/student/review/")).toBe(true)
    expect(to.startsWith("//")).toBe(false)
  })
})

describe("/review ne porte plus d'écriture d'avis", () => {
  const source = readFileSync(new URL("./page.js", import.meta.url), "utf8")

  it("plus d'action inline createReview, aucun insert, aucun accès base ni formulaire", () => {
    expect(source).not.toMatch(/createReview|"use server"|\.insert\(|\.from\(|ReviewForm|supabase/)
  })

  it("redirect() n'est jamais dans un try/catch", () => {
    expect(source).not.toMatch(/\btry\b|\bcatch\b/)
  })
})
