"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileImage, Check, Loader2, X } from "lucide-react"
import { saveStudentCardUrl } from "@/lib/actions/profile.actions"
import { useSupabase } from "@/components/shared/supabase-provider"

/**
 * @param {{ hasCard: boolean }} props
 */
export function CardUploadForm({ hasCard }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError("")

    if (f.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(f)
    }
  }

  async function handleSubmit() {
    if (!file) { setError("Sélectionnez un fichier."); return }
    setError("")
    setSubmitting(true)

    try {
      // Validation côté client
      if (file.size > 5 * 1024 * 1024) {
        setError("Le fichier ne doit pas dépasser 5 Mo.")
        return
      }
      const ext = file.name.split(".").pop().toLowerCase()
      if (!["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
        setError("Format accepté : JPG, PNG, WEBP ou PDF.")
        return
      }

      // Upload direct vers Supabase Storage depuis le client
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Session expirée. Reconnectez-vous."); return }

      const fileName = `${user.id}/card.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("student-cards")
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        setError("Erreur upload : " + uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage.from("student-cards").getPublicUrl(fileName)

      // Sauvegarder l'URL via Server Action (uniquement une string — pas de fichier)
      const result = await saveStudentCardUrl(urlData.publicUrl)

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/profile"), 2000)
    } catch (err) {
      setError("Une erreur inattendue est survenue. Réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
          <Check size={28} className="text-[#1A6B4A]" />
        </div>
        <div>
          <p className="text-base font-black text-gray-900">Carte envoyée avec succès !</p>
          <p className="text-sm text-gray-500 mt-1">
            Notre équipe vérifiera votre carte sous 24h. Vous serez notifié par email.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {hasCard && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <p className="text-sm text-amber-800">
            Vous avez déjà soumis une carte. La soumettre à nouveau remplacera l&apos;ancienne.
          </p>
        </div>
      )}

      {/* Zone de dépôt */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[#1A6B4A] hover:bg-green-50/30 transition-colors group"
      >
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Aperçu" className="max-h-48 rounded-xl object-contain" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : file ? (
          <div className="flex items-center gap-3">
            <FileImage size={32} className="text-[#1A6B4A]" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} Mo
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-green-100 transition-colors flex items-center justify-center">
              <Upload size={24} className="text-gray-400 group-hover:text-[#1A6B4A] transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">
                Déposez votre carte étudiante ici
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                ou cliquez pour sélectionner un fichier
              </p>
            </div>
            <p className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              JPG, PNG, WEBP ou PDF — 5 Mo max
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Conseils */}
      <div className="bg-[#f8f9fb] rounded-xl px-4 py-4 flex flex-col gap-2">
        <p className="text-xs font-bold text-gray-700">Pour une vérification rapide :</p>
        <ul className="flex flex-col gap-1">
          {[
            "La carte doit être lisible et non coupée",
            "Votre nom et le nom de l'établissement doivent apparaître clairement",
            "La photo doit être nette, prise en bonne lumière",
          ].map((tip) => (
            <li key={tip} className="text-xs text-gray-500 flex items-start gap-2">
              <span className="text-[#1A6B4A] mt-0.5">✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !file}
        className="w-full py-3.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 touch-manipulation"
      >
        {submitting ? (
          <><Loader2 size={15} className="animate-spin" /> Envoi en cours…</>
        ) : (
          <><Upload size={15} /> Envoyer pour vérification</>
        )}
      </button>
    </div>
  )
}
