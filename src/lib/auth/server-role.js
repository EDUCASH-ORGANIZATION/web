// Rôle d'un utilisateur lu côté serveur. L'autorité est `profiles.role`.
// `user_metadata.role` est modifiable par l'utilisateur : repli limité à student et client,
// et seulement quand aucun profil n'existe. Jamais admin hors de `profiles`.
import { USER_ROLES } from "@/lib/supabase/database.constants"

const FALLBACK_ROLES = ["student", "client"]

function filled(value) {
  return typeof value === "string" && value.trim() !== ""
}

/**
 * @param {{ from: Function }} supabase client Supabase serveur
 * @param {{ id: string, user_metadata?: { role?: unknown } } | null | undefined} user
 * @returns {Promise<{
 *   role: "student" | "client" | "admin" | null,
 *   profile: { role: string|null, full_name: string|null, city: string|null, is_suspended: boolean|null } | null,
 *   profileComplete: boolean,
 *   error?: unknown,
 * }>} `role` vaut null si ni profil ni métadonnée valide, ou si la lecture de `profiles` échoue (`error` renseigné).
 */
export async function getServerRole(supabase, user) {
  const none = { role: null, profile: null, profileComplete: false }
  if (!user?.id) return none

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name, city, is_suspended")
    .eq("user_id", user.id)
    .maybeSingle()

  // Lecture impossible : aucun rôle (fail-closed), jamais de repli sur user_metadata.
  if (error) return { ...none, error }

  if (profile) {
    return {
      role: USER_ROLES.includes(profile.role) ? profile.role : null,
      profile,
      profileComplete: filled(profile.full_name) && filled(profile.city),
    }
  }

  const metaRole = user.user_metadata?.role
  return {
    role: FALLBACK_ROLES.includes(metaRole) ? metaRole : null,
    profile: null,
    profileComplete: false,
  }
}
