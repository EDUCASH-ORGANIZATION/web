// QA indépendante RD-STUDENT-01 vague 1 : getStudentExplore réel + parseExploreParams réel sur une base en mémoire
// qui évalue ilike, or(is.null, gte), eq, in, gte, lte, tri, plage (9 par page), colonnes projetées.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { makeStudentFake } from "./fixtures/fake-supabase-student"

const ctx = { db: {}, log: [], failures: {}, user: null }
const fake = () => makeStudentFake(ctx)

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: (to) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", to }) },
  unstable_rethrow: (e) => { if (e?.digest === "NEXT_REDIRECT") throw e },
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/student/missions",
  useSearchParams: () => new URLSearchParams(""),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => fake() }))

import { getStudentExplore } from "@/lib/actions/student-explore.actions"
import { parseExploreParams, escapeLike, notExpiredFilter } from "@/lib/student-space/explore-query"
import { StudentExploreView } from "@/components/student-space/explore/explore-view"
import { MISSIONS_PAGE_SIZE } from "@/lib/constants/missions"

const ME = "stu-me"
const TODAY = "2026-10-14"

const mission = (i, over = {}) => ({
  id: `m${i}`,
  title: `Mission ${i}`,
  type: "Cours particuliers",
  city: "Cotonou",
  budget: 10000,
  urgency: "normal",
  deadline: "2026-12-31",
  created_at: `2026-10-${String(1 + (i % 13)).padStart(2, "0")}T10:00:00Z`,
  status: "open",
  client_id: "cli-secret",
  description: "DESCRIPTION-PRIVEE",
  selected_student_id: null,
  client_phone: "+22901000000",
  ...over,
})

function seed(missions) {
  ctx.log.length = 0
  ctx.failures = {}
  ctx.user = { id: ME, user_metadata: { role: "admin" } }
  ctx.db = {
    profiles: [{ user_id: ME, role: "student", full_name: "Sèna", city: "Cotonou", is_suspended: false, phone: "+22901999999", is_verified: true, verified_until: "2027-06-01", rejection_reason: "SECRET-MOTIF" }],
    student_profiles: [{ user_id: ME, card_url: "cards/stu-me/CARTE-PRIVEE.jpg" }],
    missions,
    applications: [{ id: "ap1", student_id: ME, mission_id: "m1", status: "pending" }, { id: "ap2", student_id: "stu-other", mission_id: "m2", status: "accepted" }],
  }
}

beforeEach(() => {
  seed([mission(1), mission(2), mission(3)])
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.useRealTimers())

const ids = (res) => res.missions.map((m) => m.id)
const missionQueries = () => ctx.log.filter((q) => q.table === "missions")

describe("accès", () => {
  it.each([
    ["client", (p) => { p.role = "client" }],
    ["admin", (p) => { p.role = "admin" }],
    ["suspendu", (p) => { p.is_suspended = true }],
  ])("%s refusé sans lire une mission", async (_n, mut) => {
    mut(ctx.db.profiles[0])
    const res = await getStudentExplore({})
    expect(res.error).toBeTruthy()
    expect(res.missions).toBeUndefined()
    expect(missionQueries()).toHaveLength(0)
  })
  it("sans session", async () => {
    ctx.user = null
    expect((await getStudentExplore({})).error).toBeTruthy()
    expect(ctx.log).toHaveLength(0)
  })
})

describe("missions listées : ouvertes, non expirées, colonnes publiques", () => {
  it("ne liste jamais une mission in_progress, done ou cancelled", async () => {
    seed([mission(1), mission(2, { status: "in_progress" }), mission(3, { status: "done" }), mission(4, { status: "cancelled" }), mission(5, { status: "OPEN" }), mission(6, { status: null })])
    const res = await getStudentExplore({})
    expect(ids(res)).toEqual(["m1"])
    expect(res.total).toBe(1)
  })

  it("échéance : passée masquée, aujourd'hui et sans échéance visibles (bornes)", async () => {
    seed([
      mission(1, { deadline: "2026-10-13" }),
      mission(2, { deadline: "2026-10-14" }),
      mission(3, { deadline: null }),
      mission(4, { deadline: "2026-10-15" }),
      mission(5, { deadline: "2020-01-01" }),
    ])
    const res = await getStudentExplore({})
    expect(ids(res).sort()).toEqual(["m2", "m3", "m4"])
    expect(res.total).toBe(3)
  })

  it("fuseau du Bénin : le 13 à 23:30Z est déjà le 14 au Bénin, la mission du 14 reste visible, celle du 13 est masquée", async () => {
    vi.setSystemTime(new Date("2026-10-13T23:30:00Z"))
    seed([mission(1, { deadline: "2026-10-13" }), mission(2, { deadline: "2026-10-14" })])
    expect(ids(await getStudentExplore({}))).toEqual(["m2"])
  })

  it("le filtre « non expirées » est toujours dans la requête, même avec une recherche hostile", async () => {
    await getStudentExplore({ q: "x%,status.eq.done),(deadline.is.null" })
    const q = missionQueries()[0]
    expect(q.ors).toEqual([notExpiredFilter(TODAY)])
    expect(q.filters.some(([k, c, v]) => k === "eq" && c === "status" && v === "open")).toBe(true)
  })

  it("aucune colonne privée n'est renvoyée (client_id, description, selected_student_id, status, téléphone)", async () => {
    const res = await getStudentExplore({})
    const json = JSON.stringify(res)
    for (const leak of ["cli-secret", "client_id", "DESCRIPTION-PRIVEE", "selected_student_id", "+22901", "client_phone", "SECRET-MOTIF", "CARTE-PRIVEE", "card_url", "rejection_reason"]) {
      expect(json, leak).not.toContain(leak)
    }
    expect(Object.keys(res.missions[0]).sort()).toEqual(["applicationStatus", "budget", "city", "deadline", "id", "net", "title", "type", "urgent"])
    expect(missionQueries()[0].columns).toBe("id, title, type, city, budget, urgency, deadline, created_at, purchases_estimate")
    expect(ctx.log.some((q) => q.columns === "*" && q.table !== "wallets")).toBe(false)
  })

  it("la candidature d'un autre étudiant n'apparaît pas ; la mienne oui", async () => {
    const res = await getStudentExplore({})
    expect(res.missions.find((m) => m.id === "m1").applicationStatus).toBe("pending")
    expect(res.missions.find((m) => m.id === "m2").applicationStatus).toBeNull()
  })

  it("gain net = budget moins 12 % arrondi, budget absent = 0, pas de NaN", async () => {
    seed([mission(1, { budget: 15000 }), mission(2, { budget: null }), mission(3, { budget: 3333 })])
    const res = await getStudentExplore({})
    const by = Object.fromEntries(res.missions.map((m) => [m.id, m]))
    expect(by.m1.net).toBe(13200)
    expect(by.m2.net).toBe(0)
    expect(by.m3.net).toBe(Math.round(3333 * 0.88))
  })
})

describe("recherche hostile", () => {
  const hostile = ["%", "_", ",", "(", ")", "*", "\\", "\\\\", "%%%", "50% de réduction", "a_b", "x%,status.eq.done),(deadline.is.null", "'; drop table missions;--", "\u0000", "..", "title.eq.x,or(id.eq.1)", " ".repeat(5)]
  it.each(hostile)("q=%j : requête construite sans injecter dans or(), pas d'erreur", async (q) => {
    const res = await getStudentExplore({ q })
    expect(res.error).toBeUndefined()
    const sent = missionQueries()[0]
    expect(sent.ors).toEqual([notExpiredFilter(TODAY)])
    const pattern = sent.filters.find(([k]) => k === "ilike")?.[2]
    if (q.trim()) {
      // chaque caractère spécial de la saisie est échappé : le motif ne garde que % de début et de fin non échappés
      const inner = pattern.slice(1, -1)
      expect(pattern.startsWith("%") && pattern.endsWith("%")).toBe(true)
      // `*` n'est plus échappé : PostgREST le convertit en `%` même échappé (joker accepté)
      expect(inner.replace(/\\./g, "")).not.toMatch(/[%_,()\\]/)
    } else expect(pattern).toBeUndefined()
  })

  it("« % » ne matche pas tout : seuls les titres contenant un % littéral", async () => {
    seed([mission(1, { title: "Cours" }), mission(2, { title: "Remise 50% garantie" })])
    expect(ids(await getStudentExplore({ q: "%" }))).toEqual(["m2"])
  })
  it("« _ » ne matche pas un caractère quelconque", async () => {
    seed([mission(1, { title: "ab" }), mission(2, { title: "a_b" })])
    expect(ids(await getStudentExplore({ q: "a_b" }))).toEqual(["m2"])
  })
  it("une virgule ou une parenthèse sont cherchées littéralement", async () => {
    seed([mission(1, { title: "Aide (maths), niveau 3e" }), mission(2, { title: "Autre" })])
    expect(ids(await getStudentExplore({ q: "(maths), niveau" }))).toEqual(["m1"])
  })
  it("l'injection de filtre ne révèle ni mission non ouverte ni mission expirée", async () => {
    seed([
      mission(1, { title: "Cours ouvert" }),
      mission(2, { title: "x", status: "done" }),
      mission(3, { title: "x", deadline: "2020-01-01" }),
      mission(4, { title: "x", status: "in_progress" }),
    ])
    const res = await getStudentExplore({ q: "x%,status.eq.done),(deadline.is.null" })
    expect(res.missions).toEqual([])
    expect(ids(await getStudentExplore({ q: "x" }))).toEqual([])
  })
  it("recherche insensible à la casse et aux 100 premiers caractères seulement", async () => {
    const long = "a".repeat(150)
    seed([mission(1, { title: "COURS de MATHS" }), mission(2, { title: long })])
    expect(ids(await getStudentExplore({ q: "cours de maths" }))).toEqual(["m1"])
    const res = await getStudentExplore({ q: long })
    expect(res.filters.q).toHaveLength(100)
  })
  it("q en tableau (?q=a&q=b) : première valeur, jamais d'exception", async () => {
    seed([mission(1, { title: "alpha" })])
    expect(ids(await getStudentExplore({ q: ["alpha", "beta"] }))).toEqual(["m1"])
    expect((await getStudentExplore({ q: [] })).error).toBeUndefined()
    expect((await getStudentExplore({ q: { toString: () => "x" } })).error).toBeUndefined()
  })
  it("contrat (risque PostgREST à vérifier hors CI) : « * » est échappé en \\* ; PostgREST remplace * par % dans les valeurs like", async () => {
    // PostgREST convertit `*` en `%` même échappé : `*` n'est donc plus échappé côté application.
    // `*` non échappé : PostgREST le convertit en `%` même échappé (joker accepté)
    expect(escapeLike("a*b")).toBe("a*b")
  })
})

describe("paramètres hors liste", () => {
  it.each([
    [{ type: "Hack" }, ""],
    [{ type: "__proto__" }, ""],
    [{ type: "constructor" }, ""],
    [{ type: ["Cours particuliers", "x"] }, "Cours particuliers"],
    [{ type: "cours particuliers" }, ""],
  ])("type %j", (params, expected) => {
    expect(parseExploreParams(params).type).toBe(expected)
  })

  it("villes : seules les villes connues sont gardées, doublons retirés, espaces tolérés", () => {
    expect(parseExploreParams({ cities: "Paris,Cotonou,Cotonou, Porto-Novo ,__proto__,'" }).cities).toEqual(["Cotonou", "Porto-Novo"])
    expect(parseExploreParams({ cities: "Paris" }).cities).toEqual([])
    expect(parseExploreParams({ cities: ",,," }).cities).toEqual([])
  })

  it("urgence : urgent ou high acceptés, tout le reste ignoré", () => {
    expect(parseExploreParams({ urgency: "urgent" }).urgencyValue).toBe("high")
    expect(parseExploreParams({ urgency: "high" }).urgencyValue).toBe("high")
    for (const u of ["critical", "URGENT", "1", "true", "__proto__", "normal"]) expect(parseExploreParams({ urgency: u }).urgencyValue, u).toBeNull()
  })

  it("budget : seules les 4 tranches existent", () => {
    for (const b of ["0-5000", "5000-15000", "15000-30000", "30000+"]) expect(parseExploreParams({ budget: b }).budgetRange).not.toBeNull()
    for (const b of ["-1", "0-999999999", "abc", "30000", "1e9", "__proto__", "5000-15000,x"]) expect(parseExploreParams({ budget: b }).budgetRange, b).toBeNull()
  })

  it("tri : valeurs de la liste et anciens alias ; le reste retombe sur « récentes »", () => {
    expect(parseExploreParams({ sort: "prix" }).order).toEqual({ column: "budget", ascending: true })
    expect(parseExploreParams({ sort: "prix-desc" }).order).toEqual({ column: "budget", ascending: false })
    expect(parseExploreParams({ sort: "budget_asc" }).order).toEqual({ column: "budget", ascending: true })
    for (const s of ["created_at", "budget", "id; drop", "__proto__", "constructor", "hasOwnProperty", "toString", "PRIX"]) {
      const p = parseExploreParams({ sort: s })
      expect(p.order, s).toEqual({ column: "created_at", ascending: false })
      expect(p.sort, s).toBe("")
    }
  })

  it.each([
    ["-1", 1], ["0", 1], ["NaN", 1], ["abc", 1], ["", 1], ["1.9", 1], ["2.9", 2], [" 3", 3], ["3abc", 3], ["1e3", 1], ["99999999999999999999", 100000], ["Infinity", 1], ["-0", 1], ["0x10", 1],
  ])("page=%j -> %i", (raw, expected) => {
    expect(parseExploreParams({ page: raw }).page).toBe(expected)
  })

  it("page en tableau ou non texte : retombe sur 1", () => {
    expect(parseExploreParams({ page: ["2", "3"] }).page).toBe(2)
    expect(parseExploreParams({ page: 5 }).page).toBe(1)
    expect(parseExploreParams({ page: null }).page).toBe(1)
    expect(parseExploreParams(null).page).toBe(1)
    expect(parseExploreParams(undefined).q).toBe("")
  })

  it("budget et ville s'appliquent vraiment (bornes inclusives)", async () => {
    seed([
      mission(1, { budget: 5000, city: "Cotonou" }),
      mission(2, { budget: 5001, city: "Porto-Novo" }),
      mission(3, { budget: 15000, city: "Abomey-Calavi" }),
      mission(4, { budget: 30000 }),
      mission(5, { budget: 30001 }),
    ])
    expect(ids(await getStudentExplore({ budget: "0-5000" })).sort()).toEqual(["m1"])
    expect(ids(await getStudentExplore({ budget: "5000-15000" })).sort()).toEqual(["m1", "m2", "m3"])
    expect(ids(await getStudentExplore({ budget: "30000+" })).sort()).toEqual(["m4", "m5"])
    expect(ids(await getStudentExplore({ cities: "Porto-Novo,Abomey-Calavi" })).sort()).toEqual(["m2", "m3"])
    expect(ids(await getStudentExplore({ cities: "Paris" })).sort()).toEqual(["m1", "m2", "m3", "m4", "m5"])
  })

  it("urgence ne garde que urgency=high ; tri par budget", async () => {
    seed([mission(1, { urgency: "high", budget: 9000 }), mission(2, { urgency: "normal", budget: 1000 }), mission(3, { urgency: "high", budget: 3000 })])
    expect(ids(await getStudentExplore({ urgency: "urgent", sort: "prix" }))).toEqual(["m3", "m1"])
    expect(ids(await getStudentExplore({ sort: "prix-desc" }))).toEqual(["m1", "m3", "m2"])
  })
})

describe("pagination bornée", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => mission(i + 1))
  it("9 par page, total exact, dernière page partielle", async () => {
    seed(many(20))
    const p1 = await getStudentExplore({})
    expect(p1.missions).toHaveLength(MISSIONS_PAGE_SIZE)
    expect(p1.total).toBe(20)
    expect(p1.pageSize).toBe(9)
    expect((await getStudentExplore({ page: "3" })).missions).toHaveLength(2)
    expect(missionQueries().at(-1).range).toEqual([18, 26])
  })
  it("pages sans doublon ni trou", async () => {
    seed(many(20))
    const seen = []
    for (const page of ["1", "2", "3"]) seen.push(...ids(await getStudentExplore({ page })))
    expect(new Set(seen).size).toBe(20)
  })
  it("page hors borne (négative, NaN, énorme) : jamais d'erreur, jamais plus de 9 lignes", async () => {
    seed(many(20))
    for (const page of ["-5", "NaN", "0", "999999999999", "4", "100000", "100001"]) {
      const res = await getStudentExplore({ page })
      expect(res.error, page).toBeUndefined()
      expect(res.missions.length, page).toBeLessThanOrEqual(9)
    }
  })
  it("page vide au-delà de la fin : liste vide (PGRST103 géré), pas d'erreur affichée", async () => {
    seed(many(20))
    const res = await getStudentExplore({ page: "50" })
    expect(res.error).toBeUndefined()
    expect(res.missions).toEqual([])
  })
  it("page hors borne : le total reste le vrai (20), l'en-tête l'annonce, le corps dit « Cette page est vide » avec le lien de retour", async () => {
    seed(many(20))
    const res = await getStudentExplore({ page: "50" })
    expect(res.error).toBeUndefined()
    expect(res.missions).toEqual([])
    expect(res.total).toBe(20)
    const html = renderToStaticMarkup(<StudentExploreView result={res} />)
    expect(html).toContain("Cette page est vide")
    expect(html).toContain("Revenir à la première page")
    expect(html).not.toContain("Aucune mission ne correspond")
    expect(html).not.toContain('aria-label="Pagination"')
    expect(html).toMatch(/20\u00a0missions ouvertes/)
    expect(html).not.toMatch(/0\u00a0mission ouverte/)
  })
  it("page hors borne avec filtres : le total compté respecte les mêmes filtres", async () => {
    seed([...many(20), mission(99, { type: "Livraison" })])
    const res = await getStudentExplore({ page: "50", type: "Livraison" })
    expect(res.total).toBe(1)
    expect(res.missions).toEqual([])
  })
  it("erreur de base : message neutre sans détail", async () => {
    ctx.failures.missions = "relation secret"
    expect(await getStudentExplore({})).toEqual({ error: "Impossible de charger les missions." })
  })
  it("lecture des candidatures en erreur : la liste reste servie", async () => {
    ctx.failures.applications = "down"
    const res = await getStudentExplore({})
    expect(res.error).toBeUndefined()
    expect(res.missions.length).toBe(3)
  })
})

describe("vérification de l'étudiant (note de la page)", () => {
  it("lecture du profil privé en échec : liste servie, note masquée", async () => {
    ctx.failures.profiles = (q) => (q.columns?.includes("phone") ? "down" : null)
    const res = await getStudentExplore({})
    expect(res.error).toBeUndefined()
    expect(res.verification).toBeNull()
  })
  it("seul le statut calculé sort (jamais le motif ni la carte)", async () => {
    ctx.db.profiles[0].is_verified = false
    const res = await getStudentExplore({})
    expect(Object.keys(res.verification).sort()).toEqual(["action", "canApply", "key", "label"])
    expect(res.verification.key).toBe("rejected")
    expect(JSON.stringify(res)).not.toMatch(/SECRET-MOTIF|CARTE-PRIVEE/)
  })
})

describe("vue : rendu sans exception sur les entrées hostiles", () => {
  it("q hostile affichée échappée (pas de HTML injecté)", async () => {
    const q = "<script>alert(1)</script>\"'"
    const res = await getStudentExplore({ q })
    const html = renderToStaticMarkup(<StudentExploreView result={res} />)
    expect(html).not.toContain("<script>")
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })
  it("un seul h1 sur liste, vide et erreur", async () => {
    for (const result of [await getStudentExplore({}), await getStudentExplore({ q: "zzzzzz" }), { error: "x" }]) {
      expect(renderToStaticMarkup(<StudentExploreView result={result} />).match(/<h1\b/g)).toHaveLength(1)
    }
  })
  it("titre de mission contenant du HTML : échappé", async () => {
    seed([mission(1, { title: "<img src=x onerror=alert(1)>" })])
    const html = renderToStaticMarkup(<StudentExploreView result={await getStudentExplore({})} />)
    expect(html).not.toContain("<img src=x")
  })
})
