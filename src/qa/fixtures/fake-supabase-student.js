// Faux client Supabase en mémoire pour la QA de la vague 1 étudiant. Contrairement à fake-supabase.js, il évalue
// pour de vrai eq / in / gte / lte / ilike / or (is.null, gte, eq, and) / order / range / head / count, applique la
// projection des colonnes demandées (une colonne non listée n'est jamais renvoyée) et le plafond PostgREST de 1000 lignes.
// Une page au-delà du dernier résultat répond PGRST103 comme PostgREST, seulement quand `count` est demandé (sinon liste vide). Journal de chaque requête dans `ctx.log`.

export const MAX_ROWS = 1000

function splitTop(text) {
  const parts = []
  let depth = 0
  let cur = ""
  for (const c of text) {
    if (c === "(") depth += 1
    if (c === ")") depth -= 1
    if (c === "," && depth === 0) {
      parts.push(cur)
      cur = ""
    } else cur += c
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

// ilike à la PostgREST : \x échappe x, % = tout, _ = un caractère. `*` n'est pas interprété ici (voir CONSTAT du rapport).
export function ilikeMatches(value, pattern) {
  if (value == null) return false
  let re = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "\\") {
      i += 1
      re += (pattern[i] ?? "\\").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    } else if (c === "%") re += ".*"
    else if (c === "_") re += "."
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${re}$`, "is").test(String(value))
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

/** @param {{ db: Record<string, object[]>, log: object[], failures?: Record<string, any>, user?: object|null }} ctx */
export function makeStudentFake(ctx) {
  return {
    auth: {
      getUser: async () => ({ data: { user: ctx.user ?? null }, error: ctx.user ? null : new Error("no session") }),
    },
    from: (table) => {
      const q = { table, op: "select", columns: null, filters: [], ors: [], orders: [], head: false, count: null, range: null, limit: null }
      ctx.log.push(q)
      const matching = () =>
        (ctx.db[table] ?? []).filter((row) => {
          for (const [kind, col, value] of q.filters) {
            if (kind === "eq" && row[col] !== value) return false
            if (kind === "in" && !value.includes(row[col])) return false
            if (kind === "gte" && !(row[col] != null && cmp(row[col], value) >= 0)) return false
            if (kind === "lte" && !(row[col] != null && cmp(row[col], value) <= 0)) return false
            if (kind === "ilike" && !ilikeMatches(row[col], value)) return false
          }
          return q.ors.every((expr) => splitTop(expr).some((c) => cond(row, c)))
        })
      const project = (row) => {
        if (!q.columns || q.columns.trim() === "*") return { ...row }
        const out = {}
        for (const c of q.columns.split(",").map((s) => s.trim())) out[c] = row[c]
        return out
      }
      const run = async (single) => {
        const failure = typeof ctx.failures?.[table] === "function" ? ctx.failures[table](q) : ctx.failures?.[table]
        if (failure) return { data: null, error: typeof failure === "string" ? { message: failure } : failure, count: null }
        let rows = matching()
        for (const [col, asc] of [...q.orders].reverse()) rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]))
        const total = rows.length
        if (q.head) return { data: null, error: null, count: total }
        let data = rows
        if (q.range) {
          if (q.count && q.range[0] > 0 && q.range[0] >= total) {
            return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null }
          }
          data = rows.slice(q.range[0], Math.min(q.range[1] + 1, q.range[0] + MAX_ROWS))
        } else data = rows.slice(0, q.limit ?? MAX_ROWS)
        data = data.map(project)
        return { data: single ? (data[0] ?? null) : data, error: null, count: q.count ? total : null }
      }
      const b = {
        select: (columns, opts) => {
          q.columns = columns
          if (opts?.head) q.head = true
          if (opts?.count) q.count = opts.count
          return b
        },
        eq: (c, v) => (q.filters.push(["eq", c, v]), b),
        in: (c, v) => (q.filters.push(["in", c, v]), b),
        gte: (c, v) => (q.filters.push(["gte", c, v]), b),
        lte: (c, v) => (q.filters.push(["lte", c, v]), b),
        ilike: (c, v) => (q.filters.push(["ilike", c, v]), b),
        or: (expr) => (q.ors.push(expr), b),
        order: (c, o) => (q.orders.push([c, o?.ascending !== false]), b),
        limit: (n) => ((q.limit = n), b),
        range: (a, z) => ((q.range = [a, z]), b),
        maybeSingle: () => run(true),
        single: () => run(true),
        then: (ok, ko) => run(false).then(ok, ko),
      }
      return b
    },
  }
}
