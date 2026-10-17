import { describe, it, expect, vi, afterEach } from "vitest"
import { readFileSync } from "node:fs"

vi.mock("server-only", () => ({}))
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co"

const { purgeProofFiles, purgeMessageMedia, purgeAvatars, purgeStudentCards } = await import("./purge-files")

const NOW = new Date("2026-10-17T12:00:00Z")
const OLD = "2026-09-01T10:00:00Z"
const RECENT = "2026-10-15T10:00:00Z"
const ENDED_LONG_AGO = "2025-06-01T10:00:00Z"
const ENDED_RECENTLY = "2026-06-01T10:00:00Z"

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const reqId = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const missionId = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const U1 = uid(1)
const U2 = uid(2)
const U3 = uid(3)
const publicUrl = (bucket, path) => `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`

/**
 * Faux client : `tables` (lignes par table), `buckets` (nom -> { chemin: date de création }), pannes injectables.
 * Ne propose AUCUN delete ni insert : toute écriture SQL lève une TypeError. Enregistre les colonnes demandées.
 */
function fakeService({ tables = {}, buckets = {}, tableErrors = {}, listErrors = {}, removeErrors = {} } = {}) {
  const state = { selects: [], removed: [], removeCalls: 0, listCalls: 0, maxRows: 1000 }
  const objects = Object.fromEntries(Object.entries(buckets).map(([b, files]) => [b, { ...files }]))

  function query(table, columns) {
    state.selects.push({ table, columns })
    const filters = []
    let orderCol = null
    let range = null
    const run = () => {
      if (tableErrors[table]) return { data: null, error: tableErrors[table] }
      let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      if (orderCol) rows = [...rows].sort((a, b) => (a[orderCol] < b[orderCol] ? -1 : 1))
      const [from, to] = range ?? [0, state.maxRows - 1]
      const cols = columns.split(",").map((c) => c.trim())
      return { data: rows.slice(from, Math.min(to + 1, from + state.maxRows)).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))), error: null }
    }
    const b = {
      eq: (c, v) => (filters.push((r) => r[c] === v), b),
      in: (c, vs) => (filters.push((r) => vs.includes(r[c])), b),
      not: (c, op, v) => (filters.push((r) => (op === "is" && v === null ? r[c] !== null && r[c] !== undefined : true)), b),
      order: (c) => ((orderCol = c), b),
      range: (from, to) => ((range = [from, to]), b),
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  const service = {
    from: (table) => ({ select: (columns) => query(table, columns) }),
    storage: {
      from: (bucket) => ({
        list: async (prefix, { limit, offset }) => {
          state.listCalls += 1
          const files = objects[bucket]
          if (!files) return { data: null, error: { statusCode: "404" } }
          if (listErrors[`${bucket}:${prefix}`]) return { data: null, error: { statusCode: "500" } }
          const base = prefix ? `${prefix}/` : ""
          const entries = new Map()
          for (const [path, created] of Object.entries(files)) {
            if (!path.startsWith(base)) continue
            const rest = path.slice(base.length)
            const [head, ...tail] = rest.split("/")
            if (tail.length > 0) entries.set(head, { name: head, id: null, created_at: null })
            else entries.set(head, { name: head, id: `id-${path}`, created_at: created })
          }
          return { data: [...entries.values()].slice(offset, offset + limit), error: null }
        },
        remove: async (paths) => {
          state.removeCalls += 1
          if (removeErrors[bucket]) return { data: null, error: { statusCode: "500" } }
          const done = []
          for (const p of paths) {
            if (p in objects[bucket]) {
              delete objects[bucket][p]
              done.push({ name: p })
              state.removed.push(p)
            }
          }
          return { data: done, error: null }
        },
      }),
    },
  }
  return { service, state, objects }
}

const real = { now: NOW, mode: "real" }

describe("avatars (P6)", () => {
  it("garde l'avatar courant et un fichier récent, supprime l'ancien orphelin", async () => {
    const { service, state, objects } = fakeService({
      tables: { profiles: [{ id: "p1", user_id: U1, avatar_url: publicUrl("avatars", `${U1}/avatar-300.jpg`) }] },
      buckets: { avatars: { [`${U1}/avatar-100.jpg`]: OLD, [`${U1}/avatar-200.jpg`]: RECENT, [`${U1}/avatar-300.jpg`]: OLD } },
    })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([`${U1}/avatar-100.jpg`])
    expect(Object.keys(objects.avatars).sort()).toEqual([`${U1}/avatar-200.jpg`, `${U1}/avatar-300.jpg`])
    expect(r.categories.avatars).toEqual({ examines: 3, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 })
    expect(r.stops).toEqual([])
  })

  it("garde le logo `avatar.<ext>` courant (upsert) quand la référence est un chemin brut", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [{ id: "p1", user_id: U1, avatar_url: `${U1}/avatar.png` }] },
      buckets: { avatars: { [`${U1}/avatar.png`]: OLD } },
    })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.avatars.candidats).toBe(0)
  })

  it("supprime les fichiers d'un compte sans profil, après 7 jours seulement", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [] },
      buckets: { avatars: { [`${U1}/a-1.jpg`]: OLD, [`${U1}/a-2.jpg`]: RECENT } },
    })
    await purgeAvatars(service, real)
    expect(state.removed).toEqual([`${U1}/a-1.jpg`])
  })

  it("la limite des 7 jours est exacte : 6 jours conservé, 8 jours supprimé", async () => {
    const { service, state } = fakeService({
      buckets: { avatars: { [`${U1}/six.jpg`]: "2026-10-11T12:00:00Z", [`${U1}/eight.jpg`]: "2026-10-09T12:00:00Z" } },
    })
    await purgeAvatars(service, real)
    expect(state.removed).toEqual([`${U1}/eight.jpg`])
  })

  it("une URL d'une autre origine rend le dossier illisible : dossier ignoré, rien supprimé", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [{ id: "p1", user_id: U1, avatar_url: "https://lh3.googleusercontent.com/a/photo" }] },
      buckets: { avatars: { [`${U1}/old-1.jpg`]: OLD, [`${U1}/old-2.jpg`]: OLD } },
    })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([])
    expect(state.removeCalls).toBe(0)
    expect(r.categories.avatars).toEqual({ examines: 0, candidats: 0, supprimes: 0, erreurs: 0, ignores: 2 })
  })

  it("une erreur de lecture des références ignore le dossier entier sans toucher aux autres", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [{ id: "p2", user_id: U2, avatar_url: `${U2}/keep.jpg` }] },
      buckets: { avatars: { [`${U1}/old.jpg`]: OLD, [`${U2}/old.jpg`]: OLD, [`${U2}/keep.jpg`]: OLD } },
    })
    const original = service.from
    service.from = (table) => ({
      select: (columns) => {
        const q = original(table).select(columns)
        const eq = q.eq
        q.eq = (c, v) => (v === U1 ? { then: (res) => res({ data: null, error: { code: "57014" } }) } : eq(c, v))
        return q
      },
    })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([`${U2}/old.jpg`])
    expect(r.categories.avatars.ignores).toBe(1)
    expect(r.categories.avatars.supprimes).toBe(1)
  })

  it("une date de création absente ou illisible n'est jamais candidate (compté ignoré)", async () => {
    const { service, state } = fakeService({
      buckets: { avatars: { [`${U1}/nodate.jpg`]: null, [`${U1}/bad.jpg`]: "hier" } },
    })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.avatars).toMatchObject({ examines: 0, candidats: 0, ignores: 2 })
  })

  it("ne lit les profils qu'avec des colonnes explicites, jamais select(*)", async () => {
    const { service, state } = fakeService({ buckets: { avatars: { [`${U1}/a.jpg`]: OLD } } })
    await purgeAvatars(service, real)
    expect(state.selects.length).toBeGreaterThan(0)
    for (const s of state.selects) expect(s.columns).not.toContain("*")
    expect(state.selects[0]).toEqual({ table: "profiles", columns: "id, avatar_url" })
  })

  it("un dossier au nom non uuid est ignoré sans requête", async () => {
    const { service, state } = fakeService({ buckets: { avatars: { "dossier-bizarre/a.jpg": OLD } } })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toEqual([])
    expect(state.selects).toEqual([])
    expect(r.categories.avatars.ignores).toBe(1)
  })

  it("compartiment absent : ignoré, aucune suppression, motif d'arrêt error", async () => {
    const { service, state } = fakeService({ buckets: {} })
    const r = await purgeAvatars(service, real)
    expect(state.removeCalls).toBe(0)
    expect(r.categories.avatars).toMatchObject({ examines: 0, candidats: 0, supprimes: 0, ignores: 1 })
    expect(r.stops).toEqual(["error"])
  })

  it("un `now` illisible ne supprime rien", async () => {
    const { service, state } = fakeService({ buckets: { avatars: { [`${U1}/a.jpg`]: OLD } } })
    const r = await purgeAvatars(service, { now: "demain", mode: "real" })
    expect(state.removeCalls).toBe(0)
    expect(r.stops).toEqual(["error"])
  })
})

describe("cartes étudiantes (P7)", () => {
  it("garde la carte encore référencée, supprime la carte réinitialisée", async () => {
    const { service, state } = fakeService({
      tables: { student_profiles: [{ id: "s1", user_id: U1, card_url: `${U1}/card-new.jpg` }] },
      buckets: { "student-cards": { [`${U1}/card-old.jpg`]: OLD, [`${U1}/card-new.jpg`]: OLD } },
    })
    const r = await purgeStudentCards(service, real)
    expect(state.removed).toEqual([`${U1}/card-old.jpg`])
    expect(r.categories.student_cards).toEqual({ examines: 2, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 })
  })

  it("garde la carte référencée par une URL signée du projet", async () => {
    const { service, state } = fakeService({
      tables: {
        student_profiles: [
          { id: "s1", user_id: U1, card_url: `https://proj.supabase.co/storage/v1/object/sign/student-cards/${U1}/c.jpg?token=abc` },
        ],
      },
      buckets: { "student-cards": { [`${U1}/c.jpg`]: OLD } },
    })
    await purgeStudentCards(service, real)
    expect(state.removed).toEqual([])
  })

  it("carte réinitialisée (card_url nul) : supprimée après 7 jours", async () => {
    const { service, state } = fakeService({
      tables: { student_profiles: [{ id: "s1", user_id: U1, card_url: null }] },
      buckets: { "student-cards": { [`${U1}/c.jpg`]: OLD, [`${U1}/d.jpg`]: RECENT } },
    })
    await purgeStudentCards(service, real)
    expect(state.removed).toEqual([`${U1}/c.jpg`])
  })

  it("une référence qui pointe le dossier d'un autre utilisateur rend le dossier illisible", async () => {
    const { service, state } = fakeService({
      tables: { student_profiles: [{ id: "s1", user_id: U1, card_url: `${U2}/c.jpg` }] },
      buckets: { "student-cards": { [`${U1}/c.jpg`]: OLD } },
    })
    const r = await purgeStudentCards(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.student_cards.ignores).toBe(1)
  })
})

describe("médias de messagerie (P5)", () => {
  it("garde le média d'un message existant (chemin ou URL), supprime l'orphelin ancien", async () => {
    const { service, state } = fakeService({
      tables: {
        messages: [
          { id: "m1", sender_id: U1, media_url: `${U1}/1-a.jpg` },
          { id: "m2", sender_id: U1, media_url: publicUrl("message-media", `${U1}/2-b.m4a`) },
          { id: "m3", sender_id: U1, media_url: null },
          { id: "m4", sender_id: U2, media_url: `${U2}/9-z.jpg` },
        ],
      },
      buckets: {
        "message-media": {
          [`${U1}/1-a.jpg`]: OLD,
          [`${U1}/2-b.m4a`]: OLD,
          [`${U1}/3-c.jpg`]: OLD,
          [`${U1}/4-d.jpg`]: RECENT,
          [`${U2}/9-z.jpg`]: OLD,
        },
      },
    })
    const r = await purgeMessageMedia(service, real)
    expect(state.removed).toEqual([`${U1}/3-c.jpg`])
    expect(r.categories.message_media).toEqual({ examines: 5, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 })
    expect(state.selects[0]).toEqual({ table: "messages", columns: "id, media_url" })
  })

  it("un plafond PostgREST sous 1000 lignes ne tronque pas les références", async () => {
    const messages = Array.from({ length: 250 }, (_, i) => ({
      id: `m${String(i).padStart(5, "0")}`,
      sender_id: U1,
      media_url: `${U1}/f-${i}.jpg`,
    }))
    const files = Object.fromEntries(messages.map((m) => [m.media_url, OLD]))
    const { service, state } = fakeService({ tables: { messages }, buckets: { "message-media": files } })
    state.maxRows = 100
    const r = await purgeMessageMedia(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.message_media.candidats).toBe(0)
  })

  it("lit toutes les références au-delà d'une page (plus de 1000 messages d'un expéditeur)", async () => {
    const messages = Array.from({ length: 1500 }, (_, i) => ({
      id: `m${String(i).padStart(5, "0")}`,
      sender_id: U1,
      media_url: `${U1}/f-${i}.jpg`,
    }))
    const files = Object.fromEntries(messages.map((m) => [m.media_url, OLD]))
    const { service, state } = fakeService({ tables: { messages }, buckets: { "message-media": files } })
    const r = await purgeMessageMedia(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.message_media.candidats).toBe(0)
    expect(r.categories.message_media.examines).toBe(1500)
  })

  it("référence de média d'une autre origine : dossier ignoré, rien supprimé", async () => {
    const { service, state } = fakeService({
      tables: { messages: [{ id: "m1", sender_id: U1, media_url: "https://autre.example/x.jpg" }] },
      buckets: { "message-media": { [`${U1}/a.jpg`]: OLD } },
    })
    await purgeMessageMedia(service, real)
    expect(state.removed).toEqual([])
  })
})

describe("simulation, budget, erreurs partielles", () => {
  const orphans = () => ({
    tables: { profiles: [] },
    buckets: { avatars: { [`${U1}/a.jpg`]: OLD, [`${U1}/b.jpg`]: OLD } },
  })

  it("simulation : aucun appel remove, candidats comptés, fichiers intacts", async () => {
    const { service, state, objects } = fakeService(orphans())
    const r = await purgeAvatars(service, { now: NOW, mode: "dry" })
    expect(state.removeCalls).toBe(0)
    expect(Object.keys(objects.avatars)).toHaveLength(2)
    expect(r.categories.avatars).toEqual({ examines: 2, candidats: 2, supprimes: 0, erreurs: 0, ignores: 0 })
  })

  it("un mode absent ou inconnu vaut la simulation", async () => {
    for (const mode of [undefined, "Real", "true", ""]) {
      const { service, state } = fakeService(orphans())
      await purgeAvatars(service, { now: NOW, mode })
      expect(state.removeCalls).toBe(0)
    }
  })

  it("échéance dépassée : aucun fichier supprimé, motif deadline", async () => {
    const { service, state } = fakeService(orphans())
    const r = await purgeAvatars(service, { ...real, deadline: Date.now() - 1 })
    expect(state.removeCalls).toBe(0)
    expect(r.stops).toContain("deadline")
  })

  it("échéance atteinte entre deux dossiers : le dossier suivant n'est pas traité", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [] },
      buckets: { avatars: { [`${U1}/a.jpg`]: OLD, [`${U2}/a.jpg`]: OLD } },
    })
    const spy = vi.spyOn(Date, "now")
    let calls = 0
    spy.mockImplementation(() => {
      calls += 1
      return calls < 4 ? 1000 : 99999
    })
    const r = await purgeAvatars(service, { ...real, deadline: 5000 })
    spy.mockRestore()
    expect(r.stops).toContain("deadline")
    expect(state.removed.length).toBeLessThan(2)
  })

  it("erreur de suppression : comptée dans erreurs, rien n'est annoncé supprimé", async () => {
    const { service } = fakeService({ ...orphans(), removeErrors: { avatars: true } })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await purgeAvatars(service, real)
    expect(r.categories.avatars).toMatchObject({ candidats: 2, supprimes: 0, erreurs: 2 })
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(U1)
    errorSpy.mockRestore()
  })

  it("erreur de listage d'un dossier : comptée, les autres dossiers sont traités", async () => {
    const { service, state } = fakeService({
      tables: { profiles: [] },
      buckets: { avatars: { [`${U1}/a.jpg`]: OLD, [`${U2}/a.jpg`]: OLD } },
      listErrors: { [`avatars:${U1}`]: true },
    })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await purgeAvatars(service, real)
    errorSpy.mockRestore()
    expect(state.removed).toEqual([`${U2}/a.jpg`])
    expect(r.categories.avatars).toMatchObject({ erreurs: 1, supprimes: 1 })
  })

  it("le résultat ne contient aucun identifiant ni chemin", async () => {
    const { service } = fakeService(orphans())
    const r = await purgeAvatars(service, real)
    const text = JSON.stringify(r)
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
    expect(text).not.toContain("jpg")
  })
})

describe("disjoncteur", () => {
  const many = (n, owner = U1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${owner}/f-${i}.jpg`, OLD]))

  it("saute le compartiment quand plus de 50 % ET plus de 25 fichiers sont candidats", async () => {
    const { service, state } = fakeService({ tables: { profiles: [] }, buckets: { avatars: many(30) } })
    const r = await purgeAvatars(service, real)
    expect(state.removeCalls).toBe(0)
    expect(r.stops).toEqual(["breaker"])
    expect(r.categories.avatars.supprimes).toBe(0)
  })

  it("ne se déclenche pas à 25 candidats exactement", async () => {
    const { service, state } = fakeService({ tables: { profiles: [] }, buckets: { avatars: many(25) } })
    const r = await purgeAvatars(service, real)
    expect(state.removed).toHaveLength(25)
    expect(r.stops).toEqual([])
  })

  it("ne se déclenche pas sous 50 % des fichiers examinés", async () => {
    const files = many(30)
    const refs = Array.from({ length: 40 }, (_, i) => `${U1}/ref-${i}.jpg`)
    for (const p of refs) files[p] = OLD
    const { service, state } = fakeService({
      tables: { profiles: refs.map((p, i) => ({ id: `p${i}`, user_id: U1, avatar_url: p })).slice(0, 1) },
      buckets: { avatars: { ...files } },
    })
    // une seule référence lisible : 69 candidats sur 70 -> disjoncteur ; avec toutes les références, 30 sur 70
    const tripped = await purgeAvatars(service, real)
    expect(tripped.stops).toEqual(["breaker"])
    const second = fakeService({
      tables: { profiles: refs.map((p, i) => ({ id: `p${i}`, user_id: U1, avatar_url: p })) },
      buckets: { avatars: { ...files } },
    })
    const r = await purgeAvatars(second.service, real)
    expect(r.stops).toEqual([])
    expect(second.state.removed).toHaveLength(30)
  })

  it("allowMass === true lève le disjoncteur ; toute autre valeur ne le lève pas", async () => {
    const a = fakeService({ tables: { profiles: [] }, buckets: { avatars: many(30) } })
    const r = await purgeAvatars(a.service, { ...real, allowMass: true })
    expect(a.state.removed).toHaveLength(30)
    expect(r.stops).toEqual([])
    for (const allowMass of ["true", 1, undefined, false]) {
      const b = fakeService({ tables: { profiles: [] }, buckets: { avatars: many(30) } })
      const res = await purgeAvatars(b.service, { ...real, allowMass })
      expect(b.state.removeCalls).toBe(0)
      expect(res.stops).toEqual(["breaker"])
    }
  })

  it("évalué sur tout le compartiment : premiers lots sous le seuil, total au-dessus, aucun remove", async () => {
    // U1 : 120 orphelins sur 1100 fichiers (sous le seuil) ; U2 : 600 orphelins de plus -> 720 sur 1700 puis le reste référencé
    const refs = Array.from({ length: 1000 }, (_, i) => ({ id: `p${String(i).padStart(4, "0")}`, user_id: U1, avatar_url: `${U1}/ref-${i}.jpg` }))
    const files = { ...many(120, U1), ...many(1100, U2) }
    for (const r of refs) files[r.avatar_url] = OLD
    const { service, state } = fakeService({ tables: { profiles: refs }, buckets: { avatars: files } })
    const res = await purgeAvatars(service, real)
    expect(state.removeCalls).toBe(0)
    expect(res.stops).toEqual(["breaker"])
    expect(res.categories.avatars.candidats).toBe(1220)
    expect(res.categories.avatars.supprimes).toBe(0)
  })

  it("nominal : plus de 100 candidats sous le seuil, tous supprimés par lots de 100", async () => {
    const refs = Array.from({ length: 300 }, (_, i) => ({ id: `p${String(i).padStart(4, "0")}`, user_id: U1, avatar_url: `${U1}/ref-${i}.jpg` }))
    const files = many(150, U2)
    for (const r of refs) files[r.avatar_url] = OLD
    const { service, state } = fakeService({ tables: { profiles: refs }, buckets: { avatars: files } })
    const res = await purgeAvatars(service, real)
    expect(res.stops).toEqual([])
    expect(state.removed).toHaveLength(150)
    expect(state.removeCalls).toBe(2)
    expect(res.categories.avatars.supprimes).toBe(150)
  })

  it("échéance en cours de parcours : aucun remove, motif deadline", async () => {
    const files = { ...many(5, U1), ...many(5, U2) }
    const { service, state } = fakeService({ tables: { profiles: [] }, buckets: { avatars: files } })
    // Les deux dossiers sont lus, l'échéance tombe avant la fin du parcours
    const spy = vi.spyOn(Date, "now")
    let calls = 0
    spy.mockImplementation(() => (++calls < 6 ? 1000 : 99999))
    const res = await purgeAvatars(service, { ...real, deadline: 5000 })
    spy.mockRestore()
    expect(res.stops).toContain("deadline")
    expect(state.removeCalls).toBe(0)
  })

  it("simulation : le parcours va jusqu'au bout et compte tous les candidats", async () => {
    const { service, state } = fakeService({ tables: { profiles: [] }, buckets: { avatars: { ...many(20, U1), ...many(20, U2) } } })
    const res = await purgeAvatars(service, { now: NOW, mode: "dry", allowMass: true })
    expect(res.categories.avatars.candidats).toBe(40)
    expect(state.removeCalls).toBe(0)
  })

  it("en simulation le disjoncteur est aussi signalé", async () => {
    const { service } = fakeService({ tables: { profiles: [] }, buckets: { avatars: many(30) } })
    const r = await purgeAvatars(service, { now: NOW, mode: "dry" })
    expect(r.stops).toEqual(["breaker"])
  })
})

describe("preuves d'achats (P3 et P4)", () => {
  const proofPath = (owner, request, name) => `${owner}/${request}/${name}.jpg`
  const R1 = reqId(1)
  const M1 = missionId(1)
  const baseRequest = (over = {}) => ({
    id: R1,
    mission_id: M1,
    student_id: U1,
    client_id: U2,
    payee_photo_path: proofPath(U1, R1, "payee-aaaaaaaa"),
    ticket_photo_path: proofPath(U1, R1, "ticket-bbbbbbbb"),
    sms_photo_path: null,
    updated_at: ENDED_LONG_AGO,
    ...over,
  })
  const mission = (over = {}) => ({ id: M1, status: "done", updated_at: ENDED_LONG_AGO, ...over })
  const files = (extra = {}) => ({
    [proofPath(U1, R1, "payee-aaaaaaaa")]: OLD,
    [proofPath(U1, R1, "ticket-bbbbbbbb")]: OLD,
    ...extra,
  })

  it("version périmée remplacée : supprimée après 7 jours, version courante conservée (rétention nulle)", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()] },
      buckets: {
        "purchase-proofs": files({
          [proofPath(U1, R1, "payee-oldoldold")]: OLD,
          [proofPath(U1, R1, "payee-newnewnew")]: RECENT,
        }),
      },
    })
    const r = await purgeProofFiles(service, { ...real, retentionMonths: null })
    expect(state.removed).toEqual([proofPath(U1, R1, "payee-oldoldold")])
    expect(r.categories.proof_orphans).toEqual({ examines: 4, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 })
    expect(r.categories.proof_expired.candidats).toBe(0)
  })

  it("demande absente (compte ou mission supprimé) : orphelins supprimés après 7 jours seulement", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [] },
      buckets: {
        "purchase-proofs": {
          [proofPath(U1, R1, "payee-aaaaaaaa")]: OLD,
          [proofPath(U1, R1, "ticket-bbbbbbbb")]: RECENT,
        },
      },
    })
    await purgeProofFiles(service, real)
    expect(state.removed).toEqual([proofPath(U1, R1, "payee-aaaaaaaa")])
  })

  it("la capture SMS du client vit dans le dossier du client et reste conservée", async () => {
    const sms = proofPath(U2, R1, "sms-cccccccc")
    const { service, state } = fakeService({
      tables: {
        purchase_requests: [baseRequest({ sms_photo_path: sms })],
        missions: [mission({ status: "in_progress" })],
        reports: [],
      },
      buckets: { "purchase-proofs": files({ [sms]: OLD }) },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.proof_orphans.candidats).toBe(0)
  })

  it("le sms de l'étudiant (hors de ses colonnes) n'est pas protégé et part s'il est ancien", async () => {
    const stray = proofPath(U1, R1, "sms-dddddddd")
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission({ status: "open" })], reports: [] },
      buckets: { "purchase-proofs": files({ [stray]: OLD }) },
    })
    await purgeProofFiles(service, real)
    expect(state.removed).toEqual([stray])
  })

  it("preuve expirée : mission terminée il y a plus de 12 mois, aucun signalement ouvert : supprimée", async () => {
    const { service, state } = fakeService({
      tables: {
        purchase_requests: [baseRequest()],
        missions: [mission()],
        reports: [{ id: "r1", purchase_request_id: R1, status: "resolved", handled_at: ENDED_LONG_AGO }],
      },
      buckets: { "purchase-proofs": files() },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed.sort()).toEqual([proofPath(U1, R1, "payee-aaaaaaaa"), proofPath(U1, R1, "ticket-bbbbbbbb")])
    expect(r.categories.proof_expired).toEqual({ examines: 2, candidats: 2, supprimes: 2, erreurs: 0, ignores: 0 })
    expect(r.categories.proof_orphans.candidats).toBe(0)
  })

  it("mission annulée : même règle qu'une mission terminée", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission({ status: "cancelled" })], reports: [] },
      buckets: { "purchase-proofs": files() },
    })
    await purgeProofFiles(service, real)
    expect(state.removed).toHaveLength(2)
  })

  it("signalement ouvert ou en cours : preuves conservées, même 12 mois après la fin", async () => {
    for (const status of ["open", "in_progress", "statut-inconnu"]) {
      const { service, state } = fakeService({
        tables: {
          purchase_requests: [baseRequest()],
          missions: [mission()],
          reports: [{ id: "r1", purchase_request_id: R1, status, handled_at: null }],
        },
        buckets: { "purchase-proofs": files() },
      })
      const r = await purgeProofFiles(service, real)
      expect(state.removed).toEqual([])
      expect(r.categories.proof_expired.candidats).toBe(0)
    }
  })

  it("mission non terminée (open, in_progress) : preuves conservées", async () => {
    for (const status of ["open", "in_progress"]) {
      const { service, state } = fakeService({
        tables: { purchase_requests: [baseRequest()], missions: [mission({ status })], reports: [] },
        buckets: { "purchase-proofs": files() },
      })
      await purgeProofFiles(service, real)
      expect(state.removed).toEqual([])
    }
  })

  it("fin de mission récente (moins de 12 mois) ou signalement clos récemment : conservées", async () => {
    const recentMission = fakeService({
      tables: {
        purchase_requests: [baseRequest({ updated_at: ENDED_RECENTLY })],
        missions: [mission({ updated_at: ENDED_RECENTLY })],
        reports: [],
      },
      buckets: { "purchase-proofs": files() },
    })
    await purgeProofFiles(recentMission.service, real)
    expect(recentMission.state.removed).toEqual([])
    const recentReport = fakeService({
      tables: {
        purchase_requests: [baseRequest()],
        missions: [mission()],
        reports: [
          { id: "r1", purchase_request_id: R1, status: "resolved", handled_at: ENDED_LONG_AGO },
          { id: "r2", purchase_request_id: R1, status: "dismissed", handled_at: ENDED_RECENTLY },
        ],
      },
      buckets: { "purchase-proofs": files() },
    })
    await purgeProofFiles(recentReport.service, real)
    expect(recentReport.state.removed).toEqual([])
  })

  it("P4 désactivée par injection de retentionMonths null : rien d'expiré, missions non lues (signalements lus pour P3)", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission()], reports: [] },
      buckets: { "purchase-proofs": files() },
    })
    const r = await purgeProofFiles(service, { ...real, retentionMonths: null })
    expect(state.removed).toEqual([])
    expect(r.categories.proof_expired).toEqual({ examines: 2, candidats: 0, supprimes: 0, erreurs: 0, ignores: 0 })
    expect(state.selects.map((s) => s.table)).not.toContain("missions")
    expect(state.selects.map((s) => s.table)).toContain("reports")
  })

  it("version remplacée conservée tant qu'un signalement est ouvert, supprimée quand il est clos ou absent (rétention nulle)", async () => {
    const stale = proofPath(U1, R1, "payee-oldoldold")
    const run = async (reports) => {
      const { service, state } = fakeService({
        tables: { purchase_requests: [baseRequest()], reports },
        buckets: { "purchase-proofs": files({ [stale]: OLD }) },
      })
      await purgeProofFiles(service, { ...real, retentionMonths: null })
      return state.removed
    }
    expect(await run([{ id: "r1", purchase_request_id: R1, status: "open", handled_at: null }])).toEqual([])
    expect(await run([{ id: "r1", purchase_request_id: R1, status: "statut-inconnu", handled_at: null }])).toEqual([])
    expect(await run([{ id: "r1", purchase_request_id: R1, status: "resolved", handled_at: OLD }])).toEqual([stale])
    expect(await run([])).toEqual([stale])
  })

  it("la durée par défaut est celle de la constante (12 mois) : preuve de 11 mois conservée", async () => {
    const { service, state } = fakeService({
      tables: {
        purchase_requests: [baseRequest({ updated_at: "2025-11-20T10:00:00Z" })],
        missions: [mission({ updated_at: "2025-11-20T10:00:00Z" })],
        reports: [],
      },
      buckets: { "purchase-proofs": files() },
    })
    await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
  })

  it("lecture des signalements illisible : dossier ignoré, rien supprimé même pour les orphelins", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission()] },
      tableErrors: { reports: { code: "57014" } },
      buckets: { "purchase-proofs": files({ [proofPath(U1, R1, "payee-oldoldold")]: OLD }) },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.proof_orphans.ignores).toBe(3)
  })

  it("lecture des demandes en erreur : dossier ignoré", async () => {
    const { service, state } = fakeService({
      tableErrors: { purchase_requests: { code: "57014" } },
      buckets: { "purchase-proofs": files() },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.proof_orphans.ignores).toBe(2)
  })

  it("référence de preuve illisible (autre origine) : dossier entier ignoré", async () => {
    const { service, state } = fakeService({
      tables: {
        purchase_requests: [baseRequest({ ticket_photo_path: "https://autre.example/t.jpg" })],
        missions: [mission()],
        reports: [],
      },
      buckets: { "purchase-proofs": files({ [proofPath(U1, R1, "payee-oldoldold")]: OLD }) },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.proof_orphans.ignores).toBe(3)
  })

  it("fichiers hors d'un dossier de demande conforme : jamais touchés", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [] },
      buckets: { "purchase-proofs": { [`${U1}/loose.jpg`]: OLD, [`${U1}/pas-un-uuid/x.jpg`]: OLD } },
    })
    const r = await purgeProofFiles(service, real)
    expect(state.removed).toEqual([])
    expect(r.categories.proof_orphans.ignores).toBe(2)
  })

  it("une demande est lue par identifiants des sous-dossiers du propriétaire, colonnes explicites", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission()], reports: [] },
      buckets: { "purchase-proofs": files() },
    })
    await purgeProofFiles(service, real)
    for (const s of state.selects) expect(s.columns).not.toContain("*")
    expect(state.selects[0].table).toBe("purchase_requests")
  })

  it("simulation : preuves expirées et orphelines comptées, aucun remove", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [baseRequest()], missions: [mission()], reports: [] },
      buckets: { "purchase-proofs": files({ [proofPath(U1, R1, "payee-oldoldold")]: OLD }) },
    })
    const r = await purgeProofFiles(service, { now: NOW, mode: "dry" })
    expect(state.removeCalls).toBe(0)
    expect(r.categories.proof_orphans.candidats).toBe(1)
    expect(r.categories.proof_expired.candidats).toBe(2)
  })

  it("disjoncteur sur le compartiment : orphelins et expirées comptés ensemble", async () => {
    const reqs = []
    const obj = {}
    for (let i = 1; i <= 30; i += 1) obj[proofPath(U1, reqId(100 + i), "payee-aaaaaaaa")] = OLD
    const { service, state } = fakeService({ tables: { purchase_requests: reqs }, buckets: { "purchase-proofs": obj } })
    const r = await purgeProofFiles(service, real)
    expect(state.removeCalls).toBe(0)
    expect(r.stops).toEqual(["breaker"])
    const lifted = fakeService({ tables: { purchase_requests: reqs }, buckets: { "purchase-proofs": obj } })
    await purgeProofFiles(lifted.service, { ...real, allowMass: true })
    expect(lifted.state.removed).toHaveLength(30)
  })

  it("erreur de listage d'un sous-dossier : déposant compté en erreur, les autres traités", async () => {
    const { service, state } = fakeService({
      tables: { purchase_requests: [] },
      buckets: {
        "purchase-proofs": {
          [proofPath(U1, R1, "payee-aaaaaaaa")]: OLD,
          [proofPath(U3, reqId(5), "payee-aaaaaaaa")]: OLD,
        },
      },
      listErrors: { [`purchase-proofs:${U1}/${R1}`]: true },
    })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await purgeProofFiles(service, real)
    errorSpy.mockRestore()
    expect(state.removed).toEqual([proofPath(U3, reqId(5), "payee-aaaaaaaa")])
    expect(r.categories.proof_orphans.erreurs).toBe(1)
  })
})

describe("garde-fous statiques du module", () => {
  const source = readFileSync(new URL("./purge-files.js", import.meta.url), "utf8")

  it("importe server-only, sans use server ni création de client ni DELETE SQL", () => {
    expect(source).toMatch(/^import "server-only"/)
    expect(source).not.toMatch(/["']use server["']/)
    expect(source).not.toContain("createServiceClient")
    expect(source).not.toContain(".delete(")
    expect(source).not.toContain("deleteUser")
    expect(source).not.toMatch(/select\(\s*["'`]\*/)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("exports", () => {
  it("expose les quatre fonctions", () => {
    for (const fn of [purgeProofFiles, purgeMessageMedia, purgeAvatars, purgeStudentCards]) expect(typeof fn).toBe("function")
  })
})
