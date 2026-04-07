"use client"

import { useState, useRef } from "react"
import { Loader2 } from "lucide-react"
import { StarSelector } from "@/components/review/star-selector"

/**
 * @param {{ action: (formData: FormData) => Promise<{ error?: string }> }} props
 */
export function ReviewForm({ action }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const formRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()

    if (rating === 0) {
      setError("Veuillez sélectionner une note.")
      return
    }

    setError("")
    setIsLoading(true)

    const formData = new FormData(formRef.current)
    formData.set("rating", String(rating))

    const result = await action(formData)

    // Si result existe, il y a une erreur (sinon redirect() a déjà eu lieu)
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Sélecteur d'étoiles */}
      <div className="flex flex-col items-center gap-1">
        <StarSelector onRate={setRating} />
        <input type="hidden" name="rating" value={rating} />
      </div>

      {/* Commentaire */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Commentaire <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <span className={`text-xs ${comment.length > 300 ? "text-red-500" : "text-gray-400"}`}>
            {comment.length}/300
          </span>
        </div>
        <textarea
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 300))}
          placeholder="Décrivez votre expérience avec cet étudiant..."
          rows={4}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Bouton soumettre */}
      <button
        type="submit"
        disabled={isLoading || rating === 0}
        className="w-full h-11 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
      >
        {isLoading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Publication…
          </>
        ) : (
          "Publier mon avis"
        )}
      </button>
    </form>
  )
}
