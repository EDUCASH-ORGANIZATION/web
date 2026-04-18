"use client"

import { useState, useEffect } from "react"
import { X, ArrowDown, Clock } from "lucide-react"
import { initiateWithdrawal } from "@/lib/actions/wallet.actions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function StudentWithdrawModal({ isOpen, onClose, available = 0, onSuccess, onError }) {
  const [amount,   setAmount]   = useState("")
  const [phone,    setPhone]    = useState("")
  const [operator, setOperator] = useState("mtn")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  useEffect(() => {
    if (!isOpen) return
    function onKey(e) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) { setAmount(""); setPhone(""); setError(""); setLoading(false) }
  }, [isOpen])

  if (!isOpen) return null

  const parsedAmount = parseInt(amount) || 0
  const amountError  =
    parsedAmount > 0 && parsedAmount < MIN_WITHDRAWAL_AMOUNT
      ? `Minimum ${fmt(MIN_WITHDRAWAL_AMOUNT)} FCFA`
      : parsedAmount > available
        ? "Montant supérieur à tes gains disponibles"
        : ""

  const canSubmit = parsedAmount >= MIN_WITHDRAWAL_AMOUNT && parsedAmount <= available && phone.trim() && !loading

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    if (!canSubmit) return

    setLoading(true)
    const result = await initiateWithdrawal({ amount: parsedAmount, phone: phone.trim(), operator })
    setLoading(false)

    if (result?.error) {
      onError?.(result.error)
      onClose()
      return
    }

    onSuccess?.("Virement en cours !")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#f0faf5] flex items-center justify-center">
                <ArrowDown size={16} className="text-[#1A6B4A]" />
              </div>
              <h2 className="text-base font-black text-gray-900">Retirer mes gains</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-10">
              Virement direct vers ton Mobile Money
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Montant */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Montant à retirer (FCFA)
            </label>
            <input
              type="number"
              min={MIN_WITHDRAWAL_AMOUNT}
              max={available}
              step={500}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError("") }}
              placeholder={`Min. ${fmt(MIN_WITHDRAWAL_AMOUNT)} FCFA`}
              className={`h-11 px-4 rounded-xl border text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 transition-colors ${
                amountError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
              }`}
            />
            <div className="flex items-center justify-between gap-2">
              {amountError
                ? <p className="text-xs text-red-500">{amountError}</p>
                : parsedAmount >= MIN_WITHDRAWAL_AMOUNT && parsedAmount <= available
                  ? <p className="text-xs text-[#1A6B4A] font-medium">
                      Tu recevras exactement <strong>{fmt(parsedAmount)} FCFA</strong>
                    </p>
                  : <span />
              }
              <p className="text-xs text-gray-400 ml-auto shrink-0">
                Disponible : <strong>{fmt(available)} FCFA</strong>
              </p>
            </div>
          </div>

          {/* Numéro Mobile Money */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Numéro Mobile Money
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError("") }}
              placeholder="Ex : 97000000"
              className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30"
            />
          </div>

          {/* Opérateur */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Opérateur</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: "mtn", label: "MTN Mobile Money" }, { value: "moov", label: "Moov Money" }].map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperator(op.value)}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors touch-manipulation ${
                    operator === op.value
                      ? "bg-[#1A6B4A] border-[#1A6B4A] text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note délai */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <Clock size={14} className="text-gray-400 shrink-0" />
            <p className="text-xs text-gray-500">
              Le virement arrive sous <strong>5 à 30 minutes</strong>
            </p>
          </div>

          {/* Erreur locale */}
          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {loading ? "Traitement en cours…" : "Retirer maintenant"}
          </button>
        </form>
      </div>
    </div>
  )
}
