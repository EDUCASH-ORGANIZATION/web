// @ds-screen RD-STUDENT-01
// Messages non lus du client par mission, pour l'action « Répondre à <prénom> » de Mes candidatures (E04). Pur.

// États de conversation où l'étudiant peut encore écrire (candidature en attente, mission en cours).
const WRITABLE = ["candidate", "in_progress"]

/**
 * @param {{ conversations?: Array<{ missionId?: string, unreadCount?: number, lastUnreadAt?: string|null, state?: string|null }>, error?: string } | null | undefined} result
 *   Réponse de `getStudentConversations`. En erreur ou vide : aucun non lu (l'action est simplement omise).
 * @returns {Record<string, { at: string|null, state: string }>} `at` : date du message reçu non lu le plus récent
 *   (null si inconnue : la vue n'affiche alors pas de jour ni d'heure) ; `state` : état de la conversation
 */
export function unreadByMission(result) {
  const out = {}
  for (const c of result?.conversations ?? []) {
    if (!c?.missionId || !(c.unreadCount > 0) || !WRITABLE.includes(c.state)) continue
    // Un seul client par mission : la première conversation rencontrée gagne.
    if (!out[c.missionId]) out[c.missionId] = { at: c.lastUnreadAt ?? null, state: c.state }
  }
  return out
}
