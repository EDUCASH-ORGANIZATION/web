import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const state = {
  user: null,
  sessionProfile: null,
  profiles: [],
  studentProfiles: [],
  emails: {},
  queries: [],
  signed: [],
  updateError: null,
}
const sendEmail = vi.fn()
const createServiceClient = vi.fn(() => makeService())
const revalidatePath = vi.fn()

function project(row, cols) {
  if (!cols || cols === "*") return { ...row }
  const out = {}
  for (const c of cols.split(",").map((s) => s.trim())) out[c] = row[c]
  return out
}

function likeToRegExp(pattern) {
  let source = ""
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === "\\") source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    else if (ch === "%") source += ".*"
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${source}$`, "i")
}

// Faux client service en mémoire : filtres eq / is / not / in / ilike, order, range, update conditionnel.
function makeService() {
  return {
    from(table) {
      const rows = table === "profiles" ? state.profiles : state.studentProfiles
      const q = { table, op: "select", cols: null, values: null, filters: [], ilike: [], range: null }
      state.queries.push(q)
      const b = {
        select(cols) {
          q.cols = cols
          return b
        },
        update(values) {
          q.op = "update"
          q.values = values
          return b
        },
        eq(c, v) {
          q.filters.push((r) => r[c] === v)
          return b
        },
        is(c, v) {
          q.filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v))
          return b
        },
        not(c, op, v) {
          q.filters.push((r) => !(v === null ? r[c] === null || r[c] === undefined : r[c] === v))
          return b
        },
        in(c, list) {
          q.filters.push((r) => list.includes(r[c]))
          return b
        },
        ilike(c, pattern) {
          q.ilike.push([c, pattern])
          q.filters.push((r) => likeToRegExp(pattern).test(String(r[c] ?? "")))
          return b
        },
        order() {
          return b
        },
        range(from, to) {
          q.range = [from, to]
          return b
        },
        maybeSingle: () => Promise.resolve(run(true)),
        then: (res, rej) => Promise.resolve(run(false)).then(res, rej),
      }
      function run(single) {
        if (q.op === "update") {
          if (state.updateError) return { data: null, error: state.updateError }
          const hit = rows.filter((r) => q.filters.every((f) => f(r)))
          for (const r of hit) Object.assign(r, q.values)
          return { data: hit.map((r) => project(r, q.cols)), error: null }
        }
        let hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.range) hit = hit.slice(q.range[0], q.range[1] + 1)
        const data = hit.map((r) => project(r, q.cols))
        return single ? { data: data[0] ?? null, error: null } : { data, error: null }
      }
      return b
    },
    auth: {
      admin: {
        getUserById: async (id) => ({ data: { user: state.emails[id] ? { email: state.emails[id] } : null }, error: null }),
      },
    },
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path, ttl) => {
          state.signed.push({ bucket, path, ttl })
          return { data: { signedUrl: `https://signed.example/${path}?ttl=${ttl}` }, error: null }
        },
      }),
    },
  }
}

vi.mock("next/cache", () => ({ revalidatePath: (...a) => revalidatePath(...a) }))
vi.mock("@/lib/email/index", () => ({ sendEmail: (...a) => sendEmail(...a) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: (...a) => createServiceClient(...a) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.sessionProfile }) }
      return chain
    },
  }),
}))

const actions = await import("./admin-verifications.actions")
const { approveStudentCard: rawApprove, rejectStudentCard: rawReject, resetStudentRejection, revokeStudentBadge, getVerificationQueue } = actions
// Le jeton est composite (date de dépôt + chemin de la carte) : par défaut l'appel porte le chemin actuellement
// stocké ; un test peut fournir `expectedCardPath` pour simuler une carte remplacée depuis l'affichage.
const currentCardPath = (id) => state.studentProfiles.find((s) => s.user_id === id)?.card_url ?? undefined
const withPath = (id, opts = {}) => ({ expectedCardPath: currentCardPath(id), ...opts })
const approveStudentCard = (id, opts) => rawApprove(id, withPath(id, opts))
const rejectStudentCard = (id, opts) => rawReject(id, withPath(id, opts))


const SUBMITTED = "2026-10-10T09:00:00.123456+00:00"

function addStudent(n, over = {}, card = true, declared = {}) {
  const id = uid(n)
  state.profiles.push({
    user_id: id,
    role: "student",
    full_name: `Etudiant ${n} Nom`,
    avatar_url: null,
    is_verified: false,
    verified_until: null,
    rejection_reason: null,
    verification_submitted_at: SUBMITTED,
    created_at: "2026-10-01T08:00:00+00:00",
    phone: "+22997000000",
    fcm_token: "token-secret",
    ...over,
  })
  state.studentProfiles.push({
    user_id: id,
    school: "UAC",
    level: "L3",
    card_url: card ? `${id}/carte.jpg` : null,
    ...declared,
  })
  state.emails[id] = `etudiant${n}@exemple.bj`
  return id
}

const profileOf = (id) => state.profiles.find((p) => p.user_id === id)
const updates = () => state.queries.filter((q) => q.op === "update")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"))
  state.user = { id: ADMIN_ID, user_metadata: { role: "admin" } }
  state.sessionProfile = { role: "admin", full_name: "Admin", city: "Cotonou", is_suspended: false }
  state.profiles = []
  state.studentProfiles = []
  state.emails = {}
  state.queries = []
  state.signed = []
  state.updateError = null
  sendEmail.mockReset()
  sendEmail.mockResolvedValue({ success: true })
  createServiceClient.mockClear()
  revalidatePath.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const CALLS = {
  approveStudentCard: (id) => approveStudentCard(id, { expectedSubmittedAt: SUBMITTED }),
  rejectStudentCard: (id) =>
    rejectStudentCard(id, { reason: "Photo floue ou illisible", message: "", expectedSubmittedAt: SUBMITTED }),
  resetStudentRejection: (id) => resetStudentRejection(id, { reason: "Nouvelle chance" }),
  revokeStudentBadge: (id) => revokeStudentBadge(id, { reason: "Carte contestée" }),
  getVerificationQueue: () => getVerificationQueue({}),
}

describe("contrôle admin de chaque action", () => {
  it.each(Object.keys(CALLS))("%s : refuse un profil student qui porte un metadata admin, sans lecture ni écriture", async (name) => {
    const id = addStudent(1)
    state.sessionProfile = { role: "student", full_name: "A", city: "Cotonou", is_suspended: false }
    const res = await CALLS[name](id)
    expect(res.error).toMatch(/droits/)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it.each(Object.keys(CALLS))("%s : refuse sans profil, un client et un administrateur suspendu", async (name) => {
    const id = addStudent(1)
    for (const profile of [null, { role: "client", is_suspended: false }, { role: "admin", is_suspended: true }]) {
      state.sessionProfile = profile
      expect((await CALLS[name](id)).error).toMatch(/droits/)
    }
    state.user = null
    expect((await CALLS[name](id)).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
  })

  it("autorise un profil admin", async () => {
    const id = addStudent(1)
    expect(await resetStudentRejection(id, { reason: "Motif valable" })).toMatchObject({ error: expect.any(String) })
    profileOf(id).rejection_reason = "Photo floue ou illisible"
    expect(await resetStudentRejection(id, { reason: "Motif valable" })).toEqual({ success: true })
    expect(updates().filter((q) => q.table === "profiles")).toHaveLength(2)
  })
})

describe("approveStudentCard", () => {
  it("valide : badge d'un an, e-mail une seule fois après l'écriture, journal, revalidation", async () => {
    const id = addStudent(1)
    const res = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(res).toEqual({ success: true, verifiedUntil: "2027-10-15", emailSent: true })
    expect(profileOf(id)).toMatchObject({ is_verified: true, verified_until: "2027-10-15", rejection_reason: null })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      "verification-approved",
      "etudiant1@exemple.bj",
      expect.objectContaining({ name: "Etudiant", school: "UAC", verifiedUntil: "2027-10-15" }),
    )
    expect(revalidatePath).toHaveBeenCalledWith("/admin/verifications")
    expect(revalidatePath).toHaveBeenCalledWith("/admin/dashboard")
    const line = console.info.mock.calls.find((c) => c[0] === "[admin-audit]")[1]
    expect(JSON.parse(line)).toMatchObject({ adminId: ADMIN_ID, action: "verification.approve", targetId: id })
    expect(line).not.toMatch(/exemple\.bj|phone|\+229/)
  })

  it("calcule la date de fin au Bénin, pas en UTC", async () => {
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z"))
    const id = addStudent(1)
    const res = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(res.verifiedUntil).toBe("2028-01-01")
  })

  it("accepte un dossier sans date de dépôt (jeton absent)", async () => {
    const id = addStudent(1, { verification_submitted_at: null })
    expect(await approveStudentCard(id, {})).toMatchObject({ success: true })
  })

  it.each([
    ["identifiant vide", () => ""],
    ["injection", () => "1 or 1=1"],
    ["UUID tronqué", () => uid(1).slice(0, 20)],
    ["non texte", () => 42],
  ])("refuse sans lecture ni écriture : %s", async (_n, make) => {
    addStudent(1)
    const res = await approveStudentCard(make(), { expectedSubmittedAt: SUBMITTED })
    expect(res.error).toBeTruthy()
    expect(state.queries.filter((q) => q.table === "profiles")).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it.each([
    ["un client", { role: "client" }],
    ["un administrateur", { role: "admin" }],
  ])("refuse de valider %s", async (_n, over) => {
    const id = addStudent(1, over)
    const res = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(res.error).toMatch(/déjà été traité|a changé/)
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("refuse un étudiant sans carte", async () => {
    const id = addStudent(1, {}, false)
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })

  it("refuse un identifiant inconnu", async () => {
    expect((await approveStudentCard(uid(99), {})).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })

  it("refuse un dossier déjà validé (double clic, deux onglets)", async () => {
    const id = addStudent(1)
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).success).toBe(true)
    const second = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(second.error).toMatch(/déjà été traité/)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("refuse un dossier refusé", async () => {
    const id = addStudent(1, { rejection_reason: "Photo floue ou illisible" })
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).error).toMatch(/déjà été traité/)
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("refuse quand la carte a été remplacée après l'affichage (jeton différent), sans écriture ni e-mail", async () => {
    const id = addStudent(1)
    const res = await approveStudentCard(id, { expectedSubmittedAt: "2026-10-09T09:00:00+00:00" })
    expect(res.error).toMatch(/déjà été traité|a changé/)
    expect(profileOf(id).is_verified).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("refuse un jeton illisible ou trop long sans lecture", async () => {
    const id = addStudent(1)
    expect((await approveStudentCard(id, { expectedSubmittedAt: "pas une date" })).error).toBeTruthy()
    expect((await approveStudentCard(id, { expectedSubmittedAt: "x".repeat(10000) })).error).toBeTruthy()
    expect((await approveStudentCard(id, { expectedSubmittedAt: { $ne: null } })).error).toBeTruthy()
    expect(state.queries.filter((q) => q.table === "profiles")).toHaveLength(0)
  })

  it("deux appels concurrents : une seule écriture réussie, un seul e-mail", async () => {
    const id = addStudent(1)
    const [a, b] = await Promise.all([
      approveStudentCard(id, { expectedSubmittedAt: SUBMITTED }),
      approveStudentCard(id, { expectedSubmittedAt: SUBMITTED }),
    ])
    expect([a, b].filter((r) => r.success)).toHaveLength(1)
    expect([a, b].filter((r) => r.error)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("échec d'e-mail : décision conservée, emailSent faux, erreur journalisée sans adresse", async () => {
    const id = addStudent(1)
    sendEmail.mockRejectedValue(new Error("Resend a refusé etudiant1@exemple.bj"))
    const res = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(res).toMatchObject({ success: true, emailSent: false })
    expect(profileOf(id).is_verified).toBe(true)
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/exemple\.bj/)
  })

  it("e-mail refusé par le service ou adresse introuvable : emailSent faux, décision conservée", async () => {
    const a = addStudent(1)
    sendEmail.mockResolvedValue({ error: "boom etudiant1@exemple.bj" })
    expect((await approveStudentCard(a, { expectedSubmittedAt: SUBMITTED })).emailSent).toBe(false)
    const b = addStudent(2)
    delete state.emails[b]
    expect(await approveStudentCard(b, { expectedSubmittedAt: SUBMITTED })).toMatchObject({ success: true, emailSent: false })
    expect(JSON.stringify(console.error.mock.calls)).not.toMatch(/exemple\.bj/)
  })

  it("ne relaie pas le message interne de la base", async () => {
    const id = addStudent(1)
    state.updateError = { message: 'new row violates row-level security policy for table "profiles"' }
    const res = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(res.error).toBeTruthy()
    expect(res.error).not.toMatch(/row-level|profiles/)
    expect(res.success).toBeUndefined()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it("l'écriture est conditionnelle : rôle, motif, état et jeton sont dans la requête", async () => {
    const id = addStudent(1)
    await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    const write = updates()[0]
    expect(write.values).toEqual({ is_verified: true, verified_until: "2027-10-15", rejection_reason: null })
    expect(write.cols).toBe("user_id")
    // Rejoue les filtres sur une ligne qui ne correspond pas : aucun ne doit laisser passer un client ou une autre carte.
    const base = { user_id: id, role: "student", rejection_reason: null, is_verified: false, verification_submitted_at: SUBMITTED }
    expect(write.filters.every((f) => f(base))).toBe(true)
    for (const bad of [
      { role: "client" },
      { rejection_reason: "x" },
      { is_verified: true },
      { verification_submitted_at: "2026-10-11T00:00:00+00:00" },
      { user_id: uid(77) },
    ]) {
      expect(write.filters.every((f) => f({ ...base, ...bad }))).toBe(false)
    }
  })
})

describe("rejectStudentCard", () => {
  it("refuse avec un motif de la liste, e-mail une seule fois avec le motif", async () => {
    const id = addStudent(1)
    const res = await rejectStudentCard(id, {
      reason: "Coins coupés ou recto manquant",
      message: "Merci de photographier la carte entière.",
      expectedSubmittedAt: SUBMITTED,
    })
    expect(res).toEqual({ success: true, emailSent: true })
    expect(profileOf(id)).toMatchObject({
      is_verified: false,
      verified_until: null,
      rejection_reason: "Coins coupés ou recto manquant",
    })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      "verification-rejected",
      "etudiant1@exemple.bj",
      expect.objectContaining({
        rejectionReason: "Coins coupés ou recto manquant",
        customMessage: "Merci de photographier la carte entière.",
      }),
    )
  })

  it("« Autre motif » : le texte libre devient le motif, il est obligatoire", async () => {
    const id = addStudent(1)
    const empty = await rejectStudentCard(id, { reason: "Autre motif", message: "   ", expectedSubmittedAt: SUBMITTED })
    expect(empty.error).toMatch(/Précisez/)
    expect(updates()).toHaveLength(0)
    const res = await rejectStudentCard(id, { reason: "Autre motif", message: "Carte d'un autre campus", expectedSubmittedAt: SUBMITTED })
    expect(res.success).toBe(true)
    expect(profileOf(id).rejection_reason).toBe("Carte d'un autre campus")
    expect(sendEmail.mock.calls[0][2]).toMatchObject({ rejectionReason: "Carte d'un autre campus", customMessage: null })
  })

  it.each([
    ["motif hors liste", { reason: "Parce que", message: "" }],
    ["motif absent", { message: "x" }],
    ["message de 501 caractères", { reason: "Photo floue ou illisible", message: "a".repeat(501) }],
    ["message de 10 000 caractères", { reason: "Photo floue ou illisible", message: "a".repeat(10000) }],
  ])("refuse sans écriture ni e-mail : %s", async (_n, input) => {
    const id = addStudent(1)
    const res = await rejectStudentCard(id, { ...input, expectedSubmittedAt: SUBMITTED })
    expect(res.error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("nettoie les caractères de contrôle d'un message hostile avant écriture et e-mail", async () => {
    const id = addStudent(1)
    const res = await rejectStudentCard(id, {
      reason: "Autre motif",
      message: "Carte\u0000 \u0007illisible\n\n<script>alert(1)</script>",
      expectedSubmittedAt: SUBMITTED,
    })
    expect(res.success).toBe(true)
    expect(profileOf(id).rejection_reason).not.toMatch(/[\u0000-\u001f]/)
    expect(profileOf(id).rejection_reason).toBe("Carte illisible <script>alert(1)</script>")
    expect(sendEmail.mock.calls[0][2].rejectionReason).toBe(profileOf(id).rejection_reason)
  })

  it("refuse un client, un dossier déjà décidé, une carte remplacée et deux appels concurrents", async () => {
    const client = addStudent(1, { role: "client" })
    expect((await CALLS.rejectStudentCard(client)).error).toBeTruthy()
    const done = addStudent(2, { is_verified: true, verified_until: "2027-05-01" })
    expect((await CALLS.rejectStudentCard(done)).error).toBeTruthy()
    const replaced = addStudent(3)
    expect(
      (await rejectStudentCard(replaced, { reason: "Photo floue ou illisible", expectedSubmittedAt: "2026-01-01T00:00:00+00:00" })).error,
    ).toBeTruthy()
    expect(sendEmail).not.toHaveBeenCalled()
    const id = addStudent(4)
    const results = await Promise.all([CALLS.rejectStudentCard(id), CALLS.rejectStudentCard(id)])
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("refuse un identifiant invalide", async () => {
    expect((await rejectStudentCard("", { reason: "Photo floue ou illisible" })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })

  it("échec d'e-mail : refus conservé, emailSent faux", async () => {
    const id = addStudent(1)
    sendEmail.mockRejectedValue(new Error("boom"))
    expect(await CALLS.rejectStudentCard(id)).toEqual({ success: true, emailSent: false })
    expect(profileOf(id).rejection_reason).toBe("Photo floue ou illisible")
  })

  it("ne relaie pas le message interne de la base", async () => {
    const id = addStudent(1)
    state.updateError = { message: "permission denied for table profiles" }
    const res = await CALLS.rejectStudentCard(id)
    expect(res.error).not.toMatch(/permission|profiles/)
  })
})

describe("resetStudentRejection", () => {
  it("efface le motif d'un dossier refusé et journalise le motif de l'administrateur", async () => {
    const id = addStudent(1, { rejection_reason: "Photo floue ou illisible" })
    expect(await resetStudentRejection(id, { reason: "Erreur de notre part" })).toEqual({ success: true })
    expect(profileOf(id).rejection_reason).toBeNull()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(JSON.parse(console.info.mock.calls[0][1])).toMatchObject({ action: "verification.reset", reason: "Erreur de notre part" })
  })

  it("D1 : le dossier passe en Incomplets (carte retirée) et le compteur À examiner n'augmente pas", async () => {
    const id = addStudent(1, { rejection_reason: "Photo floue ou illisible" })
    const before = await getVerificationQueue({ onglet: "a-examiner" })
    expect(before.counts["a-examiner"]).toBe(0)
    expect(await resetStudentRejection(id, { reason: "Erreur de notre part" })).toEqual({ success: true })
    expect(profileOf(id).verification_submitted_at).toBeNull()
    expect(state.studentProfiles.find((s) => s.user_id === id).card_url).toBeNull()
    const after = await getVerificationQueue({ onglet: "a-examiner" })
    expect(after.counts["a-examiner"]).toBe(0)
    expect(after.counts.incomplets).toBe(1)
    expect(after.counts.refuses).toBe(0)
  })

  it("ne touche pas à la carte d'un dossier sans refus (écriture conditionnelle refusée)", async () => {
    const id = addStudent(1)
    expect((await resetStudentRejection(id, { reason: "Motif valable" })).error).toBeTruthy()
    expect(state.studentProfiles.find((s) => s.user_id === id).card_url).toBe(`${id}/carte.jpg`)
  })

  it.each([
    ["dossier sans refus", () => addStudent(1)],
    ["client", () => addStudent(1, { role: "client", rejection_reason: "x" })],
    ["administrateur", () => addStudent(1, { role: "admin", rejection_reason: "x" })],
  ])("refuse : %s", async (_n, make) => {
    const id = make()
    const before = { ...profileOf(id) }
    expect((await resetStudentRejection(id, { reason: "Motif valable" })).error).toBeTruthy()
    expect(profileOf(id)).toEqual(before)
  })

  it.each([
    ["motif absent", undefined],
    ["motif trop court", "ok"],
    ["motif de 501 caractères", "a".repeat(501)],
  ])("exige un motif valide : %s", async (_n, reason) => {
    const id = addStudent(1, { rejection_reason: "x" })
    expect((await resetStudentRejection(id, { reason })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })

  it("refuse un identifiant invalide", async () => {
    expect((await resetStudentRejection("abc", { reason: "Motif valable" })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })
})

describe("revokeStudentBadge", () => {
  it("retire le badge d'un étudiant vérifié, prévient par e-mail avec le motif", async () => {
    const id = addStudent(1, { is_verified: true, verified_until: "2027-05-01" })
    const res = await revokeStudentBadge(id, { reason: "Carte déclarée perdue" })
    expect(res).toEqual({ success: true, emailSent: true })
    expect(profileOf(id)).toMatchObject({ is_verified: false, verified_until: null, rejection_reason: "Carte déclarée perdue" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toBe("verification-rejected")
    expect(sendEmail.mock.calls[0][2]).toMatchObject({ rejectionReason: "Carte déclarée perdue" })
  })

  it.each([
    ["non vérifié", () => addStudent(1)],
    ["client", () => addStudent(1, { role: "client", is_verified: true })],
    ["administrateur", () => addStudent(1, { role: "admin", is_verified: true })],
  ])("refuse : %s", async (_n, make) => {
    const id = make()
    expect((await revokeStudentBadge(id, { reason: "Motif valable" })).error).toBeTruthy()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("deux appels concurrents : un seul e-mail", async () => {
    const id = addStudent(1, { is_verified: true, verified_until: "2027-05-01" })
    const results = await Promise.all([CALLS.revokeStudentBadge(id), CALLS.revokeStudentBadge(id)])
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("exige un motif libre valide et nettoie les caractères de contrôle", async () => {
    const id = addStudent(1, { is_verified: true })
    expect((await revokeStudentBadge(id, {})).error).toBeTruthy()
    expect((await revokeStudentBadge(id, { reason: "a".repeat(10000) })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    await revokeStudentBadge(id, { reason: "Carte\u0000 contestée\n\tpar l'école" })
    expect(profileOf(id).rejection_reason).toBe("Carte contestée par l'école")
  })

  it("refuse un identifiant vide sans écriture", async () => {
    expect((await revokeStudentBadge("", { reason: "Motif valable" })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })
})

describe("getVerificationQueue", () => {
  function seed() {
    addStudent(1, { verification_submitted_at: "2026-10-12T09:00:00+00:00" }) // à examiner, récent
    addStudent(2, { verification_submitted_at: "2026-10-05T09:00:00+00:00" }, true, { school: "ENSGMM" }) // à examiner, ancien
    addStudent(3, {}, false) // incomplet
    addStudent(4, { rejection_reason: "Photo floue ou illisible" }) // refusé
    addStudent(5, { is_verified: true, verified_until: "2027-06-01" }) // vérifié
    addStudent(6, { is_verified: true, verified_until: "2026-09-01" }) // expiré
    state.profiles.push({ user_id: uid(50), role: "client", full_name: "Client", is_verified: false })
  }

  it("compteurs exacts des cinq onglets, plus anciens d'abord, sans donnée privée dans les lignes", async () => {
    seed()
    const res = await getVerificationQueue({})
    expect(res.error).toBeUndefined()
    expect(res.counts).toEqual({ "a-examiner": 2, incomplets: 1, refuses: 1, verifies: 1, expires: 1 })
    expect(res.onglet).toBe("a-examiner")
    expect(res.rows.map((r) => r.userId)).toEqual([uid(2), uid(1)])
    expect(res.oldestAgeDays).toBe(10)
    expect(res.rows[0]).toMatchObject({ name: "Etudiant 2 Nom", school: "ENSGMM", kind: "premiere", overdue48h: true })
    expect(res.total).toBe(2)
    expect(res.schools).toEqual(["ENSGMM", "UAC"])
    expect(res.dossier).toBeNull()
    expect(typeof res.now).toBe("string")
    expect(res.today).toBe("2026-10-15")
    const json = JSON.stringify(res.rows)
    expect(json).not.toMatch(/signed\.example|exemple\.bj|phone|fcm|token-secret|rejection|submittedAt|carte\.jpg|\+229/)
    expect(Object.keys(res.rows[0]).sort()).toEqual(
      ["age", "avatarUrl", "kind", "level", "name", "overdue48h", "school", "tab", "userId"].sort(),
    )
    expect(state.signed).toHaveLength(0)
  })

  it("liste l'onglet demandé et ignore un onglet hors liste", async () => {
    seed()
    expect((await getVerificationQueue({ onglet: "refuses" })).rows.map((r) => r.userId)).toEqual([uid(4)])
    expect((await getVerificationQueue({ onglet: "incomplets" })).rows.map((r) => r.userId)).toEqual([uid(3)])
    expect((await getVerificationQueue({ onglet: "verifies" })).rows.map((r) => r.userId)).toEqual([uid(5)])
    expect((await getVerificationQueue({ onglet: "expires" })).rows.map((r) => r.userId)).toEqual([uid(6)])
    expect((await getVerificationQueue({ onglet: "x'; drop" })).onglet).toBe("a-examiner")
  })

  it("pagine par 25 et renvoie la dernière page pour une page hors limites", async () => {
    for (let n = 1; n <= 30; n++) addStudent(n, { verification_submitted_at: `2026-10-${String(1 + (n % 9)).padStart(2, "0")}T09:00:00+00:00` })
    const first = await getVerificationQueue({})
    expect(first.rows).toHaveLength(25)
    expect(first.pageCount).toBe(2)
    expect(first.total).toBe(30)
    const last = await getVerificationQueue({ page: "1000000000" })
    expect(last.page).toBe(2)
    expect(last.rows).toHaveLength(5)
    expect((await getVerificationQueue({ page: "-1" })).page).toBe(1)
  })

  it("recherche par nom : motif ilike échappé, jamais d'injection", async () => {
    seed()
    state.profiles.find((p) => p.user_id === uid(1)).full_name = "Awa 100%_Kouassi"
    const res = await getVerificationQueue({ q: "100%_" })
    expect(res.rows.map((r) => r.userId)).toEqual([uid(1)])
    const patterns = state.queries.flatMap((q) => q.ilike)
    expect(patterns).toEqual([["full_name", "%100\\%\\_%"]])

    state.queries = []
    const hostile = await getVerificationQueue({ q: "a,full_name.eq.x),or=(role.eq.admin" })
    expect(hostile.rows).toEqual([])
    expect(state.queries.flatMap((q) => q.ilike)[0][1]).toBe("%a\\,full\\_name.eq.x\\)\\,or=\\(role.eq.admin%")

    const long = await getVerificationQueue({ q: "a".repeat(10000) })
    expect(long.q).toHaveLength(80)
  })

  it("filtre par établissement", async () => {
    seed()
    const res = await getVerificationQueue({ ecole: "ENSGMM" })
    expect(res.rows.map((r) => r.userId)).toEqual([uid(2)])
    expect(res.counts["a-examiner"]).toBe(2)
  })

  it("dossier ouvert : une seule URL signée de 300 s, date de dépôt de ce dossier, aucune adresse e-mail", async () => {
    seed()
    const res = await getVerificationQueue({ id: uid(1) })
    expect(state.signed).toEqual([{ bucket: "student-cards", path: `${uid(1)}/carte.jpg`, ttl: 300 }])
    expect(res.dossier).toMatchObject({
      userId: uid(1),
      name: "Etudiant 1 Nom",
      school: "UAC",
      level: "L3",
      tab: "a-examiner",
      submittedAt: "2026-10-12T09:00:00+00:00",
      cardView: { kind: "image", url: expect.stringContaining("ttl=300") },
      actions: ["approve", "reject"],
    })
    expect(res.dossier).not.toHaveProperty("email")
    const listJson = JSON.stringify(res.rows)
    expect(listJson).not.toMatch(/signed\.example|exemple\.bj/)
    expect(JSON.stringify(res)).not.toMatch(/exemple\.bj|phone|fcm|token-secret/)
  })

  it("dossier sans carte, vérifié, refusé : actions selon l'onglet", async () => {
    seed()
    expect((await getVerificationQueue({ id: uid(3) })).dossier).toMatchObject({ cardView: { kind: "none", url: null }, actions: [] })
    expect((await getVerificationQueue({ id: uid(5) })).dossier.actions).toEqual(["revoke"])
    expect((await getVerificationQueue({ id: uid(4) })).dossier.actions).toEqual(["reset"])
  })

  it("carte d'un autre utilisateur ou adresse externe : aucune URL signée", async () => {
    seed()
    state.studentProfiles.find((s) => s.user_id === uid(1)).card_url = `${uid(2)}/carte.jpg`
    expect((await getVerificationQueue({ id: uid(1) })).dossier.cardView).toEqual({ kind: "none", url: null })
    state.studentProfiles.find((s) => s.user_id === uid(1)).card_url = "https://exemple.net/carte.jpg"
    expect((await getVerificationQueue({ id: uid(1) })).dossier.cardView).toEqual({ kind: "none", url: null })
    expect(state.signed).toHaveLength(0)
  })

  it("carte en PDF : kind pdf", async () => {
    seed()
    state.studentProfiles.find((s) => s.user_id === uid(1)).card_url = `${uid(1)}/carte.pdf`
    expect((await getVerificationQueue({ id: uid(1) })).dossier.cardView.kind).toBe("pdf")
  })

  it("identifiant inconnu, d'un client ou invalide : pas de dossier, aucune URL signée", async () => {
    seed()
    expect(await getVerificationQueue({ id: uid(98) })).toMatchObject({ dossier: null, dossierNotFound: true })
    expect(await getVerificationQueue({ id: uid(50) })).toMatchObject({ dossier: null, dossierNotFound: true })
    expect(await getVerificationQueue({ id: "1 or 1=1" })).toMatchObject({ dossier: null, dossierNotFound: false })
    expect(state.signed).toHaveLength(0)
  })

  it("lit uniquement des colonnes listées, jamais select('*')", async () => {
    seed()
    await getVerificationQueue({ id: uid(1), q: "Etudiant", ecole: "UAC" })
    const selects = state.queries.filter((q) => q.op === "select")
    expect(selects.length).toBeGreaterThan(0)
    for (const q of selects) {
      expect(q.cols).toBeTruthy()
      expect(q.cols).not.toContain("*")
    }
    const listColumns = state.queries
      .filter((q) => q.table === "profiles" && q.op === "select")
      .map((q) => q.cols)
      .join(",")
    expect(listColumns).not.toMatch(/phone|fcm_token/)
  })

  it("distingue une erreur de lecture d'une file vide", async () => {
    const original = createServiceClient.getMockImplementation()
    createServiceClient.mockImplementationOnce(() => {
      const service = makeService()
      return {
        ...service,
        from: () => {
          const b = { select: () => b, eq: () => b, not: () => b, order: () => b, range: async () => ({ data: null, error: { message: "boom" } }) }
          return b
        },
      }
    })
    const res = await getVerificationQueue({})
    expect(res.error).toMatch(/n'ont pas pu être chargés/)
    expect(res.rows).toBeUndefined()
    expect(res.error).not.toMatch(/boom/)
    createServiceClient.mockImplementation(original)
    state.profiles = []
    state.studentProfiles = []
    const empty = await getVerificationQueue({})
    expect(empty.error).toBeUndefined()
    expect(empty.rows).toEqual([])
    expect(empty.counts["a-examiner"]).toBe(0)
  })

  it("renouvellement anticipé : l'indice « renouvellement » est renvoyé", async () => {
    addStudent(1, { verified_until: "2027-03-01", is_verified: false })
    const res = await getVerificationQueue({})
    expect(res.rows[0]).toMatchObject({ tab: "a-examiner", kind: "renouvellement" })
  })
})

describe("jeton composite : date de dépôt et chemin de la carte", () => {
  const OLD = (id) => `${id}/carte.jpg`

  it("carte remplacée (même jeton de date, chemin différent) : validation refusée sans écriture ni e-mail", async () => {
    const id = addStudent(1)
    const seen = OLD(id)
    state.studentProfiles[0].card_url = `${id}/card-0b9c7f4e-1111-4222-8333-444455556666.jpg`
    const res = await rawApprove(id, { expectedSubmittedAt: SUBMITTED, expectedCardPath: seen })
    expect(res.error).toMatch(/déjà été traité|a changé/)
    expect(updates()).toHaveLength(0)
    expect(profileOf(id).is_verified).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("carte remplacée : refus aussi pour le rejet, aucune écriture ni e-mail", async () => {
    const id = addStudent(1)
    const seen = OLD(id)
    state.studentProfiles[0].card_url = `${id}/card-aaaa.jpg`
    const res = await rawReject(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED, expectedCardPath: seen })
    expect(res.error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("deux envois successifs : seule la décision portant le dernier chemin passe", async () => {
    const id = addStudent(1)
    const first = `${id}/card-1.jpg`
    const second = `${id}/card-2.jpg`
    state.studentProfiles[0].card_url = first
    state.studentProfiles[0].card_url = second
    expect((await rawApprove(id, { expectedSubmittedAt: SUBMITTED, expectedCardPath: first })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    expect((await rawApprove(id, { expectedSubmittedAt: SUBMITTED, expectedCardPath: second })).success).toBe(true)
  })

  it("chemin attendu absent, vide ou hostile : refus sans lecture d'écriture", async () => {
    const id = addStudent(1)
    for (const p of [undefined, "", null, 42, { a: 1 }, "x".repeat(400), `${uid(99)}/carte.jpg`]) {
      const res = await rawApprove(id, { expectedSubmittedAt: SUBMITTED, expectedCardPath: p })
      expect(res.error, String(p)).toBeTruthy()
    }
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("carte stockée sous forme d'URL du projet : le chemin normalisé est comparé", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    const id = addStudent(1)
    state.studentProfiles[0].card_url = `https://example.supabase.co/storage/v1/object/public/student-cards/${id}/card-9.jpg`
    expect((await rawApprove(id, { expectedSubmittedAt: SUBMITTED, expectedCardPath: `${id}/card-9.jpg` })).success).toBe(true)
    vi.unstubAllEnvs()
  })

  it("étudiant suspendu : validation et rejet refusés, aucune écriture ni e-mail", async () => {
    const id = addStudent(1, { is_suspended: true })
    const a = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(a.error).toMatch(/suspendu/)
    const r = await rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED })
    expect(r.error).toMatch(/suspendu/)
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("le dossier ouvert porte le chemin de la carte et la date de dépôt", async () => {
    const id = addStudent(1)
    const q = await getVerificationQueue({ id })
    expect(q.dossier).toMatchObject({ cardPath: OLD(id), submittedAt: SUBMITTED })
  })

  it("ancien chemin fixe card.png : toujours signé pour le dossier ouvert", async () => {
    const id = addStudent(1)
    state.studentProfiles[0].card_url = `${id}/card.png`
    const q = await getVerificationQueue({ id })
    expect(state.signed).toEqual([{ bucket: "student-cards", path: `${id}/card.png`, ttl: 300 }])
    expect(q.dossier.cardView.kind).toBe("image")
    expect(q.dossier.cardPath).toBe(`${id}/card.png`)
  })
})
