"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, CheckCircle, Loader2, ShieldCheck, AlertTriangle } from "lucide-react"
import { confirmMission } from "@/lib/actions/mission.actions"
import { useToast } from "@/components/shared/toaster"
import { COMMISSION_RATE } from "@/lib/supabase/database.constants"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))
}

export function ConfirmMissionModal({
  missionId,
  missionTitle,
  studentName,
  budget,
  isOpen,
  onClose,
}) {
  const router       = useRouter()
  const { toast }    = useToast()
  const [loading, setLoading] = useState(false)

  const commission   = budget * COMMISSION_RATE
  const amountNet    = budget - commission
  const firstName    = studentName?.split(" ")[0] ?? "l'étudiant(e)"

  useEffect(() => {
    if (!isOpen) return
    function onKey(e) { if (e.key === "Escape" && !loading) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose, loading])

  if (!isOpen) return null

  async function handleConfirm() {
    setLoading(true)
    const result = await confirmMission(missionId)
    setLoading(false)

    if (result?.error) {
      toast({ message: result.error, type: "error" })
      onClose()
      return
    }

    const paid = fmt(result.amountStudent ?? amountNet)
    toast({
      message: `${firstName} a été payé(e) ! ${paid} FCFA versés sur son wallet.`,
      type: "success",
    })
    onClose()
    router.push("/client/dashboard")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f0faf5] flex items-center justify-center">
              <CheckCircle size={16} className="text-[#1A6B4A]" />
            </div>
            <h2 className="text-base font-black text-gray-900">Confirmer la fin de mission</h2>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">

          {/* Résumé mission + étudiant */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-gray-700 line-clamp-2">{missionTitle}</p>
            <p className="text-xs text-gray-400">
              Étudiant sélectionné : <strong className="text-gray-700">{studentName}</strong>
            </p>
          </div>

          {/* Récapitulatif financier */}
          <div className="bg-[#f0faf5] border border-green-100 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Montant total</span>
              <span className="font-bold text-gray-900">{fmt(budget)} FCFA</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Commission EduCash (12%)</span>
              <span className="font-semibold text-gray-400">− {fmt(commission)} FCFA</span>
            </div>
            <div className="h-px bg-green-100 my-0.5" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-900">Versé à {firstName}</span>
              <span className="font-black text-[#1A6B4A] text-base">{fmt(amountNet)} FCFA</span>
            </div>
          </div>

          {/* Note irréversible */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Ces fonds seront prélevés de votre wallet{" "}
              <strong>instantanément</strong>. Cette action est <strong>irréversible</strong>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 touch-manipulation"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Traitement en cours…</>
              ) : (
                <><CheckCircle size={16} /> Confirmer et payer</>
              )}
            </button>

            {!loading && (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-sm font-semibold text-gray-500 hover:text-gray-700 py-2 transition-colors"
              >
                Annuler
              </button>
            )}
          </div>

          {/* Badge sécurité */}
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-[#1A6B4A]" />
            <p className="text-xs text-gray-400">Paiement sécurisé via wallet EduCash</p>
          </div>
        </div>
      </div>
    </div>
  )
}
