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
  if (typeof value !== "string" || value.trim() === "") return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  if (time > Date.now() + FUTURE_TOLERANCE_MS) return null
  return value
}

/**
 * Lit accepted_at des candidatures demandées, par lots de 100.
 * @param {any} supabase client de l'appelant (la RLS limite les lignes visibles)
 * @param {string[]} applicationIds identifiants de candidatures (les valeurs non uuid sont ignorées)
 * @returns {Promise<{ available: boolean, byId: Map<string, string|null> }>}
 *   `available: false` quand la colonne n'existe pas encore ; `byId` est alors vide.
 *   Une ligne absente de la réponse (RLS, suppression) est absente de `byId` : l'appelant teste
 *   `available && byId.has(id)`. La valeur est la chaîne brute, à passer par `validAcceptedAt`.
 *   Toute autre erreur est levée.
 */
export async function readAcceptedAt(supabase, applicationIds) {
  const ids = [...new Set((Array.isArray(applicationIds) ? applicationIds : []).filter(isUuid))]
  const byId = new Map()
  if (ids.length === 0) return { available: true, byId }

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase.from("applications").select("id, accepted_at").in("id", batch)
    if (isMissingAcceptedColumn(error)) {
      console.error("[accepted] colonne accepted_at absente", error.code)
      return { available: false, byId: new Map() }
    }
    if (error) throw error
    for (const row of data ?? []) byId.set(row.id, row.accepted_at ?? null)
  }
  return { available: true, byId }
}
