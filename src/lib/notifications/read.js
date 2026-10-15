import { isUuid } from "@/lib/vitrine/ids"

// Lecture et marquage des notifications (RD-NOTIF-01). Toujours le client de SESSION (la RLS est le second
// verrou) ET un filtre explicite `recipient_id = userId`. Colonnes listées : jamais `select("*")`, jamais
// `dedupe_key`. Table absente (script SQL pas encore appliqué) : `{ unavailable: true }`, jamais d'exception.

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 50

const COLUMNS = "id, type, title, body, mission_id, actor_id, read_at, created_at"
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"])
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

function isMissingTable(error) {
  return Boolean(error) && MISSING_TABLE_CODES.has(error.code)
}

/** Limite bornée entre 1 et PAGE_SIZE_MAX (défaut 20). */
export function boundedPageSize(limit) {
  const n = Math.trunc(Number(limit))
  if (!Number.isFinite(n) || n < 1) return PAGE_SIZE_DEFAULT
  return Math.min(n, PAGE_SIZE_MAX)
}

/** Curseur opaque : horodatage et identifiant de la dernière ligne vue. */
export function encodeCursor(row) {
  return Buffer.from(`${row.created_at}|${row.id}`, "utf8").toString("base64url")
}

/** @returns {{ createdAt: string, id: string } | null} null si le curseur est absent ou invalide (page 1). */
export function decodeCursor(cursor) {
  if (typeof cursor !== "string" || cursor === "" || cursor.length > 200) return null
  try {
    const [createdAt, id, ...rest] = Buffer.from(cursor, "base64url").toString("utf8").split("|")
    if (rest.length > 0 || !TIMESTAMP_RE.test(createdAt ?? "") || !isUuid(id)) return null
    if (Number.isNaN(new Date(createdAt).getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

/**
 * @param {any} supabase client de session
 * @param {string} userId
 * @param {{ filter?: "all"|"unread", cursor?: string, limit?: number }} [options]
 * @returns {Promise<{ items: any[], nextCursor: string|null } | { unavailable: true } | { error: true }>}
 */
export async function listNotifications(supabase, userId, { filter = "all", cursor, limit } = {}) {
  const size = boundedPageSize(limit)
  let query = supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1)
  if (filter === "unread") query = query.is("read_at", null)
  const decoded = decodeCursor(cursor)
  if (decoded) {
    query = query.or(`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`)
  }

  const { data, error } = await query
  if (isMissingTable(error)) return { unavailable: true }
  if (error) {
    console.error("[notifications] lecture", error.code ?? "erreur")
    return { error: true }
  }
  const rows = data ?? []
  const items = rows.slice(0, size)
  return { items, nextCursor: rows.length > size ? encodeCursor(items[items.length - 1]) : null }
}

/** @returns {Promise<{ count: number } | { unavailable: true } | { error: true }>} */
export async function countUnread(supabase, userId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null)
  if (isMissingTable(error)) return { unavailable: true }
  if (error) {
    console.error("[notifications] compteur", error.code ?? "erreur")
    return { error: true }
  }
  return { count: count ?? 0 }
}

/**
 * Marque une notification comme lue. Zéro ligne touchée (notification d'un autre, inexistante, déjà lue) =
 * même succès silencieux : aucune distinction observable. Un identifiant non uuid ne fait aucune requête.
 * @returns {Promise<{ ok: true } | { unavailable: true } | { error: true }>}
 */
export async function markRead(supabase, userId, id) {
  if (!isUuid(id)) return { ok: true }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", userId)
    .is("read_at", null)
  if (isMissingTable(error)) return { unavailable: true }
  if (error) {
    console.error("[notifications] marquage", error.code ?? "erreur")
    return { error: true }
  }
  return { ok: true }
}

/** @returns {Promise<{ ok: true } | { unavailable: true } | { error: true }>} */
export async function markAllRead(supabase, userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null)
  if (isMissingTable(error)) return { unavailable: true }
  if (error) {
    console.error("[notifications] marquage de toutes", error.code ?? "erreur")
    return { error: true }
  }
  return { ok: true }
}
