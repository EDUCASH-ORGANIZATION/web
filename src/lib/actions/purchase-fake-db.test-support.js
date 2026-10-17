// Base en mémoire pour les tests des demandes de paiement d'achats (RD-ACHATS-01 ST-04). Fichier de SUPPORT de test :
// il n'est jamais importé par du code applicatif et n'est pas exécuté seul par Vitest (son nom ne finit pas par
// `.test.js`). Il imite la partie de l'API Supabase utilisée par les actions : filtres eq, in, gte, like, tri, limite,
// insert, update conditionnel, maybeSingle, single, ainsi que quelques contraintes (clé primaire, unicité de
// (mission, seq), unicité d'un signalement par partie) et le stockage (list, createSignedUrls).

export const IDS = {
  client: "00000000-0000-4000-8000-000000000001",
  otherClient: "00000000-0000-4000-8000-000000000002",
  student: "22222222-2222-4222-8222-222222222221",
  otherStudent: "22222222-2222-4222-8222-222222222222",
  admin: "99999999-9999-4999-8999-999999999999",
  mission: "11111111-1111-4111-8111-111111111111",
  otherMission: "11111111-1111-4111-8111-111111111112",
  request: "33333333-3333-4333-8333-333333333331",
  request2: "33333333-3333-4333-8333-333333333332",
  foreignRequest: "33333333-3333-4333-8333-333333333339",
}

export const SUPABASE_URL = "https://proj.supabase.co"
export const TOKEN = "a1b2c3d4e5"

/** Chemin de preuve conforme : <déposant>/<demande>/<nature>-<jeton>.<extension>. */
export const proof = (owner, request, kind, token = TOKEN, ext = "jpg") => `${owner}/${request}/${kind}-${token}.${ext}`

let counter = 0
const nextUuid = () => {
  counter += 1
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(counter).padStart(12, "0")}`
}

const UNIQUE = {
  purchase_requests: [["id"], ["mission_id", "seq"]],
  reports: [["purchase_request_id", "reporter_id"]],
  messages: [["id"]],
}

function like(value, pattern) {
  if (typeof value !== "string") return false
  const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")
  return new RegExp(`^${source}$`).test(value)
}

/**
 * @param {Partial<Record<string, object[]>>} [seed]
 */
export function createFakeDb(seed = {}) {
  const tables = {
    missions: [],
    profiles: [],
    purchase_requests: [],
    messages: [],
    reports: [],
    ...seed,
  }
  const state = {
    tables,
    /** Écritures du client service role : { table, op, row|patch }. */
    writes: [],
    /** Lectures du client de SESSION, par table. */
    sessionReads: [],
    /** Nombre de clients service role créés. */
    servicesCreated: 0,
    /** Fautes injectées : "table.op" -> erreur, ou fonction (rows) -> erreur|null. */
    faults: {},
    /** Rappel après chaque insertion, pour simuler une course : (table, row) -> void. */
    onInsert: null,
    /** Objets du compartiment des preuves. */
    objects: new Set(),
    /** TTL passés à createSignedUrls. */
    signedTtl: [],
    storageFault: null,
    reportNumber: 0,
  }

  function fault(table, op) {
    const f = state.faults[`${table}.${op}`]
    if (!f) return null
    return typeof f === "function" ? f() : f
  }

  function builder(table, { readonly, visible }) {
    const q = { op: "select", filters: [], patch: null, rows: null, order: null, limit: null, selected: false }
    const matchRows = () => tables[table].filter((r) => (visible ? visible(r) : true) && q.filters.every((f) => f(r)))

    const run = (mode) => {
      const injected = fault(table, q.op)
      if (injected) return { data: null, error: injected }
      if (q.op === "select") {
        if (readonly) state.sessionReads.push(table)
        let rows = matchRows().map((r) => ({ ...r }))
        if (q.order) {
          const { column, ascending } = q.order
          rows = rows.sort((a, b) => (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1))
        }
        if (q.limit !== null) rows = rows.slice(0, q.limit)
        if (mode === "maybeSingle") return { data: rows[0] ?? null, error: null }
        if (mode === "single") return rows[0] ? { data: rows[0], error: null } : { data: null, error: { code: "PGRST116" } }
        return { data: rows, error: null }
      }
      if (q.op === "insert") {
        const inserted = []
        for (const input of q.rows) {
          const row = { ...input }
          if (table === "purchase_requests") {
            row.status ??= "pending"
            row.version ??= 1
            row.beneficiary_confirmed ??= false
          }
          if (!row.id) row.id = nextUuid()
          row.created_at ??= new Date().toISOString()
          if (table === "reports") {
            state.reportNumber += 1
            row.number = state.reportNumber
            row.status ??= "open"
          }
          for (const key of UNIQUE[table] ?? []) {
            if (key.some((c) => row[c] === undefined || row[c] === null)) continue
            if (tables[table].some((r) => key.every((c) => r[c] === row[c]))) {
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
            }
          }
          tables[table].push(row)
          inserted.push({ ...row })
          state.writes.push({ table, op: "insert", row: { ...row } })
          state.onInsert?.(table, row)
        }
        if (!q.selected) return { data: null, error: null }
        return { data: mode === "single" ? inserted[0] : inserted, error: null }
      }
      const matched = matchRows()
      for (const row of matched) Object.assign(row, q.patch)
      state.writes.push({ table, op: "update", patch: { ...q.patch }, count: matched.length })
      return { data: q.selected ? matched.map((r) => ({ ...r })) : null, error: null }
    }

    const b = {
      select() {
        q.selected = true
        return b
      },
      insert(rows) {
        if (readonly) throw new Error(`le client de session ne doit pas écrire dans ${table}`)
        q.op = "insert"
        q.rows = Array.isArray(rows) ? rows : [rows]
        return b
      },
      update(patch) {
        if (readonly) throw new Error(`le client de session ne doit pas écrire dans ${table}`)
        q.op = "update"
        q.patch = patch
        return b
      },
      eq(column, value) {
        q.filters.push((r) => r[column] === value)
        return b
      },
      in(column, values) {
        q.filters.push((r) => values.includes(r[column]))
        return b
      },
      gte(column, value) {
        q.filters.push((r) => r[column] >= value)
        return b
      },
      like(column, pattern) {
        q.filters.push((r) => like(r[column], pattern))
        return b
      },
      order(column, { ascending = true } = {}) {
        q.order = { column, ascending }
        return b
      },
      limit(n) {
        q.limit = n
        return b
      },
      maybeSingle: async () => run("maybeSingle"),
      single: async () => run("single"),
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  function storage() {
    return {
      from: (bucket) => {
        if (bucket !== "purchase-proofs") throw new Error(`compartiment inattendu ${bucket}`)
        return {
          list: async (folder, { search = "", limit = 100 } = {}) => {
            if (state.storageFault) return { data: null, error: state.storageFault }
            const names = [...state.objects]
              .filter((p) => p.startsWith(`${folder}/`) && !p.slice(folder.length + 1).includes("/"))
              .map((p) => ({ name: p.slice(folder.length + 1) }))
              .filter((o) => o.name.includes(search))
            return { data: names.slice(0, limit), error: null }
          },
          createSignedUrls: async (paths, ttl) => {
            state.signedTtl.push(ttl)
            if (state.storageFault) return { data: null, error: state.storageFault }
            return {
              data: paths.map((path) => ({
                path,
                error: null,
                signedUrl: `${SUPABASE_URL}/storage/v1/object/sign/purchase-proofs/${path}?token=t`,
              })),
              error: null,
            }
          },
        }
      },
    }
  }

  /** Client service role : lit et écrit sans restriction. */
  function service() {
    state.servicesCreated += 1
    return { from: (table) => builder(table, { readonly: false }), storage: storage() }
  }

  /** Client de session de `userId` : lecture des missions seulement (RLS imitée), aucune écriture. */
  function session(userId) {
    return {
      from: (table) => {
        if (table !== "missions") throw new Error(`le client de session ne doit pas lire ${table}`)
        return builder(table, {
          readonly: true,
          visible: (r) => r.client_id === userId || r.selected_student_id === userId || r.status === "open",
        })
      },
    }
  }

  return Object.assign(state, { service, session })
}

/** Mission en cours avec achats, client IDS.client, étudiant retenu IDS.student. */
export function missionRow(overrides = {}) {
  return {
    id: IDS.mission,
    title: "Courses au marché",
    status: "in_progress",
    client_id: IDS.client,
    selected_student_id: IDS.student,
    purchases_estimate: 20000,
    ...overrides,
  }
}

/** Demande en attente valide pour la mission par défaut. */
export function requestRow(overrides = {}) {
  const id = overrides.id ?? IDS.request
  return {
    id,
    mission_id: IDS.mission,
    seq: 1,
    student_id: IDS.student,
    client_id: IDS.client,
    status: "pending",
    payee_kind: "merchant",
    payee_number: "123456",
    payee_photo_path: proof(IDS.student, id, "payee"),
    ticket_photo_path: proof(IDS.student, id, "ticket"),
    vendor_name: "Poissonnerie Dossa",
    items: "Poisson",
    amount: 6000,
    version: 1,
    paid_at: null,
    sms_photo_path: null,
    paid_reference: null,
    beneficiary_confirmed: false,
    received_at: null,
    cancelled_at: null,
    reported_at: null,
    created_at: "2026-01-01T08:00:00.000Z",
    edited_at: null,
    ...overrides,
  }
}
