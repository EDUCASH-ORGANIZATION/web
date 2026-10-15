// Contexte serveur des actions admin (RD-ADMIN-01). Module serveur sans "use server" : il est importé par les
// fichiers `admin-*.actions.js`, il n'expose aucune action appelable depuis le navigateur.
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { classifyDossier } from "@/lib/admin-space/verification-queue"

const ERR_CONFIG = "Le service est momentanément indisponible. Réessayez dans un instant."
const CARDS_BUCKET = "student-cards"

export const READ_PAGE_SIZE = 1000
// Borne de sécurité du comptage des dossiers : au-delà, la lecture s'arrête (le compte est alors un minimum).
export const MAX_CARD_ROWS = 20000
// Borne de sécurité des sommes paginées (200 pages de 1000 lignes).
export const MAX_SUM_ROWS = 200000

const FILTER_METHODS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "is", "in"])
const AUDIT_SECRET_KEY = /e-?mail|phone|^tel$|url|token|password|secret|card/i
const AUDIT_TEXT_MAX = 500

/**
 * Contrôle admin (`profiles.role`, jamais `user_metadata`) puis ouverture du client service role.
 * Le client n'est créé qu'après un contrôle réussi : refus pour un visiteur, un autre rôle, un compte suspendu
 * ou un profil introuvable.
 * @returns {Promise<{ admin: { userId: string, fullName: string }, service: import("@supabase/supabase-js").SupabaseClient, error?: undefined } | { error: string }>}
 */
export async function requireAdminService() {
  const auth = await requireRole(["admin"])
  if (auth.error) return { error: auth.error }
  try {
    const service = createServiceClient()
    return {
      admin: { userId: auth.user.id, fullName: auth.profile?.full_name ?? "" },
      service,
    }
  } catch (err) {
    console.error("[admin-context] client service indisponible:", err)
    return { error: ERR_CONFIG }
  }
}

function auditValue(value, depth = 0) {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return /^https?:\/\//i.test(value.trim()) ? "[url]" : value.slice(0, AUDIT_TEXT_MAX)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return depth > 2 ? "[liste]" : value.slice(0, 20).map((v) => auditValue(v, depth + 1))
  if (typeof value === "object") {
    if (depth > 2) return "[objet]"
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (!AUDIT_SECRET_KEY.test(key)) out[key] = auditValue(item, depth + 1)
    }
    return out
  }
  return null
}

/**
 * Journalise une décision admin : une ligne `[admin-audit]` en JSON. Aucune adresse e-mail, aucun téléphone,
 * aucune URL ni jeton : les clés sensibles sont retirées et les URL masquées.
 * @param {{ adminId: string, action: string, targetId?: string|null, before?: unknown, after?: unknown, reason?: string|null }} entry
 */
export function logAdminAction({ adminId, action, targetId = null, before = null, after = null, reason = null }) {
  console.info(
    "[admin-audit]",
    JSON.stringify({
      at: new Date().toISOString(),
      adminId,
      action,
      targetId,
      before: auditValue(before),
      after: auditValue(after),
      reason: typeof reason === "string" ? reason.slice(0, AUDIT_TEXT_MAX) : null,
    }),
  )
}

/**
 * Découpe une liste en paquets (les filtres `.in()` d'une URL PostgREST ont une taille limitée).
 * @template T
 * @param {T[]} ids
 * @param {number} [size]
 * @returns {T[][]}
 */
export function inChunks(ids, size = 100) {
  const step = Number.isInteger(size) && size > 0 ? size : 100
  const out = []
  for (let i = 0; i < (ids?.length ?? 0); i += step) out.push(ids.slice(i, i + step))
  return out
}

/**
 * URL signée de courte durée de la carte d'un étudiant. Seul un chemin du dossier de l'étudiant dans le bucket
 * des cartes est signé : jamais de repli sur la valeur brute.
 * @param {{ storage: { from: Function } }} service
 * @param {string} userId
 * @param {unknown} rawCardUrl
 * @param {number} [ttlSeconds]
 * @returns {Promise<{ kind: "image" | "pdf" | "none", url: string | null }>}
 */
export async function signStudentCard(service, userId, rawCardUrl, ttlSeconds = 300) {
  const none = { kind: "none", url: null }
  const path = toOwnedStoragePath(rawCardUrl, CARDS_BUCKET, userId)
  if (!path) return none
  const { data, error } = await service.storage.from(CARDS_BUCKET).createSignedUrl(path, ttlSeconds)
  if (error || !data?.signedUrl) return none
  return { kind: /\.pdf$/i.test(path) ? "pdf" : "image", url: data.signedUrl }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Début (heure du Bénin, UTC+1) du jour qui suit `day` ("AAAA-MM-JJ"), en ISO : seuil « déposée après l'échéance ». */
function dayAfterStartISO(day) {
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
  return `${next}T00:00:00+01:00`
}

/**
 * Nombre de dossiers « À examiner » : même règle que `classifyDossier`. Lit les étudiants ayant une carte, puis
 * leurs profils par paquets de 100. La date de dépôt (colonne privée) n'est jamais lue : pour un badge échu, elle
 * sert de filtre (`gte`) afin de savoir si la carte a été renvoyée après l'échéance. Lève une erreur si une
 * lecture échoue (l'appelant décide du repli).
 * @param {{ from: Function }} service
 * @param {string} today "AAAA-MM-JJ" (jour du Bénin)
 * @returns {Promise<number>}
 */
export async function countPendingVerifications(service, today) {
  let pending = 0
  for (let from = 0; from < MAX_CARD_ROWS; from += READ_PAGE_SIZE) {
    const { data: cards, error } = await service
      .from("student_profiles")
      .select("user_id")
      .not("card_url", "is", null)
      .order("user_id", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1)
    if (error) throw new Error("Lecture des cartes impossible.")
    const ids = (cards ?? []).map((row) => row.user_id)

    for (const chunk of inChunks(ids)) {
      const { data: profiles, error: profilesError } = await service
        .from("profiles")
        .select("user_id, verified_until")
        .in("user_id", chunk)
        .eq("role", "student")
        .eq("is_verified", false)
        .is("rejection_reason", null)
      if (profilesError) throw new Error("Lecture des profils impossible.")

      // Badge échu : à examiner seulement si la carte a été renvoyée après l'échéance (un filtre par date d'échéance).
      const expiredByDay = new Map()
      for (const profile of profiles ?? []) {
        const tab = classifyDossier({ isVerified: false, verifiedUntil: profile.verified_until, hasCard: true }, today)
        if (tab === "a-examiner") pending += 1
        else if (tab === "expires") {
          const day = String(profile.verified_until).trim().slice(0, 10)
          expiredByDay.set(day, [...(expiredByDay.get(day) ?? []), profile.user_id])
        }
      }
      for (const [day, expiredIds] of expiredByDay) {
        const { data: resent, error: resentError } = await service
          .from("profiles")
          .select("user_id")
          .in("user_id", expiredIds)
          .gte("verification_submitted_at", dayAfterStartISO(day))
        if (resentError) throw new Error("Lecture des profils impossible.")
        pending += (resent ?? []).length
      }
    }
    if (ids.length < READ_PAGE_SIZE) break
  }
  return pending
}

/**
 * Somme d'une colonne numérique sur toute la table, au-delà de la limite de 1000 lignes par requête.
 * @param {{ from: Function }} service
 * @param {string} table
 * @param {string} column
 * @param {Array<[string, ...unknown[]]>} [filters] ex. `[["eq", "type", "commission"], ["gte", "created_at", iso]]`
 * @param {{ orderBy?: string }} [options] colonne d'ordre stable (clé unique) : `id` par défaut
 * @returns {Promise<number>}
 */
export async function sumColumnPaged(service, table, column, filters = [], { orderBy = "id" } = {}) {
  for (const [method] of filters) {
    if (!FILTER_METHODS.has(method)) throw new Error("Condition de somme non autorisée.")
  }
  let total = 0
  for (let from = 0; from < MAX_SUM_ROWS; from += READ_PAGE_SIZE) {
    let query = service.from(table).select(column)
    for (const [method, ...args] of filters) query = query[method](...args)
    const { data, error } = await query.order(orderBy, { ascending: true }).range(from, from + READ_PAGE_SIZE - 1)
    if (error) throw new Error("Lecture des montants impossible.")
    const rows = data ?? []
    for (const row of rows) {
      const n = Number(row[column])
      if (Number.isFinite(n)) total += n
    }
    if (rows.length < READ_PAGE_SIZE) break
  }
  return total
}
