"use client"

import { useState, useEffect } from "react"
import { X, ArrowDown, AlertTriangle } from "lucide-react"
import { initiateWithdrawal } from "@/lib/actions/wallet.actions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function WithdrawModal({ isOpen, onClose, available = 0, onSuccess }) {
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
        ? "Montant supérieur au solde disponible"
        : ""

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    if (parsedAmount < MIN_WITHDRAWAL_AMOUNT) {
      setError(`Montant minimum : ${fmt(MIN_WITHDRAWAL_AMOUNT)} FCFA`)
      return
    }
    if (parsedAmount > available) {
      setError("Solde disponible insuffisant")
      return
    }
    if (!phone.trim()) {
      setError("Numéro Mobile Money requis")
      return
    }

    setLoading(true)
    const result = await initiateWithdrawal({ amount: parsedAmount, phone: phone.trim(), operator })
    setLoading(false)

    if (result?.error) {
      setError(result.error)
      return
    }

    onSuccess?.("Retrait initié — virement sous 24h")
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <ArrowDown size={16} className="text-gray-600" />
            </div>
            <h2 className="text-base font-black text-gray-900">Retirer des fonds</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Note délai */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Délai de traitement : 24 heures.</strong>{" "}
            Le virement sera envoyé sur votre Mobile Money après vérification.
          </p>
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
            <div className="flex items-center justify-between">
              {amountError
                ? <p className="text-xs text-red-500">{amountError}</p>
                : <span />
              }
              <p className="text-xs text-gray-400 ml-auto">
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
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30 appearance-none cursor-pointer"
            >
              <option value="mtn">MTN Mobile Money</option>
              <option value="moov">Moov Money</option>
            </select>
          </div>

          {/* Erreur globale */}
          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !!amountError || parsedAmount < MIN_WITHDRAWAL_AMOUNT || !phone.trim()}
            className="w-full py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {loading ? "Traitement en cours…" : "Demander le retrait"}
          </button>
        </form>
      </div>
    </div>
  )
}
