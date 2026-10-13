"use server"

// Lectures de la page Portefeuille client (C14 à C16). Toute action commence par requireRole(["client"]) :
// les lectures partagées (getWallet, getWalletTransactions, getMyProfile) n'ont que requireUser.
// Plafonds de lecture connus (documentés aussi dans .agents/tasks/RD-CLIENT-01/plan.md) :
// - 100 missions financées au plus (FUNDED_LIMIT), les plus récentes d'abord ;
// - l'historique est lu par pages de 20 mouvements (une lecture de 21 pour savoir s'il en reste).
// Le numéro de téléphone (colonne privée) n'est lu que pour pré-remplir le champ de CET utilisateur
// quand les paiements sont ouverts : jamais journalisé, jamais renvoyé autrement.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getWallet, getWalletTransactions } from "@/lib/actions/wallet.actions"
import { getMyProfile } from "@/lib/actions/profile.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { firstName } from "@/lib/vitrine/public-name"
import { WALLET_FILTERS, parseWalletFilter } from "@/lib/app/wallet-tx"
import { formatLocalPhone } from "@/lib/client-space/withdraw-schema"

const ERR_WALLET = "Impossible de charger votre portefeuille."
const ERR_FUNDED = "Impossible de charger vos missions financées."
const ERR_MORE = "Impossible de charger les mouvements suivants."

const PAGE_SIZE = 20
const FUNDED_LIMIT = 100
const MAX_OFFSET = 100000

const typesOf = (filterId) => WALLET_FILTERS.find((f) => f.id === parseWalletFilter(filterId))?.types ?? undefined

const toTransaction = (row) => ({
  id: row.id,
  type: row.type,
  amount: Math.abs(Number(row.amount) || 0),
  createdAt: row.created_at,
  missionId: row.mission_id ?? null,
  missionTitle: row.missions?.title ?? null,
})

// Missions ouvertes et en cours du client avec le montant réservé. Le prénom de l'étudiant retenu vient des
// colonnes publiques de `profiles`.
async function readFunded(supabase, userId) {
  const { data, error } = await supabase
    .from("missions")
    .select("id, title, status, budget, deadline, selected_student_id, applications(id, status)")
    .eq("client_id", userId)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(FUNDED_LIMIT)
  if (error) {
    console.error("[getClientFundedMissions]", error.message)
    return { error: ERR_FUNDED }
  }
  const rows = data ?? []
  const studentIds = [...new Set(rows.filter((m) => m.status === "in_progress").map((m) => m.selected_student_id).filter(Boolean))]
  let names = new Map()
  if (studentIds.length > 0) {
    const res = await supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds)
    if (res.error) {
      console.error("[getClientFundedMissions]", res.error.message)
      return { error: ERR_FUNDED }
    }
    names = new Map((res.data ?? []).map((p) => [p.user_id, p.full_name]))
  }
  return {
    missions: rows.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      budget: Number(m.budget) || 0,
      deadline: m.deadline ?? null,
      studentName: m.status === "in_progress" ? firstName(names.get(m.selected_student_id), { fallback: "" }) || null : null,
      pendingCount: (m.applications ?? []).filter((a) => a.status === "pending").length,
    })),
  }
}

/**
 * Missions ouvertes et en cours du client connecté, avec le montant réservé (budget) de chacune.
 * @returns {Promise<{ missions: Array<{
 *   id: string, title: string, status: "open"|"in_progress", budget: number, deadline: string|null,
 *   studentName: string|null, pendingCount: number }> } | { error: string }>}
 */
export async function getClientFundedMissions() {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: ERR_FUNDED }
    return await readFunded(auth.supabase, auth.user.id)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getClientFundedMissions]", err)
    return { error: ERR_FUNDED }
  }
}

/**
 * @typedef {Object} WalletTransaction
 * @property {string} id
 * @property {string} type Valeur en base : l'afficher par walletTxView()
 * @property {number} amount Valeur absolue (FCFA) : le signe vient du type
 * @property {string} createdAt
 * @property {string|null} missionId
 * @property {string|null} missionTitle
 *
 * @typedef {Object} ClientWalletData
 * @property {{ available: number, escrow: number, total: number }} wallet
 * @property {Array<object>|null} funded Missions financées, null si leur lecture a échoué
 * @property {WalletTransaction[]} transactions Première page de l'historique du filtre
 * @property {boolean} hasMore Reste-t-il des mouvements après cette page
 * @property {string} filter Filtre appliqué (valeur validée)
 * @property {string} phone Numéro de l'utilisateur « 01 97 45 21 08 » pour pré-remplir le retrait ("" si paiements coupés ou inconnu)
 */

/**
 * Toutes les données de la page Portefeuille : solde, missions financées, première page de l'historique
 * (filtre `?filtre=`), numéro à pré-remplir.
 * @param {{ filtre?: string|string[] }} [params]
 * @returns {Promise<{ data: ClientWalletData } | { error: string }>}
 */
export async function getClientWalletPage({ filtre } = {}) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: ERR_WALLET }
    const { supabase, user } = auth
    const filter = parseWalletFilter(filtre)

    const [walletRes, txRes, fundedRes] = await Promise.all([
      getWallet(user.id),
      getWalletTransactions(user.id, PAGE_SIZE + 1, 0, typesOf(filter)),
      readFunded(supabase, user.id),
    ])
    // Un solde ou un historique illisible ne se remplace pas par un zéro : la page passe en erreur.
    if (walletRes.error || !Array.isArray(txRes)) return { error: ERR_WALLET }

    let phone = ""
    if (paymentsEnabled()) {
      const profileRes = await getMyProfile()
      phone = profileRes.error ? "" : formatLocalPhone(profileRes.profile?.phone)
    }

    const reserved = Number(walletRes.wallet?.reserved) || 0
    return {
      data: {
        wallet: {
          available: Number(walletRes.available) || 0,
          escrow: reserved,
          total: Number(walletRes.wallet?.balance) || 0,
        },
        funded: fundedRes.error ? null : fundedRes.missions,
        transactions: txRes.slice(0, PAGE_SIZE).map(toTransaction),
        hasMore: txRes.length > PAGE_SIZE,
        filter,
        phone,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getClientWalletPage]", err)
    return { error: ERR_WALLET }
  }
}

/**
 * Page suivante de l'historique (« Voir plus »).
 * @param {{ filtre?: string, offset?: number }} params
 * @returns {Promise<{ transactions: WalletTransaction[], hasMore: boolean } | { error: string }>}
 */
export async function getClientWalletMoreTransactions({ filtre, offset } = {}) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: ERR_MORE }
    const start = Number.isInteger(offset) && offset >= 0 ? Math.min(offset, MAX_OFFSET) : 0
    const res = await getWalletTransactions(auth.user.id, PAGE_SIZE + 1, start, typesOf(filtre))
    if (!Array.isArray(res)) return { error: ERR_MORE }
    return { transactions: res.slice(0, PAGE_SIZE).map(toTransaction), hasMore: res.length > PAGE_SIZE }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getClientWalletMoreTransactions]", err)
    return { error: ERR_MORE }
  }
}
