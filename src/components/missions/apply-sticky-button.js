"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Send, CheckCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSupabase } from "@/components/shared/supabase-provider"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

// ─── Modal de candidature ─────────────────────────────────────────────────────

function ApplyModal({ isOpen, onClose, missionId, missionTitle, onSuccess }) {
  const { supabase } = useSupabase()
  const { user } = useAuth()
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) { setError("Le message de candidature est requis."); return }
    setError("")
    setIsSubmitting(true)

    const { error: insertError } = await supabase.from("applications").insert({
      mission_id: missionId,
      student_id: user.id,
      message: message.trim(),
      status: "pending",
    })

    if (insertError) {
      setError("Une erreur est survenue. Réessayez.")
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setMessage("")
    onSuccess()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Postuler à cette mission" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Mission : <span className="font-medium text-gray-800">{missionTitle}</span>
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Votre message de candidature *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 600))}
            rows={5}
            placeholder="Présentez-vous, expliquez pourquoi vous êtes le bon profil et votre disponibilité…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/600</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
            <Send size={15} />
            Envoyer ma candidature
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Barre sticky ─────────────────────────────────────────────────────────────

/**
 * Barre fixe en bas de l'écran (mobile) avec logique de candidature.
 *
 * @param {{ missionId: string, missionTitle: string }} props
 */
export function ApplyStickyButton({ missionId, missionTitle }) {
  const { supabase } = useSupabase()
  const { user, role, isLoading } = useAuth()
  const [isApplied, setIsApplied] = useState(false)
  const [checkingApplication, setCheckingApplication] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Vérifie si l'étudiant a déjà postulé
  useEffect(() => {
    if (!user || role !== "student") return

    setCheckingApplication(true)
    supabase
      .from("applications")
      .select("id")
      .eq("mission_id", missionId)
      .eq("student_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsApplied(!!data)
        setCheckingApplication(false)
      })
  }, [user, role, missionId, supabase])

  // Pendant le chargement de la session
  if (isLoading || checkingApplication) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-4 lg:hidden">
        <div className="flex items-center justify-center h-10">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  // Non connecté
  if (!user) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-4 lg:hidden">
        <Link
          href={`/auth/register?redirect=/missions/${missionId}`}
          className="flex items-center justify-center w-full h-10 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          S&apos;inscrire pour postuler
        </Link>
      </div>
    )
  }

  // Connecté mais pas étudiant (client)
  if (role !== "student") return null

  // Déjà candidaté
  if (isApplied) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-4 lg:hidden">
        <div className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">
          <CheckCircle size={16} />
          Candidature envoyée
        </div>
      </div>
    )
  }

  // Peut postuler
  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-4 lg:hidden">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation"
        >
          <Send size={15} />
          Postuler à cette mission
        </button>
      </div>

      <ApplyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        missionId={missionId}
        missionTitle={missionTitle}
        onSuccess={() => setIsApplied(true)}
      />
    </>
  )
}
