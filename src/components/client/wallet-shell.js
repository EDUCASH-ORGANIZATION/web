"use client"

import { useState } from "react"
import { WalletCard } from "@/components/shared/wallet-card"
import { DepositModal } from "@/components/client/deposit-modal"
import { WithdrawModal } from "@/components/client/withdraw-modal"
import {
  WALLET_TRANSACTION_LABELS,
  WALLET_TRANSACTION_COLORS,
} from "@/lib/supabase/database.constants"
import {
  ArrowDown, ArrowUp, RotateCcw, Banknote, ShieldCheck,
  Briefcase, ChevronDown,
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
  deposit:    <ArrowDown size={14} className="text-green-600" />,
  reserve:    <Briefcase size={14} className="text-orange-500" />,
  release:    <ArrowUp size={14} className="text-green-600" />,
  commission: <ShieldCheck size={14} className="text-gray-400" />,
  refund:     <RotateCcw size={14} className="text-blue-500" />,
  withdrawal: <Banknote size={14} className="text-red-500" />,
}

const SIGN = {
  deposit:    "+",
  release:    "+",
  refund:     "+",
  reserve:    "−",
  commission: "−",
  withdrawal: "−",
}

const FILTER_OPTIONS = [
  { value: "all",        label: "Tous les mouvements" },
  { value: "deposit",    label: "Recharges" },
  { value: "reserve",    label: "Réservations" },
  { value: "refund",     label: "Remboursements" },
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

export function WalletClientShell({
  wallet,
  available,
  transactions,
  stats,
  activeMissions,
}) {
  const [depositOpen,  setDepositOpen]  = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [filter,       setFilter]       = useState("all")
  const [visibleCount, setVisibleCount] = useState(20)
  const [toast,        setToast]        = useState("")

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(""), 4000)
  }

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.type === filter)

  const visible = filtered.slice(0, visibleCount)

  const STATUS_MAP = {
    open:        { label: "Ouverte",  cls: "bg-blue-100 text-blue-700" },
    in_progress: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Wallet card avec actions */}
      <WalletCard
        balance={wallet.balance}
        reserved={wallet.reserved}
        available={available}
        role="client"
        showActions
        onDeposit={() => setDepositOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
      />

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total rechargé</p>
          <p className="text-xl font-black text-gray-900">
            {fmt(stats.totalDeposited)} <span className="text-sm font-bold text-gray-400">FCFA</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dépensé en missions</p>
          <p className="text-xl font-black text-gray-900">
            {fmt(Math.max(0, stats.totalDeposited - available - (wallet.reserved ?? 0)))} <span className="text-sm font-bold text-gray-400">FCFA</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Missions financées</p>
          <p className="text-xl font-black text-gray-900">{activeMissions.length}</p>
        </div>
      </div>

      {/* ── Missions financées ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
          <Briefcase size={15} className="text-[#1A6B4A]" />
          Missions financées actuellement
        </h2>
        {activeMissions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune mission active en ce moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeMissions.map((m) => {
              const status = STATUS_MAP[m.status] ?? STATUS_MAP.open
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-orange-500 font-medium">{fmt(m.budget)} FCFA réservés</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
              )
            })}
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

      {/* Modals */}
      <DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        currentBalance={available}
      />
      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        onSuccess={showToast}
      />
    </>
  )
}
