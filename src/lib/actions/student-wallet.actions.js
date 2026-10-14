"use server"

// Lectures de la page Portefeuille étudiant (E08) et du préremplissage du retrait (E09).
// Toute action commence par requireRole(["student"]) : les lectures partagées (getWallet,
// getWalletTransactions, getMyProfile) n'ont que requireUser. Le grand livre `wallet_transactions` est la seule
// source des mouvements et des gains : la table historique `transactions` n'est jamais lue.
// Plafonds de lecture connus :
// - l'historique est lu par pages de 20 mouvements (une lecture de 21 pour savoir s'il en reste) ;
// - les gains (8 semaines, total) viennent des `release` de l'étudiant, lus par pages de 1000 lignes
//   (plafond PostgREST), 5 pages au plus ; au-delà ou en cas d'erreur la valeur est `null` : la carte « Tes gains »
//   est alors omise, jamais un faux 0 ;
// - 100 missions en cours au plus pour « À venir, en séquestre » ;
// - le retrait « en cours » est le dernier retrait débité dont le virement n'est pas confirmé (sans
//   identifiant de virement), faute de statut dans le grand livre ; sa lecture en échec l'omet.
// Le numéro de téléphone (colonne privée) n'est lu que pour préremplir le champ de CET étudiant quand les paiements
// sont ouverts : jamais journalisé, jamais renvoyé autrement qu'en version complète pour le champ et masquée
// (deux derniers chiffres) pour l'affichage.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getWallet, getWalletTransactions } from "@/lib/actions/wallet.actions"
import { getMyProfile } from "@/lib/actions/profile.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { escrowSplit } from "@/lib/app/money"
import { firstName } from "@/lib/vitrine/public-name"
import { parseStudentWalletFilter, studentWalletFilterTypes } from "@/lib/student-space/student-wallet-tx"
import { formatLocalPhone, maskLocalPhoneLastTwo } from "@/lib/client-space/withdraw-schema"

const ERR_WALLET = "Impossible de charger ton portefeuille."
const ERR_MORE = "Impossible de charger les mouvements suivants."
const ERR_PREFILL = "Impossible de lire ton numéro."

const PAGE_SIZE = 20
const MAX_OFFSET = 100000
const TO_COME_LIMIT = 100
const LEDGER_PAGE_SIZE = 1000
const LEDGER_MAX_PAGES = 5
const WEEKS = 8
const DAY_MS = 24 * 60 * 60 * 1000
const BENIN_OFFSET_MS = 60 * 60 * 1000 // UTC+1 toute l'année

const typesOf = (filterId) => studentWalletFilterTypes(parseStudentWalletFilter(filterId)) ?? undefined

const toTransaction = (row) => ({
  id: row.id,
  type: row.type,
  amount: Math.abs(Number(row.amount) || 0),
  createdAt: row.created_at,
  missionId: row.mission_id ?? null,
  missionTitle: row.missions?.title ?? null,
})

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)

// Lundi (jour du Bénin) de la semaine qui contient `ms`, en millisecondes UTC à minuit de ce jour.
function weekStartMs(ms) {
  const local = new Date(ms + BENIN_OFFSET_MS)
  const sinceMonday = (local.getUTCDay() + 6) % 7
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday)
}

/**
 * Gains lus dans le grand livre : `release` de l'étudiant (son net), par semaine sur les 8 dernières
 * (la semaine en cours en dernier) et au total. `null` si une lecture échoue ou dépasse le plafond.
 */
async function readEarnings(supabase, userId, now) {
  const currentWeek = weekStartMs(now)
  const firstWeek = currentWeek - (WEEKS - 1) * 7 * DAY_MS
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: isoDay(firstWeek + i * 7 * DAY_MS), total: 0 }))
  let total = 0
  for (let page = 0; page < LEDGER_MAX_PAGES; page++) {
    const from = page * LEDGER_PAGE_SIZE
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("amount, created_at")
      .eq("user_id", userId)
      .eq("type", "release")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + LEDGER_PAGE_SIZE - 1)
    if (error) {
      console.error("[getStudentWallet] gains", error.message)
      return null
    }
    const rows = data ?? []
    for (const row of rows) {
      const amount = Math.abs(Number(row.amount) || 0)
      total += amount
      const at = Date.parse(row.created_at)
      if (!Number.isFinite(at)) continue
      const index = Math.floor((weekStartMs(at) - firstWeek) / (7 * DAY_MS))
      if (index >= 0 && index < WEEKS) weeks[index].total += amount
    }
    if (!Number.isFinite(total)) return null
    if (rows.length < LEDGER_PAGE_SIZE) {
      return { weeks, eightWeeks: weeks.reduce((sum, w) => sum + w.total, 0), total }
    }
  }
  return null
}

// Missions en cours où l'étudiant est retenu : sa part nette (escrowSplit) reste en séquestre jusqu'à la validation.
async function readToCome(supabase, userId) {
  const { data, error } = await supabase
    .from("missions")
    .select("id, title, budget, client_id")
    .eq("selected_student_id", userId)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(TO_COME_LIMIT)
  if (error) {
    console.error("[getStudentWallet] à venir", error.message)
    return null
  }
  const rows = data ?? []
  const clientIds = [...new Set(rows.map((m) => m.client_id).filter(Boolean))]
  let names = new Map()
  if (clientIds.length > 0) {
    const res = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds)
    if (res.error) {
      console.error("[getStudentWallet] à venir", res.error.message)
      return null
    }
    names = new Map((res.data ?? []).map((p) => [p.user_id, p.full_name]))
  }
  const missions = rows.map((m) => ({
    id: m.id,
    title: m.title,
    clientName: firstName(names.get(m.client_id), { fallback: "ton client" }),
    budget: Math.round(Number(m.budget) || 0),
    net: escrowSplit(m.budget).student,
  }))
  return { total: missions.reduce((sum, m) => sum + m.net, 0), missions }
}

// Dernier retrait débité dont le virement n'est pas confirmé. Lecture en échec : omis (jamais une erreur de page).
async function readPendingWithdrawal(supabase, userId) {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, amount, created_at")
    .eq("user_id", userId)
    .eq("type", "withdrawal")
    .is("fedapay_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) {
    console.error("[getStudentWallet] retrait en cours", error.message)
    return null
  }
  const row = data?.[0]
  return row ? { amount: Math.abs(Number(row.amount) || 0), createdAt: row.created_at } : null
}

/**
 * @typedef {Object} StudentWalletTransaction
 * @property {string} id
 * @property {string} type Valeur en base : l'afficher par studentWalletTxView()
 * @property {number} amount Valeur absolue (FCFA) : le signe vient du type
 * @property {string} createdAt
 * @property {string|null} missionId
 * @property {string|null} missionTitle
 *
 * @typedef {Object} StudentWalletData
 * @property {{ available: number }} wallet
 * @property {{ weeks: Array<{ start: string, total: number }>, eightWeeks: number, total: number }|null} gains
 *   Gains (net de l'étudiant) : 8 semaines du plus ancien au courant (`start` = lundi `YYYY-MM-DD`), leur somme, le total.
 *   `null` si la lecture a échoué
 * @property {{ total: number, missions: Array<{ id: string, title: string, clientName: string, budget: number, net: number }> }|null} toCome
 *   Missions en cours où l'étudiant est retenu, `net` = sa part (escrowSplit). `null` si la lecture a échoué
 * @property {{ amount: number, createdAt: string }|null} pendingWithdrawal
 * @property {StudentWalletTransaction[]} transactions Première page de l'historique du filtre
 * @property {boolean} hasMore
 * @property {string} filter Filtre appliqué (valeur validée)
 */

/**
 * Toutes les données de la page Portefeuille étudiant. Un solde ou un historique illisible donne une erreur
 * (jamais un zéro) ; les blocs secondaires illisibles (gains, à venir, retrait en cours) sont omis (`null`).
 * @param {{ filtre?: string|string[] }} [params]
 * @returns {Promise<{ data: StudentWalletData } | { error: string }>}
 */
export async function getStudentWallet({ filtre } = {}) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: ERR_WALLET }
    const { supabase, user } = auth
    const filter = parseStudentWalletFilter(filtre)

    const [walletRes, txRes, gains, toCome, pendingWithdrawal] = await Promise.all([
      getWallet(user.id),
      getWalletTransactions(user.id, PAGE_SIZE + 1, 0, typesOf(filter)),
      readEarnings(supabase, user.id, Date.now()),
      readToCome(supabase, user.id),
      readPendingWithdrawal(supabase, user.id),
    ])
    if (walletRes.error || !Array.isArray(txRes)) return { error: ERR_WALLET }

    return {
      data: {
        wallet: { available: Number(walletRes.available) || 0 },
        gains,
        toCome,
        pendingWithdrawal,
        transactions: txRes.slice(0, PAGE_SIZE).map(toTransaction),
        hasMore: txRes.length > PAGE_SIZE,
        filter,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentWallet]", err)
    return { error: ERR_WALLET }
  }
}

/**
 * Page suivante de l'historique (« Voir plus »).
 * @param {{ filtre?: string, offset?: number }} params
 * @returns {Promise<{ transactions: StudentWalletTransaction[], hasMore: boolean } | { error: string }>}
 */
export async function getStudentWalletMore({ filtre, offset } = {}) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: ERR_MORE }
    const start = Number.isInteger(offset) && offset >= 0 ? Math.min(offset, MAX_OFFSET) : 0
    const res = await getWalletTransactions(auth.user.id, PAGE_SIZE + 1, start, typesOf(filtre))
    if (!Array.isArray(res)) return { error: ERR_MORE }
    return { transactions: res.slice(0, PAGE_SIZE).map(toTransaction), hasMore: res.length > PAGE_SIZE }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentWalletMore]", err)
    return { error: ERR_MORE }
  }
}

/**
 * Numéro du profil de l'étudiant pour préremplir le retrait. Paiements coupés : rien n'est lu.
 * `phone` (« 01 97 45 21 08 ») ne sert qu'à préremplir le champ ; `masked` (« •• •• •• •• 08 ») est le seul
 * format d'affichage. "" quand le numéro est absent ou invalide.
 * @returns {Promise<{ phone: string, masked: string } | { error: string }>}
 */
export async function getStudentWithdrawPrefill() {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: ERR_PREFILL }
    if (!paymentsEnabled()) return { phone: "", masked: "" }
    const res = await getMyProfile()
    if (res.error) return { phone: "", masked: "" }
    const raw = res.profile?.phone
    return { phone: formatLocalPhone(raw), masked: maskLocalPhoneLastTwo(raw) }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentWithdrawPrefill]", err)
    return { error: ERR_PREFILL }
  }
}
