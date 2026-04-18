import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Clock,
} from "lucide-react"

export const metadata = { title: "Wallets — Admin EduCash" }

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
}

function KpiCard({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-xl font-black text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default async function AdminWalletsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== "admin") redirect("/auth/login")

  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)
  const firstOfMonthIso = firstOfMonth.toISOString()

  const [
    { data: allWallets },
    { data: recentDeposits },
    { data: pendingWithdrawals },
    { data: commissionsThisMonth },
  ] = await Promise.all([
    // All wallets with user join for name
    supabase
      .from("wallets")
      .select("id, user_id, balance, reserved, profiles(full_name, role)")
      .order("balance", { ascending: false })
      .limit(20),

    // Last 10 deposits
    supabase
      .from("wallet_transactions")
      .select("id, user_id, amount, balance_after, created_at, profiles(full_name)")
      .eq("type", "deposit")
      .order("created_at", { ascending: false })
      .limit(10),

    // Pending withdrawals (no fedapay_id yet means pending)
    supabase
      .from("wallet_transactions")
      .select("id, user_id, amount, created_at, note, profiles(full_name)")
      .eq("type", "withdrawal")
      .is("fedapay_id", null)
      .order("created_at", { ascending: false })
      .limit(20),

    // Commissions this month from old transactions table
    supabase
      .from("transactions")
      .select("commission")
      .eq("status", "paid")
      .gte("created_at", firstOfMonthIso),
  ])

  const totalBalance   = (allWallets ?? []).reduce((s, w) => s + (w.balance ?? 0), 0)
  const totalReserved  = (allWallets ?? []).reduce((s, w) => s + (w.reserved ?? 0), 0)
  const totalAvailable = totalBalance - totalReserved
  const commissionsMonth = (commissionsThisMonth ?? []).reduce((s, t) => s + (t.commission ?? 0), 0)

  return (
    <div className="p-6 lg:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Wallets</h1>
        <p className="text-sm text-gray-500 mt-0.5">Supervision des fonds en circulation sur la plateforme</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total en circulation"
          value={`${fmt(Math.round(totalBalance))} FCFA`}
          sub="Tous les wallets"
          icon={Wallet}
          color="text-[#1A6B4A]"
          bg="bg-[#f0faf5]"
        />
        <KpiCard
          label="Fonds réservés"
          value={`${fmt(Math.round(totalReserved))} FCFA`}
          sub="Missions en cours"
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <KpiCard
          label="Fonds disponibles"
          value={`${fmt(Math.round(totalAvailable))} FCFA`}
          sub="Disponible au retrait"
          icon={ArrowUpRight}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Commissions ce mois"
          value={`${fmt(Math.round(commissionsMonth))} FCFA`}
          sub="Missions terminées"
          icon={TrendingUp}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Top wallets — 2 cols */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-black text-gray-900">Top wallets</h2>
            <p className="text-xs text-gray-400 mt-0.5">Classés par solde décroissant</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Utilisateur", "Rôle", "Solde", "Réservé", "Disponible"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(allWallets ?? []).map((w) => {
                  const available = (w.balance ?? 0) - (w.reserved ?? 0)
                  const role = w.profiles?.role ?? "—"
                  const name = w.profiles?.full_name ?? "—"
                  const initial = name.charAt(0).toUpperCase()
                  return (
                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-black">{initial}</span>
                          </div>
                          <span className="font-semibold text-gray-900 truncate max-w-[140px]">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                          role === "client" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        }`}>
                          {role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {fmt(w.balance ?? 0)}
                      </td>
                      <td className="px-5 py-3.5 text-amber-600 font-medium">
                        {w.reserved ? fmt(w.reserved) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={available < 0 ? "text-red-500 font-bold" : "text-[#1A6B4A] font-bold"}>
                          {fmt(available)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {!allWallets?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                      Aucun wallet trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Retraits en attente — 1 col */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">Retraits en attente</h2>
            {pendingWithdrawals?.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">
                {pendingWithdrawals.length}
              </span>
            )}
          </div>
          <div className="flex flex-col divide-y divide-gray-50 flex-1">
            {!pendingWithdrawals?.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <ArrowUpRight size={28} className="text-gray-200" />
                <p className="text-sm font-semibold text-gray-500">Aucun retrait en attente</p>
              </div>
            ) : (
              pendingWithdrawals.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <ArrowUpRight size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {t.profiles?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(t.created_at)}</p>
                  </div>
                  <span className="text-sm font-black text-red-600 shrink-0">
                    -{fmt(t.amount)} <span className="text-[10px] font-normal text-gray-400">FCFA</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dernières recharges */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">Dernières recharges</h2>
          <p className="text-xs text-gray-400 mt-0.5">10 derniers dépôts confirmés</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Utilisateur", "Montant", "Nouveau solde", "Date"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(recentDeposits ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                        <ArrowDownLeft size={13} className="text-green-600" />
                      </div>
                      <span className="font-semibold text-gray-900">{t.profiles?.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-black text-green-600">
                    +{fmt(t.amount)} FCFA
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 font-medium">
                    {fmt(t.balance_after)} FCFA
                  </td>
                  <td className="px-6 py-3.5 text-gray-400 text-xs">
                    {formatDate(t.created_at)}
                  </td>
                </tr>
              ))}
              {!recentDeposits?.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
                    Aucun dépôt enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
