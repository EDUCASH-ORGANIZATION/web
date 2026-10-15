import "server-only"
import { isUuid } from "@/lib/vitrine/ids"

// Lecture tolérante de missions.completion_declared_at (RD-DONE-01, script 90).
// La colonne est lue dans une requête SÉPARÉE des lectures principales : tant que le script 90 n'est
// pas appliqué (42703, ou PGRST204 selon la couche), la page se rend sans état « à confirmer » et le
// bouton « J'ai terminé » reste masqué. Aucune écriture ici.

const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"])
const MAX_IDS = 200

/** @param {{ code?: string }|null|undefined} error */
export function isMissingCompletionColumn(error) {
  return Boolean(error) && MISSING_COLUMN_CODES.has(error.code)
}

/**
 * @param {any} supabase client (session ou service role, selon l'appelant)
 * @param {string[]} missionIds identifiants de missions (les valeurs non uuid sont ignorées)
 * @returns {Promise<{ available: boolean, byId: Map<string, string|null> }>}
 *   `available: false` quand la colonne n'existe pas encore ; `byId` est alors vide.
 *   Toute autre erreur est levée.
 */
export async function readCompletionDeclared(supabase, missionIds) {
  const ids = [...new Set((Array.isArray(missionIds) ? missionIds : []).filter(isUuid))].slice(0, MAX_IDS)
  const byId = new Map()
  if (ids.length === 0) return { available: true, byId }

  const { data, error } = await supabase.from("missions").select("id, completion_declared_at").in("id", ids)
  if (isMissingCompletionColumn(error)) {
    console.error("[completion] colonne completion_declared_at absente", error.code)
    return { available: false, byId }
  }
  if (error) throw error

  for (const row of data ?? []) byId.set(row.id, row.completion_declared_at ?? null)
  return { available: true, byId }
}
