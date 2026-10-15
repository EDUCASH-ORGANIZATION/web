import { countUnread, listNotifications, markAllRead, markRead } from "./read"

// Corps commun des actions de lecture des trois espaces (RD-NOTIF-01). Module serveur sans "use server" : il
// n'expose aucune action appelable du navigateur. Chaque action d'espace contrôle le rôle AVANT d'appeler ces
// fonctions, avec le client de session et l'identifiant de l'appelant (jamais un paramètre de la requête).

export const ERR_NOTIFICATIONS_UNAVAILABLE = "Les notifications sont momentanément indisponibles."
export const ERR_NOTIFICATIONS_GENERIC = "Impossible de charger vos notifications. Réessayez dans un instant."
const ERR_MARK = "Impossible de mettre à jour vos notifications. Réessayez dans un instant."

/** @param {unknown} filtre seule la valeur « non-lues » filtre. */
export function toFilter(filtre) {
  return filtre === "non-lues" ? "unread" : "all"
}

/** @returns {Promise<{ items: any[], nextCursor: string|null, unreadCount: number } | { error: string, unavailable?: true }>} */
export async function loadNotifications(supabase, userId, { filtre, curseur } = {}) {
  const [list, unread] = await Promise.all([
    listNotifications(supabase, userId, { filter: toFilter(filtre), cursor: typeof curseur === "string" ? curseur : undefined }),
    countUnread(supabase, userId),
  ])
  if (list.unavailable || unread.unavailable) return { error: ERR_NOTIFICATIONS_UNAVAILABLE, unavailable: true }
  if (list.error) return { error: ERR_NOTIFICATIONS_GENERIC }
  return { items: list.items, nextCursor: list.nextCursor, unreadCount: unread.error ? 0 : unread.count }
}

/** Compteur seul (sondage) : 0 si la table est absente ou la lecture en erreur. */
export async function loadUnreadCount(supabase, userId) {
  const res = await countUnread(supabase, userId)
  if (res.unavailable) return { count: 0, unavailable: true }
  if (res.error) return { error: ERR_NOTIFICATIONS_GENERIC }
  return { count: res.count }
}

/** @returns {Promise<{ success: true } | { error: string }>} */
export async function markOne(supabase, userId, id) {
  const res = await markRead(supabase, userId, id)
  if (res.unavailable) return { error: ERR_NOTIFICATIONS_UNAVAILABLE }
  if (res.error) return { error: ERR_MARK }
  return { success: true }
}

/** @returns {Promise<{ success: true } | { error: string }>} */
export async function markAll(supabase, userId) {
  const res = await markAllRead(supabase, userId)
  if (res.unavailable) return { error: ERR_NOTIFICATIONS_UNAVAILABLE }
  if (res.error) return { error: ERR_MARK }
  return { success: true }
}

/**
 * Compteur de non lues pour la coquille : 0 si la table est absente, la lecture en erreur ou une exception.
 * Ne bloque jamais le rendu de la coquille.
 * @returns {Promise<number>}
 */
export async function shellNotificationCount(supabase, userId) {
  try {
    const res = await countUnread(supabase, userId)
    return typeof res.count === "number" ? res.count : 0
  } catch (err) {
    console.error("[notifications] compteur de la coquille", err?.code ?? "erreur")
    return 0
  }
}
