// Écriture de `student_profiles.card_url` par la session de l'étudiant (RD-FIX-15). Module serveur sans "use server" :
// importé par `profile.actions.js` et `onboarding.actions.js`, il n'expose aucune action appelable depuis le navigateur.
//
// Pourquoi pas `upsert` : supabase-js le traduit en `INSERT ... ON CONFLICT (user_id) DO UPDATE SET card_url =
// EXCLUDED.card_url`. PostgreSQL exige le privilège SELECT sur toute colonne lue dans `EXCLUDED`, et depuis RD-SEC-02
// `authenticated` n'a plus SELECT sur `card_url` (colonne privée) : l'upsert échoue toujours en 42501
// « permission denied for table student_profiles ». Un UPDATE simple, filtré sur `user_id` et sans RETURNING de la
// carte, n'exige que UPDATE sur `card_url` et SELECT sur `user_id`, que la session possède. La garde SQL
// `student_profiles_card_guard` s'applique toujours (chemin dans le dossier de l'appelant, dossier remis en attente).

/**
 * Garantit que la ligne `student_profiles` de l'appelant existe, sans rien modifier si elle existe déjà
 * (`INSERT ... ON CONFLICT (user_id) DO NOTHING` : aucune colonne lue dans `EXCLUDED`).
 * @param {object} supabase - client de SESSION de l'étudiant (jamais le service role)
 * @param {string} userId - identifiant vérifié côté serveur
 * @returns {Promise<{ error: { message: string } | null }>}
 */
export async function ensureOwnStudentRow(supabase, userId) {
  const { error } = await supabase
    .from("student_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
  return { error: error ?? null }
}

/**
 * Écrit le chemin de carte (déjà validé par `toOwnedStoragePath`) sur la ligne existante de l'appelant.
 * Une mise à jour qui ne touche aucune ligne est un échec : jamais de succès sans carte enregistrée.
 * @param {object} supabase - client de SESSION de l'étudiant (jamais le service role)
 * @param {string} userId - identifiant vérifié côté serveur
 * @param {string} cardPath - chemin dans le bucket `student-cards`, sous le dossier de `userId`
 * @returns {Promise<{ error: { message: string } | null }>}
 */
export async function setOwnCardPath(supabase, userId, cardPath) {
  const { error, count } = await supabase
    .from("student_profiles")
    .update({ card_url: cardPath }, { count: "exact" })
    .eq("user_id", userId)
  if (error) return { error }
  if (count !== 1) {
    return { error: { code: "card_row_count", message: `student_profiles : ${count ?? "aucune"} ligne mise à jour pour la carte` } }
  }
  return { error: null }
}

/**
 * Journalise l'échec d'une étape d'écriture de carte sur UNE ligne lisible dans les logs Vercel :
 * `[action] step=<étape> code=<code PostgreSQL ou PostgREST> <message>`. Seuls `code` et `message` sont repris :
 * jamais `details` ni `hint` (ils peuvent contenir des valeurs de ligne), ni le chemin de la carte.
 * @param {string} action - nom de l'action serveur (ex. `saveStudentCardUrl`)
 * @param {string} step - identifiant d'étape stable (ex. `set_card_path`)
 * @param {{ code?: string, message?: string } | null | undefined} error
 */
export function logCardStepError(action, step, error) {
  const code = typeof error?.code === "string" && error.code !== "" ? error.code : "none"
  const message = typeof error?.message === "string" ? error.message.replace(/\s+/g, " ").slice(0, 300) : "erreur sans message"
  console.error(`[${action}] step=${step} code=${code} ${message}`)
}
