// Faux client Supabase en mémoire pour la QA de la vague 4 : filtres eq / in / gte / or(and(eq)) évalués pour de bon,
// journal de chaque requête (table, filtres, expressions or), plages, comptes `head`, insertions et mises à jour.
// Les erreurs et les retards se règlent par `ctx.failures["table.op"]` et `ctx.delay`.

export function splitTop(text) {
  const parts = []
  let depth = 0
  let current = ""
  for (const c of text) {
    if (c === "(") depth += 1
    if (c === ")") depth -= 1
    if (c === "," && depth === 0) {
      parts.push(current)
      current = ""
    } else current += c
  }
  if (current) parts.push(current)
  return parts
}

function matchCondition(row, cond) {
  if (cond.startsWith("and(")) return splitTop(cond.slice(4, -1)).every((c) => matchCondition(row, c))
  const [col, op, ...rest] = cond.split(".")
  if (op !== "eq") throw new Error(`opérateur non géré : ${cond}`)
  return String(row[col]) === rest.join(".")
}

/** @param {{ db: Record<string, object[]>, log: object[], failures: Record<string, any>, user?: object|null, origin?: string, delay?: () => Promise<void> }} ctx */
export function makeFakeSupabase(ctx) {
  return {
    auth: {
      getUser: async () => ({ data: { user: ctx.user ?? null }, error: ctx.user ? null : new Error("no session") }),
    },
    rpc: async (name, params) => {
      ctx.log.push({ table: `rpc:${name}`, op: "rpc", filters: [], ors: [], params })
      if (ctx.delay) await ctx.delay()
      return ctx.rpc ? ctx.rpc(name, params) : { data: { success: true }, error: null }
    },
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({ data: { publicUrl: `${ctx.origin}/storage/v1/object/public/${bucket}/${path}` } }),
        createSignedUrls: async (paths, ttl) => {
          ctx.log.push({ table: `storage:${bucket}`, op: "createSignedUrls", filters: [], ors: [], paths, ttl })
          if (ctx.failures["storage.createSignedUrls"]) return { data: null, error: { message: "signature impossible" } }
          return {
            data: paths.map((path) => ({ path, error: null, signedUrl: `${ctx.origin}/storage/v1/object/sign/${bucket}/${path}?token=t-${ttl}` })),
            error: null,
          }
        },
      }),
    },
    from: (table) => {
      const q = { table, op: "select", columns: null, filters: [], ors: [], payload: null, head: false, limit: null, range: null }
      ctx.log.push(q)
      const matches = () =>
        (ctx.db[table] ?? []).filter((row) => {
          for (const [kind, col, value] of q.filters) {
            if (kind === "eq" && row[col] !== value) return false
            if (kind === "in" && !value.includes(row[col])) return false
            if (kind === "gte" && !(row[col] >= value)) return false
          }
          return q.ors.every((expr) => splitTop(expr).some((cond) => matchCondition(row, cond)))
        })
      const run = async (single) => {
        if (ctx.delay) await ctx.delay()
        const failure = ctx.failures[`${table}.${q.op}`]
        if (failure) return { data: null, error: typeof failure === "string" ? { message: failure } : failure, count: null }
        if (q.op === "delete") {
          const doomed = matches()
          ctx.db[table] = (ctx.db[table] ?? []).filter((r) => !doomed.includes(r))
          return { data: null, error: null }
        }
        if (q.op === "insert") {
          const list = ctx.db[table] ?? []
          const keys = ctx.unique?.[table]
          if (keys && list.some((r) => keys.every((k) => r[k] === q.payload[k]))) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
          }
          const row = { id: `new-${list.length + 1}`, created_at: new Date().toISOString(), ...q.payload }
          ctx.db[table] = [...list, row]
          return { data: row, error: null }
        }
        if (q.op === "update") {
          matches().forEach((r) => Object.assign(r, q.payload))
          return { data: null, error: null }
        }
        const rows = matches()
        if (q.head) return { data: null, error: null, count: rows.length }
        let data = rows
        if (q.range) data = rows.slice(q.range[0], q.range[1] + 1)
        else if (q.limit) data = rows.slice(0, q.limit)
        return { data: single ? (data[0] ?? null) : data, error: null }
      }
      const b = {
        select: (columns, opts) => {
          q.columns = columns
          if (opts?.head) q.head = true
          return b
        },
        insert: (payload) => ((q.op = "insert"), (q.payload = payload), b),
        delete: () => ((q.op = "delete"), b),
        update: (payload) => ((q.op = "update"), (q.payload = payload), b),
        eq: (c, v) => (q.filters.push(["eq", c, v]), b),
        in: (c, v) => (q.filters.push(["in", c, v]), b),
        gte: (c, v) => (q.filters.push(["gte", c, v]), b),
        or: (expr) => (q.ors.push(expr), b),
        order: () => b,
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
