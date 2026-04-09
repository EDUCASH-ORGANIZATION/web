"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/shared/toaster"
import { useSupabase } from "@/components/shared/supabase-provider"
import { CITIES, MISSION_TYPES } from "@/lib/supabase/database.constants"
import clsx from "clsx"

const STUDY_LEVELS = [
  "Licence 1", "Licence 2", "Licence 3",
  "Master 1", "Master 2", "BTS", "Doctorat", "Autre",
]

// ─── Étape 1 ─────────────────────────────────────────────────────────────────

function Step1({ onNext }) {
  const [avatarFile, setAvatarFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState("")
  const [bio, setBio] = useState("")
  const avatarInputRef = useRef(null)

  const fullNameRef = useRef(null)
  const cityRef = useRef(null)
  const phoneRef = useRef(null)

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleNext() {
    const fullName = fullNameRef.current?.value.trim()
    const city = cityRef.current?.value

    if (!fullName) { setError("Le nom complet est requis."); return }
    if (!city) { setError("Veuillez choisir une ville."); return }
    setError("")

    onNext({
      avatarFile,
      fullName,
      city,
      phone: phoneRef.current?.value.trim() ?? "",
      bio,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progression */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#1A6B4A] rounded-full transition-all" style={{ width: "50%" }} />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Ton profil <span className="text-gray-400 font-normal text-base">(1/2)</span></h2>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-[#1A6B4A] transition-colors overflow-hidden flex items-center justify-center"
          aria-label="Choisir une photo de profil"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Aperçu avatar" className="w-full h-full object-cover" />
          ) : (
            <Camera size={28} className="text-gray-400" />
          )}
        </button>
        <p className="text-xs text-gray-500">Photo de profil (optionnel)</p>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Nom complet */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Nom complet *</label>
        <input
          ref={fullNameRef}
          suppressHydrationWarning
          type="text"
          placeholder="Ex : Kokou Mensah"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {/* Ville */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Ville *</label>
        <select
          ref={cityRef}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        >
          <option value="">Sélectionner une ville</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Téléphone */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Téléphone</label>
        <input
          ref={phoneRef}
          suppressHydrationWarning
          type="tel"
          placeholder="+229 XX XX XX XX"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Bio courte <span className="text-gray-400 font-normal">({bio.length}/200)</span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 200))}
          placeholder="Dis quelques mots sur toi..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button variant="primary" fullWidth onClick={handleNext}>
        Suivant →
      </Button>
    </div>
  )
}

// ─── Étape 2 ─────────────────────────────────────────────────────────────────

function Step2({ step1Data, onBack }) {
  const router = useRouter()
  const { toast } = useToast()
  const { supabase } = useSupabase()

  const [skills, setSkills] = useState([])
  const [cardFile, setCardFile] = useState(null)
  const [cardName, setCardName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const schoolRef = useRef(null)
  const levelRef = useRef(null)
  const availabilityRef = useRef(null)
  const cardInputRef = useRef(null)

  function toggleSkill(skill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  function handleCardChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCardFile(file)
    setCardName(file.name)
  }

  async function handleSubmit() {
    if (skills.length === 0) { setError("Sélectionne au moins une compétence."); return }
    setError("")
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié.")
      if (user.user_metadata?.role !== "student") throw new Error("Session incorrecte. Reconnecte-toi en tant qu'étudiant.")

      let avatarUrl = null
      let cardUrl = null

      // 1. Upload avatar
      if (step1Data.avatarFile) {
        const ext = step1Data.avatarFile.name.split(".").pop()
        const fileName = `${user.id}/avatar.${ext}`
        const { error: avatarError } = await supabase.storage
          .from("avatars")
          .upload(fileName, step1Data.avatarFile, { upsert: true })
        if (avatarError) throw avatarError
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      // 2. Upload carte étudiante
      if (cardFile) {
        const ext = cardFile.name.split(".").pop()
        const fileName = `${user.id}/card.${ext}`
        const { error: cardError } = await supabase.storage
          .from("student-cards")
          .upload(fileName, cardFile, { upsert: true })
        if (cardError) throw cardError
        const { data: urlData } = supabase.storage.from("student-cards").getPublicUrl(fileName)
        cardUrl = urlData.publicUrl
      }

      // 3. Insert profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: step1Data.fullName,
        phone: step1Data.phone || null,
        city: step1Data.city,
        bio: step1Data.bio || null,
        avatar_url: avatarUrl,
        role: "student",
      }, { onConflict: "user_id" })
      if (profileError) throw profileError

      // 4. Insert student_profile
      const { error: studentError } = await supabase.from("student_profiles").upsert({
        user_id: user.id,
        school: schoolRef.current?.value.trim() || null,
        level: levelRef.current?.value || null,
        skills,
        card_url: cardUrl,
        availability: availabilityRef.current?.value.trim() || null,
      }, { onConflict: "user_id" })
      if (studentError) throw studentError

      // 5. Redirect + toast
      toast({ message: "Profil créé ! Vérification en cours sous 24h.", type: "success" })
      router.push("/dashboard")
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progression */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#1A6B4A] rounded-full transition-all" style={{ width: "100%" }} />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Ton profil <span className="text-gray-400 font-normal text-base">(2/2)</span></h2>

      {/* Établissement */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Établissement</label>
        <input
          ref={schoolRef}
          suppressHydrationWarning
          type="text"
          placeholder="Ex : UAC, UNSTIM..."
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {/* Niveau */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Niveau d&apos;études</label>
        <select
          ref={levelRef}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        >
          <option value="">Sélectionner un niveau</option>
          {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Compétences */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">
          Compétences * <span className="text-gray-400 font-normal">(au moins 1)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {MISSION_TYPES.map((skill) => {
            const active = skills.includes(skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  active
                    ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                    : "bg-white text-gray-600 border-gray-300 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
                )}
              >
                {skill}
              </button>
            )
          })}
        </div>
      </div>

      {/* Carte étudiante */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Carte étudiante</p>
        <button
          type="button"
          onClick={() => cardInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#1A6B4A] transition-colors px-4 py-6"
        >
          <Upload size={24} className="text-gray-400" />
          <span className="text-sm text-gray-500">
            {cardName || "Clique ou glisse ta carte ici"}
          </span>
          <span className="text-xs text-gray-400">Image ou PDF</span>
        </button>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <span className="text-amber-500 text-xs mt-0.5">⚠</span>
          <p className="text-xs text-amber-700">Utilisé uniquement pour vérifier ton statut étudiant.</p>
        </div>
        <input
          ref={cardInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleCardChange}
        />
      </div>

      {/* Disponibilités */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Disponibilités</label>
        <textarea
          ref={availabilityRef}
          placeholder="Ex : Week-ends, mercredis après-midi, vacances scolaires..."
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          ← Retour
        </Button>
        <Button variant="primary" fullWidth isLoading={isSubmitting} onClick={handleSubmit}>
          Terminer mon inscription
        </Button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function StudentProfileForm() {
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState({})

  return (
    <div>
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
