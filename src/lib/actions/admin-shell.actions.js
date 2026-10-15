"use server"

import { unstable_rethrow } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServerRole } from "@/lib/auth/server-role"
import { dashboardFor } from "@/lib/auth/destinations"
import { todayInBenin } from "@/lib/vitrine/dates"
import { shellNotificationCount } from "@/lib/notifications/actions-core"
import { countPendingVerifications, requireAdminService } from "./admin-context"

/**
 * Où renvoyer un visiteur refusé par le contrôle admin. Fail-closed : tout cas douteux (rôle introuvable,
 * lecture en erreur) mène à l'accueil. Le rôle vient de `profiles.role` seul.
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
    if (role !== "admin") return dashboardFor(role) ?? "/"
    return "/"
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getAdminShellData] destination", err)
    return "/"
  }
}

/**
 * Données de la coquille de l'espace admin : identité d'affichage et nombre de dossiers « À examiner » (la même
 * règle que l'onglet et l'accueil). Le rôle vient de `profiles.role` (`requireAdminService`) ; un compte suspendu
 * ou d'un autre rôle est refusé avec `redirectTo`, la destination que le layout applique. Un compteur illisible
 * donne 0 : la coquille n'est jamais bloquée par lui.
 *
 * @returns {Promise<
 *   { shell: { userId: string, fullName: string, pendingCount: number, notificationCount: number } } |
 *   { error: string, redirectTo: string }
 * >}
 */
export async function getAdminShellData() {
  try {
    const ctx = await requireAdminService()
    if (ctx.error) return { error: ctx.error, redirectTo: await refusalDestination() }

    let pendingCount = 0
    const [pending, notificationCount] = await Promise.allSettled([
      countPendingVerifications(ctx.service, todayInBenin()),
      (async () => shellNotificationCount(await createClient(), ctx.admin.userId))(),
    ])
    if (pending.status === "fulfilled") pendingCount = pending.value
    else {
      unstable_rethrow(pending.reason)
      console.error("[getAdminShellData] compteur", pending.reason)
    }

    return {
      shell: {
        userId: ctx.admin.userId,
        fullName: ctx.admin.fullName,
        pendingCount,
        notificationCount: notificationCount.status === "fulfilled" ? notificationCount.value : 0,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getAdminShellData]", err)
    return { error: "Impossible de charger votre espace.", redirectTo: "/" }
  }
}
