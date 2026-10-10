// Limite simple en mémoire du formulaire « Prévenez-moi » : fenêtre glissante par clé.
// Meilleur effort : le compteur est propre à chaque instance serverless (pas de stockage partagé,
// pas de SQL). Il freine un envoi en rafale, le honeypot et la validation font le reste.

export const WAITLIST_LIMITS = { perIp: 5, perEmail: 2, windowMs: 10 * 60 * 1000, maxKeys: 5000 }

const hits = new Map()

function prune(now) {
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < WAITLIST_LIMITS.windowMs)
    if (recent.length === 0) hits.delete(key)
    else hits.set(key, recent)
  }
}

/**
 * Enregistre une tentative et indique si elle dépasse la limite.
 * @param {string} key
 * @param {number} max Nombre maximal de tentatives dans la fenêtre
 * @param {number} [now]
 * @returns {boolean} true si la tentative est refusée
 */
export function isRateLimited(key, max, now = Date.now()) {
  if (hits.size > WAITLIST_LIMITS.maxKeys) prune(now)
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WAITLIST_LIMITS.windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  return false
}

/** Pour les tests. */
export function resetRateLimit() {
  hits.clear()
}
