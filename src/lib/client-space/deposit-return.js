// Recharge du portefeuille client (C15) : lecture des paramètres d'URL et validation du montant. Pur.
// Aucun montant n'est jamais lu dans l'URL pour être crédité : `?montant=` n'est qu'une suggestion de
// champ, bornée ici et revalidée par le schéma et par le serveur. `status` n'est pas une preuve de paiement :
// seul le solde du portefeuille (crédité par le serveur) fait foi.
import { MIN_DEPOSIT_AMOUNT } from "../supabase/database.constants.js"
import { formatAmount } from "../app/format.js"

/** Montants rapides proposés dans la modale de recharge. */
export const QUICK_DEPOSIT_AMOUNTS = [5000, 10000, 25000]

/** Plafond de la saisie (9 chiffres, comme le champ montant). */
export const MAX_DEPOSIT_AMOUNT = 999999999

// Retour du prestataire (`?id=&status=`) : seules ces valeurs sont reconnues, toute autre est ignorée.
// `approved` n'affirme rien : le paiement est « en attente de confirmation » tant que le solde ne l'a pas reflété.
const STATUS_TO_KIND = {
  approved: "pending",
  canceled: "cancelled",
  cancelled: "cancelled",
  declined: "failed",
  failed: "failed",
}

// Alias cibles `?recharge=` (la planche C15). « succes » reste « en attente » pour la même raison.
const RECHARGE_TO_KIND = {
  succes: "pending",
  attente: "pending",
  annulee: "cancelled",
  echec: "failed",
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function lookup(table, raw) {
  const value = firstValue(raw)
  return typeof value === "string" && Object.hasOwn(table, value) ? table[value] : null
}

/**
 * État de retour d'une recharge. `status` prime sur `recharge` ; une valeur inconnue est ignorée
 * (puis l'autre paramètre est essayé). L'identifiant `id` n'est jamais lu.
 * @param {Record<string, string|string[]|undefined>|null|undefined} searchParams
 * @returns {{ kind: "pending" | "cancelled" | "failed" } | null}
 */
export function parseDepositReturn(searchParams) {
  const params = searchParams ?? {}
  const kind = lookup(STATUS_TO_KIND, params.status) ?? lookup(RECHARGE_TO_KIND, params.recharge)
  return kind ? { kind } : null
}

/**
 * Ouverture de la modale de recharge (`?recharger=1`) et montant suggéré (`?montant=`).
 * La suggestion est un entier de chiffres seuls, ramené au minimum de recharge s'il est plus petit et
 * ignoré s'il dépasse le plafond ; tout autre format donne null.
 * @param {Record<string, string|string[]|undefined>|null|undefined} searchParams
 * @returns {{ open: boolean, suggestion: number | null }}
 */
export function parseRechargeParams(searchParams) {
  const params = searchParams ?? {}
  const open = firstValue(params.recharger) === "1"
  const raw = firstValue(params.montant)
  let suggestion = null
  if (typeof raw === "string" && /^\d{1,9}$/.test(raw)) {
    const n = Number(raw)
    if (n > 0 && n <= MAX_DEPOSIT_AMOUNT) suggestion = Math.max(n, MIN_DEPOSIT_AMOUNT)
  }
  return { open, suggestion }
}

/**
 * Message d'erreur (vouvoiement) pour un montant de recharge, ou null s'il est valide.
 * @param {number|null|undefined} amount
 * @returns {string | null}
 */
export function depositAmountError(amount) {
  if (amount === null || amount === undefined || !Number.isInteger(amount) || amount <= 0) {
    return "Indiquez le montant à recharger."
  }
  if (amount < MIN_DEPOSIT_AMOUNT) {
    return `Le minimum de recharge est de ${formatAmount(MIN_DEPOSIT_AMOUNT)}.`
  }
  if (amount > MAX_DEPOSIT_AMOUNT) return "Ce montant est trop élevé."
  return null
}

/**
 * Adresse de paiement renvoyée par le serveur : https seulement, sinon null (aucune redirection).
 * @param {unknown} url
 * @returns {string | null}
 */
export function safePaymentUrl(url) {
  if (typeof url !== "string") return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}
