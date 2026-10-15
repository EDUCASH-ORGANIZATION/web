// QA indépendante RD-CLIENT-01, vague 4 : publication de mission (C03).
// createMission, getDuplicatePrefill et requireRole sont RÉELS ; Supabase est simulé en mémoire.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const CLIENT = "00000000-0000-4000-8000-000000000001"
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002"
const M_MINE = "11111111-1111-4111-8111-111111111111"
const M_THEIRS = "11111111-1111-4111-8111-111111111119"

const ctx = { db: {}, log: [], failures: {}, user: null, origin: "https://example.supabase.co", delay: null, rpc: null }
vi.mock("@/lib/supabase/server", async () => {
  const { makeFakeSupabase } = await import("./fixtures/fake-supabase.js")
  return { createClient: async () => makeFakeSupabase(ctx) }
})
vi.mock("@/lib/supabase/service", async () => {
  const { makeFakeSupabase } = await import("./fixtures/fake-supabase.js")
  return { createServiceClient: () => makeFakeSupabase(ctx) }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: (e) => { if (e?.digest) throw e },
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }))
const getWalletMock = vi.fn()
vi.mock("@/lib/actions/wallet.actions", () => ({ getWallet: (...a) => getWalletMock(...a) }))
vi.mock("@/lib/actions/publish-waitlist.actions", () => ({ notifyPublishOpening: vi.fn() }))

const { createMission } = await import("@/lib/actions/mission.actions")
const { getDuplicatePrefill, getPublishPage } = await import("@/lib/actions/client-publish.actions")
const { default: NewMissionPage } = await import("@/app/(client)/client/missions/new/page")
const { PublishWizard, runPublish } = await import("@/components/client-space/publish/publish-wizard")
const { PublishPausedView } = await import("@/components/client-space/publish/publish-paused-view")
const { parsePublishPrefill, resumePublishHref } = await import("@/lib/utils/publish-prefill")
const { initialValues, duplicateValues, validatePublish, parseDuplicateId } = await import("@/lib/client-space/publish-schema")

const future = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
const valid = (over) => ({
  title: "Traduire un flyer", description: "Traduction d'un flyer de deux pages du français vers l'anglais.",
  type: "Traduction", city: "Cotonou", budget: 5000, urgency: "low", deadline: future(), ...over,
})

function seed(role = "client", suspended = false) {
  ctx.user = { id: CLIENT, user_metadata: { role: "client" } }
  ctx.log = []
  ctx.failures = {}
  ctx.delay = null
  ctx.rpc = null
  ctx.db = {
    profiles: [{ user_id: CLIENT, role, full_name: "Rosine Adjovi", city: "Cotonou", is_suspended: suspended }],
    wallets: [{ user_id: CLIENT, balance: 100000, reserved: 0 }],
    missions: [
      { id: M_MINE, client_id: CLIENT, title: "Ma mission", description: "d".repeat(4000), type: "Traduction", city: "Cotonou", budget: 7000, urgency: "medium", deadline: "2030-01-01", status: "done", phone: "+22997000000" },
      { id: M_THEIRS, client_id: OTHER_CLIENT, title: "SECRET d'un autre", description: "confidentiel", type: "Traduction", city: "Cotonou", budget: 9000, urgency: "high", status: "open" },
    ],
    wallet_transactions: [],
  }
}
const created = () => ctx.db.missions.filter((m) => m.id.startsWith("new-"))
const rpcs = () => ctx.log.filter((q) => q.op === "rpc")

beforeEach(() => {
  seed()
  getWalletMock.mockReset().mockResolvedValue({ available: 100000 })
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.unstubAllEnvs()
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe("paiements coupés : aucune publication possible", () => {
  for (const flag of [undefined, "", "false", "TRUE", "True", "1", "yes", "true ", " true", "on"]) {
    it(`createMission refusé quand PAYMENTS_ENABLED = ${JSON.stringify(flag)} : aucune lecture de portefeuille, aucune insertion, aucun RPC`, async () => {
      if (flag !== undefined) vi.stubEnv("PAYMENTS_ENABLED", flag)
      else vi.stubEnv("PAYMENTS_ENABLED", "")
      const out = await createMission(valid())
      expect(out).toEqual({ error: "La publication de missions est en cours d'activation." })
      expect(created()).toEqual([])
      expect(ctx.log.filter((q) => q.table !== "profiles")).toEqual([])
    })
  }
  it("la page rend l'écran « en cours d'activation » et n'appelle ni action de données ni solde", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "")
    const el = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "x", duplicate: M_THEIRS }) })
    expect(el.type).toBe(PublishPausedView)
    expect(getWalletMock).not.toHaveBeenCalled()
    expect(ctx.log).toEqual([])
  })
  it("la page paiements coupés : le lien de reprise ne contient que des paramètres validés (pas de duplicate invalide)", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "")
    const el = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "<script>alert(1)</script>", duplicate: "x,y", ville: "Paris", type: "Hack" }) })
    const href = el.props.resumeHref
    expect(href.startsWith("/client/missions/new")).toBe(true)
    expect(href).not.toMatch(/duplicate|Paris|Hack/)
    expect(href).not.toContain("<")
    expect(resumePublishHref(href)).toBe(href)
  })
  it("même paiements ouverts : le client sans le rôle ne publie pas (étudiant, admin, suspendu, sans session)", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    for (const setup of [() => seed("student"), () => seed("admin"), () => seed("client", true), () => { ctx.user = null }]) {
      setup()
      const out = await createMission(valid())
      expect(out.error).toBeTruthy()
      expect(out.error).not.toBe("wallet_insufficient")
      expect(created()).toEqual([])
      expect(ctx.log.filter((q) => q.table !== "profiles")).toEqual([])
    }
  })
})

describe("createMission appelée directement (paiements ouverts)", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", "true"))
  it("nominal : client = session, statut open, réservation du budget", async () => {
    const out = await createMission(valid({ budget: 5000 }))
    expect(out.id).toMatch(/^new-/)
    const row = created()[0]
    expect(row).toMatchObject({ client_id: CLIENT, status: "open", budget: 5000 })
    expect(rpcs().map((q) => q.table)).toEqual(["rpc:wallet_reserve"])
    expect(rpcs()[0].params).toMatchObject({ p_user_id: CLIENT, p_amount: 5000, p_mission_id: out.id })
  })
  it("client_id, status, id, selected_student_id, commission forgés : ignorés", async () => {
    await createMission({ ...valid(), client_id: OTHER_CLIENT, status: "done", id: M_THEIRS, selected_student_id: OTHER_CLIENT, commission: 0 })
    const row = created()[0]
    expect(row.client_id).toBe(CLIENT)
    expect(row.status).toBe("open")
    expect(row.id).not.toBe(M_THEIRS)
    expect(row).not.toHaveProperty("selected_student_id")
    expect(row).not.toHaveProperty("commission")
  })
  const BAD = {
    "budget décimal": { budget: 5000.5 },
    "budget négatif": { budget: -5000 },
    "budget zéro": { budget: 0 },
    "budget sous le minimum": { budget: 1 },
    "budget texte": { budget: "abc" },
    "budget NaN": { budget: NaN },
    "budget Infinity": { budget: Infinity },
    "budget null": { budget: null },
    "budget absent": { budget: undefined },
    "budget tableau": { budget: [5000, 6000] },
    "type inconnu": { type: "Piratage" },
    "type absent": { type: undefined },
    "ville inconnue": { city: "Paris" },
    "urgence inconnue": { urgency: "extreme" },
    "titre vide": { title: "   " },
    "titre 121 caractères": { title: "t".repeat(121) },
    "titre non texte": { title: { a: 1 } },
    "description vide": { description: "" },
    "description 3001 caractères": { description: "d".repeat(3001) },
    "échéance passée": { deadline: "2020-01-01" },
    "échéance texte libre": { deadline: "demain" },
    "échéance non texte": { deadline: 20301231 },
  }
  for (const [name, over] of Object.entries(BAD)) {
    it(`refus sans insertion ni réservation : ${name}`, async () => {
      const out = await createMission(valid(over))
      expect(out.error).toBeTruthy()
      expect(out).not.toHaveProperty("id")
      expect(created()).toEqual([])
      expect(rpcs()).toEqual([])
    })
  }
  it("entrée absente ou non objet : refus sans exception", async () => {
    for (const bad of [undefined, null, "x", 5, []]) {
      expect((await createMission(bad)).error).toBeTruthy()
    }
    expect(created()).toEqual([])
  })
  it("solde insuffisant : retour wallet_insufficient avec le manque, aucune insertion", async () => {
    ctx.db.wallets[0] = { user_id: CLIENT, balance: 3000, reserved: 1000 }
    const out = await createMission(valid({ budget: 5000 }))
    expect(out).toMatchObject({ error: "wallet_insufficient", available: 2000, required: 5000, shortfall: 3000 })
    expect(created()).toEqual([])
  })
  it("solde illisible ou portefeuille absent : refus, aucune insertion", async () => {
    ctx.failures["wallets.select"] = "boom"
    expect((await createMission(valid())).error).toMatch(/portefeuille/)
    ctx.failures = {}
    ctx.db.wallets = []
    expect((await createMission(valid())).error).toMatch(/portefeuille/)
    expect(created()).toEqual([])
  })
  it("réservation refusée : la mission créée est retirée (aucune mission fantôme)", async () => {
    ctx.rpc = async () => ({ data: { success: false, error: "insufficient_balance" }, error: null })
    const out = await createMission(valid())
    expect(out.error).toMatch(/Impossible de réserver/)
    expect(created()).toEqual([])
  })
  it("réservation refusée ET suppression impossible : annulation atomique, jamais d'« id » renvoyé", async () => {
    ctx.rpc = async (name) => (name === "wallet_reserve" ? { data: { success: false }, error: null } : { data: { success: true }, error: null })
    ctx.failures["missions.delete"] = "fk violation"
    const out = await createMission(valid())
    expect(out).not.toHaveProperty("id")
    expect(rpcs().map((q) => q.table)).toContain("rpc:wallet_cancel_mission")
  })
  it("erreur d'insertion : message générique, sans texte SQL, aucune réservation", async () => {
    ctx.failures["missions.insert"] = { code: "23514", message: "new row violates check constraint missions_budget" }
    const out = await createMission(valid())
    expect(out.error).not.toMatch(/constraint|check|missions_budget/)
    expect(rpcs()).toEqual([])
  })
  it("double envoi concurrent avec un solde pour UNE seule mission : une seule reste publiée et réservée", async () => {
    ctx.db.wallets[0] = { user_id: CLIENT, balance: 6000, reserved: 0 }
    ctx.delay = () => new Promise((r) => setTimeout(r, 1))
    // RPC atomique comme en base : la réservation se fait ou non, sans course.
    ctx.rpc = async (name, p) => {
      if (name !== "wallet_reserve") return { data: { success: true }, error: null }
      const w = ctx.db.wallets[0]
      if (w.balance - w.reserved < p.p_amount) return { data: { success: false, error: "insufficient_balance" }, error: null }
      w.reserved += p.p_amount
      return { data: { success: true }, error: null }
    }
    const [a, b] = await Promise.all([createMission(valid({ budget: 5000 })), createMission(valid({ budget: 5000 }))])
    const wins = [a, b].filter((r) => r.id)
    expect(wins).toHaveLength(1)
    expect(created()).toHaveLength(1)
    expect(ctx.db.wallets[0].reserved).toBe(5000)
  })
  it("double envoi concurrent avec un solde large : deux missions (pas d'idempotence côté serveur, le verrou est dans l'interface)", async () => {
    ctx.delay = () => new Promise((r) => setTimeout(r, 1))
    const [a, b] = await Promise.all([createMission(valid()), createMission(valid())])
    expect([a, b].every((r) => r.id)).toBe(true)
    expect(created()).toHaveLength(2)
  })
  it("budget énorme (entier sûr) : refusé par le solde, jamais publié", async () => {
    const out = await createMission(valid({ budget: Number.MAX_SAFE_INTEGER }))
    expect(out.error).toBe("wallet_insufficient")
    expect(created()).toEqual([])
  })
  it("HTML dans le titre : stocké tel quel (React l'échappe), jamais interprété par l'action", async () => {
    await createMission(valid({ title: "<img src=x onerror=alert(1)>" }))
    expect(created()[0].title).toBe("<img src=x onerror=alert(1)>")
  })
})

describe("runPublish : verrou contre le double envoi", () => {
  const today = "2026-10-13"
  const v = valid({ deadline: "2026-12-01" })
  it("deux appels simultanés : un seul createMission", async () => {
    const lock = { current: false }
    let release
    const create = vi.fn(() => new Promise((r) => { release = r }))
    const first = runPublish({ values: v, today, create, lock })
    const second = await runPublish({ values: v, today, create, lock })
    expect(second).toEqual({ kind: "busy" })
    release({ id: "abc" })
    expect(await first).toEqual({ kind: "success", id: "abc" })
    expect(create).toHaveBeenCalledTimes(1)
  })
  it("après un succès le verrou reste pris (pas de seconde publication avant le changement de page)", async () => {
    const lock = { current: false }
    const create = vi.fn(async () => ({ id: "abc" }))
    await runPublish({ values: v, today, create, lock })
    expect(await runPublish({ values: v, today, create, lock })).toEqual({ kind: "busy" })
    expect(create).toHaveBeenCalledTimes(1)
  })
  it("après un refus ou une exception le verrou est rendu", async () => {
    const lock = { current: false }
    await runPublish({ values: v, today, create: async () => ({ error: "Refus" }), lock })
    expect(lock.current).toBe(false)
    await runPublish({ values: v, today, create: async () => { throw new Error("réseau") }, lock })
    expect(lock.current).toBe(false)
  })
  it("valeurs invalides : createMission n'est pas appelé", async () => {
    const create = vi.fn()
    const out = await runPublish({ values: valid({ budget: 10, deadline: "2020-01-01" }), today, create, lock: { current: false } })
    expect(out.kind).toBe("invalid")
    expect(create).not.toHaveBeenCalled()
  })
  it("shortfall hostile (NaN, négatif, texte) : message d'erreur générique, pas de modale à 0 FCFA", async () => {
    for (const shortfall of [NaN, -5, 0, "abc", undefined, null]) {
      const out = await runPublish({ values: v, today, create: async () => ({ error: "wallet_insufficient", shortfall, available: 0 }), lock: { current: false } })
      expect(out.kind, String(shortfall)).toBe("error")
    }
  })
  it("l'erreur du serveur n'est pas perdue ni remplacée, et un id vide n'est pas un succès", async () => {
    expect((await runPublish({ values: v, today, create: async () => ({ id: "" }), lock: { current: false } })).kind).toBe("error")
    expect((await runPublish({ values: v, today, create: async () => ({ id: 42 }), lock: { current: false } })).kind).toBe("error")
    expect((await runPublish({ values: v, today, create: async () => null, lock: { current: false } })).kind).toBe("error")
  })
})

describe("duplicate", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", "true"))
  it("duplicate d'une de ses missions : valeurs reprises, sans échéance ni champ privé", async () => {
    const dup = await getDuplicatePrefill(M_MINE)
    expect(dup).toMatchObject({ title: "Ma mission", type: "Traduction", city: "Cotonou", budget: 7000, urgency: "medium" })
    expect(dup).not.toHaveProperty("deadline")
    expect(JSON.stringify(dup)).not.toMatch(/97000000|client_id|status/)
    expect(dup.description).toHaveLength(3000)
  })
  it("duplicate d'une mission d'un AUTRE client : null, aucune fuite, filtre client_id dans la requête", async () => {
    expect(await getDuplicatePrefill(M_THEIRS)).toBeNull()
    const q = ctx.log.find((x) => x.table === "missions")
    expect(q.filters).toContainEqual(["eq", "client_id", CLIENT])
    const page = await getPublishPage({ duplicate: M_THEIRS })
    expect(page.data.duplicate).toBeNull()
    expect(JSON.stringify(page)).not.toMatch(/SECRET|confidentiel/)
  })
  it("colonnes lues : celles reprises seulement", async () => {
    await getDuplicatePrefill(M_MINE)
    expect(ctx.log.find((x) => x.table === "missions").columns).toBe("title, description, type, city, budget, urgency, purchases_estimate")
  })
  it("identifiant hostile : null sans aucune requête de données", async () => {
    for (const bad of [`${M_MINE},id.neq.x`, `${M_MINE}.x`, "*", "", null, undefined, 3, {}, `${M_MINE}\n`]) {
      seed()
      const out = await getDuplicatePrefill(bad)
      expect(out, String(bad)).toBeNull()
      expect(ctx.log.filter((q) => q.table === "missions")).toEqual([])
    }
  })
  it("tableau de duplicate : seule la première valeur compte (pas de contournement par doublon de paramètre)", async () => {
    expect(parseDuplicateId([M_THEIRS, M_MINE])).toBe(M_THEIRS)
    expect(await getDuplicatePrefill(parseDuplicateId([M_THEIRS, M_MINE]))).toBeNull()
  })
  it("étudiant, admin, suspendu, sans session : null sans lecture de mission", async () => {
    for (const setup of [() => seed("student"), () => seed("admin"), () => seed("client", true), () => { ctx.user = null }]) {
      setup()
      expect(await getDuplicatePrefill(M_MINE)).toBeNull()
      expect(ctx.log.filter((q) => q.table === "missions")).toEqual([])
    }
  })
  it("lecture en erreur : null, pas d'exception ni de texte SQL", async () => {
    ctx.failures["missions.select"] = "relation missions"
    expect(await getDuplicatePrefill(M_MINE)).toBeNull()
  })
  it("getPublishPage : solde illisible n'empêche pas de rédiger ; rôle refusé donne une erreur neutre", async () => {
    getWalletMock.mockResolvedValue({ error: "x" })
    expect((await getPublishPage({})).data.available).toBeNull()
    seed("student")
    const out = await getPublishPage({})
    expect(out.error).toBeTruthy()
    expect(out.data).toBeUndefined()
  })
  it("duplicateValues : valeurs corrompues en base ignorées (budget fou, type inconnu, ville inconnue)", () => {
    expect(duplicateValues({ title: 5, description: null, type: "X", city: "Y", budget: 1.5, urgency: "z" })).toEqual({})
    expect(duplicateValues({ budget: 10 ** 12 })).toEqual({})
    expect(duplicateValues(null)).toEqual({})
  })
})

describe("préremplissage d'URL hostile", () => {
  it("script, balises, guillemets : conservés comme TEXTE, bornés à 80 caractères, jamais exécutables à l'affichage", () => {
    const p = parsePublishPrefill({ besoin: `"><script>alert(1)</script>${"a".repeat(500)}` })
    expect(Array.from(p.title).length).toBeLessThanOrEqual(80)
    expect(initialValues(p).title).toBe(p.title)
  })
  it("très long (1 Mo) : borné sans lenteur", () => {
    const t0 = Date.now()
    const p = parsePublishPrefill({ besoin: "é".repeat(1_000_000) })
    expect(Array.from(p.title)).toHaveLength(80)
    expect(Date.now() - t0).toBeLessThan(500)
  })
  it("caractères de contrôle, nul, retours à la ligne, marques de direction : supprimés", () => {
    const p = parsePublishPrefill({ besoin: "a\u0000b\u0007c\nd\re‮f​g\u007fh" })
    expect(p.title).toBe("abcdefgh")
  })
  it("ne coupe pas un emoji en deux (point de code)", () => {
    const p = parsePublishPrefill({ besoin: "😀".repeat(100) })
    expect(Array.from(p.title)).toHaveLength(80)
    expect(p.title).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  })
  it("ville et type inconnus ou dans une autre casse : ignorés ; valeurs multiples : la première", () => {
    expect(parsePublishPrefill({ ville: "cotonou", type: "traduction" })).toMatchObject({ city: "", type: "" })
    expect(parsePublishPrefill({ ville: ["Cotonou", "Paris"], besoin: ["un", "deux"] })).toMatchObject({ city: "Cotonou", title: "un" })
    expect(parsePublishPrefill({ ville: { a: 1 }, besoin: 5, type: null })).toEqual({ title: "", city: "", type: "" })
    expect(parsePublishPrefill(null)).toEqual({ title: "", city: "", type: "" })
  })
  it("__proto__, constructor : sans effet", () => {
    const p = parsePublishPrefill(JSON.parse('{"__proto__":{"title":"x"},"besoin":"ok"}'))
    expect(p.title).toBe("ok")
    expect(({}).title).toBeUndefined()
  })
  it("rendu de l'assistant : le script de l'URL est échappé dans le HTML", () => {
    const initial = initialValues(parsePublishPrefill({ besoin: `<script>alert(1)</script><img src=x onerror=alert(1)>` }))
    const html = renderToStaticMarkup(<PublishWizard initial={initial} available={1000} today="2026-10-13" />)
    expect(html).not.toContain("<script>alert")
    expect(html).not.toMatch(/<img[^>]*onerror/)
    expect(html).toContain("&lt;script&gt;")
  })
  it("page avec paiements ouverts : l'URL hostile donne des valeurs initiales bornées et un duplicate ignoré", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true")
    const el = await NewMissionPage({ searchParams: Promise.resolve({ besoin: "x".repeat(5000), duplicate: M_THEIRS, ville: "Lyon" }) })
    expect(el.props.initial.title).toHaveLength(80)
    expect(el.props.initial.city).toBe("")
    expect(el.props.duplicateId).toBe("")
    expect(JSON.stringify(el.props)).not.toMatch(/SECRET|confidentiel/)
  })
  it("lien de reprise : pas de redirection ouverte ni de schéma", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example/client/missions/new", "javascript:alert(1)", "/client/missions/newx", "/client/missions/new/../../x", "/client/missions/new/%2e%2e/x", "/client/missions", "/auth/login", `/client/missions/new\n`, "/client/missions/new\\x"]) {
      const out = resumePublishHref(bad)
      expect(out, bad).toBeNull()
    }
    expect(resumePublishHref("/client/missions/new?besoin=a")).toBe("/client/missions/new?besoin=a")
  })
  it("validatePublish : le texte de l'URL ne contourne pas les bornes (description courte, date passée, budget décimal)", () => {
    const r = validatePublish({ type: "Traduction", title: "ok", description: "court", city: "Cotonou", budget: 5000.5, urgency: "low", deadline: "2020-01-01" }, "2026-10-13")
    expect(r.ok).toBe(false)
    expect(Object.keys(r.errors).sort()).toEqual(["budget", "deadline", "description"])
  })
})
