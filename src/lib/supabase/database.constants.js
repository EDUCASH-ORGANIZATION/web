// src/lib/database.constants.js

// ─── Rôles ───────────────────────────────────────────────────────────────────
export const USER_ROLES = /** @type {const} */ (["student", "client", "admin"])

// ─── Statuts ─────────────────────────────────────────────────────────────────
export const MISSION_STATUSES = /** @type {const} */ (["open", "in_progress", "done", "cancelled"])
export const APPLICATION_STATUSES = /** @type {const} */ (["pending", "accepted", "rejected"])
export const TRANSACTION_STATUSES = /** @type {const} */ (["pending", "paid", "failed", "refunded"])
export const MISSION_URGENCIES = /** @type {const} */ (["low", "medium", "high"])

// ─── Métier ──────────────────────────────────────────────────────────────────
export const MISSION_TYPES = /** @type {const} */ ([
  "Babysitting",
  "Livraison",
  "Aide administrative",
  "Saisie",
  "Community Management",
  "Traduction",
  "Cours particuliers",
  "Autre",
])

export const CITIES = /** @type {const} */ ([
  "Cotonou",
  "Porto-Novo",
  "Abomey-Calavi",
])

// ─── Commission ───────────────────────────────────────────────────────────────
export const COMMISSION_RATE = 0.12

// ─── Wallet ───────────────────────────────────────────────────────────────────
export const WALLET_TRANSACTION_TYPES = [
  "deposit",    // recharge client
  "reserve",    // blocage mission
  "release",    // libération vers étudiant
  "commission", // commission EduCash
  "refund",     // remboursement annulation
  "withdrawal", // retrait Mobile Money
]

export const WALLET_TRANSACTION_LABELS = {
  deposit:    "Recharge",
  reserve:    "Mission publiée",
  release:    "Paiement reçu",
  commission: "Commission EduCash",
  refund:     "Remboursement",
  withdrawal: "Retrait",
}

export const WALLET_TRANSACTION_COLORS = {
  deposit:    "text-green-600",
  reserve:    "text-orange-500",
  release:    "text-green-600",
  commission: "text-gray-400",
  refund:     "text-blue-500",
  withdrawal: "text-red-500",
}

export const MIN_WITHDRAWAL_AMOUNT = 2000
export const MIN_DEPOSIT_AMOUNT    = 2000

// ─── Vérification ─────────────────────────────────────────────────────────────

// Durée de validité du badge de vérification en jours
export const VERIFICATION_VALIDITY_DAYS = 365

// Instructions upload carte étudiante
export const CARD_UPLOAD_INSTRUCTIONS = [
  "Photo nette et bien éclairée: pas de flou",
  "Tous les coins de la carte doivent être visibles",
  "Ton nom et ton établissement doivent être lisibles",
  "Fond uni de préférence (table, bureau)",
  "Formats acceptés : JPG, PNG, PDF — max 10 MB",
]

// Motifs de rejet prédéfinis
export const REJECTION_REASONS = [
  "Carte illisible ou floue — veuillez retirer une photo plus nette",
  "Tous les coins de la carte ne sont pas visibles",
  "La carte est expirée",
  "Le nom sur la carte ne correspond pas au profil",
  "Ce document ne semble pas être une carte étudiante valide",
  "La carte appartient à un autre établissement que celui déclaré",
  "Autre motif (préciser dans le message personnalisé)",
]

// ─── Structures de référence (documentation des objets Supabase) ─────────────
// Ces objets ne sont pas utilisés à l'exécution.
// Ils servent de référence visuelle pour savoir quels champs
// existent sur chaque table — l'équivalent des interfaces TypeScript.

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} user_id
 * @property {string|null} full_name
 * @property {string|null} city
 * @property {string|null} avatar_url
 * @property {string|null} bio
 * @property {string|null} phone
 * @property {'student'|'client'|'admin'} role
 * @property {boolean} is_verified
 * @property {number} rating
 * @property {number} missions_done
 * @property {string|null} fcm_token
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} StudentProfile
 * @property {string} id
 * @property {string} user_id
 * @property {string|null} school
 * @property {string|null} level
 * @property {string[]} skills
 * @property {string|null} card_url
 * @property {string|null} availability
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Mission
 * @property {string} id
 * @property {string} client_id
 * @property {string} title
 * @property {string} description
 * @property {string} type
 * @property {string} city
 * @property {number} budget
 * @property {'low'|'medium'|'high'} urgency
 * @property {'open'|'in_progress'|'done'|'cancelled'} status
 * @property {string|null} deadline
 * @property {string|null} selected_student_id
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Application
 * @property {string} id
 * @property {string} mission_id
 * @property {string} student_id
 * @property {string} message
 * @property {'pending'|'accepted'|'rejected'} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} mission_id
 * @property {string} sender_id
 * @property {string} receiver_id
 * @property {string} content
 * @property {boolean} read
 * @property {string} created_at
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} mission_id
 * @property {string} client_id
 * @property {string} student_id
 * @property {number} amount_total
 * @property {number} commission
 * @property {number} amount_student
 * @property {string|null} fedapay_id
 * @property {'pending'|'paid'|'failed'|'refunded'} status
 * @property {string|null} paid_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} mission_id
 * @property {string} reviewer_id
 * @property {string} reviewed_id
 * @property {number} rating
 * @property {string|null} comment
 * @property {string} created_at
 */