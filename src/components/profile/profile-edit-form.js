"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2, Check } from "lucide-react"
import { updateStudentProfile } from "@/lib/actions/profile.actions"
import { useSupabase } from "@/components/shared/supabase-provider"
import { CITIES } from "@/lib/supabase/database.constants"

const STUDY_LEVELS = [
  "Licence 1", "Licence 2", "Licence 3",
  "Master 1", "Master 2", "BTS", "Doctorat", "Autre",
]

const SKILLS_LIST = [
  "Babysitting", "Livraison", "Aide administrative", "Saisie",
  "Community Management", "Traduction", "Cours particuliers",
  "Mathématiques", "Physique-Chimie", "Informatique", "Rédaction Web",
  "Microsoft Excel", "AutoCAD", "Comptabilité", "Marketing", "Autre",
]

export function ProfileEditForm({ profile, studentProfile }) {
  const router = useRouter()
  const { supabase } = useSupabase()

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url ?? null)
  const [skills, setSkills] = useState(
    Array.isArray(studentProfile?.skills) ? studentProfile.skills : []
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const avatarInputRef = useRef(null)

  // Champs contrôlés
  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [city, setCity] = useState(profile?.city ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [bio, setBio] = useState(profile?.bio ?? "")
  const [school, setSchool] = useState(studentProfile?.school ?? "")
  const [level, setLevel] = useState(studentProfile?.level ?? "")
  const [availability, setAvailability] = useState(studentProfile?.availability ?? "")

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 3 Mo.")
      return
    }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function toggleSkill(skill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) { setError("Le nom complet est requis."); return }
    if (!city.trim()) { setError("La ville est requise."); return }

    setError("")
    setSubmitting(true)

    try {
      // 1. Upload avatar directement vers Supabase Storage (depuis le client)
      let avatarUrl = undefined
      if (avatarFile) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError("Session expirée. Reconnectez-vous."); return }

        const ext = avatarFile.name.split(".").pop()
        const fileName = `${user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true })

        if (uploadError) {
          setError("Erreur upload photo : " + uploadError.message)
          return
        }

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      // 2. Sauvegarder les données texte via Server Action (pas de fichier)
      const result = await updateStudentProfile({
        fullName: fullName.trim(),
        city: city.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        school: school.trim(),
        level: level.trim(),
        availability: availability.trim(),
        skills,
        avatarUrl,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/profile"), 1200)
    } catch (err) {
      setError("Une erreur inattendue est survenue. Réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="relative w-20 h-20 rounded-2xl bg-[#1A6B4A] flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-2xl font-black">{initial}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#1A6B4A] border-2 border-white flex items-center justify-center hover:bg-[#155a3d] transition-colors touch-manipulation"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Photo de profil</p>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG ou WEBP — max 3 Mo</p>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="mt-1.5 text-xs font-semibold text-[#1A6B4A] hover:underline touch-manipulation"
          >
            Changer la photo
          </button>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Infos personnelles */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Informations personnelles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Nom complet *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Ville *</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors bg-white"
            >
              <option value="">Choisir une ville</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+229 96 00 00 00"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">À propos de moi</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Décrivez votre profil, vos expériences et vos points forts…"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
          />
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Infos académiques */}
      <div className="flex flex-col gap-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Informations académiques
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">École / Université</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="ex : UAC - EPAC"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Niveau d&apos;études</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors bg-white"
            >
              <option value="">Sélectionner un niveau</option>
              {STUDY_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Disponibilités</label>
          <textarea
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            rows={3}
            placeholder="ex : Lundi-Vendredi de 18h à 21h, week-ends libres…"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
          />
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Compétences */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Compétences
        </h3>
        <p className="text-xs text-gray-500">Sélectionnez vos domaines de compétences</p>
        <div className="flex flex-wrap gap-2">
          {SKILLS_LIST.map((skill) => {
            const selected = skills.includes(skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all touch-manipulation ${
                  selected
                    ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
                }`}
              >
                {selected && <Check size={11} />}
                {skill}
              </button>
            )
          })}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors touch-manipulation disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting || success}
          className="flex-1 py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
        >
          {submitting ? (
            <><Loader2 size={15} className="animate-spin" /> Enregistrement…</>
          ) : success ? (
            <><Check size={15} /> Sauvegardé !</>
          ) : (
            "Sauvegarder"
          )}
        </button>
      </div>
    </form>
  )
}
