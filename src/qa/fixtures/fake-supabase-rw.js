// Faux client Supabase en mémoire, lecture ET écriture, pour les tests d'abus de l'espace étudiant (RD-STUDENT-01).
// Évalue eq / neq / in / gte / lte / ilike / is / not / or (and(), eq, is, gte, lte) / order / range / limit / head / count,
// applique la projection des colonnes (une colonne non listée n'est jamais renvoyée), les jointures `missions(...)`,
// insert / update / delete / upsert, des contraintes d'unicité (code 23505) et un point de suspension asynchrone
// optionnel (ctx.yield) pour rejouer les envois simultanés. Journal des écritures dans `ctx.writes`.

let seq = 0

function splitTop(text) {
  const parts = []
  let depth = 0
  let cur = ""
  for (const c of text) {
    if (c === "(") depth += 1
    if (c === ")") depth -= 1
    if (c === "," && depth === 0) { parts.push(cur); cur = "" } else cur += c
  }
  if (cur) parts.push(cur)
  return parts
}

function cmp(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function cond(row, text) {
  if (text.startsWith("and(")) return splitTop(text.slice(4, -1)).every((c) => cond(row, c))
  const [col, op, ...rest] = text.split(".")
  const v = rest.join(".")
  if (op === "is") return v === "null" ? row[col] == null : String(row[col]) === v
  if (op === "eq") return String(row[col]) === v
  if (op === "gte") return row[col] != null && cmp(row[col], v) >= 0
  if (op === "lte") return row[col] != null && cmp(row[col], v) <= 0
  throw new Error(`condition or() non gérée : ${text}`)
}

export function ilikeMatches(value, pattern) {
  if (value == null) return false
  let re = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "\\") { i += 1; re += (pattern[i] ?? "\\").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
    else if (c === "%") re += ".*"
    else if (c === "_") re += "."
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${re}$`, "is").test(String(value))
}

const FK = { missions: "mission_id" }

/** @param {{ db: Record<string, object[]>, writes: object[], log: object[], user: object|null, unique?: Record<string, string[]>, yield?: boolean, failures?: Record<string, any> }} ctx */
export function makeRW(ctx) {
  ctx.log ??= []
  ctx.writes ??= []
  const project = (row, columns) => {
    if (!columns || columns.trim() === "*") return { ...row }
    const out = {}
    for (const part of splitTop(columns).map((s) => s.trim())) {
      const embed = part.match(/^(\w+)\((.*)\)$/)
      if (embed) {
        const [, table, inner] = embed
        const target = (ctx.db[table] ?? []).find((r) => r.id === row[FK[table]])
        out[table] = target ? project(target, inner) : null
      } else if (part === "*") Object.assign(out, row)
      else out[part] = row[part]
    }
    return out
  }
  return {
    auth: {
      getUser: async () => ({ data: { user: ctx.user ?? null }, error: ctx.user ? null : new Error("no session") }),
      getSession: async () => ({ data: { session: ctx.user ? { access_token: "tok" } : null } }),
      admin: { getUserById: async () => ({ data: { user: { email: "x@example.com" } }, error: null }) },
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
    from: (table) => {
      const q = { table, op: "select", columns: null, filters: [], ors: [], orders: [], head: false, count: null, range: null, limit: null, payload: null, returning: false }
      ctx.log.push(q)
      const matching = () =>
        (ctx.db[table] ?? []).filter((row) => {
          for (const [kind, col, value] of q.filters) {
            if (kind === "eq" && row[col] !== value) return false
            if (kind === "neq" && row[col] === value) return false
            if (kind === "in" && !value.includes(row[col])) return false
            if (kind === "gte" && !(row[col] != null && cmp(row[col], value) >= 0)) return false
            if (kind === "lte" && !(row[col] != null && cmp(row[col], value) <= 0)) return false
            if (kind === "ilike" && !ilikeMatches(row[col], value)) return false
            if (kind === "is" && (value === null ? row[col] != null : row[col] !== value)) return false
            if (kind === "notnull" && row[col] == null) return false
          }
          return q.ors.every((expr) => splitTop(expr).some((c) => cond(row, c)))
        })
      const run = async (single) => {
        if (ctx.yield) await new Promise((r) => setTimeout(r, 0))
        const failure = typeof ctx.failures?.[`${table}:${q.op}`] === "function" ? ctx.failures[`${table}:${q.op}`](q) : ctx.failures?.[`${table}:${q.op}`]
        if (failure) return { data: null, error: typeof failure === "string" ? { message: failure } : failure, count: null }
        if (q.op === "insert" || q.op === "upsert") {
          const list = Array.isArray(q.payload) ? q.payload : [q.payload]
          const inserted = []
          for (const p of list) {
            const row = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date().toISOString(), ...p }
            const key = ctx.unique?.[table]
            if (key && (ctx.db[table] ?? []).some((r) => key.every((k) => r[k] === row[k]))) {
              if (q.op === "upsert") { Object.assign((ctx.db[table]).find((r) => key.every((k) => r[k] === row[k])), p); continue }
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" }, count: null }
            }
            ctx.writes.push({ table, op: q.op, payload: p })
            ;(ctx.db[table] ??= []).push(row)
            inserted.push(row)
          }
          const data = inserted.map((r) => project(r, q.columns))
          return { data: q.returning ? (single ? (data[0] ?? null) : data) : null, error: null, count: null }
        }
        if (q.op === "update") {
          const rows = matching()
          ctx.writes.push({ table, op: "update", payload: q.payload, filters: q.filters, matched: rows.length })
          for (const r of rows) Object.assign(r, q.payload)
          return { data: null, error: null, count: null }
        }
        if (q.op === "delete") {
          const rows = matching()
          ctx.writes.push({ table, op: "delete", filters: q.filters, matched: rows.length })
          ctx.db[table] = (ctx.db[table] ?? []).filter((r) => !rows.includes(r))
          return { data: null, error: null, count: null }
        }
        let rows = matching()
        for (const [col, asc] of [...q.orders].reverse()) rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]))
        const total = rows.length
        if (q.head) return { data: null, error: null, count: total }
        let data
        if (q.range) {
          if (q.count && q.range[0] > 0 && q.range[0] >= total) return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null }
          data = rows.slice(q.range[0], Math.min(q.range[1] + 1, q.range[0] + 1000))
        } else data = rows.slice(0, q.limit ?? 1000)
        data = data.map((r) => project(r, q.columns))
        return { data: single ? (data[0] ?? null) : data, error: null, count: q.count ? total : null }
      }
      const b = {
        select: (columns, opts) => {
          if (q.op === "insert" || q.op === "upsert") q.returning = true
          q.columns = columns
          if (opts?.head) q.head = true
          if (opts?.count) q.count = opts.count
          return b
        },
        eq: (c, v) => (q.filters.push(["eq", c, v]), b),
        neq: (c, v) => (q.filters.push(["neq", c, v]), b),
        in: (c, v) => (q.filters.push(["in", c, v]), b),
        gte: (c, v) => (q.filters.push(["gte", c, v]), b),
        lte: (c, v) => (q.filters.push(["lte", c, v]), b),
        ilike: (c, v) => (q.filters.push(["ilike", c, v]), b),
        is: (c, v) => (q.filters.push(["is", c, v]), b),
        not: (c, op, v) => (q.filters.push([op === "is" && v === null ? "notnull" : "neverMatch", c, v]), b),
        or: (expr) => (q.ors.push(expr), b),
        order: (c, o) => (q.orders.push([c, o?.ascending !== false]), b),
        limit: (n) => ((q.limit = n), b),
        range: (a, z) => ((q.range = [a, z]), b),
        insert: (p) => ((q.op = "insert"), (q.payload = p), b),
        upsert: (p) => ((q.op = "upsert"), (q.payload = p), b),
        update: (p) => ((q.op = "update"), (q.payload = p), b),
        delete: () => ((q.op = "delete"), b),
        maybeSingle: () => run(true),
        single: () => run(true),
        then: (ok, ko) => run(false).then(ok, ko),
      }
      return b
    },
  }
}
