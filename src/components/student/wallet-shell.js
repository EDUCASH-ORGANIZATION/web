"use client"

import { useState } from "react"
import { WalletCard } from "@/components/shared/wallet-card"
import { StudentWithdrawModal } from "@/components/student/withdraw-modal"
import {
  WALLET_TRANSACTION_LABELS,
  WALLET_TRANSACTION_COLORS,
} from "@/lib/supabase/database.constants"
import {
  ArrowUp, RotateCcw, Banknote, ShieldCheck,
  Briefcase, ChevronDown, CheckCircle2,
} from "lucide-react"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso))
}

const TYPE_ICONS = {
  release:    <ArrowUp size={14} className="text-green-600" />,
  commission: <ShieldCheck size={14} className="text-gray-400" />,
  refund:     <RotateCcw size={14} className="text-blue-500" />,
  withdrawal: <Banknote size={14} className="text-red-500" />,
}

const SIGN = {
  release:    "+",
  refund:     "+",
  commission: "−",
  withdrawal: "−",
}

const FILTER_OPTIONS = [
  { value: "all",        label: "Tous les mouvements" },
  { value: "release",    label: "Gains reçus" },
  { value: "withdrawal", label: "Retraits" },
]

function TransactionItem({ tx }) {
  const label = WALLET_TRANSACTION_LABELS[tx.type] ?? tx.type
  const color = WALLET_TRANSACTION_COLORS[tx.type] ?? "text-gray-600"
  const icon  = TYPE_ICONS[tx.type] ?? null
  const sign  = SIGN[tx.type] ?? ""

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {tx.missions?.title && (
          <p className="text-xs text-gray-400 truncate">{tx.missions.title}</p>
        )}
        <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
      </div>
      <p className={`text-sm font-bold shrink-0 ${color}`}>
        {sign}{fmt(tx.amount)} FCFA
      </p>
    </div>
  )
}

export function StudentWalletShell({ wallet, available, transactions, stats, completedMissions }) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [filter,       setFilter]       = useState("all")
  const [visibleCount, setVisibleCount] = useState(20)
  const [toast,        setToast]        = useState({ msg: "", type: "success" })

  function showToast(msg, type = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 4000)
  }

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.type === filter)

  const visible = filtered.slice(0, visibleCount)

  return (
    <>
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg ${
          toast.type === "success" ? "bg-green-600" : "bg-red-500"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Wallet card */}
      <WalletCard
        balance={wallet.balance}
        reserved={0}
        available={available}
        role="student"
        showActions
        onWithdraw={() => setWithdrawOpen(true)}
      />

      {/* ── Stats gains ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total gagné</p>
          <p className="text-xl font-black text-green-700">
            {fmt(stats.totalEarned)} <span className="text-sm font-bold text-green-500">FCFA</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total retiré</p>
          <p className="text-xl font-black text-gray-900">
            {fmt(stats.totalWithdrawn)} <span className="text-sm font-bold text-gray-400">FCFA</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Commissions prélevées</p>
          <p className="text-xl font-black text-gray-400">
            {fmt(stats.totalCommissions)} <span className="text-sm font-bold text-gray-300">FCFA</span>
          </p>
        </div>
      </div>

      {/* ── Missions rémunérées ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-[#1A6B4A]" />
          Missions rémunérées
        </h2>
        {completedMissions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune mission terminée pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-col">
            {completedMissions.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(m.created_at)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {m.amount_student != null && (
                    <span className="text-sm font-bold text-green-600">
                      +{fmt(m.amount_student)} FCFA
                    </span>
                  )}
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                    Terminée
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Historique ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-black text-gray-900">Historique des mouvements</h2>
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setVisibleCount(20) }}
              className="h-9 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 appearance-none cursor-pointer"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">Aucun mouvement pour ce filtre.</p>
        ) : (
          <div className="flex flex-col">
            {visible.map((tx) => (
              <TransactionItem key={tx.id} tx={tx} />
            ))}
          </div>
        )}

        {filtered.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + 20)}
            className="self-center text-sm font-semibold text-[#1A6B4A] hover:underline py-1"
          >
            Charger plus ({filtered.length - visibleCount} restants)
          </button>
        )}
      </div>

      {/* Modal retrait */}
      <StudentWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg)   => showToast(msg, "error")}
      />
    </>
  )
}
