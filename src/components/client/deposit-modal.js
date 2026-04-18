"use client"

import { useState, useEffect } from "react"
import { X, Plus, AlertCircle } from "lucide-react"
import { initiateDeposit } from "@/lib/actions/wallet.actions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function DepositModal({ isOpen, onClose, currentBalance = 0 }) {
  const [amount,   setAmount]   = useState("")
  const [operator, setOperator] = useState("mtn")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  // Fermeture avec Echap
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  // Reset à la fermeture
  useEffect(() => {
    if (!isOpen) { setAmount(""); setError(""); setLoading(false) }
  }, [isOpen])

  if (!isOpen) return null

  const parsedAmount  = parseInt(amount) || 0
  const newBalance    = currentBalance + parsedAmount
  const amountInvalid = parsedAmount > 0 && parsedAmount < MIN_DEPOSIT_AMOUNT

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    if (parsedAmount < MIN_DEPOSIT_AMOUNT) {
      setError(`Montant minimum : ${fmt(MIN_DEPOSIT_AMOUNT)} FCFA`)
      return
    }

    setLoading(true)
    const result = await initiateDeposit({ amount: parsedAmount })
    setLoading(false)

    if (result?.error) {
      setError(result.error)
      return
    }

    if (result?.paymentUrl) {
      window.location.href = result.paymentUrl
    }
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0faf5] flex items-center justify-center">
              <Plus size={16} className="text-[#1A6B4A]" />
            </div>
            <h2 className="text-base font-black text-gray-900">Recharger mon wallet</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Montant */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Montant à recharger (FCFA)
            </label>
            <input
              type="number"
              min={MIN_DEPOSIT_AMOUNT}
              step={500}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError("") }}
              placeholder={`Min. ${fmt(MIN_DEPOSIT_AMOUNT)} FCFA`}
              className={`h-11 px-4 rounded-xl border text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 transition-colors ${
                amountInvalid ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
              }`}
            />
            {/* Aperçu nouveau solde */}
            {parsedAmount >= MIN_DEPOSIT_AMOUNT && (
              <p className="text-xs text-[#1A6B4A] font-medium">
                Vous aurez <strong>{fmt(newBalance)} FCFA</strong> disponibles
              </p>
            )}
            {amountInvalid && (
              <p className="text-xs text-red-500">
                Minimum {fmt(MIN_DEPOSIT_AMOUNT)} FCFA
              </p>
            )}
          </div>

          {/* Opérateur */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Opérateur</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 appearance-none cursor-pointer"
            >
              <option value="mtn">MTN Mobile Money</option>
              <option value="moov">Moov Money</option>
            </select>
          </div>

          {/* Note redirection */}
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Vous serez redirigé vers <strong>FedaPay</strong> pour effectuer le paiement de façon sécurisée.
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || parsedAmount < MIN_DEPOSIT_AMOUNT}
            className="w-full py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {loading ? "Redirection en cours…" : "Continuer vers le paiement"}
          </button>
        </form>
      </div>
    </div>
  )
}
