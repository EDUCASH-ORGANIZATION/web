// Rôle d'un utilisateur lu côté serveur. L'autorité est `profiles.role`, et elle seule.
// `user_metadata` est modifiable par l'utilisateur : jamais lu ici. Le déclencheur `handle_new_user`
// crée un profil à chaque inscription ; l'absence de profil donne donc « aucun rôle » (fail-closed).
import { USER_ROLES } from "@/lib/supabase/database.constants"

function filled(value) {
  return typeof value === "string" && value.trim() !== ""
}

/**
 * @param {{ from: Function }} supabase client Supabase serveur
 * @param {{ id: string } | null | undefined} user
 * @returns {Promise<{
 *   role: "student" | "client" | "admin" | null,
 *   profile: { role: string|null, full_name: string|null, city: string|null, is_suspended: boolean|null } | null,
 *   profileComplete: boolean,
 *   error?: unknown,
 * }>} `role` vaut null si aucun profil ne porte un rôle valide, ou si la lecture de `profiles` échoue (`error` renseigné).
 */
export async function getServerRole(supabase, user) {
  const none = { role: null, profile: null, profileComplete: false }
  if (!user?.id) return none

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name, city, is_suspended")
    .eq("user_id", user.id)
    .maybeSingle()

  // Lecture impossible : aucun rôle (fail-closed), aucun repli.
  if (error) return { ...none, error }

  if (profile) {
    return {
      role: USER_ROLES.includes(profile.role) ? profile.role : null,
      profile,
      profileComplete: filled(profile.full_name) && filled(profile.city),
    }
  }

  // Aucun profil : aucun rôle.
  return none
}
