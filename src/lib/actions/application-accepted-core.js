import "server-only"
import { isUuid } from "@/lib/vitrine/ids"

// Lecture tolérante de applications.accepted_at (RD-ACCEPT-01, script 91).
// La colonne est lue dans une requête SÉPARÉE des lectures principales : tant que le script 91 n'est
// pas appliqué (42703, ou PGRST204 selon la couche), les pages se rendent sans date de rétention.
// Jamais de requête HEAD pour sonder la colonne (un HEAD ne remonte pas le code d'erreur
// Postgres) et jamais accepted_at ajouté à un select existant. Aucune écriture ici.

const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"])
const BATCH_SIZE = 100
// Tolérance d'horloge entre la base et le serveur applicatif.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
// Format ISO exigé avant Date.parse (qui accepte des formats libres, dont "1", "2026" ou "March 7").
const ISO_DATE_START = /^\d{4}-\d{2}-\d{2}T/

/** @param {{ code?: string }|null|undefined} error */
export function isMissingAcceptedColumn(error) {
  return Boolean(error) && MISSING_COLUMN_CODES.has(error.code)
}

/**
 * Renvoie la date si c'est une chaîne ISO valide qui n'est pas dans le futur (au-delà de quelques
 * minutes de tolérance), sinon null. Ne lève jamais.
 * @param {unknown} value
 * @returns {string|null}
 */
export function validAcceptedAt(value) {
  if (typeof value !== "string" || !ISO_DATE_START.test(value)) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  if (time > Date.now() + FUTURE_TOLERANCE_MS) return null
  return value
}

/**
 * Lit accepted_at des candidatures demandées, par lots de 100.
 * @param {any} supabase client de l'appelant (la RLS limite les lignes visibles)
 * @param {string[]} applicationIds identifiants de candidatures (les valeurs non uuid sont ignorées)
 * @param {{ studentId?: string }} [options] `studentId` : ajoute `.eq("student_id", studentId)` à la requête, en plus de la RLS
 * @returns {Promise<{ available: boolean, byId: Map<string, string|null> }>}
 *   `available: false` quand la colonne n'existe pas encore ; `byId` est alors vide.
 *   Une ligne absente de la réponse (RLS, suppression) est absente de `byId` : l'appelant teste
 *   `available && byId.has(id)`. La valeur est la chaîne brute, à passer par `validAcceptedAt`.
 *   Toute autre erreur est levée.
 */
export async function readAcceptedAt(supabase, applicationIds, { studentId } = {}) {
  const ids = [...new Set((Array.isArray(applicationIds) ? applicationIds : []).filter(isUuid))]
  const byId = new Map()
  if (ids.length === 0) return { available: true, byId }

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    let query = supabase.from("applications").select("id, accepted_at").in("id", batch)
    if (studentId) query = query.eq("student_id", studentId)
    const { data, error } = await query
    if (isMissingAcceptedColumn(error)) {
      console.error("[accepted] colonne accepted_at absente", error.code)
      return { available: false, byId: new Map() }
    }
    if (error) throw error
    for (const row of data ?? []) byId.set(row.id, row.accepted_at ?? null)
  }
  return { available: true, byId }
}
