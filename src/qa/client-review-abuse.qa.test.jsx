// QA indépendante RD-CLIENT-01, vague 4 : avis du client (createClientReview, getClientReviewPage, route /review).
// requireRole réel ; Supabase simulé en mémoire (avec contrainte unique reviews(mission_id, reviewer_id)).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isValidElement } from "react"

const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002"
const STUDENT = "22222222-2222-4222-8222-222222222221"
const OTHER_STUDENT = "22222222-2222-4222-8222-222222222222"
const M_DONE = "11111111-1111-4111-8111-111111111111"
const M_OPEN = "11111111-1111-4111-8111-111111111112"
const M_PROG = "11111111-1111-4111-8111-111111111113"
const M_CANC = "11111111-1111-4111-8111-111111111114"
const M_NOSTUD = "11111111-1111-4111-8111-111111111115"
const M_OTHER = "11111111-1111-4111-8111-111111111119"

const ctx = { db: {}, log: [], failures: {}, user: null, origin: "https://example.supabase.co", delay: null, unique: { reviews: ["mission_id", "reviewer_id"] } }
vi.mock("@/lib/supabase/server", async () => {
  const { makeFakeSupabase } = await import("./fixtures/fake-supabase.js")
  return { createClient: async () => makeFakeSupabase(ctx) }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (to) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", to }) },
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" }) },
}))
vi.mock("@/components/review/review-form", () => ({ ReviewForm: () => null }))
vi.mock("@/components/client-space/review/review-view", () => ({ ReviewView: () => null }))

const { createClientReview, getClientReviewPage } = await import("@/lib/actions/review.actions")
const { default: LegacyReviewPage } = await import("@/app/review/[missionId]/page")
const { default: ClientReviewPage } = await import("@/app/(client)/client/review/[missionId]/page")

function seed(role = "client", suspended = false) {
  ctx.user = { id: CLIENT, user_metadata: { role: "client" } }
  ctx.log = []
  ctx.failures = {}
  ctx.delay = null
  ctx.db = {
    profiles: [
      { user_id: CLIENT, role, full_name: "Rosine Adjovi", city: "Cotonou", is_suspended: suspended },
      { user_id: STUDENT, role: "student", full_name: "Awa Kouassi", avatar_url: null },
    ],
    missions: [
      { id: M_DONE, client_id: CLIENT, title: "Traduire", budget: 5000, status: "done", selected_student_id: STUDENT },
      { id: M_OPEN, client_id: CLIENT, title: "Ouverte", budget: 5000, status: "open", selected_student_id: null },
      { id: M_PROG, client_id: CLIENT, title: "En cours", budget: 5000, status: "in_progress", selected_student_id: STUDENT },
      { id: M_CANC, client_id: CLIENT, title: "Annulée", budget: 5000, status: "cancelled", selected_student_id: STUDENT },
      { id: M_NOSTUD, client_id: CLIENT, title: "Sans étudiant", budget: 5000, status: "done", selected_student_id: null },
      { id: M_OTHER, client_id: OTHER_CLIENT, title: "Autre", budget: 5000, status: "done", selected_student_id: OTHER_STUDENT },
    ],
    reviews: [],
  }
}

beforeEach(() => { seed(); vi.spyOn(console, "error").mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

const reviews = () => ctx.db.reviews
const dataQueries = () => ctx.log.filter((q) => q.table !== "profiles")
const rate = (over) => createClientReview({ missionId: M_DONE, rating: 5, comment: "Très bien", ...over })

describe("createClientReview : rôle", () => {
  const denials = {
    "sans session": () => { ctx.user = null },
    "étudiant": () => seed("student"),
    "admin": () => seed("admin"),
    "client suspendu": () => seed("client", true),
    "rôle inconnu": () => seed("root"),
    "profil absent": () => { ctx.db.profiles = ctx.db.profiles.filter((p) => p.user_id !== CLIENT) },
  }
  for (const [name, setup] of Object.entries(denials)) {
    it(`${name} : refus, aucune lecture de données, aucun avis`, async () => {
      setup()
      const out = await rate()
      expect(out.error).toBeTruthy()
      expect(dataQueries()).toEqual([])
      expect(reviews()).toEqual([])
    })
    it(`getClientReviewPage ${name} : null sans lecture de données`, async () => {
      setup()
      expect(await getClientReviewPage(M_DONE)).toBeNull()
      expect(dataQueries()).toEqual([])
    })
  }
})

describe("createClientReview : propriété et état de la mission", () => {
  it("cas nominal : l'avis porte l'étudiant retenu et l'auteur de la session", async () => {
    const out = await rate({ rating: 4, comment: "  Bien  " })
    expect(out).toEqual({ success: true, review: { rating: 4, comment: "Bien" } })
    expect(reviews()).toHaveLength(1)
    expect(reviews()[0]).toMatchObject({ mission_id: M_DONE, reviewer_id: CLIENT, reviewed_id: STUDENT, rating: 4, comment: "Bien" })
  })
  it("mission d'un autre client : message neutre identique à une mission inexistante", async () => {
    const other = await rate({ missionId: M_OTHER })
    const ghost = await rate({ missionId: "99999999-9999-4999-8999-999999999999" })
    expect(other).toEqual(ghost)
    expect(reviews()).toEqual([])
  })
  it.each([["ouverte", M_OPEN], ["en cours", M_PROG], ["annulée", M_CANC]])("mission %s : refusée", async (_n, id) => {
    expect((await rate({ missionId: id })).error).toMatch(/une fois la mission terminée/)
    expect(reviews()).toEqual([])
  })
  it("mission terminée sans étudiant retenu : refusée", async () => {
    expect((await rate({ missionId: M_NOSTUD })).error).toMatch(/Aucun étudiant/)
    expect(reviews()).toEqual([])
  })
  it("reviewedId forgé (toutes graphies), reviewer_id et client_id : ignorés, la personne notée vient de la mission", async () => {
    await rate({ reviewedId: OTHER_STUDENT, reviewed_id: OTHER_STUDENT, reviewer_id: OTHER_CLIENT, reviewerId: OTHER_CLIENT, studentId: OTHER_STUDENT })
    expect(reviews()[0]).toMatchObject({ reviewed_id: STUDENT, reviewer_id: CLIENT })
    expect(Object.keys(reviews()[0]).sort()).toEqual(["comment", "created_at", "id", "mission_id", "rating", "reviewed_id", "reviewer_id"])
  })
  it("identifiant mal formé ou caractères de filtre : refus sans aucune requête", async () => {
    for (const bad of ["", null, undefined, 12, {}, [M_DONE], `${M_DONE},id.neq.x`, `${M_DONE}\n`, "x.y(z)"]) {
      expect((await rate({ missionId: bad })).error).toBe("Cette mission est introuvable.")
    }
    expect(dataQueries()).toEqual([])
  })
  it("entrée absente, null, tableau, chaîne : refus sans exception", async () => {
    for (const bad of [undefined, null, [], "x", 5]) expect((await createClientReview(bad)).error).toBeTruthy()
    expect(reviews()).toEqual([])
  })
  it("avis déjà donné : refus, un seul avis en base", async () => {
    expect((await rate()).success).toBe(true)
    expect((await rate({ rating: 1 })).error).toMatch(/déjà noté/)
    expect(reviews()).toHaveLength(1)
    expect(reviews()[0].rating).toBe(5)
  })
  it("double envoi concurrent : les deux passent le contrôle, la contrainte unique tranche, un seul avis", async () => {
    ctx.delay = () => new Promise((r) => setTimeout(r, 2))
    const [a, b, c] = await Promise.all([rate({ rating: 5 }), rate({ rating: 1 }), rate({ rating: 3 })])
    const wins = [a, b, c].filter((r) => r.success)
    expect(wins).toHaveLength(1)
    expect([a, b, c].filter((r) => r.error)).toEqual([{ error: expect.stringMatching(/déjà noté/) }, { error: expect.stringMatching(/déjà noté/) }])
    expect(reviews()).toHaveLength(1)
  })
  it("échec d'insertion autre que le doublon : message neutre, sans texte SQL", async () => {
    ctx.failures["reviews.insert"] = { code: "42501", message: 'new row violates row-level security policy for table "reviews"' }
    const out = await rate()
    expect(out.error).toMatch(/Impossible d'enregistrer/)
    expect(out.error).not.toMatch(/row-level|policy/)
  })
  it("erreurs de lecture : message neutre", async () => {
    ctx.failures["missions.select"] = "boom missions"
    expect((await rate()).error).not.toMatch(/boom/)
    ctx.failures = { "reviews.select": "boom reviews" }
    const out = await rate()
    expect(out.error).not.toMatch(/boom/)
    expect(reviews()).toEqual([])
  })
})

describe("createClientReview : note et commentaire", () => {
  it.each([0, 6, -1, 3.5, 4.0000001, "5", "abc", NaN, Infinity, -Infinity, null, undefined, true, [5], { v: 5 }, 1e9, 5n])(
    "note invalide %s : refusée sans lecture ni insertion",
    async (rating) => {
      expect((await rate({ rating: typeof rating === "bigint" ? rating : rating })).error).toBe("Choisissez une note de 1 à 5 étoiles.")
      expect(dataQueries()).toEqual([])
      expect(reviews()).toEqual([])
    },
  )
  it.each([1, 2, 3, 4, 5])("note %i acceptée", async (rating) => {
    expect((await rate({ rating })).success).toBe(true)
  })
  it("commentaire : 300 caractères acceptés, 301 refusés", async () => {
    expect((await rate({ comment: "é".repeat(300) })).success).toBe(true)
    seed()
    expect((await rate({ comment: "é".repeat(301) })).error).toMatch(/300 caractères/)
    expect(reviews()).toEqual([])
  })
  it("commentaire vide, espaces ou absent : enregistré à null", async () => {
    for (const c of ["", "   ", undefined, null]) {
      seed()
      const out = await rate({ comment: c })
      expect(out.review.comment).toBeNull()
      expect(reviews()[0].comment).toBeNull()
    }
  })
  it("commentaire non texte : refusé", async () => {
    for (const c of [5, {}, ["a"], true]) expect((await rate({ comment: c })).error).toBe("Votre commentaire n'est pas valide.")
    expect(reviews()).toEqual([])
  })
  it.each([["octet nul", "a\u0000b"], ["cloche", "a\u0007b"], ["échappement", "a\u001bb"], ["C1", "a\u0085b"], ["marque RTL", "a‮b"], ["isolat", "a⁦b"], ["espace de largeur nulle", "a​b"], ["BOM", "a﻿b"]])(
    "caractère interdit (%s) : refusé",
    async (_n, c) => {
      expect((await rate({ comment: c })).error).toMatch(/caractères non autorisés/)
      expect(reviews()).toEqual([])
    },
  )
  it("HTML et lien dans le commentaire : conservés tels quels (échappés à l'affichage), non exécutés", async () => {
    const html = `<script>alert(1)</script> <a href="javascript:x">y</a>`
    await rate({ comment: html })
    expect(reviews()[0].comment).toBe(html)
  })
  it("sauts de ligne et tabulations autorisés", async () => {
    expect((await rate({ comment: "a\nb\tc" })).success).toBe(true)
  })
})

describe("getClientReviewPage", () => {
  it("mission d'un autre client, mal formée ou inexistante : null (404)", async () => {
    for (const id of [M_OTHER, "zz", "", null, `${M_DONE}.x`, "99999999-9999-4999-8999-999999999999"]) {
      expect(await getClientReviewPage(id)).toBeNull()
    }
  })
  it("états : form, not_done (en cours, sans étudiant), already", async () => {
    expect((await getClientReviewPage(M_DONE)).state).toBe("form")
    expect((await getClientReviewPage(M_PROG)).state).toBe("not_done")
    expect((await getClientReviewPage(M_NOSTUD)).state).toBe("not_done")
    await rate()
    const page = await getClientReviewPage(M_DONE)
    expect(page.state).toBe("already")
    expect(page.review).toMatchObject({ rating: 5 })
  })
  it("avis d'un AUTRE client sur la même mission : ne rend pas la page « déjà noté »", async () => {
    ctx.db.reviews.push({ mission_id: M_DONE, reviewer_id: OTHER_CLIENT, reviewed_id: STUDENT, rating: 1, comment: "autre" })
    const page = await getClientReviewPage(M_DONE)
    expect(page.state).toBe("form")
    expect(JSON.stringify(page)).not.toContain("autre")
  })
  it("lecture en échec : lève une erreur neutre (error.js), jamais un texte SQL", async () => {
    ctx.failures["missions.select"] = "relation \"missions\" does not exist"
    await expect(getClientReviewPage(M_DONE)).rejects.toThrow("Impossible de charger cette page.")
  })
  it("colonnes de profil lues : publiques seulement", async () => {
    await getClientReviewPage(M_DONE)
    for (const q of ctx.log.filter((x) => x.table === "profiles" && x.columns && !/\brole\b/.test(x.columns))) {
      expect(q.columns).not.toContain("*")
      expect(q.columns).not.toMatch(/phone|email|card_url|balance/)
    }
  })
  it("page /client/review/<id> : 404 pour une mission d'un autre client", async () => {
    await expect(ClientReviewPage({ params: Promise.resolve({ missionId: M_OTHER }) })).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" })
    const ok = await ClientReviewPage({ params: Promise.resolve({ missionId: M_DONE }) })
    expect(isValidElement(ok)).toBe(true)
  })
  it("page /client/review/<id> : 404 pour un étudiant ou un client suspendu (aucune fuite)", async () => {
    seed("student")
    await expect(ClientReviewPage({ params: Promise.resolve({ missionId: M_DONE }) })).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" })
    seed("client", true)
    await expect(ClientReviewPage({ params: Promise.resolve({ missionId: M_DONE }) })).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" })
  })
})

describe("/review/<id> : redirection selon le rôle", () => {
  const run = (missionId) => LegacyReviewPage({ params: Promise.resolve({ missionId }) }).then((el) => ({ el }), (e) => ({ e }))
  it("client : redirigé vers /client/review/<id> avant toute lecture de mission", async () => {
    const { e } = await run(M_DONE)
    expect(e.digest).toBe("NEXT_REDIRECT")
    expect(e.to).toBe(`/client/review/${M_DONE}`)
    expect(dataQueries()).toEqual([])
  })
  it("client : un identifiant hostile n'est pas réinterprété comme chemin externe", async () => {
    const { e } = await run("..//evil.example")
    expect(e.to.startsWith("/client/review/")).toBe(true)
    expect(e.to.startsWith("//")).toBe(false)
    expect(e.to).not.toMatch(/^https?:/)
  })
  it("sans session : redirigé vers la connexion", async () => {
    ctx.user = null
    expect((await run(M_DONE)).e.to).toBe("/auth/login")
  })
  it("client suspendu : redirigé vers la connexion, jamais vers l'avis", async () => {
    seed("client", true)
    expect((await run(M_DONE)).e.to).toBe("/auth/login")
  })
  it("admin : redirigé vers la connexion (rôle non autorisé)", async () => {
    seed("admin")
    expect((await run(M_DONE)).e.to).toBe("/auth/login")
  })
  it("étudiant retenu : comportement d'origine (formulaire rendu, pas de redirection)", async () => {
    seed("student")
    ctx.db.profiles[0].user_id = STUDENT
    ctx.user = { id: STUDENT }
    const { el, e } = await run(M_DONE)
    expect(e).toBeUndefined()
    expect(isValidElement(el)).toBe(true)
  })
  it("étudiant non impliqué dans la mission : 404", async () => {
    seed("student")
    ctx.db.profiles[0].user_id = OTHER_STUDENT
    ctx.user = { id: OTHER_STUDENT }
    const { e } = await run(M_DONE)
    expect(e.digest).toBe("NEXT_NOT_FOUND")
  })
  it("étudiant, mission non terminée : 404", async () => {
    seed("student")
    ctx.db.profiles[0].user_id = STUDENT
    ctx.user = { id: STUDENT }
    expect((await run(M_PROG)).e.digest).toBe("NEXT_NOT_FOUND")
  })
  it("étudiant ayant déjà noté : renvoyé vers /dashboard", async () => {
    seed("student")
    ctx.db.profiles[0].user_id = STUDENT
    ctx.user = { id: STUDENT }
    ctx.db.reviews.push({ mission_id: M_DONE, reviewer_id: STUDENT })
    expect((await run(M_DONE)).e.to).toBe("/dashboard")
  })
})
