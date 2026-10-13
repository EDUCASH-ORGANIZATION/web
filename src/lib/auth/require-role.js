import { createClient } from "@/lib/supabase/server"
import { getServerRole } from "@/lib/auth/server-role"

const ERR_AUTH = "Tu dois être connecté pour effectuer cette action."
const ERR_FORBIDDEN = "Tu n'as pas les droits pour effectuer cette action."
const ERR_AUTH_CLIENT = "Vous devez être connecté pour effectuer cette action."
const ERR_FORBIDDEN_CLIENT = "Vous n'avez pas les droits pour effectuer cette action."

// L'espace client est vouvoyé : un rôle exigé exactement ["client"] donne des messages vouvoyés.
const isClientOnly = (roles) => Array.isArray(roles) && roles.length === 1 && roles[0] === "client"

/**
 * Exige un utilisateur connecté (jeton vérifié par `getUser()`).
 * @returns {Promise<{ supabase: any, user: any, error?: undefined } | { error: string }>}
 */
export async function requireUser(errorMessage = ERR_AUTH) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) return { error: errorMessage }
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
  const clientOnly = isClientOnly(roles)
  const errForbidden = clientOnly ? ERR_FORBIDDEN_CLIENT : ERR_FORBIDDEN
  const auth = await requireUser(clientOnly ? ERR_AUTH_CLIENT : ERR_AUTH)
  if (auth.error) return { error: auth.error }

  const { supabase, user } = auth
  const { role, profile, error } = await getServerRole(supabase, user)
  if (error || !profile || !role) return { error: errForbidden }
  if (profile.is_suspended === true) return { error: errForbidden }
  if (!roles.includes(role)) return { error: errForbidden }

  return { supabase, user, role, profile }
}
