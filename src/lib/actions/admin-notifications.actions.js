"use server"

import { createClient } from "@/lib/supabase/server"
import { loadNotifications, loadUnreadCount, markAll, markOne } from "@/lib/notifications/actions-core"
import { requireAdminService } from "./admin-context"

// Le contrôle admin (`profiles.role = 'admin'`, compte non suspendu) précède tout accès. La lecture passe par le
// client de SESSION (RLS : chacun ne voit que ses notifications), jamais par le service role.

/**
 * Notifications de l'admin connecté, plus récentes d'abord, 20 par page (curseur opaque).
 * @param {{ filtre?: string, curseur?: string }} [params] `filtre` : « non-lues » seulement
 * @returns {Promise<{ items: any[], nextCursor: string|null, unreadCount: number } | { error: string, unavailable?: true }>}
 */
export async function getAdminNotifications({ filtre, curseur } = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return loadNotifications(await createClient(), ctx.admin.userId, { filtre, curseur })
}

/**
 * Nombre de notifications non lues (sondage de la cloche). 0 si la table est absente.
 * @returns {Promise<{ count: number, unavailable?: true } | { error: string }>}
 */
export async function getAdminUnreadNotificationCount() {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return loadUnreadCount(await createClient(), ctx.admin.userId)
}

/**
 * Marque une notification de l'appelant comme lue (succès silencieux pour l'identifiant d'une autre personne).
 * @param {string} id
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markAdminNotificationRead(id) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return markOne(await createClient(), ctx.admin.userId, id)
}

/**
 * Marque toutes les notifications non lues de l'appelant comme lues.
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markAllAdminNotificationsRead() {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return markAll(await createClient(), ctx.admin.userId)
}
