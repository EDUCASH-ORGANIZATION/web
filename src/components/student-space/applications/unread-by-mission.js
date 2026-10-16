// @ds-screen RD-STUDENT-01
// Messages non lus du client par mission, pour l'action « Répondre à <prénom> » de Mes candidatures (E04). Pur.

/**
 * @param {{ conversations?: Array<{ missionId?: string, unreadCount?: number, lastAt?: string }>, error?: string } | null | undefined} result
 *   Réponse de `getStudentConversations`. En erreur ou vide : aucun non lu (l'action est simplement omise).
 * @returns {Record<string, { at: string }>} `at` : date du dernier message de la conversation
 */
export function unreadByMission(result) {
  const out = {}
  for (const c of result?.conversations ?? []) {
    if (!c?.missionId || !(c.unreadCount > 0) || !c.lastAt) continue
    // Plusieurs conversations sur une mission : la plus récente d'abord, la première rencontrée gagne.
    if (!out[c.missionId]) out[c.missionId] = { at: c.lastAt }
  }
  return out
}
