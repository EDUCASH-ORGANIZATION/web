// @ds-screen RD-ADMIN-01
// Logique pure des écrans finances de l'espace admin (AD11 transactions, AD12 portefeuilles, AD13 retraits) :
// paramètres d'URL, périodes, pagination, anomalies, statut des retraits. Aucun accès aux données.
import { WALLET_TRANSACTION_TYPES } from "@/lib/supabase/database.constants"
import { todayInBenin } from "@/lib/vitrine/dates"
import { WITHDRAWAL_STUCK_HOURS } from "./dashboard-queue"

export const FINANCE_PAGE_SIZE = 25
export const MAX_PAGE = 100000
export const REFERENCE_MAX = 64
export const SEARCH_MAX = 60

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const BENIN_TZ = "Africa/Porto-Novo"
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const REFERENCE_PATTERN = /^[A-Za-z0-9._:-]+$/

export const TRANSACTION_PERIODS = [
  { id: "7j", label: "7 derniers jours" },
  { id: "30j", label: "30 derniers jours" },
  { id: "mois", label: "Ce mois-ci" },
]
export const DEFAULT_PERIOD = "mois"

/** Texte de recherche nettoyé : caractères de contrôle retirés, espaces normalisés, longueur bornée. */
export function cleanSearch(value, max = SEARCH_MAX) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string") return ""
  return raw.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

/** Numéro de page : entier de 1 à MAX_PAGE, 1 par défaut (valeur absente, négative, décimale ou hostile). */
export function parsePage(value) {
  const raw = Array.isArray(value) ? value[0] : value
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : 1
  return Math.min(Math.max(n, 1), MAX_PAGE)
}

function oneOf(value, allowed, fallback) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === "string" && allowed.includes(raw) ? raw : fallback
}

/**
 * Paramètres de l'écran transactions : type et période en listes fermées (valeur inconnue : ignorée), référence
 * nettoyée. `referenceOk` est faux quand la saisie ne ressemble pas à une référence de paiement : la recherche
 * ne renvoie alors aucune ligne (jamais d'erreur).
 * @param {Record<string, unknown>} [searchParams]
 */
export function parseTransactionParams(searchParams = {}) {
  const sp = searchParams && typeof searchParams === "object" ? searchParams : {}
  const q = cleanSearch(sp.q, REFERENCE_MAX)
  return {
    type: oneOf(sp.type, WALLET_TRANSACTION_TYPES, ""),
    periode: oneOf(sp.periode, TRANSACTION_PERIODS.map((p) => p.id), DEFAULT_PERIOD),
    q,
    referenceOk: q === "" || REFERENCE_PATTERN.test(q),
    page: parsePage(sp.page),
  }
}

/** Paramètres de l'écran portefeuilles : recherche par nom, page. */
export function parseWalletParams(searchParams = {}) {
  const sp = searchParams && typeof searchParams === "object" ? searchParams : {}
  return { q: cleanSearch(sp.q), page: parsePage(sp.page) }
}

/** Paramètres de l'écran retraits : page seulement. */
export function parseWithdrawalParams(searchParams = {}) {
  const sp = searchParams && typeof searchParams === "object" ? searchParams : {}
  return { page: parsePage(sp.page) }
}

/**
 * Début de la période (ISO) : 7 ou 30 jours glissants, ou depuis le 1er du mois au Bénin (UTC+1).
 * @param {string} periode
 * @param {Date} now
 */
export function periodStart(periode, now) {
  if (periode === "7j") return new Date(now.getTime() - 7 * DAY_MS).toISOString()
  if (periode === "30j") return new Date(now.getTime() - 30 * DAY_MS).toISOString()
  return `${todayInBenin(now).slice(0, 7)}-01T00:00:00+01:00`
}

/** Nombre de pages (au moins 1). */
export function totalPages(total, size = FINANCE_PAGE_SIZE) {
  const n = Number(total)
  return Number.isFinite(n) && n > 0 ? Math.ceil(n / size) : 1
}

/** Page ramenée dans les limites : une page trop grande renvoie la dernière. */
export function clampPage(page, total, size = FINANCE_PAGE_SIZE) {
  return Math.min(Math.max(1, Math.floor(Number(page)) || 1), totalPages(total, size))
}

function amount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Disponible d'un portefeuille : solde moins argent réservé (le solde comprend le séquestre). */
export function walletAvailable(balance, reserved) {
  return amount(balance) - amount(reserved)
}

/** Anomalie d'un portefeuille : solde négatif, ou argent réservé supérieur au solde ; sinon null. */
export function walletAnomaly({ balance, reserved } = {}) {
  const b = amount(balance)
  if (b < 0) return "negative-balance"
  if (amount(reserved) > b) return "reserved-over-balance"
  return null
}

/**
 * Fenêtre d'une page sur une liste en deux parties : `head` est en mémoire (n lignes), `tail` est lue par plage.
 * @returns {{ head: [number, number], tail: [number, number] | null }} bornes `[début, fin[` de chaque partie
 */
export function splitPage(page, headLength, size = FINANCE_PAGE_SIZE) {
  const start = (Math.max(1, page) - 1) * size
  const end = start + size
  const headEnd = Math.min(end, headLength)
  const head = [Math.min(start, headLength), headEnd]
  const tailStart = Math.max(start - headLength, 0)
  const tailEnd = end - headLength
  return { head, tail: tailEnd > 0 ? [tailStart, tailEnd] : null }
}

/**
 * Opérateur lu dans la note d'un retrait, sinon « Mobile Money ». Le prestataire de paiement n'est jamais nommé.
 * @param {unknown} note
 */
export function operatorFromNote(note) {
  const text = typeof note === "string" ? note : ""
  if (/mtn/i.test(text)) return "MTN MoMo"
  if (/moov/i.test(text)) return "Moov Money"
  if (/celtiis/i.test(text)) return "Celtiis Cash"
  return "Mobile Money"
}

/**
 * Statut d'un retrait vu de l'admin.
 * - `reversed` : une ligne d'annulation pointe vers lui (portefeuille recrédité) ;
 * - `created` : une référence de paiement existe (virement créé) ;
 * - `stuck` : débité sans référence depuis plus de 24 h (même seuil que le tableau de bord) ;
 * - `pending` : débité sans référence, récent (traitement en cours).
 * @param {{ reference?: string|null, reversed?: boolean, createdAt?: string|null }} row
 * @param {Date} now
 * @returns {"reversed" | "created" | "stuck" | "pending"}
 */
export function withdrawalStatus({ reference, reversed, createdAt } = {}, now) {
  if (reversed === true) return "reversed"
  if (typeof reference === "string" && reference.trim() !== "") return "created"
  const t = new Date(createdAt).getTime()
  if (!Number.isNaN(t) && now.getTime() - t > WITHDRAWAL_STUCK_HOURS * HOUR_MS) return "stuck"
  return "pending"
}

export const WITHDRAWAL_STATUS_VIEW = {
  reversed: { label: "Recrédité", tone: "neutre" },
  created: { label: "Virement créé", tone: "succes" },
  stuck: { label: "Débité sans virement créé", tone: "erreur" },
  pending: { label: "En cours de traitement", tone: "alerte" },
}

/** Durée écoulée en clair : « 20 h », « 3 j », « moins d'une heure ». Vide si la date est illisible. */
export function elapsedLabel(since, now) {
  const t = new Date(since).getTime()
  if (Number.isNaN(t)) return ""
  const diff = Math.max(0, now.getTime() - t)
  if (diff < HOUR_MS) return "moins d'une heure"
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h`
  return `${Math.floor(diff / DAY_MS)} j`
}

/** Date et heure du Bénin : « 8 oct. 13:02 ». Vide si la date est illisible. */
export function formatDateTime(iso) {
  const date = new Date(iso)
  if (iso === null || iso === undefined || Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: BENIN_TZ,
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`
}

/** Heure du Bénin « 14:32 » (heure du calcul des totaux). */
export function formatTime(iso) {
  const date = new Date(iso)
  if (iso === null || iso === undefined || Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: BENIN_TZ }).format(date)
}

// Avertissement affiché partout où un retrait bloqué est présenté : l'enregistrement de la référence de paiement
// peut avoir échoué alors que le virement est parti, un recrédit ferait alors payer deux fois.
export const STUCK_WITHDRAWAL_WARNING =
  "Avant tout recrédit, vérifiez chez le prestataire de paiement que le virement n'est pas parti : un enregistrement peut avoir échoué alors que l'argent a été envoyé."
