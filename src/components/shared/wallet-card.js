"use client"

import Link from "next/link"
import { Plus, ArrowDown, Wallet } from "lucide-react"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function WalletCard({
  balance   = 0,
  reserved  = 0,
  available = 0,
  role,
  showActions = false,
  onDeposit,
  onWithdraw,
}) {
  const walletHref     = role === "client" ? "/client/wallet" : "/student/wallet"
  const canWithdraw    = available >= MIN_WITHDRAWAL_AMOUNT
  const hasReservation = role === "client" && reserved > 0

  return (
    <div className="bg-white rounded-xl shadow-md p-6 flex flex-col gap-5">

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#f0faf5] flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-[#1A6B4A]" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Mon wallet EduCash</p>
      </div>

      {/* ── Solde disponible ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <p className="text-3xl font-bold text-green-700 leading-none">
          {fmt(available)}{" "}
          <span className="text-lg font-semibold text-green-600">FCFA</span>
        </p>

        {hasReservation && (
          <p className="text-xs text-orange-500 font-medium mt-1">
            dont {fmt(reserved)} FCFA réservés pour missions en cours
          </p>
        )}
      </div>

      {/* ── Grille solde total / réservé (client uniquement) ─────── */}
      {role === "client" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              Solde total
            </p>
            <p className="text-sm font-bold text-gray-700">
              {fmt(balance)} <span className="text-xs font-medium text-gray-400">FCFA</span>
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-0.5">
              Réservé
            </p>
            <p className="text-sm font-bold text-orange-600">
              {fmt(reserved)} <span className="text-xs font-medium text-orange-400">FCFA</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────── */}
      {showActions && (
        <div className="flex flex-col gap-2">
          {role === "client" && (
            <>
              <button
                type="button"
                onClick={onDeposit}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
              >
                <Plus size={16} />
                Recharger
              </button>

              {available > 0 && (
                <button
                  type="button"
                  onClick={onWithdraw}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 transition-colors touch-manipulation"
                >
                  <ArrowDown size={16} />
                  Retirer
                </button>
              )}
            </>
          )}

          {role === "student" && (
            <div className="relative group">
              <button
                type="button"
                onClick={canWithdraw ? onWithdraw : undefined}
                disabled={!canWithdraw}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors touch-manipulation ${
                  canWithdraw
                    ? "bg-[#1A6B4A] text-white hover:bg-[#155a3d]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <ArrowDown size={16} />
                Retirer mes gains
              </button>

              {!canWithdraw && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Minimum {fmt(MIN_WITHDRAWAL_AMOUNT)} FCFA
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Lien historique ───────────────────────────────────────── */}
      <div className="flex justify-end">
        <Link
          href={walletHref}
          className="text-sm font-semibold text-[#1A6B4A] hover:underline"
        >
          Voir l&apos;historique →
        </Link>
      </div>
    </div>
  )
}
