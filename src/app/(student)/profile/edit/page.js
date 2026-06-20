"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, Camera, Check, Loader2,
  ShieldCheck, ShieldAlert, Clock, AlertCircle, RefreshCw,
} from "lucide-react"
import { useSupabase } from "@/components/shared/supabase-provider"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"
import { CardUploadZone } from "@/components/auth/card-upload-zone"
import { useToast } from "@/components/shared/toaster"
import { updateStudentProfileWithCard } from "@/lib/actions/profile.actions"
import { getUniversities } from "@/lib/actions/university.actions"
import { CITIES } from "@/lib/supabase/database.constants"

// ─── Constantes ───────────────────────────────────────────────────────────────

const STUDY_LEVELS = [
  "Licence 1", "Licence 2", "Licence 3",
  "Master 1", "Master 2", "BTS", "Doctorat", "Autre",
]

const COUNTRY_CODES = [
  { code: "+229", label: "🇧🇯 Bénin (+229)" },
  { code: "+225", label: "🇨🇮 Côte d'Ivoire (+225)" },
  { code: "+233", label: "🇬🇭 Ghana (+233)" },
  { code: "+234", label: "🇳🇬 Nigeria (+234)" },
  { code: "+221", label: "🇸🇳 Sénégal (+221)" },
  { code: "+226", label: "🇧🇫 Burkina Faso (+226)" },
  { code: "+227", label: "🇳🇪 Niger (+227)" },
  { code: "+242", label: "🇨🇬 Congo (+242)" },
  { code: "+241", label: "🇬🇦 Gabon (+241)" },
  { code: "+237", label: "🇨🇲 Cameroun (+237)" },
  { code: "+33", label: "🇫🇷 France (+33)" },
  { code: "+1", label: "🇺🇸 USA/Canada (+1)" },
  { code: "+44", label: "🇬🇧 Royaume-Uni (+44)" },
  { code: "+49", label: "🇩🇪 Allemagne (+49)" },
  { code: "+91", label: "🇮🇳 Inde (+91)" },
  { code: "+86", label: "🇨🇳 Chine (+86)" },
  { code: "+other", label: "Autre indicatif" },
]

const AVAILABILITY_PRESETS = [
  "Jours de semaine",
  "Week-end",
  "Matin",
  "Après-midi",
  "Soirée",
  "Autre",
]

const SKILLS_LIST = [
  "Babysitting", "Livraison", "Saisie",
  "Community Management", "Traduction", "Cours particuliers",
  "Mathématiques", "Physique-Chimie", "Informatique", "Rédaction Web",
  "Microsoft Excel", "AutoCAD", "Comptabilité", "Marketing", "Autre",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return ""
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso))
}

function parsePhone(phone = "") {
  const clean = phone.replace(/\s+/g, "")
  // Cherche un indicatif connu dans COUNTRY_CODES (sauf +other)
  const known = COUNTRY_CODES.filter((c) => c.code !== "+other").find((c) => clean.startsWith(c.code))
  if (known) {
    return { countryCode: known.code, phoneNumber: clean.slice(known.code.length), otherCode: "" }
  }
  // S'il commence par +, on prend le premier bloc comme indicatif "autre"
  if (clean.startsWith("+")) {
    const match = clean.match(/^\+(\d{1,4})(\d*)$/)
    if (match) return { countryCode: "+other", phoneNumber: match[2], otherCode: `+${match[1]}` }
  }
  // Valeur par défaut : Bénin
  return { countryCode: "+229", phoneNumber: clean, otherCode: "" }
}

function formatPhone(countryCode, phoneNumber, otherCode) {
  if (countryCode === "+other") return `${otherCode}${phoneNumber}`.trim()
  const num = phoneNumber.replace(/\s+/g, "")
  return num ? `${countryCode}${num}` : ""
}

function normalizeBeninPhone(number) {
  // Supprime tout sauf les chiffres
  const digits = number.replace(/\D/g, "")
  // Si le numéro commence par 01, 02, 05, 06, 07, 08, 09 on le garde
  return digits.slice(0, 10)
}

function parseAvailability(value = "") {
  const parts = value
    .split(/[,;]|\u2014|--/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const presets = parts.filter((p) => AVAILABILITY_PRESETS.includes(p))
  const otherParts = parts.filter((p) => !AVAILABILITY_PRESETS.includes(p))
  return {
    presets,
    other: otherParts.join(", "),
  }
}

function formatAvailability(presets, other) {
  const hasAutre = presets.includes("Autre")
  const cleanPresets = presets.filter((p) => p !== "Autre")
  const parts = [...cleanPresets]
  if (hasAutre && other.trim()) parts.push(other.trim())
  return parts.join(", ")
}

// ─── Bannière de statut de vérification ──────────────────────────────────────

function VerificationBanner({ profile, studentProfile, cardFile, onCardFileChange }) {
  const today        = new Date()
  const isVerified   = profile?.is_verified ?? false
  const verifiedUntil = profile?.verified_until ? new Date(profile.verified_until) : null
  const submittedAt  = profile?.verification_submitted_at
  const rejectionReason = profile?.rejection_reason

  const isExpired = isVerified && verifiedUntil && verifiedUntil < today
  const isActive  = isVerified && (!verifiedUntil || verifiedUntil >= today)

  // ── Vérifié & valide ──────────────────────────────────────────────────────
  if (isActive) {
    return (
      <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-5 py-5">
        <VerifiedAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name ?? ""}
          isVerified
          verifiedUntil={profile?.verified_until}
          size="lg"
          showBadge
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck size={16} className="text-green-600 shrink-0" />
            <p className="text-sm font-black text-green-800">Profil vérifié ✓</p>
          </div>
          {verifiedUntil && (
            <p className="text-xs text-green-700 mt-0.5">
              Badge valable jusqu&apos;au{" "}
              <span className="font-semibold">{fmtDate(profile.verified_until)}</span>
            </p>
          )}
          <p className="text-xs text-green-600 mt-1">
            Tu n&apos;as pas besoin de soumettre à nouveau ta carte.
          </p>
        </div>
      </div>
    )
  }

  // ── Badge expiré ──────────────────────────────────────────────────────────
  if (isExpired) {
    return (
      <div className="flex flex-col gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <RefreshCw size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">
              Ton badge a expiré le {fmtDate(profile.verified_until)}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Soumets une nouvelle carte pour renouveler ton badge.
            </p>
          </div>
        </div>
        <CardUploadZone file={cardFile} onFileSelect={onCardFileChange} />
      </div>
    )
  }

  // ── Dossier rejeté ────────────────────────────────────────────────────────
  if (!isVerified && rejectionReason) {
    return (
      <div className="flex flex-col gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-black text-red-800">Ton dossier a été rejeté</p>
            <p className="text-xs text-red-600 mt-0.5">
              Soumets une nouvelle carte pour obtenir ton badge.
            </p>
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">
            Motif du rejet
          </p>
          <p className="text-sm text-red-700">{rejectionReason}</p>
        </div>
        <CardUploadZone file={cardFile} onFileSelect={onCardFileChange} />
      </div>
    )
  }

  // ── En cours de vérification ──────────────────────────────────────────────
  if (!isVerified && !rejectionReason && submittedAt) {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Clock size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-black text-amber-900">Vérification en cours</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Ton dossier a été soumis le{" "}
            <span className="font-semibold">{fmtDate(submittedAt)}</span> — notre équipe l&apos;examine.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Délai habituel : 24 à 48 heures.
          </p>
        </div>
      </div>
    )
  }

  // ── Pas encore soumis ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <ShieldAlert size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-black text-amber-900">Complète ta vérification</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Soumets ta carte étudiante pour obtenir ton badge vérifié.
          </p>
        </div>
      </div>
      <CardUploadZone file={cardFile} onFileSelect={onCardFileChange} />
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProfileEditPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const avatarInputRef = useRef(null)

  // ── Données chargées ──────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(true)
  const [profile, setProfile]           = useState(null)
  const [studentProfile, setStudentProfile] = useState(null)
  const [universities, setUniversities] = useState([])

  // ── Champs formulaire ─────────────────────────────────────────────────────
  const [fullName, setFullName]         = useState("")
  const [city, setCity]                 = useState("")
  const [countryCode, setCountryCode]   = useState("+229")
  const [phoneNumber, setPhoneNumber]   = useState("")
  const [otherCode, setOtherCode]       = useState("")
  const [bio, setBio]                   = useState("")
  const [school, setSchool]             = useState("")
  const [schoolOther, setSchoolOther]   = useState("")
  const [level, setLevel]               = useState("")
  const [availabilityPresets, setAvailabilityPresets] = useState([])
  const [availabilityOther, setAvailabilityOther]     = useState("")
  const [skills, setSkills]                           = useState([])

  // ── Fichiers ──────────────────────────────────────────────────────────────
  const [avatarFile, setAvatarFile]     = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [cardFile, setCardFile]         = useState(null)

  // ── État soumission ───────────────────────────────────────────────────────
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState("")

  // ── Chargement des données ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/auth/login"); return }

      const [
        { data: p },
        { data: sp },
        unis,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        getUniversities(),
      ])

      setProfile(p)
      setStudentProfile(sp)
      setUniversities(unis ?? [])

      // Pré-remplissage
      setFullName(p?.full_name ?? "")
      setCity(p?.city ?? "")
      const parsedPhone = parsePhone(p?.phone ?? "")
      setCountryCode(parsedPhone.countryCode)
      setPhoneNumber(parsedPhone.phoneNumber)
      setOtherCode(parsedPhone.otherCode)
      setBio(p?.bio ?? "")
      setAvatarPreview(p?.avatar_url ?? null)
      setLevel(sp?.level ?? "")
      const parsedAvailability = parseAvailability(sp?.availability ?? "")
      setAvailabilityPresets(parsedAvailability.presets)
      setAvailabilityOther(parsedAvailability.other)
      setSkills(Array.isArray(sp?.skills) ? sp.skills : [])

      // École : détecte si c'est une valeur libre ou dans la liste des universités
      const currentSchool = sp?.school ?? ""
      const inList = unis?.some((u) => u.name === currentSchool || u.short_name === currentSchool)
      if (currentSchool && !inList) {
        setSchool("__other__")
        setSchoolOther(currentSchool)
      } else {
        setSchool(currentSchool)
      }

      setLoading(false)
    }
    load()
  }, [supabase, router])

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  function toggleAvailabilityPreset(preset) {
    setAvailabilityPresets((prev) =>
      prev.includes(preset)
        ? prev.filter((p) => p !== preset)
        : [...prev, preset]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) { setError("Le nom complet est requis."); return }
    if (!city.trim())     { setError("La ville est requise."); return }

    const finalPhone = formatPhone(countryCode, phoneNumber, otherCode)
    if (finalPhone) {
      const localNumber = countryCode === "+other" ? phoneNumber.replace(/\D/g, "") : phoneNumber.replace(/\D/g, "")
      if (countryCode === "+229" && localNumber.length !== 10) {
        setError("Le numéro de téléphone béninois doit commencer par 01 et contenir 10 chiffres (ex: 01 00 00 00 00)."); return
      }
      if (countryCode === "+other" && !/^\+\d{1,4}$/.test(otherCode)) {
        setError("Indicatif international invalide (ex: +225)."); return
      }
      if (localNumber.length < 6) {
        setError("Le numéro de téléphone semble trop court."); return
      }
    }

    setError("")
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Session expirée. Reconnectez-vous."); setSubmitting(false); return }

      // 1. Upload avatar
      let avatarUrl = undefined
      if (avatarFile) {
        const ext  = avatarFile.name.split(".").pop()
        const path = `${user.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true })
        if (upErr) { setError("Erreur photo : " + upErr.message); setSubmitting(false); return }
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }

      // 2. Upload carte étudiante
      let cardUrl = undefined
      if (cardFile) {
        const ext  = cardFile.name.split(".").pop()
        const path = `${user.id}/card-${Date.now()}.${ext}`
        const { error: cardErr } = await supabase.storage
          .from("student-cards")
          .upload(path, cardFile, { upsert: true })
        if (cardErr) { setError("Erreur carte : " + cardErr.message); setSubmitting(false); return }
        // On stocke l'URL brute (signed URLs générées côté admin)
        const { data: urlData } = supabase.storage.from("student-cards").getPublicUrl(path)
        cardUrl = urlData.publicUrl
      }

      // 3. Calcule la valeur finale de l'école
      const finalSchool = school === "__other__" ? schoolOther.trim() : school
      const finalAvailability = formatAvailability(availabilityPresets, availabilityOther)

      // 4. Server Action
      const result = await updateStudentProfileWithCard({
        fullName:     fullName.trim(),
        city:         city.trim(),
        phone:        finalPhone,
        bio:          bio.trim(),
        school:       finalSchool,
        level:        level.trim(),
        availability: finalAvailability,
        skills,
        avatarUrl,
        cardUrl,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      toast({
        message: cardFile
          ? "Profil sauvegardé — ta carte est en cours d'examen."
          : "Profil mis à jour avec succès.",
        type: "success",
      })
      router.push("/profile")
    } catch (err) {
      console.error(err)
      setError("Une erreur inattendue est survenue. Réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Skeleton de chargement ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto flex flex-col gap-6 animate-pulse">
        <div className="h-9 w-48 bg-gray-100 rounded-xl" />
        <div className="h-28 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  const initial   = fullName?.charAt(0)?.toUpperCase() ?? "?"
  const bioLength = bio.length

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto flex flex-col gap-6 pb-28">

        {/* ── En-tête ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900">Modifier mon profil</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Mets à jour tes informations et ta vérification
            </p>
          </div>
        </div>

        {/* ── Statut de vérification ─────────────────────────────────── */}
        <VerificationBanner
          profile={profile}
          studentProfile={studentProfile}
          cardFile={cardFile}
          onCardFileChange={setCardFile}
        />

        {/* ── Informations personnelles ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Informations personnelles
          </h2>

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
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#1A6B4A] border-2 border-white flex items-center justify-center hover:bg-[#155a3d] transition-colors"
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
                className="mt-1.5 text-xs font-semibold text-[#1A6B4A] hover:underline"
              >
                Changer la photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nom complet */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Nom complet <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
              />
            </div>

            {/* Ville */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Ville <span className="text-red-500">*</span>
              </label>
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

            {/* Téléphone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Téléphone</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="shrink-0 rounded-xl border border-gray-200 px-2 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors bg-white"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                {countryCode === "+other" && (
                  <input
                    type="text"
                    value={otherCode}
                    onChange={(e) => setOtherCode(e.target.value.replace(/[^0-9+]/g, ""))}
                    placeholder="+225"
                    className="w-20 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
                  />
                )}
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = countryCode === "+229"
                      ? normalizeBeninPhone(e.target.value)
                      : e.target.value.replace(/[^0-9]/g, "").slice(0, 12)
                    setPhoneNumber(value)
                  }}
                  placeholder={countryCode === "+229" ? "01 00 00 00 00" : "Numéro local"}
                  className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
                />
              </div>
              <p className="text-xs text-gray-400">
                {countryCode === "+229"
                  ? "Format béninois : 01 suivi de 8 chiffres (ex: 01 00 00 00 00)"
                  : "Saisis le numéro local sans l'indicatif"}
              </p>
            </div>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">À propos de moi</label>
              <span className={`text-xs ${bioLength > 180 ? "text-amber-500" : "text-gray-400"}`}>
                {bioLength}/200
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 200))}
              rows={4}
              placeholder="Décris ton profil, tes expériences et tes points forts…"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
            />
          </div>
        </div>

        {/* ── Informations académiques ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Informations académiques
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Établissement */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Établissement</label>
              <select
                value={school}
                onChange={(e) => { setSchool(e.target.value); if (e.target.value !== "__other__") setSchoolOther("") }}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors bg-white"
              >
                <option value="">Sélectionner un établissement</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.short_name ? `${u.short_name} — ${u.name}` : u.name}
                  </option>
                ))}
                <option value="__other__">Autre établissement</option>
              </select>
              {school === "__other__" && (
                <input
                  type="text"
                  value={schoolOther}
                  onChange={(e) => setSchoolOther(e.target.value)}
                  placeholder="Nom de ton établissement"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors mt-1.5"
                />
              )}
            </div>

            {/* Niveau */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
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

          {/* Disponibilités */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-semibold text-gray-700">Disponibilités</label>
            <p className="text-xs text-gray-500">Sélectionne tes plages habituelles</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_PRESETS.map((preset) => {
                const selected = availabilityPresets.includes(preset)
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleAvailabilityPreset(preset)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all touch-manipulation ${
                      selected
                        ? "bg-[#1A6B4A] text-white border-[#1A6B4A]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#1A6B4A] hover:text-[#1A6B4A]"
                    }`}
                  >
                    {selected && <Check size={11} />}
                    {preset}
                  </button>
                )
              })}
            </div>
            {availabilityPresets.includes("Autre") && (
              <textarea
                value={availabilityOther}
                onChange={(e) => setAvailabilityOther(e.target.value)}
                rows={3}
                placeholder="Précise tes disponibilités spécifiques…"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
              />
            )}
          </div>

          {/* Compétences */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-semibold text-gray-700">Compétences</label>
            <p className="text-xs text-gray-500">Sélectionne tes domaines de compétences</p>
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
        </div>

        {/* ── Erreur ────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── Bouton enregistrer ─────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
          ) : (
            <>
              <Check size={16} />
              Enregistrer les modifications
            </>
          )}
        </button>
      </div>
    </form>
  )
}
