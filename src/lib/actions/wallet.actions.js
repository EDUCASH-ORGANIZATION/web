"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import {
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAWAL_AMOUNT,
} from "@/lib/supabase/database.constants"

// Extrait le vrai message d'erreur depuis une FunctionsHttpError.
// error.context est le fetch Response brut — on lit via .text() pour éviter
// les échecs silencieux de .json() quand Content-Type est absent ou le body vide.
async function readFnError(error, fallback) {
  try {
    const resp = error?.context
    if (!resp || typeof resp.text !== "function") return error?.message ?? fallback
    const text = await resp.text()
    if (!text) return error?.message ?? fallback
    try {
      const body = JSON.parse(text)
      return body?.error ?? body?.message ?? error?.message ?? fallback
    } catch {
      return text.length < 300 ? text : (error?.message ?? fallback)
    }
  } catch {
    return error?.message ?? fallback
  }
}

// ─── getWallet ────────────────────────────────────────────────────────────────

export async function getWallet(userId) {
  const supabase = await createClient()

  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error) return { error: error.message }

  const available = (wallet.balance ?? 0) - (wallet.reserved ?? 0)
  return { wallet, available }
}

// ─── getWalletTransactions ────────────────────────────────────────────────────

export async function getWalletTransactions(userId, limit = 20, offset = 0) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*, missions(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message }
  return data
}

// ─── initiateDeposit ──────────────────────────────────────────────────────────

export async function initiateDeposit({ amount }) {
  if (!amount || amount < MIN_DEPOSIT_AMOUNT) {
    return { error: `Montant minimum ${MIN_DEPOSIT_AMOUNT.toLocaleString("fr-FR")} FCFA` }
  }

  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke(
    "create-deposit-transaction",
    { body: { userId: user.id, amount } }
  )

  if (error) {
    const message = await readFnError(error, "Erreur lors de l'initiation du dépôt")
    console.error("[initiateDeposit]", message)
    return { error: message }
  }
  if (!data?.paymentUrl) return { error: "URL de paiement manquante" }

  return { paymentUrl: data.paymentUrl }
}

// ─── initiateWithdrawal ───────────────────────────────────────────────────────

export async function initiateWithdrawal({ amount, phone, operator }) {
  if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
    return { error: `Montant minimum ${MIN_WITHDRAWAL_AMOUNT.toLocaleString("fr-FR")} FCFA` }
  }

  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const { available, error: walletError } = await getWallet(user.id)
  if (walletError) return { error: walletError }
  if (available < amount) return { error: "Solde insuffisant" }

  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke(
    "process-withdrawal",
    { body: { userId: user.id, amount, phone, operator } }
  )

  if (error) {
    const message = await readFnError(error, "Erreur lors du retrait")
    console.error("[initiateWithdrawal]", message)
    return { error: message }
  }

  return { success: true, message: data?.message ?? "Retrait initié avec succès" }
}

// ─── getWalletStats ───────────────────────────────────────────────────────────

export async function getWalletStats(userId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("type, amount")
    .eq("user_id", userId)

  if (error) return { error: error.message }

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
