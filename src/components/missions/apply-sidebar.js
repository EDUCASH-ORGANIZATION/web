"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Send, CheckCircle, Loader2, ShieldAlert, Lock } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useSupabase } from "@/components/shared/supabase-provider"

function formatBudget(n) {
  return new Intl.NumberFormat("fr-FR").format(n)
}

/**
 * Sidebar de candidature (desktop) — inline dans la page mission.
 *
 * @param {{
 *   missionId: string,
 *   missionTitle: string,
 *   clientName: string,
 *   budget: number,
 *   estimatedDuration: string | null,
 * }} props
 */
export function ApplySidebar({ missionId, missionTitle, clientName, budget, estimatedDuration }) {
  const { supabase } = useSupabase()
  const { user, role, isLoading } = useAuth()

  const [message, setMessage] = useState("")
  const [isApplied, setIsApplied] = useState(false)
  const [isVerified, setIsVerified] = useState(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const netGain = Math.round(budget * 0.88)

  // Vérifie l'application existante + le statut de vérification
  useEffect(() => {
    if (!user || role !== "student") return

    setChecking(true)
    Promise.all([
      supabase
        .from("applications")
        .select("id")
        .eq("mission_id", missionId)
        .eq("student_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("is_verified")
        .eq("user_id", user.id)
        .single(),
    ]).then(([{ data: app }, { data: profile }]) => {
      setIsApplied(!!app)
      setIsVerified(profile?.is_verified ?? false)
      setChecking(false)
    })
  }, [user, role, missionId, supabase])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) { setError("Le message de candidature est requis."); return }
    setError("")
    setSubmitting(true)

    const { error: insertError } = await supabase.from("applications").insert({
      mission_id: missionId,
      student_id: user.id,
      message: message.trim(),
      status: "pending",
    })

    if (insertError) {
      setError("Une erreur est survenue. Réessayez.")
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSuccess(true)
    setIsApplied(true)
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5 sticky top-6">

      {/* En-tête */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
          Postuler à cette mission
        </p>
        <p className="text-sm text-gray-500">Proposée par <span className="font-semibold text-gray-700">{clientName}</span></p>
      </div>

      <hr className="border-gray-100" />

      {/* Textarea motivation */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Ma motivation
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={5}
          placeholder="Présentez-vous, expliquez pourquoi vous êtes le bon profil pour cette mission…"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
          disabled={isApplied || success || !user || role !== "student"}
        />
        <p className="text-[11px] text-gray-400 text-right">{message.length}/500</p>
      </div>

      {/* Infos mission */}
      <div className="flex flex-col gap-2 bg-gray-50 rounded-xl px-4 py-3">
        {estimatedDuration && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Temps estimé</span>
            <span className="font-semibold text-gray-800">{estimatedDuration}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Engagement</span>
          <span className="font-semibold text-gray-800">Unique</span>
        </div>
      </div>

      {/* Gain net */}
      <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Votre gain net</span>
        <span className="text-base font-black text-[#1A6B4A]">
          {formatBudget(netGain)} <span className="text-xs font-bold">FCFA</span>
        </span>
      </div>

      {/* Message d'erreur */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}

      {/* Bouton selon état */}
      {isLoading || checking ? (
        <div className="flex items-center justify-center h-11">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : !user ? (
        // Non connecté
        <Link
          href={`/auth/login?next=/missions/${missionId}`}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
        >
          <Lock size={15} />
          Se connecter pour postuler
        </Link>
      ) : role !== "student" ? (
        // Client ou admin
        <div className="flex items-center justify-center h-11 rounded-xl bg-gray-100 text-gray-400 text-sm font-medium">
          Réservé aux étudiants
        </div>
      ) : isApplied || success ? (
        // Déjà postulé
        <div className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gray-100 text-[#1A6B4A] text-sm font-semibold">
          <CheckCircle size={16} />
          Candidature envoyée
        </div>
      ) : isVerified === false ? (
        // Non vérifié
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
            <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Votre profil doit être vérifié pour postuler.{" "}
              <Link href="/profile" className="font-bold underline hover:no-underline">
                Compléter mon dossier →
              </Link>
            </p>
          </div>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gray-200 text-gray-400 text-sm font-bold cursor-not-allowed"
          >
            <Send size={15} />
            Envoyer ma candidature
          </button>
        </div>
      ) : (
        // Peut postuler
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation disabled:opacity-60"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Envoyer ma candidature
        </button>
      )}

      <p className="text-[10px] text-gray-400 text-center leading-relaxed">
        EduCash prélève une commission de 12 % sur le budget de la mission.
      </p>
    </div>
  )
}
