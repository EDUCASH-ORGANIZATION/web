import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"
import {
  getWallet,
  getWalletTransactions,
  getWalletStats,
} from "@/lib/actions/wallet.actions"
import { StudentWalletShell } from "@/components/student/wallet-shell"

export const metadata = { title: "Mes gains — EduCash" }

export default async function StudentWalletPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/login")

  const supabase = await createClient()

  const [
    walletResult,
    transactionsResult,
    statsResult,
    { data: completedMissions },
  ] = await Promise.all([
    getWallet(user.id),
    getWalletTransactions(user.id, 100),
    getWalletStats(user.id),
    supabase
      .from("missions")
      .select("id, title, created_at, transactions(amount_student)")
      .eq("selected_student_id", user.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  if (walletResult.error) redirect("/dashboard")

  const { wallet, available } = walletResult
  const transactions = Array.isArray(transactionsResult) ? transactionsResult : []
  const stats = statsResult.error
    ? { totalDeposited: 0, totalEarned: 0, totalWithdrawn: 0, totalCommissions: 0 }
    : statsResult

  // Aplati : missions[i].amount_student depuis le join transactions
  const missionsWithAmount = (completedMissions ?? []).map((m) => ({
    ...m,
    amount_student: m.transactions?.[0]?.amount_student ?? null,
  }))

  return (
    <div className="p-4 lg:p-8 max-w-[800px] mx-auto flex flex-col gap-6">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-gray-900">Mes gains EduCash</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Retrouve tous tes paiements et retire tes gains
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <ShieldCheck size={13} />
          Paiement garanti avant la mission ✓
        </span>
      </div>

      {/* ── Shell client (WalletCard + Stats + Missions + Historique + Modal) */}
      <StudentWalletShell
        wallet={wallet}
        available={available}
        transactions={transactions}
        stats={stats}
        completedMissions={missionsWithAmount}
      />
    </div>
  )
}
