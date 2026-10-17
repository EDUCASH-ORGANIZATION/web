import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

import { pseudonymizeClosedAccounts } from "./account-closure-pseudonymize"
import { summaryHasNoIdentifiers } from "@/lib/purge/purge-rules"
import { ACCOUNT_BATCH, ACCOUNT_BREAKER, CLOSED_ACCOUNT_LABEL } from "@/lib/account-closure/closure-rules"

const NOW = new Date("2026-11-20T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000
const iso = (ms) => new Date(ms).toISOString()
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const WRITE_TABLES = new Set([
  "profiles",
  "student_profiles",
  "notifications",
  "applications",
  "account_closure_events",
])

/** Faux client Supabase en mémoire : filtres eq / is / not / in / lte / or, écritures journalisées. */
function makeDb(seed = {}) {
  const tables = {
    profiles: [],
    student_profiles: [],
    wallets: [],
    purchase_requests: [],
    reports: [],
    missions: [],
    transactions: [],
    notifications: [],
    applications: [],
    account_closure_events: [],
    ...structuredClone(seed),
  }
  const writes = []
  const fail = new Map()
  const hooks = { beforeWrite: null }

  function orPredicate(text) {
    const parts = text.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".")
      let val = rest.join(".")
      if (val.startsWith('"')) val = JSON.parse(val)
      return (row) => {
        if (op === "eq") return row[col] === val
        if (op === "neq") return row[col] !== null && row[col] !== undefined && row[col] !== val
        if (op === "is") return row[col] === null || row[col] === undefined
        throw new Error(`or non géré : ${op}`)
      }
    })
    return (row) => parts.some((f) => f(row))
  }

  function builder(table) {
    const st = { op: "select", filters: [], payload: null, count: null, head: false, limit: null, order: null, sel: false }
    const q = {
      select(_cols, opts = {}) {
        if (st.op === "select") {
          st.count = opts.count ?? null
          st.head = opts.head === true
        } else st.sel = true
        return q
      },
      update(payload) {
        st.op = "update"
        st.payload = payload
        return q
      },
      delete() {
        st.op = "delete"
        return q
      },
      insert(payload) {
        st.op = "insert"
        st.payload = payload
        return q
      },
      eq: (c, v) => (st.filters.push((r) => r[c] === v), q),
      is: (c, v) => (st.filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)), q),
      not: (c, op, v) => {
        if (op !== "is") throw new Error("not non géré")
        st.filters.push((r) => !(v === null ? r[c] === null || r[c] === undefined : r[c] === v))
        return q
      },
      in: (c, vs) => (st.filters.push((r) => vs.includes(r[c])), q),
      lte: (c, v) => (st.filters.push((r) => r[c] !== null && r[c] !== undefined && new Date(r[c]) <= new Date(v)), q),
      or: (text) => (st.filters.push(orPredicate(text)), q),
      order: (c) => ((st.order = c), q),
      limit: (n) => ((st.limit = n), q),
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    function run() {
      const key = `${table}.${st.op}`
      if (st.op !== "select") {
        writes.push({ table, op: st.op, payload: st.payload })
        if (hooks.beforeWrite) hooks.beforeWrite({ table, op: st.op, payload: st.payload, rows: tables })
      }
      if (fail.has(key)) return { data: null, error: { code: fail.get(key) }, count: null }
      const rows = tables[table]
      if (st.op === "insert") {
        const dup = table === "account_closure_events" && rows.some((r) => r.user_id === st.payload.user_id && r.event === st.payload.event)
        if (dup) return { data: null, error: { code: "23505" } }
        rows.push({ ...st.payload })
        return { data: null, error: null }
      }
      const matched = rows.filter((r) => st.filters.every((f) => f(r)))
      if (st.op === "update") {
        for (const r of matched) Object.assign(r, st.payload)
        return { data: st.sel ? matched.map((r) => ({ user_id: r.user_id })) : null, error: null }
      }
      if (st.op === "delete") {
        tables[table] = rows.filter((r) => !matched.includes(r))
        return { data: null, error: null }
      }
      let data = matched
      if (st.order) data = [...data].sort((a, b) => String(a[st.order]).localeCompare(String(b[st.order])))
      const total = data.length
      if (st.limit !== null) data = data.slice(0, st.limit)
      return { data: st.head ? null : data.map((r) => ({ ...r })), count: st.count ? total : null, error: null }
    }
    return q
  }

  const removed = []
  const updateUserById = vi.fn(async () => ({ error: fail.has("auth") ? { code: "boom" } : null }))
  const deleteUser = vi.fn()
  const service = {
    from: builder,
    auth: { admin: { updateUserById, deleteUser } },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          if (fail.has("storage")) return { data: null, error: { message: "x" } }
          removed.push(...paths.map((p) => `${bucket}/${p}`))
          return { data: paths.map((name) => ({ name })), error: null }
        },
      }),
    },
  }
  return { service, tables, writes, removed, updateUserById, deleteUser, fail, hooks }
}

function closedProfile(n, daysAgo, extra = {}) {
  return {
    user_id: uid(n),
    full_name: `Nom ${n}`,
    closed_at: iso(NOW.getTime() - daysAgo * DAY),
    pseudonymized_at: null,
    avatar_url: `${uid(n)}/avatar.png`,
    bio: "bio",
    phone: "0100",
    is_verified: true,
    ...extra,
  }
}

const real = { now: NOW, mode: "real" }
const counters = (r) => r.categories.closed_accounts

let errorSpy
let logSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  logSpy.mockRestore()
})

describe("pseudonymizeClosedAccounts : sélection et échéance", () => {
  it("ne touche jamais un compte fermé depuis moins de 14 jours, traite celui de exactement 14 jours", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 13.99), closedProfile(2, 14), closedProfile(3, 14.01)],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ candidats: 2, supprimes: 2, erreurs: 0, ignores: 0 })
    const byId = Object.fromEntries(db.tables.profiles.map((p) => [p.user_id, p]))
    expect(byId[uid(1)].pseudonymized_at).toBeNull()
    expect(byId[uid(1)].full_name).toBe("Nom 1")
    expect(byId[uid(2)].full_name).toBe(CLOSED_ACCOUNT_LABEL)
    expect(byId[uid(3)].full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })

  it("ignore un compte actif ou déjà pseudonymisé", async () => {
    const db = makeDb({
      profiles: [
        { user_id: uid(1), full_name: "Actif", closed_at: null, pseudonymized_at: null },
        closedProfile(2, 30, { pseudonymized_at: iso(NOW.getTime() - DAY), full_name: CLOSED_ACCOUNT_LABEL }),
      ],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ candidats: 0, supprimes: 0, examines: 0 })
    expect(db.writes).toEqual([])
  })

  it("ignore un compte réactivé entre la sélection et la revendication", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    db.hooks.beforeWrite = ({ table, op, rows }) => {
      if (table === "profiles" && op === "update") {
        rows.profiles[0].closed_at = null
        db.hooks.beforeWrite = null
      }
    }
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ supprimes: 0, ignores: 1, erreurs: 0 })
    expect(db.tables.profiles[0].pseudonymized_at).toBeNull()
    expect(db.tables.profiles[0].full_name).toBe("Nom 1")
    expect(db.updateUserById).not.toHaveBeenCalled()
    expect(db.writes.filter((w) => w.table !== "profiles")).toEqual([])
  })
})

describe("pseudonymizeClosedAccounts : simulation", () => {
  it("compte seulement : aucune écriture, aucun appel auth ou Storage", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20), closedProfile(2, 20)] })
    for (const mode of ["dry", undefined]) {
      const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode })
      expect(counters(r)).toMatchObject({ candidats: 2, supprimes: 0, erreurs: 0 })
    }
    expect(db.writes).toEqual([])
    expect(db.updateUserById).not.toHaveBeenCalled()
    expect(db.removed).toEqual([])
  })
})

describe("pseudonymizeClosedAccounts : passage réel", () => {
  it("efface, pseudonymise, journalise et écrit profiles en dernier", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      student_profiles: [{ user_id: uid(1), school: "S", level: "L", availability: "A", card_url: `${uid(1)}/card.jpg`, skills: ["x"] }],
      notifications: [{ recipient_id: uid(1) }, { recipient_id: uid(2) }],
      applications: [
        { student_id: uid(1), status: "pending" },
        { student_id: uid(1), status: "rejected" },
        { student_id: uid(1), status: "accepted" },
        { student_id: uid(2), status: "pending" },
      ],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ examines: 1, candidats: 1, supprimes: 1, erreurs: 0, ignores: 0 })
    expect(r.stops).toEqual([])
    expect(db.tables.notifications).toEqual([{ recipient_id: uid(2) }])
    expect(db.tables.applications.map((a) => `${a.student_id}:${a.status}`).sort()).toEqual([
      `${uid(1)}:accepted`,
      `${uid(2)}:pending`,
    ])
    expect(db.removed.sort()).toEqual([`avatars/${uid(1)}/avatar.png`, `student-cards/${uid(1)}/card.jpg`])
    expect(db.updateUserById).toHaveBeenCalledTimes(1)
    expect(db.deleteUser).not.toHaveBeenCalled()
    expect(db.tables.student_profiles[0]).toMatchObject({ school: null, level: null, availability: null, card_url: null, skills: [] })
    expect(db.tables.account_closure_events).toEqual([
      { user_id: uid(1), event: "pseudonymized", actor_kind: "system", actor_id: null, reason_code: null },
    ])
    const p = db.tables.profiles[0]
    expect(p).toMatchObject({ full_name: CLOSED_ACCOUNT_LABEL, avatar_url: null, bio: null, phone: null, is_verified: false })
    expect(p.pseudonymized_at).toBe(NOW.toISOString())
    const last = db.writes.at(-1)
    expect(last.table).toBe("profiles")
    expect(last.payload.full_name).toBe(CLOSED_ACCOUNT_LABEL)
    expect(db.writes.filter((w) => w.payload && "full_name" in w.payload)).toHaveLength(1)
  })

  it("n'écrit que dans les tables listées et ne supprime que notifications et candidatures", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      student_profiles: [{ user_id: uid(1), card_url: null }],
    })
    await pseudonymizeClosedAccounts(db.service, real)
    for (const w of db.writes) expect(WRITE_TABLES.has(w.table)).toBe(true)
    const deletes = db.writes.filter((w) => w.op === "delete").map((w) => w.table)
    expect(deletes.sort()).toEqual(["applications", "notifications"])
    expect(db.deleteUser).not.toHaveBeenCalled()
  })

  it("ignore les fichiers hors du dossier du compte", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20, { avatar_url: `${uid(2)}/avatar.png` })],
      student_profiles: [{ user_id: uid(1), card_url: "../autre/card.jpg" }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r).supprimes).toBe(1)
    expect(db.removed).toEqual([])
  })
})

describe("pseudonymizeClosedAccounts : blocages du temps 3", () => {
  const cases = {
    solde: { wallets: [{ user_id: uid(1), balance: 100, reserved: 0 }] },
    reserve: { wallets: [{ user_id: uid(1), balance: 0, reserved: 5 }] },
    achat: { purchase_requests: [{ student_id: uid(9), client_id: uid(1), status: "paid" }] },
    "mission cliente ouverte": { missions: [{ client_id: uid(1), selected_student_id: null, status: "open" }] },
    "mission cliente en cours": { missions: [{ client_id: uid(1), selected_student_id: uid(9), status: "in_progress" }] },
    "mission étudiante en cours": { missions: [{ client_id: uid(9), selected_student_id: uid(1), status: "in_progress" }] },
    signalement: { reports: [{ reporter_id: uid(9), reported_user_id: uid(1), status: "open" }] },
    "signalement en cours": { reports: [{ reporter_id: uid(1), reported_user_id: uid(9), status: "in_progress" }] },
    transaction: { transactions: [{ client_id: uid(9), student_id: uid(1), status: "pending" }] },
  }
  for (const [name, extra] of Object.entries(cases)) {
    it(`reporte le compte (${name}) sans aucune écriture`, async () => {
      const db = makeDb({ profiles: [closedProfile(1, 20)], ...extra })
      const r = await pseudonymizeClosedAccounts(db.service, real)
      expect(counters(r)).toMatchObject({ ignores: 1, supprimes: 0, erreurs: 0 })
      expect(db.writes).toEqual([])
      expect(db.updateUserById).not.toHaveBeenCalled()
    })
  }

  it("ne bloque pas sur des éléments terminés ou d'autres comptes", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      wallets: [{ user_id: uid(1), balance: 0, reserved: 0 }],
      reports: [{ reporter_id: uid(1), reported_user_id: uid(9), status: "resolved" }],
      purchase_requests: [{ student_id: uid(9), client_id: uid(8), status: "pending" }],
      transactions: [{ client_id: uid(1), student_id: uid(9), status: "completed" }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ supprimes: 1, ignores: 0 })
  })

  it("reporte le compte quand une lecture échoue (fail-closed)", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    db.fail.set("wallets.select", "XX")
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ ignores: 1, supprimes: 0 })
    expect(db.writes).toEqual([])
  })

  it("un compte reporté ne retient pas les autres", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 30), closedProfile(2, 20)],
      wallets: [{ user_id: uid(1), balance: 10, reserved: 0 }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ ignores: 1, supprimes: 1 })
    expect(db.tables.profiles.find((p) => p.user_id === uid(2)).full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })
})

describe("pseudonymizeClosedAccounts : interruption et reprise", () => {
  const steps = [
    ["notifications.delete", "notifications"],
    ["applications.delete", "applications"],
    ["storage", "storage"],
    ["auth", "auth"],
    ["student_profiles.update", "student_profiles"],
    ["account_closure_events.insert", "events"],
  ]
  const seed = () => ({
    profiles: [closedProfile(1, 20)],
    student_profiles: [{ user_id: uid(1), school: "S", card_url: `${uid(1)}/card.jpg`, skills: ["x"] }],
    notifications: [{ recipient_id: uid(1) }],
    applications: [{ student_id: uid(1), status: "pending" }],
  })

  for (const [key, label] of steps) {
    it(`reprend après un échec à l'étape ${label} : état final identique, un seul événement`, async () => {
      const clean = makeDb(seed())
      await pseudonymizeClosedAccounts(clean.service, real)

      const db = makeDb(seed())
      db.fail.set(key, "XX")
      const first = await pseudonymizeClosedAccounts(db.service, real)
      expect(counters(first)).toMatchObject({ erreurs: 1, supprimes: 0 })
      // profiles n'a pas reçu son patch final : le compte reste à reprendre.
      expect(db.tables.profiles[0].full_name).toBe("Nom 1")
      expect(db.tables.profiles[0].pseudonymized_at).not.toBeNull()

      db.fail.delete(key)
      const second = await pseudonymizeClosedAccounts(db.service, { now: new Date(NOW.getTime() + DAY), mode: "real" })
      expect(counters(second)).toMatchObject({ erreurs: 0, supprimes: 1 })
      expect(db.tables.profiles[0]).toMatchObject({ full_name: CLOSED_ACCOUNT_LABEL, avatar_url: null })
      expect(db.tables.profiles[0].pseudonymized_at).toBe(NOW.toISOString())
      expect(db.tables.student_profiles).toEqual(clean.tables.student_profiles)
      expect(db.tables.notifications).toEqual([])
      expect(db.tables.applications).toEqual([])
      expect(db.tables.account_closure_events).toHaveLength(1)
      expect(db.deleteUser).not.toHaveBeenCalled()

      const third = await pseudonymizeClosedAccounts(db.service, real)
      expect(counters(third)).toMatchObject({ candidats: 0, supprimes: 0 })
    })
  }

  it("un événement déjà écrit (conflit d'unicité) n'est pas une erreur", async () => {
    const db = makeDb({
      ...seed(),
      account_closure_events: [{ user_id: uid(1), event: "pseudonymized" }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ erreurs: 0, supprimes: 1 })
    expect(db.tables.account_closure_events).toHaveLength(1)
  })

  it("une reprise ne réévalue pas les blocages et ne revendique pas de nouveau", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20, { pseudonymized_at: iso(NOW.getTime() - DAY) })],
      wallets: [{ user_id: uid(1), balance: 50, reserved: 0 }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ supprimes: 1, ignores: 0 })
    expect(db.tables.profiles[0].pseudonymized_at).toBe(iso(NOW.getTime() - DAY))
    expect(db.tables.profiles[0].full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })

  it("une reprise ne réévalue pas les missions, mais revérifie les signalements ouverts", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20, { pseudonymized_at: iso(NOW.getTime() - DAY) })],
      missions: [{ client_id: uid(1), selected_student_id: null, status: "open" }],
      reports: [{ reporter_id: uid(9), reported_user_id: uid(1), status: "open" }],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ ignores: 1, supprimes: 0, erreurs: 0 })
    expect(db.writes).toEqual([])
    expect(db.tables.profiles[0].full_name).toBe("Nom 1")
    db.tables.reports[0].status = "resolved"
    const again = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(again)).toMatchObject({ supprimes: 1, ignores: 0 })
    expect(db.tables.profiles[0].full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })

  it("un signalement ouvert après la revendication suspend l'effacement et laisse le compte en reprise", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      student_profiles: [{ user_id: uid(1), card_url: `${uid(1)}/card.jpg`, skills: ["x"] }],
      notifications: [{ recipient_id: uid(1) }],
    })
    db.hooks.beforeWrite = ({ table, op, rows }) => {
      if (table === "profiles" && op === "update" && rows.reports.length === 0) {
        rows.reports.push({ reporter_id: uid(9), reported_user_id: uid(1), status: "open" })
      }
    }
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ ignores: 1, supprimes: 0, erreurs: 0 })
    expect(db.tables.profiles[0].pseudonymized_at).toBe(NOW.toISOString())
    expect(db.tables.profiles[0].full_name).toBe("Nom 1")
    expect(db.writes.filter((w) => w.op === "delete")).toEqual([])
    expect(db.removed).toEqual([])
    expect(db.updateUserById).not.toHaveBeenCalled()
    expect(db.tables.notifications).toHaveLength(1)

    db.tables.reports[0].status = "resolved"
    const again = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(again)).toMatchObject({ supprimes: 1, ignores: 0 })
    expect(db.tables.profiles[0].full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })

  it("compte une erreur et n'efface rien si la relecture des signalements échoue", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20, { pseudonymized_at: iso(NOW.getTime() - DAY) })] })
    db.fail.set("reports.select", "XX")
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ erreurs: 1, supprimes: 0 })
    expect(db.writes).toEqual([])
  })

  it("une reprise est examinée même en simulation sans écrire", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20, { pseudonymized_at: iso(NOW.getTime() - DAY) })] })
    const r = await pseudonymizeClosedAccounts(db.service, { now: NOW, mode: "dry" })
    expect(counters(r)).toMatchObject({ candidats: 1, examines: 1 })
    expect(db.writes).toEqual([])
  })
})

describe("pseudonymizeClosedAccounts : coupe-circuit, lot et échéance", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => closedProfile(i + 1, 20 + i))

  it("au plus ACCOUNT_BREAKER nouveaux candidats : traités", async () => {
    const db = makeDb({ profiles: many(ACCOUNT_BREAKER) })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(r.stops).toEqual([])
    expect(counters(r).supprimes).toBe(ACCOUNT_BREAKER)
  })

  it("au-delà : aucune nouvelle revendication, arrêt breaker", async () => {
    const db = makeDb({ profiles: many(ACCOUNT_BREAKER + 1) })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(r.stops).toEqual(["breaker"])
    expect(counters(r)).toMatchObject({ candidats: ACCOUNT_BREAKER + 1, supprimes: 0 })
    expect(db.writes).toEqual([])
  })

  it("poursuit les reprises malgré le coupe-circuit", async () => {
    const db = makeDb({
      profiles: [...many(ACCOUNT_BREAKER + 1), closedProfile(99, 40, { pseudonymized_at: iso(NOW.getTime() - DAY) })],
    })
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(r.stops).toEqual(["breaker"])
    expect(counters(r).supprimes).toBe(1)
    expect(db.tables.profiles.find((p) => p.user_id === uid(99)).full_name).toBe(CLOSED_ACCOUNT_LABEL)
  })

  it("allowMass lève le coupe-circuit, dans la limite du lot", async () => {
    const db = makeDb({ profiles: many(ACCOUNT_BATCH + 5) })
    const r = await pseudonymizeClosedAccounts(db.service, { ...real, allowMass: true })
    expect(r.stops).toEqual([])
    expect(counters(r)).toMatchObject({ candidats: ACCOUNT_BATCH + 5, examines: ACCOUNT_BATCH, supprimes: ACCOUNT_BATCH })
    expect(db.tables.profiles.filter((p) => p.pseudonymized_at === null)).toHaveLength(5)
  })

  it("respecte l'échéance entre deux comptes", async () => {
    const db = makeDb({ profiles: many(3) })
    let time = 0
    const clock = vi.spyOn(Date, "now").mockImplementation(() => time)
    // Le temps dépasse l'échéance une fois le premier compte terminé.
    db.hooks.beforeWrite = ({ table, payload }) => {
      if (table === "profiles" && payload && "full_name" in payload) time = 10_000
    }
    const r = await pseudonymizeClosedAccounts(db.service, { ...real, deadline: 5_000 })
    clock.mockRestore()
    expect(r.stops).toEqual(["deadline"])
    expect(counters(r).supprimes).toBe(1)
    expect(db.tables.profiles.filter((p) => p.pseudonymized_at === null)).toHaveLength(2)
  })

  it("une échéance atteinte pendant la suppression des fichiers laisse le compte en reprise", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    const clock = vi.spyOn(Date, "now")
    // 1er appel : contrôle entre comptes ; suivants : dépassement dans removePaths.
    clock.mockReturnValueOnce(0).mockReturnValue(10_000)
    const r = await pseudonymizeClosedAccounts(db.service, { ...real, deadline: 5_000 })
    clock.mockRestore()
    expect(r.stops).toEqual(["deadline"])
    expect(counters(r)).toMatchObject({ supprimes: 0, erreurs: 0 })
    expect(db.tables.profiles[0].full_name).toBe("Nom 1")
  })
})

describe("pseudonymizeClosedAccounts : robustesse et confidentialité", () => {
  it("date illisible : arrêt error sans lecture ni écriture", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    const r = await pseudonymizeClosedAccounts(db.service, { now: "pas une date", mode: "real" })
    expect(r.stops).toEqual(["error"])
    expect(db.writes).toEqual([])
  })

  it("lecture des candidats en échec : erreur, rien d'écrit", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    db.fail.set("profiles.select", "XX")
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r).erreurs).toBe(1)
    expect(r.stops).toEqual(["error"])
    expect(db.writes).toEqual([])
  })

  it("un échec d'écriture de la revendication est compté sans effacement", async () => {
    const db = makeDb({ profiles: [closedProfile(1, 20)] })
    db.fail.set("profiles.update", "XX")
    const r = await pseudonymizeClosedAccounts(db.service, real)
    expect(counters(r)).toMatchObject({ erreurs: 1, supprimes: 0 })
    expect(db.updateUserById).not.toHaveBeenCalled()
  })

  it("le résultat et les journaux ne contiennent aucun identifiant", async () => {
    const db = makeDb({
      profiles: [closedProfile(1, 20)],
      student_profiles: [{ user_id: uid(1), card_url: `${uid(1)}/c.jpg` }],
    })
    db.fail.set("auth", "XX")
    const first = await pseudonymizeClosedAccounts(db.service, real)
    db.fail.delete("auth")
    const second = await pseudonymizeClosedAccounts(db.service, real)
    for (const r of [first, second]) {
      expect(JSON.stringify(r)).not.toContain(uid(1))
      const summary = { mode: "real", duree_ms: 0, categories: r.categories, stops: {} }
      expect(summaryHasNoIdentifiers(summary)).toBe(true)
    }
    const logged = JSON.stringify([...errorSpy.mock.calls, ...logSpy.mock.calls])
    expect(logged).not.toContain(uid(1))
  })
})
