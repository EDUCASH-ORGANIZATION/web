"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { loadNotifications, loadUnreadCount, markAll, markOne } from "@/lib/notifications/actions-core"

const PAGE = "/client/notifications"

/**
 * Notifications du client connecté, plus récentes d'abord, 20 par page (curseur opaque).
 * @param {{ filtre?: string, curseur?: string }} [params] `filtre` : « non-lues » seulement
 * @returns {Promise<{ items: any[], nextCursor: string|null, unreadCount: number } | { error: string, unavailable?: true }>}
 */
export async function getClientNotifications({ filtre, curseur } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  return loadNotifications(auth.supabase, auth.user.id, { filtre, curseur })
}

/**
 * Nombre de notifications non lues (sondage de la cloche). 0 si la table est absente.
 * @returns {Promise<{ count: number, unavailable?: true } | { error: string }>}
 */
export async function getClientUnreadNotificationCount() {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  return loadUnreadCount(auth.supabase, auth.user.id)
}

/**
 * Marque une notification de l'appelant comme lue. L'identifiant d'une autre personne ou inexistant donne le
 * même succès silencieux.
 * @param {string} id
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markClientNotificationRead(id) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const res = await markOne(auth.supabase, auth.user.id, id)
  if (res.success) revalidatePath(PAGE)
  return res
}

/**
 * Marque toutes les notifications non lues de l'appelant comme lues.
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markAllClientNotificationsRead() {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const res = await markAll(auth.supabase, auth.user.id)
  if (res.success) revalidatePath(PAGE)
  return res
}
