"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle } from "lucide-react"

const SUBJECTS = [
  "Question sur mon compte",
  "Problème avec une mission",
  "Paiement / Remboursement",
  "Signaler un utilisateur",
  "Partenariat / Presse",
  "Autre",
]

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState(null) // "success" | "error" | null
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) return
    setIsSubmitting(true)
    // Simulation d'envoi (à remplacer par Resend ou un endpoint API)
    await new Promise((r) => setTimeout(r, 1200))
    setStatus("success")
    setIsSubmitting(false)
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-500" />
        </div>
        <p className="font-semibold text-gray-900">Message envoyé !</p>
        <p className="text-sm text-gray-500">
          Nous vous répondrons dans les 24h ouvrées à <span className="font-medium">{email}</span>.
        </p>
        <button
          type="button"
          onClick={() => { setStatus(null); setName(""); setEmail(""); setSubject(""); setMessage("") }}
          className="text-sm text-[#1A6B4A] hover:underline"
        >
          Envoyer un autre message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Nom *</label>
          <input
            suppressHydrationWarning
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
            required
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Email *</label>
          <input
            suppressHydrationWarning
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            required
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Sujet</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        >
          <option value="">Sélectionner un sujet</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Message * <span className="text-gray-400 font-normal">({message.length}/1000)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
          placeholder="Décrivez votre demande en détail..."
          rows={5}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Une erreur est survenue. Réessayez ou contactez-nous par email.</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
        disabled={!name.trim() || !email.trim() || !message.trim()}
      >
        Envoyer le message →
      </Button>
    </form>
  )
}
