"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { requireUser } from "@/lib/auth/require-role"
import { PAYMENTS_PENDING_COPY, paymentsEnabled } from "@/lib/constants/payments"
import {
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAWAL_AMOUNT,
} from "@/lib/supabase/database.constants"

const MAX_TRANSACTIONS_LIMIT = 50
const ERR_WALLET_READ = "Impossible de charger ton portefeuille."
const ERR_FORBIDDEN_WALLET = "Tu n'as pas accès à ce portefeuille."
const ERR_PAYMENTS_PENDING = PAYMENTS_PENDING_COPY.wallet.title

// Détail d'une erreur de fonction Edge, pour le journal serveur seulement.
// error.context est le fetch Response brut - on lit via .text() pour éviter
// les échecs silencieux de .json() quand Content-Type est absent ou le body vide.
async function readFnErrorDetail(error) {
  try {
    const resp = error?.context
    if (!resp || typeof resp.text !== "function") return error?.message ?? ""
    const text = await resp.text()
    if (!text) return error?.message ?? ""
    try {
      const body = JSON.parse(text)
      return body?.error ?? body?.message ?? error?.message ?? ""
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return error?.message ?? ""
  }
}

// Message renvoyé au navigateur : seul le message de pause des paiements est relayé,
// tout le reste devient le message neutre `fallback` (le détail part dans le journal).
async function readFnError(error, fallback) {
  const detail = await readFnErrorDetail(error)
  const pending = Object.values(PAYMENTS_PENDING_COPY.wallet)
  if (typeof detail === "string" && pending.includes(detail)) return { message: detail, detail }
  return { message: fallback, detail }
}

// Identité dérivée de la session. Un userId passé en argument n'est jamais une autorité :
// s'il est fourni et diffère de la session, l'appel est refusé.
async function resolveWalletUser(userId) {
  const auth = await requireUser()
  if (auth.error) return { error: auth.error }
  if (userId !== undefined && userId !== null && userId !== auth.user.id) {
    return { error: ERR_FORBIDDEN_WALLET }
  }
  return { supabase: auth.supabase, user: auth.user }
}

// Jeton de session de l'utilisateur courant (null si pas de session).
async function getAccessToken(supabase) {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

// ─── getWallet ────────────────────────────────────────────────────────────────

export async function getWallet(userId) {
  const auth = await resolveWalletUser(userId)
  if (auth.error) return { error: auth.error }

  const { data: wallet, error } = await auth.supabase
    .from("wallets")
    .select("*")
    .eq("user_id", auth.user.id)
    .single()

  if (error) {
    console.error("[getWallet]", error.message)
    return { error: ERR_WALLET_READ }
  }

  const available = (wallet.balance ?? 0) - (wallet.reserved ?? 0)
  return { wallet, available }
}

// ─── getWalletTransactions ────────────────────────────────────────────────────

export async function getWalletTransactions(userId, limit = 20, offset = 0) {
  const auth = await resolveWalletUser(userId)
  if (auth.error) return { error: auth.error }

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), MAX_TRANSACTIONS_LIMIT) : 20
  const safeOffset = Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0

  const { data, error } = await auth.supabase
    .from("wallet_transactions")
    .select("*, missions(title)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  if (error) {
    console.error("[getWalletTransactions]", error.message)
    return { error: ERR_WALLET_READ }
  }
  return data
}

// ─── initiateDeposit ──────────────────────────────────────────────────────────

export async function initiateDeposit({ amount }) {
  if (!paymentsEnabled()) return { error: ERR_PAYMENTS_PENDING }
  if (!amount || amount < MIN_DEPOSIT_AMOUNT) {
    return { error: `Montant minimum ${MIN_DEPOSIT_AMOUNT.toLocaleString("fr-FR")} FCFA` }
  }

  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const supabase = await createClient()
  const accessToken = await getAccessToken(supabase)
  if (!accessToken) return { error: "Session expirée. Reconnectez-vous." }

  const { data, error } = await supabase.functions.invoke(
    "create-deposit-transaction",
    {
      body: { amount },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (error) {
    if (error?.context?.status === 401) return { error: "Session expirée. Reconnectez-vous." }
    const { message, detail } = await readFnError(error, "Le dépôt n'a pas pu être initié. Réessaie dans un instant.")
    console.error("[initiateDeposit]", detail)
    return { error: message }
  }
  if (!data?.paymentUrl) return { error: "URL de paiement manquante" }

  return { paymentUrl: data.paymentUrl }
}

// ─── initiateWithdrawal ───────────────────────────────────────────────────────

export async function initiateWithdrawal({ amount, phone, operator }) {
  if (!paymentsEnabled()) return { error: ERR_PAYMENTS_PENDING }
  if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
    return { error: `Montant minimum ${MIN_WITHDRAWAL_AMOUNT.toLocaleString("fr-FR")} FCFA` }
  }

  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const { available, error: walletError } = await getWallet(user.id)
  if (walletError) return { error: ERR_WALLET_READ }
  if (available < amount) return { error: "Solde insuffisant" }

  const supabase = await createClient()
  const accessToken = await getAccessToken(supabase)
  if (!accessToken) return { error: "Session expirée. Reconnectez-vous." }

  // L'identité n'est jamais envoyée : la fonction la déduit du jeton de session
  const { data, error } = await supabase.functions.invoke(
    "process-withdrawal",
    {
      body: { amount, phone, operator },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (error) {
    if (error?.context?.status === 401) return { error: "Session expirée. Reconnectez-vous." }
    const { message, detail } = await readFnError(error, "Le retrait n'a pas pu être initié. Réessaie dans un instant.")
    console.error("[initiateWithdrawal]", detail)
    return { error: message }
  }

  return { success: true, message: "Retrait initié avec succès" }
}

// ─── getWalletStats ───────────────────────────────────────────────────────────

export async function getWalletStats(userId) {
  const auth = await resolveWalletUser(userId)
  if (auth.error) return { error: auth.error }

  const { data, error } = await auth.supabase
    .from("wallet_transactions")
    .select("type, amount")
    .eq("user_id", auth.user.id)

  if (error) {
    console.error("[getWalletStats]", error.message)
    return { error: ERR_WALLET_READ }
  }

  const sum = (type) =>
    (data ?? [])
      .filter((t) => t.type === type)
      .reduce((acc, t) => acc + (t.amount ?? 0), 0)

  return {
    totalDeposited:   sum("deposit"),
    totalEarned:      sum("release"),
    totalWithdrawn:   sum("withdrawal"),
    totalCommissions: sum("commission"),
  }
}
