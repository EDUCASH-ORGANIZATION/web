import { createHash } from "node:crypto"

// Empreinte courte des jetons de déduplication (RD-NOTIF-01). Module serveur (node:crypto) : le catalogue reste
// pur et importable côté client. Une clé `dedupe_key` est lisible par son destinataire (SELECT sur sa ligne) :
// elle ne doit jamais contenir une colonne privée en clair (`verification_submitted_at`). L'empreinte garde
// l'unicité (deux dépôts distincts => deux empreintes) et l'idempotence (même dépôt => même empreinte).

export const FINGERPRINT_LENGTH = 12
export const FINGERPRINT_PATTERN = /^[0-9a-f]{12}$/

/**
 * Empreinte SHA-256 tronquée (12 caractères hexadécimaux) d'un jeton, préfixée par l'usage pour qu'un même
 * jeton ne donne pas la même empreinte d'un usage à l'autre.
 * @param {string} purpose  usage (par exemple le type de notification)
 * @param {unknown} token   jeton brut (jamais stocké)
 * @returns {string}
 */
export function dedupeFingerprint(purpose, token) {
  return createHash("sha256").update(`${purpose}\u0000${String(token)}`).digest("hex").slice(0, FINGERPRINT_LENGTH)
}
