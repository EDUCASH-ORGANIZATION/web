// QA indépendante RD-STUDENT-01 vague 1 : getStudentDashboard réel (requireRole, getWallet, getMyProfile,
// getMyStudentProfile réels) sur une base en mémoire qui projette les colonnes et plafonne à 1000 lignes.
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
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => fake() }))

import { getStudentDashboard } from "@/lib/actions/student-dashboard.actions"
import { StudentDashboardView } from "@/components/student-space/dashboard/student-dashboard-view"

const ME = "stu-me"
const OTHER = "stu-other"
const CLIENT = "cli-1"
const CLIENT2 = "cli-2"

function seed() {
  ctx.log.length = 0
  ctx.failures = {}
  ctx.user = { id: ME, user_metadata: { role: "admin" } }
  ctx.db = {
    profiles: [
      { user_id: ME, role: "student", full_name: "Sèna Agossou", city: "Cotonou", is_suspended: false, phone: "+22901999999", rating: "4.5", is_verified: true, verified_until: "2027-06-01", rejection_reason: "SECRET-MOTIF", verification_submitted_at: "2026-09-01T10:00:00Z", push_token: "push-token-xyz" },
      { user_id: OTHER, role: "student", full_name: "Autre Etudiant", city: "Cotonou", is_suspended: false, phone: "+22901888888", rating: 2, is_verified: false },
      { user_id: CLIENT, role: "client", full_name: "Rosine Houngbédji", city: "Cotonou", is_suspended: false, phone: "+22901777777" },
      { user_id: CLIENT2, role: "client", full_name: "Koffi Agbo", city: "Cotonou", is_suspended: false },
    ],
    student_profiles: [
      { user_id: ME, school: "UAC", level: "L2", skills: [], availability: null, card_url: "cards/stu-me/CARTE-PRIVEE.jpg" },
      { user_id: OTHER, card_url: "cards/stu-other/AUTRE-CARTE.jpg" },
    ],
    wallets: [
      { user_id: ME, balance: 25000, reserved: 5000 },
      { user_id: OTHER, balance: 999999, reserved: 0 },
    ],
    missions: [
      { id: "m1", title: "Cours de maths", budget: 15000, client_id: CLIENT, selected_student_id: ME, status: "in_progress", updated_at: "2026-10-10", description: "DESCRIPTION-PRIVEE" },
      { id: "mo", title: "MISSION-AUTRE", budget: 77777, client_id: CLIENT2, selected_student_id: OTHER, status: "in_progress", updated_at: "2026-10-10" },
      { id: "d1", title: "Flyer", budget: 8000, client_id: CLIENT, selected_student_id: ME, status: "done", updated_at: "2026-10-01" },
      { id: "do", title: "DONE-AUTRE", budget: 5000, client_id: CLIENT2, selected_student_id: OTHER, status: "done", updated_at: "2026-10-01" },
    ],
    applications: [
      { id: "a1", student_id: ME, status: "pending", created_at: "2026-10-07T10:00:00Z", mission_id: "x1" },
      { id: "a2", student_id: OTHER, status: "pending", created_at: "2026-10-09T10:00:00Z", mission_id: "x1" },
      { id: "a3", student_id: OTHER, status: "pending", created_at: "2026-10-09T11:00:00Z", mission_id: "x2" },
    ],
    reviews: [
      { id: "r1", reviewed_id: ME, reviewer_id: CLIENT, mission_id: "d1" },
      { id: "r2", reviewed_id: OTHER, reviewer_id: CLIENT, mission_id: "do" },
      { id: "r3", reviewed_id: CLIENT2, reviewer_id: OTHER, mission_id: "do" },
    ],
    messages: [
      { id: "g1", receiver_id: ME, sender_id: CLIENT, mission_id: "m1", read: false, created_at: "2026-10-12T10:00:00Z", content: "MESSAGE-PRIVE" },
      { id: "g2", receiver_id: OTHER, sender_id: CLIENT2, mission_id: "mo", read: false, created_at: "2026-10-12T11:00:00Z" },
      { id: "g3", receiver_id: ME, sender_id: CLIENT, mission_id: "m1", read: true, created_at: "2026-10-12T09:00:00Z" },
    ],
    wallet_transactions: [],
  }
}

function ledger(n, { user = ME, type = "release", at = "2026-10-05T10:00:00Z", amount = 1 } = {}) {
  return Array.from({ length: n }, (_, i) => ({ id: `${user}-${type}-${at}-${i}`.padEnd(40, "0"), user_id: user, type, amount, created_at: at }))
}

beforeEach(() => {
  seed()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"))
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.useRealTimers())

describe("refus hors étudiant : aucune donnée lue", () => {
  const tablesRead = () => new Set(ctx.log.map((q) => q.table))
  it.each([
    ["client", (p) => { p.role = "client" }],
    ["admin", (p) => { p.role = "admin" }],
    ["étudiant suspendu", (p) => { p.is_suspended = true }],
    ["rôle inconnu", (p) => { p.role = "root" }],
  ])("%s", async (_n, mut) => {
    mut(ctx.db.profiles[0])
    const res = await getStudentDashboard()
    expect(res.data).toBeUndefined()
    expect(res.error).toMatch(/Impossible de charger/)
    expect(tablesRead()).toEqual(new Set(["profiles"]))
    expect(JSON.stringify(res)).not.toMatch(/Rosine|MISSION|SECRET/)
  })
  it("sans session", async () => {
    ctx.user = null
    expect((await getStudentDashboard()).error).toBeTruthy()
    expect(ctx.log).toHaveLength(0)
  })
  it("profil introuvable malgré user_metadata étudiant", async () => {
    ctx.db.profiles = ctx.db.profiles.filter((p) => p.user_id !== ME)
    ctx.user.user_metadata.role = "student"
    expect((await getStudentDashboard()).error).toBeTruthy()
  })
  it("profil illisible", async () => {
    ctx.failures.profiles = "boom"
    const res = await getStudentDashboard()
    expect(res.error).toBe("Impossible de charger votre tableau de bord.")
    expect(res.error).not.toMatch(/boom/)
  })
})

describe("confidentialité et isolation", () => {
  it("le JSON ne contient aucune colonne privée ni aucune donnée d'un autre compte", async () => {
    const res = await getStudentDashboard()
    expect(res.data).toBeDefined()
    const json = JSON.stringify(res)
    for (const leak of [
      "+22901", "SECRET-MOTIF", "CARTE-PRIVEE", "AUTRE-CARTE", "push-token", "push_token", "card_url", "rejection_reason",
      "verification_submitted_at", "phone", "DESCRIPTION-PRIVEE", "MESSAGE-PRIVE", "MISSION-AUTRE", "DONE-AUTRE",
      "Autre Etudiant", "Koffi", "stu-other", "cli-2", "999999", "77777", "user_metadata",
    ]) expect(json, leak).not.toContain(leak)
    expect(Object.keys(res.data.verification).sort()).toEqual(["action", "canApply", "daysLeft", "key", "label"])
  })

  it("agrège uniquement les lignes de l'étudiant connecté", async () => {
    ctx.db.wallet_transactions = [...ledger(3, { amount: 1000 }), ...ledger(5, { user: OTHER, amount: 50000 })]
    const { data } = await getStudentDashboard()
    expect(data.wallet.available).toBe(20000)
    expect(data.wallet.earnedThisMonth).toBe(3000)
    expect(data.wallet.escrowToCome).toBe(Math.round(15000 * 0.88))
    expect(data.inProgress.map((m) => m.id)).toEqual(["m1"])
    expect(data.pendingApplications.count).toBe(1)
    expect(data.unread).toEqual([{ missionId: "m1", title: "Cours de maths", clientName: "Rosine", count: 1 }])
    expect(data.rating).toEqual({ value: 4.5, reviewsCount: 1 })
    expect(data.toReview.map((m) => m.id)).toEqual(["d1"])
    expect(data.hasActivity).toBe(true)
  })

  it("chaque requête de lecture est filtrée sur l'id de la session (jamais un id venu d'ailleurs)", async () => {
    await getStudentDashboard()
    const scoped = ctx.log.filter((q) => ["missions", "applications", "wallet_transactions", "wallets", "student_profiles"].includes(q.table))
    expect(scoped.length).toBeGreaterThan(5)
    for (const q of scoped) {
      expect(q.filters.some(([k, , v]) => k === "eq" && v === ME), `${q.table} sans filtre sur la session`).toBe(true)
    }
    expect(ctx.log.some((q) => q.columns === "*" && ["profiles", "student_profiles"].includes(q.table))).toBe(false)
  })

  it("mission terminée sans avis de l'étudiant : à noter ; avis d'un autre sur la même mission ne compte pas", async () => {
    ctx.db.reviews = [{ id: "rx", reviewed_id: ME, reviewer_id: OTHER, mission_id: "d1" }]
    const { data } = await getStudentDashboard()
    expect(data.toReview.map((m) => m.id)).toEqual(["d1"])
  })
})

describe("gains du mois : exactitude autour du plafond de 1000 lignes", () => {
  it.each([[0, 0], [1, 1], [999, 999], [1000, 1000], [1001, 1001], [2000, 2000], [2001, 2001], [4999, 4999]])(
    "%i lignes de 1 FCFA -> %i",
    async (n, expected) => {
      ctx.db.wallet_transactions = ledger(n)
      const { data } = await getStudentDashboard()
      expect(data.wallet.earnedThisMonth).toBe(expected)
    },
  )

  it("plafond documenté (5 pages de 1000) : exactement 5000 lignes -> null, par conception (la 6e page n'est pas lue)", async () => {
    // Documenté en tête de student-dashboard.actions.js : au-delà de 5 pages, ou si la 5e est pleine, la valeur est null
    // (la ligne n'est pas affichée) plutôt qu'un total possiblement tronqué. 4999 est la dernière valeur exacte servie.
    ctx.db.wallet_transactions = ledger(5000)
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBeNull()
  })

  it("5001 lignes (au-delà de 5 pages) : valeur nulle, jamais un total tronqué présenté comme exact", async () => {
    ctx.db.wallet_transactions = ledger(5001)
    const { data } = await getStudentDashboard()
    expect(data.wallet.earnedThisMonth).toBeNull()
  })

  it("1001 lignes dont des lignes d'un autre étudiant, d'un autre type et d'un autre mois : seules les bonnes comptent", async () => {
    ctx.db.wallet_transactions = [
      ...ledger(1001),
      ...ledger(1200, { user: OTHER }),
      ...ledger(300, { type: "deposit" }),
      ...ledger(300, { type: "withdrawal" }),
      ...ledger(300, { at: "2026-09-15T10:00:00Z" }),
    ]
    const { data } = await getStudentDashboard()
    expect(data.wallet.earnedThisMonth).toBe(1001)
  })

  it("fuseau du Bénin : 22:59:59Z le 30/09 est en septembre, 23:00:00Z est en octobre", async () => {
    ctx.db.wallet_transactions = [
      { id: "a", user_id: ME, type: "release", amount: 100, created_at: "2026-09-30T22:59:59Z" },
      { id: "b", user_id: ME, type: "release", amount: 10, created_at: "2026-09-30T23:00:00Z" },
    ]
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBe(10)
  })

  it("le 31 octobre 23:30Z, on est déjà le 1er novembre au Bénin : le mois de novembre commence", async () => {
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z"))
    ctx.db.wallet_transactions = [
      { id: "a", user_id: ME, type: "release", amount: 500, created_at: "2026-10-31T22:00:00Z" },
      { id: "b", user_id: ME, type: "release", amount: 7, created_at: "2026-10-31T23:10:00Z" },
    ]
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBe(7)
  })

  it("montants en chaîne décimale et négatifs : valeur absolue, somme exacte", async () => {
    ctx.db.wallet_transactions = [
      { id: "a", user_id: ME, type: "release", amount: "1500.5", created_at: "2026-10-02T00:00:00Z" },
      { id: "b", user_id: ME, type: "release", amount: -200, created_at: "2026-10-03T00:00:00Z" },
      { id: "c", user_id: ME, type: "release", amount: null, created_at: "2026-10-03T00:00:00Z" },
    ]
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBe(1700.5)
  })

  it("montant illisible (NaN) : valeur nulle plutôt qu'un NaN affiché", async () => {
    ctx.db.wallet_transactions = [{ id: "a", user_id: ME, type: "release", amount: "abc", created_at: "2026-10-02T00:00:00Z" }]
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBeNull()
  })

  it("erreur sur la 1re page : ligne omise (null), le reste du tableau de bord reste servi", async () => {
    ctx.failures.wallet_transactions = "down"
    const { data, error } = await getStudentDashboard()
    expect(error).toBeUndefined()
    expect(data.wallet.earnedThisMonth).toBeNull()
    expect(data.wallet.available).toBe(20000)
  })

  it("erreur sur la 2e page : null, jamais un cumul partiel", async () => {
    ctx.db.wallet_transactions = ledger(1500)
    ctx.failures.wallet_transactions = (q) => (q.range?.[0] >= 1000 ? "down" : null)
    expect((await getStudentDashboard()).data.wallet.earnedThisMonth).toBeNull()
  })

  it("la vue n'affiche aucune ligne « gagné ce mois » quand la valeur est nulle, ni NaN ni null", async () => {
    ctx.failures.wallet_transactions = "down"
    const { data } = await getStudentDashboard()
    const html = renderToStaticMarkup(<StudentDashboardView data={data} today="2026-10-14" paymentsEnabled={false} />)
    expect(html).not.toMatch(/NaN|undefined|>null</)
    expect(html).not.toMatch(/ce mois/i)
  })

  it("la vue affiche la ligne quand la valeur est connue, y compris 0", async () => {
    const { data } = await getStudentDashboard()
    expect(data.wallet.earnedThisMonth).toBe(0)
    const html = renderToStaticMarkup(<StudentDashboardView data={data} today="2026-10-14" paymentsEnabled={false} />)
    expect(html).not.toMatch(/NaN|undefined/)
  })
})

describe("erreurs de lecture : erreur neutre, aucun détail de base", () => {
  it.each(["missions", "applications", "reviews", "messages", "wallets"])("table %s en erreur", async (table) => {
    ctx.failures[table] = "relation \"secret_table\" does not exist"
    const res = await getStudentDashboard()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("lecture privée du profil (service role) en erreur : erreur neutre, rien de partiel", async () => {
    ctx.failures.profiles = (q) => (q.columns?.includes("phone") ? "service down" : null)
    const res = await getStudentDashboard()
    expect(res).toEqual({ error: "Impossible de charger votre tableau de bord." })
  })

  it("solde illisible : erreur (jamais 0 FCFA inventé)", async () => {
    ctx.db.wallets = []
    const res = await getStudentDashboard()
    expect(res.error).toBeTruthy()
  })

  it("la vue d'erreur n'a qu'un h1 et pas de donnée", () => {
    const html = renderToStaticMarkup(<StudentDashboardView error="x" today="2026-10-14" paymentsEnabled={false} />)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })
})

describe("plafonds de lecture", () => {
  it("plus de 100 missions en cours : lecture bornée à 100", async () => {
    ctx.db.missions = Array.from({ length: 130 }, (_, i) => ({ id: `p${i}`, title: `T${i}`, budget: 1000, client_id: CLIENT, selected_student_id: ME, status: "in_progress", updated_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}` }))
    const { data } = await getStudentDashboard()
    expect(data.inProgress.length).toBe(100)
  })
  it("budget absent ou texte : escrow 0, pas de NaN", async () => {
    ctx.db.missions[0].budget = "abc"
    const { data } = await getStudentDashboard()
    expect(data.wallet.escrowToCome).toBe(0)
  })
})
