import { createClient } from "@/lib/supabase/server"
import { getServerRole } from "@/lib/auth/server-role"

const ERR_AUTH = "Tu dois être connecté pour effectuer cette action."
const ERR_FORBIDDEN = "Tu n'as pas les droits pour effectuer cette action."

/**
 * Exige un utilisateur connecté (jeton vérifié par `getUser()`).
 * @returns {Promise<{ supabase: any, user: any, error?: undefined } | { error: string }>}
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) return { error: ERR_AUTH }
  return { supabase, user }
}

/**
 * Exige un utilisateur connecté dont le rôle `profiles.role` figure dans `roles`.
 * Fail-closed : rôle introuvable, lecture du profil en erreur, absence de profil
 * ou compte suspendu donnent un refus. Aucune lecture de `user_metadata`.
 * @param {Array<"student"|"client"|"admin">} roles rôles autorisés
 * @returns {Promise<{ supabase: any, user: any, role: string, profile: object, error?: undefined } | { error: string }>}
 */
export async function requireRole(roles) {
  const auth = await requireUser()
  if (auth.error) return { error: auth.error }

  const { supabase, user } = auth
  const { role, profile, error } = await getServerRole(supabase, user)
  if (error || !profile || !role) return { error: ERR_FORBIDDEN }
  if (profile.is_suspended === true) return { error: ERR_FORBIDDEN }
  if (!roles.includes(role)) return { error: ERR_FORBIDDEN }

  return { supabase, user, role, profile }
}
