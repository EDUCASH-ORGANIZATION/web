"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import clsx from "clsx"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import { createMission } from "@/lib/actions/mission.actions"
import { useToast } from "@/components/shared/toaster"

const COMMISSION_RATE = 0.12
const TODAY = new Date().toISOString().split("T")[0]

const URGENCY_OPTIONS = [
  {
    value: "low",
    label: "Normale",
    activeClass: "bg-gray-200 text-gray-800 border-gray-400",
    inactiveClass: "bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-300",
  },
  {
    value: "medium",
    label: "Haute",
    activeClass: "bg-orange-100 text-orange-800 border-orange-400",
    inactiveClass: "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-700",
  },
  {
    value: "high",
    label: "Très haute",
    activeClass: "bg-red-100 text-red-800 border-red-400",
    inactiveClass: "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-700",
  },
]

// ─── Composants utilitaires ───────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
      <AlertCircle size={15} className="text-red-500 shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}

// ─── Barre de progression ─────────────────────────────────────────────────────

function ProgressBar({ step }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs font-medium text-gray-500">
        <span className={step >= 1 ? "text-[#1A6B4A]" : ""}>1. Détails</span>
        <span className={step >= 2 ? "text-[#1A6B4A]" : ""}>2. Budget & Confirmation</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1A6B4A] rounded-full transition-all duration-300"
          style={{ width: step === 1 ? "50%" : "100%" }}
        />
      </div>
    </div>
  )
}

// ─── Étape 1 ─────────────────────────────────────────────────────────────────

function Step1({ onNext }) {
  const [title, setTitle] = useState("")
  const [type, setType] = useState("")
  const [description, setDescription] = useState("")
  const [city, setCity] = useState("")
  const [urgency, setUrgency] = useState("low")
  const [error, setError] = useState("")
  const deadlineRef = useRef(null)

  const inputClass = "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent bg-white"
  const selectClass = "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"

  function validate() {
    if (!title.trim()) return "Le titre est requis."
    if (!type) return "Le type de service est requis."
    if (description.trim().length < 100) return "La description doit contenir au moins 100 caractères."
    if (description.length > 500) return "La description ne doit pas dépasser 500 caractères."
    if (!city) return "La ville est requise."
    return null
  }

  function handleNext() {
    const err = validate()
    if (err) { setError(err); return }
    setError("")
    onNext({
      title: title.trim(),
      type,
      description: description.trim(),
      city,
      urgency,
      deadline: deadlineRef.current?.value || null,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Titre */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel required>Titre de la mission</FieldLabel>
          <span className={clsx("text-xs", title.length > 80 ? "text-red-500" : "text-gray-400")}>
            {title.length}/80
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Ex : Garde d'enfants le samedi soir"
          className={inputClass}
          suppressHydrationWarning
        />
      </div>

      {/* Type de service */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel required>Type de service</FieldLabel>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="">Sélectionner un type</option>
          {MISSION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel required>Description</FieldLabel>
          <span className={clsx("text-xs", description.length > 500 ? "text-red-500" : description.length < 100 ? "text-amber-500" : "text-gray-400")}>
            {description.length}/500
            {description.length < 100 && ` (min ${100 - description.length} car.)`}
          </span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          placeholder="Décrivez précisément votre besoin : lieu, horaires, compétences attendues, matériel fourni..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {/* Ville */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel required>Ville</FieldLabel>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={selectClass}>
          <option value="">Sélectionner une ville</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Date souhaitée */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Date souhaitée</FieldLabel>
        <input
          ref={deadlineRef}
          type="date"
          min={TODAY}
          suppressHydrationWarning
          className={inputClass}
        />
      </div>

      {/* Urgence */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Urgence</FieldLabel>
        <div className="flex gap-2">
          {URGENCY_OPTIONS.map(({ value, label, activeClass, inactiveClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => setUrgency(value)}
              className={clsx(
                "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors touch-manipulation",
                urgency === value ? activeClass : inactiveClass
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />

      <button
        type="button"
        onClick={handleNext}
        className="w-full h-10 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation"
      >
        Suivant →
      </button>
    </div>
  )
}

// ─── Étape 2 ─────────────────────────────────────────────────────────────────

function Step2({ step1Data, onBack }) {
  const router = useRouter()
  const { toast } = useToast()
  const [budget, setBudget] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const budgetNum = parseFloat(budget) || 0
  const studentAmount = Math.round(budgetNum * (1 - COMMISSION_RATE))

  const URGENCY_LABELS = { low: "Normale", medium: "Haute", high: "Très haute" }

  const summaryItems = [
    { label: "Titre", value: step1Data.title },
    { label: "Type", value: step1Data.type },
    { label: "Ville", value: step1Data.city },
    { label: "Urgence", value: URGENCY_LABELS[step1Data.urgency] ?? step1Data.urgency },
    step1Data.deadline && { label: "Date souhaitée", value: new Intl.DateTimeFormat("fr-FR").format(new Date(step1Data.deadline)) },
  ].filter(Boolean)

  async function handleSubmit() {
    if (!budget || budgetNum < 2000) {
      setError("Le budget minimum est de 2 000 FCFA.")
      return
    }
    setError("")
    setIsLoading(true)

    const result = await createMission({
      ...step1Data,
      budget: budgetNum,
    })

    setIsLoading(false)

    if (result.error) {
      toast({ message: result.error, type: "error" })
      setError(result.error)
      return
    }

    toast({ message: "Mission publiée ! Les étudiants peuvent postuler.", type: "success" })
    router.push(`/client/missions/${result.id}`)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Budget */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel required>Budget (FCFA)</FieldLabel>
        <input
          type="number"
          min={2000}
          step={500}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Ex : 15000"
          suppressHydrationWarning
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
        {budgetNum >= 2000 && (
          <p className="text-sm font-medium text-[#1A6B4A]">
            {new Intl.NumberFormat("fr-FR").format(budgetNum)} FCFA
          </p>
        )}
      </div>

      {/* Récapitulatif */}
      <div className="bg-green-50 rounded-xl p-4 flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Récapitulatif</p>
        {summaryItems.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="text-xs text-gray-500 shrink-0">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 pt-1">
          <span className="text-xs text-gray-500 shrink-0">Description</span>
          <span className="text-xs font-medium text-gray-800 text-right line-clamp-2 max-w-[200px]">
            {step1Data.description}
          </span>
        </div>
      </div>

      {/* Commission */}
      <div className="flex flex-col gap-1.5 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
        <p>Commission EduCash : <span className="font-medium text-gray-700">12%</span> prélevée sur le montant final.</p>
        {budgetNum >= 2000 && (
          <p>
            Montant versé à l&apos;étudiant :{" "}
            <span className="font-semibold text-[#1A6B4A]">
              {new Intl.NumberFormat("fr-FR").format(studentAmount)} FCFA
            </span>
          </p>
        )}
      </div>

      <ErrorBanner message={error} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 touch-manipulation"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || budgetNum < 2000}
          className="flex-1 h-10 rounded-lg bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Publication…
            </>
          ) : (
            "Publier ma mission"
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function NewMissionForm() {
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState({})

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar step={step} />

      <h2 className="text-lg font-bold text-gray-900">
        {step === 1 ? "Détails de la mission" : "Budget & Confirmation"}
      </h2>

      {step === 1 ? (
        <Step1
          onNext={(data) => {
            setStep1Data(data)
            setStep(2)
          }}
        />
      ) : (
        <Step2
          step1Data={step1Data}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  )
}
