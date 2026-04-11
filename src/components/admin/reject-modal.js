"use client"

import { useState } from "react"
import { XCircle, Loader2, ChevronDown, Mail } from "lucide-react"
import { rejectStudent } from "@/lib/actions/admin.actions"
import { REJECTION_REASONS } from "@/lib/supabase/database.constants"
import { useToast } from "@/components/shared/toaster"
import { useRouter } from "next/navigation"

const LAST_REASON = REJECTION_REASONS[REJECTION_REASONS.length - 1]

export function RejectModal({ userId, name, onClose }) {
  const [reason, setReason]               = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [loading, setLoading]             = useState(false)
  const [showPreview, setShowPreview]     = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const isOther = reason === LAST_REASON
  const canSubmit = reason && (!isOther || customMessage.trim())

  async function handleReject() {
    if (!canSubmit) return
    setLoading(true)
    const finalReason = isOther ? customMessage.trim() : reason
    const result = await rejectStudent(userId, finalReason, isOther ? "" : customMessage.trim())
    setLoading(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: `Dossier de ${name} rejeté.`, type: "warning" })
      onClose()
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <XCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">Rejeter le dossier</h3>
            <p className="text-sm text-gray-500">{name}</p>
          </div>
        </div>

        {/* Sélecteur de motif */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Motif du rejet <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setCustomMessage("") }}
              className="w-full appearance-none rounded-xl border border-gray-200 px-3.5 py-3 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors bg-white"
            >
              <option value="">Sélectionner un motif…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Champ libre — "Autre motif" uniquement */}
        {isOther && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Motif personnalisé <span className="text-red-500">*</span>
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Décrivez le motif précis du rejet…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors"
            />
          </div>
        )}

        {/* Message complémentaire — motifs standards */}
        {reason && !isOther && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Message complémentaire{" "}
              <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Conseils supplémentaires pour l'étudiant…"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
            />
          </div>
        )}

        {/* Aperçu email */}
        {reason && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors self-start"
          >
            <Mail size={12} />
            Aperçu de l&apos;email envoyé
            <ChevronDown size={12} className={`transition-transform ${showPreview ? "rotate-180" : ""}`} />
          </button>
        )}
        {showPreview && reason && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Objet :</span>{" "}
              Action requise sur ton dossier EduCash
            </p>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Motif :</span>{" "}
              {isOther ? (customMessage || "—") : reason}
            </p>
            {customMessage && !isOther && (
              <p className="text-xs text-gray-700">
                <span className="font-semibold">Message :</span>{" "}
                {customMessage}
              </p>
            )}
            <p className="text-[11px] text-gray-400 italic">
              L&apos;étudiant recevra un lien pour soumettre à nouveau son dossier.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={loading || !canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Rejeter
          </button>
        </div>
      </div>
    </div>
  )
}
