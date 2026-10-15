import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa"
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const state = { user: null, sessionProfile: null, profiles: [], studentProfiles: [], emails: {}, queries: [], signed: [], hooks: {} }
const sendEmail = vi.fn()
const createServiceClient = vi.fn(() => makeService())

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

// Faux client en mémoire (QA) : eq / is / not / in / gte / ilike, range, update conditionnel, hook entre lecture et écriture.
function makeService() {
  return {
    from(table) {
      const rows = table === "profiles" ? state.profiles : state.studentProfiles
      const q = { table, op: "select", cols: null, values: null, filters: [], range: null }
      state.queries.push(q)
      const same = (a, b) => (typeof a === "string" && typeof b === "string" && /^\d{4}-\d\d-\d\dT/.test(a) && /^\d{4}-\d\d-\d\dT/.test(b) ? Date.parse(a) === Date.parse(b) : a === b)
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
          q.filters.push((r) => same(r[c], v))
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
        gte(c, v) {
          q.filters.push((r) => r[c] != null && Date.parse(r[c]) >= Date.parse(v))
          return b
        },
        ilike(c, pattern) {
          q.filters.push((r) => likeToRegExp(pattern).test(String(r[c] ?? "")))
          return b
        },
        order: () => b,
        range(from, to) {
          q.range = [from, to]
          return b
        },
        maybeSingle: () => Promise.resolve(run(true)),
        then: (res, rej) => Promise.resolve(run(false)).then(res, rej),
      }
      function run(single) {
        if (q.op === "update") {
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
    auth: { admin: { getUserById: async (id) => ({ data: { user: state.emails[id] ? { email: state.emails[id] } : null }, error: null }) } },
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
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

const { approveStudentCard, rejectStudentCard, resetStudentRejection, revokeStudentBadge, getVerificationQueue } = await import("./admin-verifications.actions")
const { countPendingVerifications } = await import("./admin-context")

const SUBMITTED = "2026-10-10T09:00:00.123456+00:00"

function addStudent(n, over = {}, card = true) {
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
  state.studentProfiles.push({ user_id: id, school: "UAC", level: "L3", card_url: card ? `${id}/carte.jpg` : null })
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
  sendEmail.mockReset()
  sendEmail.mockResolvedValue({ success: true })
  createServiceClient.mockClear()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("QA double clic et concurrence", () => {
  it("10 approbations simultanées : une seule écriture réussie, un seul e-mail", async () => {
    const id = addStudent(1)
    const results = await Promise.all(Array.from({ length: 10 }, () => approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })))
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(results.filter((r) => r.error)).toHaveLength(9)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toBe("verification-approved")
    expect(profileOf(id).is_verified).toBe(true)
  })
  it("approbation et refus simultanés : un seul gagne, un seul e-mail, état final cohérent", async () => {
    const id = addStudent(1)
    const [a, r] = await Promise.all([
      approveStudentCard(id, { expectedSubmittedAt: SUBMITTED }),
      rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED }),
    ])
    expect([a.success, r.success].filter(Boolean)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const p = profileOf(id)
    // jamais vérifié ET refusé en même temps
    expect(p.is_verified && p.rejection_reason).toBeFalsy()
  })
  it("double refus : un seul e-mail de refus", async () => {
    const id = addStudent(1)
    const calls = await Promise.all([1, 2, 3].map(() => rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED })))
    expect(calls.filter((c) => c.success)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
  it("double révocation : un seul e-mail, une seule écriture réussie", async () => {
    const id = addStudent(1, { is_verified: true, verified_until: "2027-01-01" })
    const calls = await Promise.all([1, 2, 3].map(() => revokeStudentBadge(id, { reason: "Carte contestée" })))
    expect(calls.filter((c) => c.success)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
  it("double réinitialisation : une seule réussit", async () => {
    const id = addStudent(1, { rejection_reason: "Flou" })
    const calls = await Promise.all([1, 2].map(() => resetStudentRejection(id, { reason: "Nouvelle chance" })))
    expect(calls.filter((c) => c.success)).toHaveLength(1)
  })
  it("révocation d'un dossier refusé ou non vérifié : refusée sans e-mail", async () => {
    const id = addStudent(1, { rejection_reason: "Flou" })
    expect(await revokeStudentBadge(id, { reason: "Carte contestée" })).toEqual({ error: expect.any(String) })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("carte remplacée entre l'affichage et la décision : refus sans écriture ni e-mail", async () => {
    const id = addStudent(1)
    profileOf(id).verification_submitted_at = "2026-10-14T09:00:00+00:00"
    const r = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(r.error).toMatch(/déjà été traité|changé/)
    expect(profileOf(id).is_verified).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("même instant écrit avec un autre fuseau : le jeton est accepté", async () => {
    const id = addStudent(1)
    const r = await approveStudentCard(id, { expectedSubmittedAt: "2026-10-10T09:00:00.123456Z" })
    expect(r.success).toBe(true)
  })
  it("jeton hostile (objet, tableau, très long, illisible) : refus sans lecture d'écriture", async () => {
    const id = addStudent(1)
    for (const t of [{ a: 1 }, ["x"], "x".repeat(100), "pas une date", 12345]) {
      const r = await approveStudentCard(id, { expectedSubmittedAt: t })
      expect(r.error).toBeTruthy()
    }
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("appel sans options ni argument : pas d'exception", async () => {
    await expect(approveStudentCard()).resolves.toHaveProperty("error")
    await expect(rejectStudentCard()).resolves.toHaveProperty("error")
    await expect(resetStudentRejection()).resolves.toHaveProperty("error")
    await expect(revokeStudentBadge(undefined, undefined)).resolves.toHaveProperty("error")
    expect(updates()).toHaveLength(0)
  })
})

describe("QA dossiers expirés", () => {
  it("valider un dossier expiré sans carte renvoyée : refusé, aucune écriture", async () => {
    const id = addStudent(1, { verified_until: "2026-10-01", verification_submitted_at: "2026-09-01T10:00:00Z" })
    const r = await approveStudentCard(id, { expectedSubmittedAt: "2026-09-01T10:00:00Z" })
    expect(r.error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })
  it("refuser un dossier expiré : refusé", async () => {
    const id = addStudent(1, { verified_until: "2026-10-01", verification_submitted_at: "2026-09-01T10:00:00Z" })
    expect((await rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: "2026-09-01T10:00:00Z" })).error).toBeTruthy()
    expect(updates()).toHaveLength(0)
  })
  it("renouvellement après expiration (carte renvoyée après l'échéance) : validable, nouveau badge d'un an", async () => {
    const id = addStudent(1, { verified_until: "2026-10-01", verification_submitted_at: "2026-10-12T10:00:00Z" })
    const r = await approveStudentCard(id, { expectedSubmittedAt: "2026-10-12T10:00:00Z" })
    expect(r).toMatchObject({ success: true, verifiedUntil: "2027-10-15" })
  })
  it("révoquer un badge déjà échu mais is_verified vrai : l'action ne cible que is_verified (comportement lisible)", async () => {
    const id = addStudent(1, { is_verified: true, verified_until: "2026-10-01" })
    const r = await revokeStudentBadge(id, { reason: "Carte contestée" })
    expect(r.success).toBe(true)
    expect(profileOf(id).verified_until).toBe(null)
  })
  it("compteurs : le compte « à examiner » de la liste égale countPendingVerifications (mêmes données, dossiers expirés mêlés)", async () => {
    addStudent(1) // première demande
    addStudent(2, { verified_until: "2026-12-01" }) // renouvellement anticipé
    addStudent(3, { verified_until: "2026-10-01", verification_submitted_at: "2026-09-01T10:00:00Z" }) // expiré
    addStudent(4, { verified_until: "2026-10-01", verification_submitted_at: "2026-10-12T10:00:00Z" }) // renvoyé après
    addStudent(5, { verified_until: "2026-10-14", verification_submitted_at: "2026-10-14T23:30:00Z" }) // renvoyé à minuit Bénin
    addStudent(6, { verified_until: "2026-10-14", verification_submitted_at: "2026-10-14T22:59:00Z" }) // la veille au Bénin
    addStudent(7, { rejection_reason: "Flou" })
    addStudent(8, { is_verified: true, verified_until: "2027-01-01" })
    addStudent(9, {}, false)
    const queue = await getVerificationQueue({})
    const count = await countPendingVerifications(createServiceClient(), queue.today)
    expect(queue.counts["a-examiner"]).toBe(4) // 1, 2, 4, 5
    expect(count).toBe(queue.counts["a-examiner"])
    expect(Object.values(queue.counts).reduce((a, b) => a + b, 0)).toBe(9)
  })
  it("compteurs avec 2 300 étudiants (pagination de lecture) : somme des onglets = total", async () => {
    for (let i = 1; i <= 2300; i++) addStudent(i, i % 3 === 0 ? { is_verified: true, verified_until: "2027-01-01" } : {}, i % 5 !== 0)
    const queue = await getVerificationQueue({})
    expect(Object.values(queue.counts).reduce((a, b) => a + b, 0)).toBe(2300)
    expect(queue.counts["a-examiner"]).toBe(await countPendingVerifications(createServiceClient(), queue.today))
  })
})

describe("QA minuit au Bénin", () => {
  it("23:30 UTC le 14 octobre (00:30 le 15 au Bénin) : le badge court jusqu'au 15 octobre de l'année suivante", async () => {
    vi.setSystemTime(new Date("2026-10-14T23:30:00Z"))
    const id = addStudent(1)
    const r = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(r.verifiedUntil).toBe("2027-10-15")
    expect(profileOf(id).verified_until).toBe("2027-10-15")
  })
  it("22:59 UTC le 14 (23:59 au Bénin) : le badge court jusqu'au 14 octobre", async () => {
    vi.setSystemTime(new Date("2026-10-14T22:59:00Z"))
    const id = addStudent(1)
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).verifiedUntil).toBe("2027-10-14")
  })
  it("un badge au 14 est échu à 23:30 UTC le 14 (jour du Bénin = 15) : valider ce dossier non vérifié est refusé", async () => {
    vi.setSystemTime(new Date("2026-10-14T23:30:00Z"))
    const id = addStudent(1, { verified_until: "2026-10-14", verification_submitted_at: "2026-10-01T10:00:00Z" })
    expect((await approveStudentCard(id, { expectedSubmittedAt: "2026-10-01T10:00:00Z" })).error).toBeTruthy()
  })
  it("29 février 2028 : badge au 28 février 2029", async () => {
    vi.setSystemTime(new Date("2028-02-29T10:00:00Z"))
    const id = addStudent(1)
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).verifiedUntil).toBe("2029-02-28")
  })
})

describe("QA e-mail, journal et données privées", () => {
  it("échec d'envoi (rejet de promesse) : décision conservée, emailSent faux, aucune adresse dans les journaux", async () => {
    const id = addStudent(1)
    sendEmail.mockRejectedValue(new Error("boom etudiant1@exemple.bj"))
    const r = await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
    expect(r).toMatchObject({ success: true, emailSent: false })
    expect(profileOf(id).is_verified).toBe(true)
    const logged = JSON.stringify([...console.error.mock.calls, ...console.info.mock.calls])
    expect(logged).not.toContain("exemple.bj")
    expect(logged).not.toContain("22997")
  })
  it("adresse e-mail introuvable : décision conservée, aucun envoi", async () => {
    const id = addStudent(1)
    delete state.emails[id]
    const r = await rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED })
    expect(r).toMatchObject({ success: true, emailSent: false })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("sendEmail renvoie { error } : emailSent faux, décision conservée", async () => {
    const id = addStudent(1)
    sendEmail.mockResolvedValue({ error: "x" })
    expect(await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).toMatchObject({ success: true, emailSent: false })
  })
  it("« Autre motif » : le texte libre est stocké nettoyé et passé à l'e-mail sans caractère de contrôle", async () => {
    const id = addStudent(1)
    const r = await rejectStudentCard(id, { reason: "Autre motif", message: "  Carte\u0000 illisible\r\n<script>x</script> ", expectedSubmittedAt: SUBMITTED })
    expect(r.success).toBe(true)
    expect(profileOf(id).rejection_reason).toBe("Carte illisible <script>x</script>")
    expect(sendEmail.mock.calls[0][2].rejectionReason).not.toMatch(/[\u0000-\u001f]/)
  })
  it("message de 10 000 caractères : refusé sans écriture", async () => {
    const id = addStudent(1)
    const r = await rejectStudentCard(id, { reason: "Photo floue ou illisible", message: "a".repeat(10000), expectedSubmittedAt: SUBMITTED })
    expect(r.error).toBeTruthy()
    expect(updates()).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("la file ne contient aucune URL signée, e-mail, téléphone ni jeton dans les lignes de liste", async () => {
    for (let i = 1; i <= 30; i++) addStudent(i)
    const q = await getVerificationQueue({})
    const text = JSON.stringify(q.rows)
    expect(text).not.toMatch(/signed\.example|exemple\.bj|22997|token-secret|card_url|carte\.jpg/)
    expect(state.signed).toHaveLength(0)
    expect(q.rows).toHaveLength(25)
    expect(q.pageCount).toBe(2)
  })
  it("dossier ouvert : une seule URL signée de 300 s, e-mail seulement pour ce dossier, jamais le téléphone", async () => {
    for (let i = 1; i <= 3; i++) addStudent(i)
    const q = await getVerificationQueue({ id: uid(2) })
    expect(state.signed).toHaveLength(1)
    expect(state.signed[0]).toMatchObject({ bucket: "student-cards", ttl: 300 })
    expect(q.dossier.email).toBe("etudiant2@exemple.bj")
    const text = JSON.stringify(q)
    expect(text).not.toMatch(/22997|token-secret|etudiant1@|etudiant3@/)
  })
  it("carte d'un autre utilisateur ou chemin hostile en base : kind none, aucune signature", async () => {
    const id = addStudent(1)
    state.studentProfiles[0].card_url = `${uid(99)}/carte.jpg`
    expect((await getVerificationQueue({ id })).dossier.cardView.kind).toBe("none")
    state.studentProfiles[0].card_url = `${id}/../${uid(99)}/carte.jpg`
    expect((await getVerificationQueue({ id })).dossier.cardView.kind).toBe("none")
    state.studentProfiles[0].card_url = "https://evil.example/x.jpg"
    expect((await getVerificationQueue({ id })).dossier.cardView.kind).toBe("none")
    expect(state.signed).toHaveLength(0)
  })
  it("id d'un client ou inconnu dans l'URL : dossierNotFound, aucune lecture de carte", async () => {
    addStudent(1)
    state.profiles.push({ user_id: uid(50), role: "client", full_name: "Client", is_verified: false, verification_submitted_at: null, created_at: "2026-10-01T00:00:00Z" })
    expect((await getVerificationQueue({ id: uid(50) })).dossierNotFound).toBe(true)
    expect((await getVerificationQueue({ id: uid(77) })).dossierNotFound).toBe(true)
    expect(state.signed).toHaveLength(0)
  })
  it("recherche hostile : %, _, virgule, parenthèses, 200 caractères ne lèvent rien et ne renvoient pas tout", async () => {
    addStudent(1)
    for (const q of ["%", "_", "a,b)", "or=(id.eq.1)", "x".repeat(200), "\\", "'; drop table profiles;--"]) {
      const res = await getVerificationQueue({ q })
      expect(res.error).toBeUndefined()
      expect(res.rows).toHaveLength(0)
    }
  })
  it("page hors limites : ramenée à la dernière ; liste vide : une page", async () => {
    for (let i = 1; i <= 26; i++) addStudent(i)
    const last = await getVerificationQueue({ page: "999" })
    expect(last.page).toBe(2)
    expect(last.rows).toHaveLength(1)
    state.profiles = []
    state.studentProfiles = []
    const empty = await getVerificationQueue({ page: "5" })
    expect(empty).toMatchObject({ page: 1, pageCount: 1, total: 0, rows: [] })
  })
  it("tri : le plus ancien d'abord dans « À examiner »", async () => {
    addStudent(1, { verification_submitted_at: "2026-10-12T00:00:00Z" })
    addStudent(2, { verification_submitted_at: "2026-10-05T00:00:00Z" })
    addStudent(3, { verification_submitted_at: "2026-10-08T00:00:00Z" })
    const q = await getVerificationQueue({})
    expect(q.rows.map((r) => r.userId)).toEqual([uid(2), uid(3), uid(1)])
    expect(q.oldestAgeDays).toBe(10)
  })
})

describe("QA cibles invalides", () => {
  it("cible client, admin, soi-même : aucune écriture ni e-mail pour chaque action", async () => {
    for (const role of ["client", "admin"]) {
      const id = addStudent(role === "client" ? 1 : 2, { role, is_verified: true, rejection_reason: null })
      await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })
      await rejectStudentCard(id, { reason: "Photo floue ou illisible", expectedSubmittedAt: SUBMITTED })
      await revokeStudentBadge(id, { reason: "Carte contestée" })
      await resetStudentRejection(id, { reason: "Nouvelle chance" })
      expect(profileOf(id).is_verified).toBe(true)
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("admin suspendu : refus sans client service", async () => {
    state.sessionProfile = { role: "admin", full_name: "A", city: "Cotonou", is_suspended: true }
    const id = addStudent(1)
    expect((await approveStudentCard(id, { expectedSubmittedAt: SUBMITTED })).error).toBeTruthy()
    expect((await getVerificationQueue({})).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it("visiteur non connecté : refus sans client service", async () => {
    state.user = null
    expect((await getVerificationQueue({})).error).toBeTruthy()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
