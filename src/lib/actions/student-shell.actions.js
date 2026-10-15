"use server"

import { unstable_rethrow } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/require-role"
import { getServerRole } from "@/lib/auth/server-role"
import { dashboardFor } from "@/lib/auth/destinations"
import { shellNotificationCount } from "@/lib/notifications/actions-core"

// Plafonds : au plus LINKED_LIMIT missions liées (candidatures, puis missions où l'étudiant est retenu) et
// UNREAD_SCAN_LIMIT messages non lus examinés. Au-delà, le compteur est une borne basse (la pastille reste
// affichée), jamais une erreur.
const LINKED_LIMIT = 200
const UNREAD_SCAN_LIMIT = 500

/**
 * Messages non lus qui comptent pour l'étudiant : ceux reçus du client d'une mission où il a une candidature OU
 * dont il est le retenu, la même règle que la boîte de réception (`getStudentConversations`). La politique
 * messages_insert de la base laisse un compte quelconque écrire à n'importe qui : sans ce filtre, il pourrait
 * gonfler la pastille. Le couple (client, mission) est vérifié exactement, pas seulement chaque moitié.
 * Toute lecture en erreur donne 0 : la coquille n'est jamais bloquée par son compteur.
 * @returns {Promise<number>}
 */
async function countLegitimateUnread(supabase, userId) {
  const [appsRes, selectedRes] = await Promise.all([
    supabase.from("applications").select("mission_id").eq("student_id", userId).limit(LINKED_LIMIT),
    supabase.from("missions").select("id, client_id").eq("selected_student_id", userId).limit(LINKED_LIMIT),
  ])
  const failure = appsRes.error ?? selectedRes.error
  if (failure) {
    console.error("[getStudentShellData] missions liées", failure.message)
    return 0
  }

  const clientOf = new Map((selectedRes.data ?? []).map((m) => [m.id, m.client_id]))
  const appliedIds = [...new Set((appsRes.data ?? []).map((a) => a.mission_id))].filter((id) => !clientOf.has(id))
  if (appliedIds.length > 0) {
    const appliedRes = await supabase.from("missions").select("id, client_id").in("id", appliedIds).limit(LINKED_LIMIT)
    if (appliedRes.error) {
      console.error("[getStudentShellData] missions candidatées", appliedRes.error.message)
      return 0
    }
    for (const m of appliedRes.data ?? []) clientOf.set(m.id, m.client_id)
  }

  const missionIds = [...clientOf.keys()]
  const clientIds = [...new Set([...clientOf.values()].filter(Boolean))]
  if (missionIds.length === 0 || clientIds.length === 0) return 0

  const { data, error } = await supabase
    .from("messages")
    .select("sender_id, mission_id")
    .eq("receiver_id", userId)
    .eq("read", false)
    .in("sender_id", clientIds)
    .in("mission_id", missionIds)
    .limit(UNREAD_SCAN_LIMIT)
  if (error) {
    console.error("[getStudentShellData]", error.message)
    return 0
  }
  return (data ?? []).filter((row) => clientOf.get(row.mission_id) === row.sender_id).length
}

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
 * Données de la coquille de l'espace étudiant : identité d'affichage et messages non lus (de ses clients seulement).
 * Champs publics seulement (jamais de téléphone, de carte ni de `user_metadata`).
 * Le rôle vient de `profiles.role` (`requireRole`) ; un compte suspendu ou sans rôle étudiant est refusé
 * avec `redirectTo`, la destination que le layout applique.
 *
 * @returns {Promise<
 *   { shell: { userId: string, fullName: string, unreadCount: number, notificationCount: number } } |
 *   { error: string, redirectTo: string }
 * >}
 */
export async function getStudentShellData() {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error, redirectTo: await refusalDestination() }

    const { supabase, user, profile } = auth
    let unreadCount = 0
    const [unread, notificationCount] = await Promise.allSettled([
      countLegitimateUnread(supabase, user.id),
      shellNotificationCount(supabase, user.id),
    ])
    if (unread.status === "fulfilled") unreadCount = unread.value
    else {
      unstable_rethrow(unread.reason)
      console.error("[getStudentShellData] compteur", unread.reason)
    }

    return {
      shell: {
        userId: user.id,
        fullName: typeof profile.full_name === "string" ? profile.full_name : "",
        unreadCount,
        notificationCount: notificationCount.status === "fulfilled" ? notificationCount.value : 0,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentShellData]", err)
    return { error: "Impossible de charger votre espace.", redirectTo: "/" }
  }
}
