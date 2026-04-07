"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Send, Loader2 } from "lucide-react"
import clsx from "clsx"
import { apply } from "@/lib/actions/application.actions"
import { useToast } from "@/components/shared/toaster"

const MAX_CHARS = 500
const MIN_CHARS = 50

/**
 * Modal de candidature à une mission.
 *
 * @param {{
 *   missionId: string,
 *   missionTitle: string,
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSuccess: () => void
 * }} props
 */
export function ApplyModal({ missionId, missionTitle, isOpen, onClose, onSuccess }) {
  const { toast } = useToast()
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const charsOver = message.length > MAX_CHARS

  function handleClose() {
    if (isLoading) return
    setMessage("")
    setError(null)
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (message.trim().length < MIN_CHARS) {
      setError(`Minimum ${MIN_CHARS} caractères requis.`)
      return
    }
    if (message.length > MAX_CHARS) {
      setError(`Maximum ${MAX_CHARS} caractères autorisés.`)
      return
    }

    setIsLoading(true)
    const result = await apply({ missionId, message: message.trim() })
    setIsLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.success) {
      onSuccess()
      handleClose()
      toast({ message: "Candidature envoyée ! Le client sera notifié.", type: "success" })
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Contenu */}
        <Dialog.Content
          className={clsx(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-md bg-white rounded-2xl shadow-xl p-6",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          {/* En-tête */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Postuler à cette mission
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Rédige ton message de motivation pour postuler à {missionTitle}.
              </Dialog.Description>
            </div>
            <Dialog.Close
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Aperçu mission */}
          <div className="flex items-center gap-2 mb-5 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
              Mission
            </span>
            <p className="text-sm font-medium text-gray-800 truncate">
              {missionTitle.length > 60 ? missionTitle.slice(0, 60) + "…" : missionTitle}
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Ton message de motivation
              </label>

              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Explique pourquoi tu es le bon candidat pour cette mission, tes compétences et ta disponibilité…"
                rows={5}
                disabled={isLoading}
                className={clsx(
                  "w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none",
                  "focus:outline-none focus:ring-2 focus:border-transparent transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  charsOver
                    ? "border-red-300 focus:ring-red-400"
                    : "border-gray-300 focus:ring-[#1A6B4A]"
                )}
              />

              {/* Compteur */}
              <p className={clsx(
                "text-xs text-right tabular-nums",
                charsOver ? "text-red-500 font-medium" : "text-gray-400"
              )}>
                {message.length} / {MAX_CHARS} caractères
              </p>
            </div>

            {/* Erreur */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Bouton principal */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                "w-full h-10 rounded-lg flex items-center justify-center gap-2",
                "text-sm font-semibold text-white transition-colors touch-manipulation",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "bg-[#1A6B4A] hover:bg-[#155a3d] active:bg-[#104530]"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send size={15} />
                  Envoyer ma candidature
                </>
              )}
            </button>

            {/* Annuler */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors text-center disabled:opacity-50 touch-manipulation"
            >
              Annuler
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
