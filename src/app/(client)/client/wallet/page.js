import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import {
  getWallet,
  getWalletTransactions,
  getWalletStats,
} from "@/lib/actions/wallet.actions"
import { WalletClientShell } from "@/components/client/wallet-shell"

export const metadata = { title: "Mon Wallet — EduCash" }

export default async function ClientWalletPage({ searchParams }) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const resolvedParams = await searchParams
  const depositStatus  = resolvedParams?.status ?? null

  const supabase = await createClient()

  const [
    walletResult,
    transactionsResult,
    statsResult,
    { data: activeMissions },
  ] = await Promise.all([
    getWallet(user.id),
    getWalletTransactions(user.id, 100), // on charge 100 — le filtre est côté client
    getWalletStats(user.id),
    supabase
      .from("missions")
      .select("id, title, budget, status")
      .eq("client_id", user.id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false }),
  ])

  if (walletResult.error) redirect("/client/dashboard")

  const { wallet, available } = walletResult
  const transactions = Array.isArray(transactionsResult) ? transactionsResult : []
  const stats = statsResult.error
    ? { totalDeposited: 0, totalEarned: 0, totalWithdrawn: 0, totalCommissions: 0 }
    : statsResult

  return (
    <div className="p-4 lg:p-8 max-w-[800px] mx-auto flex flex-col gap-6">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-gray-900">Mon Wallet</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gérez vos fonds et suivez vos mouvements
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <ShieldCheck size={13} />
          Fonds sécurisés ✓
        </span>
      </div>

      {/* Notification retour FedaPay */}
      {depositStatus === "cancelled" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          Le paiement a été annulé. Votre wallet n&apos;a pas été modifié.
        </div>
      )}

      {/* ── Shell client (WalletCard + Stats + Missions + Historique + Modals) */}
      <WalletClientShell
        wallet={wallet}
        available={available}
        transactions={transactions}
        stats={stats}
        activeMissions={activeMissions ?? []}
      />
    </div>
  )
}
