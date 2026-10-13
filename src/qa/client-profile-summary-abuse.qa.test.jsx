// QA indépendante RD-CLIENT-01, vague 4 : getClientProfileSummary et updateClientProfile (C17).
// requireRole réel ; clients de session et de service simulés (mêmes tables en mémoire).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ORIGIN = "https://example.supabase.co"
const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER = "00000000-0000-4000-8000-000000000002"
const S1 = "22222222-2222-4222-8222-222222222221"

const ctx = { db: {}, log: [], failures: {}, user: null, origin: ORIGIN, delay: null, rpc: null }
const serviceCalls = vi.fn()
vi.mock("@/lib/supabase/server", async () => {
  const { makeFakeSupabase } = await import("./fixtures/fake-supabase.js")
  return { createClient: async () => makeFakeSupabase(ctx) }
})
vi.mock("@/lib/supabase/service", async () => {
  const { makeFakeSupabase } = await import("./fixtures/fake-supabase.js")
  return { createServiceClient: () => { serviceCalls(); return makeFakeSupabase(ctx) } }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const { getClientProfileSummary, updateClientProfile } = await import("@/lib/actions/profile.actions")

const PRIVATE = { rejection_reason: "SECRET-MOTIF", fcm_token: "SECRET-TOKEN", card_url: "SECRET-CARD", email: "secret@x.bj", balance: 987654, verification_submitted_at: "2026-01-01" }

function seed(role = "client", suspended = false) {
  ctx.user = { id: CLIENT, user_metadata: { role: "client" } }
  ctx.log = []
  ctx.failures = {}
  ctx.delay = null
  ctx.db = {
    profiles: [
      { user_id: CLIENT, role, full_name: "Rosine Adjovi", city: "Cotonou", is_suspended: suspended, avatar_url: null, bio: "Boutique Adjovi", rating: 4.5, created_at: "2026-04-02T10:00:00Z", phone: "+22997452108", ...PRIVATE },
      { user_id: S1, role: "student", full_name: "Awa Kouassi Doe", phone: "+22961000000", ...PRIVATE },
    ],
    missions: [
      { id: "m1", client_id: CLIENT, title: "Mission 1", status: "done" },
      { id: "m2", client_id: CLIENT, title: "Mission 2", status: "open" },
      { id: "m3", client_id: CLIENT, title: "Mission 3", status: "in_progress" },
      { id: "m4", client_id: CLIENT, title: "Mission 4", status: "cancelled" },
      { id: "m9", client_id: OTHER, title: "Autre", status: "done" },
    ],
    reviews: [{ id: "r1", reviewed_id: CLIENT, reviewer_id: S1, mission_id: "m1", rating: 5, comment: "Client sérieux", created_at: "2026-05-01T10:00:00Z" }],
    wallet_transactions: [],
  }
  serviceCalls.mockClear()
}
const releases = (n, amount = 100, user = CLIENT) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${user.slice(-1)}-${i}`, user_id: user, type: "release", amount, created_at: new Date(2026, 0, 1, 0, 0, i).toISOString() }))

beforeEach(() => { seed(); vi.spyOn(console, "error").mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe("getClientProfileSummary : rôle", () => {
  const denials = {
    "sans session": () => { ctx.user = null },
    "étudiant": () => seed("student"),
    "admin": () => seed("admin"),
    "client suspendu": () => seed("client", true),
    "profil absent": () => { ctx.db.profiles = ctx.db.profiles.filter((p) => p.user_id !== CLIENT) },
  }
  for (const [name, setup] of Object.entries(denials)) {
    it(`${name} : refus, ni service role ni lecture de données`, async () => {
      setup()
      const out = await getClientProfileSummary()
      expect(out.error).toBeTruthy()
      expect(out.summary).toBeUndefined()
      expect(serviceCalls).not.toHaveBeenCalled()
      expect(ctx.log.filter((q) => q.table !== "profiles")).toEqual([])
    })
    it(`updateClientProfile ${name} : refus, aucune mise à jour`, async () => {
      setup()
      const out = await updateClientProfile({ fullName: "X", city: "Cotonou" })
      expect(out.error).toBeTruthy()
      expect(ctx.log.some((q) => q.op === "update")).toBe(false)
    })
  }
})

describe("getClientProfileSummary : aucune colonne privée", () => {
  it("aucune requête ne sélectionne *, ni de colonne privée hors téléphone du propriétaire", async () => {
    await getClientProfileSummary()
    const selects = ctx.log.filter((q) => q.op === "select" && q.columns && !/\brole\b/.test(q.columns))
    expect(selects.length).toBeGreaterThan(3)
    for (const q of selects) {
      expect(q.columns, q.table).not.toContain("*")
      expect(q.columns, q.table).not.toMatch(/rejection_reason|fcm_token|notification_token|card_url|email|balance|verification_submitted_at|is_suspended/)
    }
    const profileSelects = selects.filter((q) => q.table === "profiles")
    // seule la lecture du propriétaire (filtrée sur son id) peut contenir le téléphone
    for (const q of profileSelects) {
      if (/phone/.test(q.columns)) expect(q.filters).toContainEqual(["eq", "user_id", CLIENT])
    }
  })
  it("la réponse ne contient aucune valeur privée, même si la base les renvoie toutes", async () => {
    const json = JSON.stringify(await getClientProfileSummary())
    for (const secret of ["SECRET-MOTIF", "SECRET-TOKEN", "SECRET-CARD", "secret@x.bj", "987654", "+22961000000", "Doe"]) {
      expect(json, secret).not.toContain(secret)
    }
  })
  it("le téléphone du propriétaire est présent (son propre numéro), jamais celui d'un auteur d'avis", async () => {
    const { summary } = await getClientProfileSummary()
    expect(summary.identity.phone).toBe("+22997452108")
    expect(summary.reviews[0].authorFirstName).toBe("Awa")
    expect(JSON.stringify(summary.reviews)).not.toMatch(/phone|\+229|Kouassi|reviewer_id|mission_id/)
  })
  it("lecture du profil par le service role filtrée sur la SESSION", async () => {
    await getClientProfileSummary()
    const q = ctx.log.find((x) => x.table === "profiles" && /phone/.test(x.columns ?? ""))
    expect(q.filters).toEqual([["eq", "user_id", CLIENT]])
  })
  it("les décomptes de missions ne comptent que celles du client", async () => {
    const { summary } = await getClientProfileSummary()
    expect(summary.stats).toMatchObject({ published: 4, active: 2, done: 1, cancelled: 1 })
    expect(ctx.log.filter((q) => q.table === "missions" && q.head).every((q) => q.filters.some(([, c, v]) => c === "client_id" && v === CLIENT))).toBe(true)
  })
  it("avis : 10 au plus affichés, le nombre total reste exact", async () => {
    ctx.db.reviews = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}`, reviewed_id: CLIENT, reviewer_id: S1, mission_id: "m1", rating: 4, comment: "ok", created_at: `2026-05-${String(i + 1).padStart(2, "0")}T10:00:00Z` }))
    const { summary } = await getClientProfileSummary()
    expect(summary.reviews).toHaveLength(10)
    expect(summary.stats.reviewsCount).toBe(15)
  })
  it("avis rédigés par le client (reviewer) ou sur d'autres personnes : jamais comptés comme reçus", async () => {
    ctx.db.reviews.push({ id: "mine", reviewed_id: S1, reviewer_id: CLIENT, mission_id: "m1", rating: 1, comment: "écrit par moi", created_at: "2026-05-02T00:00:00Z" })
    const { summary } = await getClientProfileSummary()
    expect(summary.stats.reviewsCount).toBe(1)
    expect(JSON.stringify(summary.reviews)).not.toContain("écrit par moi")
  })
  it("titre de mission d'un avis : seulement celle du client", async () => {
    ctx.db.reviews[0].mission_id = "m9"
    const { summary } = await getClientProfileSummary()
    expect(summary.reviews[0].missionTitle).toBeNull()
  })
  it("note : valeur illisible donne 0, texte numérique converti", async () => {
    for (const [raw, want] of [[null, 0], ["abc", 0], ["3.5", 3.5], [undefined, 0]]) {
      ctx.db.profiles[0].rating = raw
      expect((await getClientProfileSummary()).summary.stats.rating).toBe(want)
    }
  })
  it("profil introuvable ou erreur de lecture : erreur neutre sans texte SQL", async () => {
    ctx.failures["profiles.select"] = { message: 'relation "profiles" boom' }
    // requireRole lit aussi profiles : l'échec ferme l'accès avant, message neutre dans tous les cas
    const out = await getClientProfileSummary()
    expect(out.error).toBeTruthy()
    expect(out.error).not.toMatch(/relation|boom/)
  })
})

describe("getClientProfileSummary : total dépensé", () => {
  const spent = async () => (await getClientProfileSummary()).summary.stats.totalSpent
  it("aucune libération : 0 (vrai zéro, pas indisponible)", async () => {
    expect(await spent()).toBe(0)
  })
  it("plus de 1000 lignes : somme exacte (2500 x 100 = 250000)", async () => {
    ctx.db.wallet_transactions = releases(2500)
    expect(await spent()).toBe(250000)
    const pages = ctx.log.filter((q) => q.table === "wallet_transactions")
    expect(pages.map((q) => q.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it("exactement 1000 lignes : une seconde page vide est lue, total exact", async () => {
    ctx.db.wallet_transactions = releases(1000, 3)
    expect(await spent()).toBe(3000)
  })
  it("exactement 999, 1001, 2000 lignes", async () => {
    for (const n of [999, 1001, 2000]) {
      ctx.db.wallet_transactions = releases(n, 7)
      expect(await spent(), String(n)).toBe(7 * n)
    }
  })
  it("seules les libérations du client comptent (réservations, remboursements, dépôts, libérations d'autrui exclus)", async () => {
    ctx.db.wallet_transactions = [
      ...releases(3, 1000),
      { id: "a", user_id: CLIENT, type: "reserve", amount: 99999, created_at: "2026-01-01" },
      { id: "b", user_id: CLIENT, type: "refund", amount: 99999, created_at: "2026-01-01" },
      { id: "c", user_id: CLIENT, type: "deposit", amount: 99999, created_at: "2026-01-01" },
      ...releases(5, 5000, OTHER),
    ]
    expect(await spent()).toBe(3000)
  })
  it("erreur de lecture sur la première page : Indisponible (null), jamais 0", async () => {
    ctx.db.wallet_transactions = releases(10)
    ctx.failures["wallet_transactions.select"] = "boom"
    expect(await spent()).toBeNull()
  })
  it("erreur sur la deuxième page : null, jamais un total partiel", async () => {
    ctx.db.wallet_transactions = releases(2500)
    let calls = 0
    const original = ctx.failures
    Object.defineProperty(ctx.failures, "wallet_transactions.select", { get: () => (++calls >= 2 ? "boom page 2" : undefined), configurable: true })
    expect(await spent()).toBeNull()
    ctx.failures = original
  })
  it("montant illisible (texte, NaN) : null ; montant absent ou null : compté 0", async () => {
    ctx.db.wallet_transactions = [...releases(2, 500), { id: "x", user_id: CLIENT, type: "release", amount: "abc", created_at: "2026-02-01" }]
    expect(await spent()).toBeNull()
    ctx.db.wallet_transactions = [...releases(2, 500), { id: "y", user_id: CLIENT, type: "release", amount: null, created_at: "2026-02-01" }]
    expect(await spent()).toBe(1000)
  })
  it("plus de 50 000 libérations : null (plafond de pages), jamais un total tronqué", async () => {
    ctx.db.wallet_transactions = releases(50_001, 1)
    expect(await spent()).toBeNull()
  })
  it("l'échec du total n'efface pas les autres chiffres", async () => {
    ctx.failures["wallet_transactions.select"] = "boom"
    const { summary } = await getClientProfileSummary()
    expect(summary.stats.totalSpent).toBeNull()
    expect(summary.stats.published).toBe(4)
    expect(summary.stats.reviewsCount).toBe(1)
  })
  it("l'échec des missions met ces chiffres à null mais pas le total ni les avis", async () => {
    ctx.db.wallet_transactions = releases(2, 50)
    ctx.failures["missions.select"] = "boom"
    const { summary } = await getClientProfileSummary()
    expect(summary.stats).toMatchObject({ published: null, active: null, done: null, cancelled: null, totalSpent: 100, reviewsCount: 1 })
  })
  it("l'erreur SQL n'est pas exposée dans la réponse", async () => {
    ctx.failures["wallet_transactions.select"] = 'permission denied for table wallet_transactions'
    expect(JSON.stringify(await getClientProfileSummary())).not.toMatch(/permission|denied/)
  })
})

describe("updateClientProfile : abus", () => {
  const upd = () => ctx.log.filter((q) => q.op === "update")
  it("champs forgés (role, is_verified, user_id, rating) : jamais écrits", async () => {
    const out = await updateClientProfile({ fullName: "Rosine A.", city: "Cotonou", phone: "01 97 45 21 08", companyName: "Ma boutique", role: "admin", is_verified: true, user_id: OTHER, rating: 5, is_suspended: false })
    expect(out).toEqual({ success: true })
    expect(upd()[0].payload).toEqual({ full_name: "Rosine A.", city: "Cotonou", phone: "+2290197452108", bio: "Ma boutique" })
    expect(upd()[0].filters).toEqual([["eq", "user_id", CLIENT]])
  })
  it("logo d'un autre utilisateur, d'un autre compartiment, externe ou avec traversée : refusé, aucune mise à jour", async () => {
    for (const url of [
      `${ORIGIN}/storage/v1/object/public/avatars/${OTHER}/logo.png`,
      `${ORIGIN}/storage/v1/object/public/message-media/${CLIENT}/logo.png`,
      `https://evil.example/storage/v1/object/public/avatars/${CLIENT}/logo.png`,
      `${ORIGIN}/storage/v1/object/public/avatars/${CLIENT}/../${OTHER}/logo.png`,
      "javascript:alert(1)",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
      const out = await updateClientProfile({ fullName: "X", city: "Cotonou", avatarUrl: url })
      expect(out.error, url).toBe("Ce logo n'est pas valide. Envoyez-le à nouveau.")
    }
    expect(upd()).toEqual([])
    vi.unstubAllEnvs()
  })
  it("logo valide : adresse sans paramètres ; sans logo fourni : l'avatar existant n'est pas touché", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN)
    await updateClientProfile({ fullName: "X", city: "Cotonou", avatarUrl: `${ORIGIN}/storage/v1/object/public/avatars/${CLIENT}/logo.png?t=1` })
    expect(upd()[0].payload.avatar_url).toBe(`${ORIGIN}/storage/v1/object/public/avatars/${CLIENT}/logo.png`)
    seed()
    await updateClientProfile({ fullName: "X", city: "Cotonou" })
    expect(upd()[0].payload).not.toHaveProperty("avatar_url")
    vi.unstubAllEnvs()
  })
  it("ville hors liste, nom vide, trop long, caractères spéciaux : refusés en vouvoiement", async () => {
    const cases = [
      [{ fullName: "X", city: "Paris" }, /Choisissez une ville/],
      [{ fullName: "   ", city: "Cotonou" }, /nom complet est requis/],
      [{ fullName: "X".repeat(101), city: "Cotonou" }, /ne doivent pas dépasser/],
      [{ fullName: "A\u0000B", city: "Cotonou" }, /caractère spécial/],
      [{ fullName: "A‮B", city: "Cotonou" }, /caractère spécial/],
      [{ fullName: "X", city: "Cotonou", companyName: "S".repeat(101) }, /ne doivent pas dépasser/],
    ]
    for (const [input, re] of cases) expect((await updateClientProfile(input)).error).toMatch(re)
    expect(upd()).toEqual([])
  })
  it.each(["12345", "0897452108", "+33612345678", "abcdefghij", "01 97 45 21 0", "01 97 45 21 088", "<script>"])("téléphone invalide %s : refusé", async (phone) => {
    const out = await updateClientProfile({ fullName: "X", city: "Cotonou", phone })
    expect(out.error).toBe("Le numéro doit avoir 10 chiffres et commencer par 01. Ex. 01 97 45 21 08")
    expect(upd()).toEqual([])
  })
  it("entrées absentes ou de mauvais type : message générique sans exception", async () => {
    for (const bad of [undefined, null, "x", 5]) {
      const out = await updateClientProfile(bad)
      expect(out.error).toBeTruthy()
      expect(out.error).not.toMatch(/Cannot|undefined|TypeError/)
    }
    for (const fullName of [5, {}, ["a"]]) {
      expect((await updateClientProfile({ fullName, city: "Cotonou" })).error).toBeTruthy()
    }
    expect(upd()).toEqual([])
  })
  it("échec d'écriture : message neutre vouvoyé, sans texte SQL", async () => {
    ctx.failures["profiles.update"] = { message: 'violates row-level security policy for "profiles"' }
    const out = await updateClientProfile({ fullName: "X", city: "Cotonou" })
    expect(out.error).toBe("Impossible d'enregistrer votre profil.")
  })
})
