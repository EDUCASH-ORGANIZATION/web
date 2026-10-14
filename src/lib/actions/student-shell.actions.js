"use server"

import { unstable_rethrow } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/require-role"
import { getServerRole } from "@/lib/auth/server-role"
import { dashboardFor } from "@/lib/auth/destinations"

/**
 * Où renvoyer un visiteur refusé par `requireRole(["student"])`. Fail-closed : tout cas douteux
 * (rôle introuvable, lecture en erreur) mène à l'accueil. Le rôle vient de `profiles.role` seul.
 * @returns {Promise<string>}
 */
async function refusalDestination() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "/auth/login"

    const { role, profile } = await getServerRole(supabase, user)
    if (!role) return "/"
    if (profile?.is_suspended === true) return "/auth/login?suspended=1"
    if (role !== "student") return dashboardFor(role) ?? "/"
    return "/"
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentShellData] destination", err)
    return "/"
  }
}

/**
 * Données de la coquille de l'espace étudiant : identité d'affichage et messages non lus.
 * Champs publics seulement (jamais de téléphone, de carte ni de `user_metadata`).
 * Le rôle vient de `profiles.role` (`requireRole`) ; un compte suspendu ou sans rôle étudiant est refusé
 * avec `redirectTo`, la destination que le layout applique.
 *
 * @returns {Promise<
 *   { shell: { userId: string, fullName: string, unreadCount: number } } |
 *   { error: string, redirectTo: string }
 * >}
 */
export async function getStudentShellData() {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error, redirectTo: await refusalDestination() }

    const { supabase, user, profile } = auth
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false)
    // Un compteur illisible ne bloque pas la coquille : la pastille reste simplement vide.
    if (error) console.error("[getStudentShellData]", error.message)

    return {
      shell: {
        userId: user.id,
        fullName: typeof profile.full_name === "string" ? profile.full_name : "",
        unreadCount: error ? 0 : (count ?? 0),
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentShellData]", err)
    return { error: "Impossible de charger votre espace.", redirectTo: "/" }
  }
}
