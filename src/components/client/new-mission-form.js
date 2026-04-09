"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Send, Loader2, ShieldCheck, Star, MapPin } from "lucide-react"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import { createMission } from "@/lib/actions/mission.actions"
import { useToast } from "@/components/shared/toaster"

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0]

const URGENCY_OPTIONS = [
  { value: "low",    label: "Standard" },
  { value: "medium", label: "Urgent"   },
  { value: "high",   label: "Critique" },
]

const TYPE_COLORS = {
  "Babysitting":           { bg: "bg-orange-100",  text: "text-orange-700" },
  "Livraison":             { bg: "bg-sky-100",     text: "text-sky-700" },
  "Aide administrative":   { bg: "bg-teal-100",    text: "text-teal-700" },
  "Saisie":                { bg: "bg-indigo-100",  text: "text-indigo-700" },
  "Community Management":  { bg: "bg-pink-100",    text: "text-pink-700" },
  "Traduction":            { bg: "bg-blue-100",    text: "text-blue-700" },
  "Cours particuliers":    { bg: "bg-amber-100",   text: "text-amber-700" },
  "Autre":                 { bg: "bg-gray-100",    text: "text-gray-600"  },
}

const URGENCY_BADGE = {
  medium: { label: "Urgent",   cls: "bg-amber-100 text-amber-700" },
  high:   { label: "Critique", cls: "bg-red-100 text-red-600"     },
}

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

function diffDaysFromNow(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
  return diff > 0 ? diff : null
}

// ─── Aperçu en temps réel ─────────────────────────────────────────────────────

function LivePreview({ title, type, city, description, budget, urgency, deadline, profile }) {
  const color    = TYPE_COLORS[type] ?? { bg: "bg-gray-100", text: "text-gray-600" }
  const urgBadge = URGENCY_BADGE[urgency]
  const days     = diffDaysFromNow(deadline)
  const initial  = profile?.full_name?.charAt(0)?.toUpperCase() ?? "C"

  return (
    <div className="flex flex-col gap-5">

      {/* Badge LIVE */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aperçu en temps réel</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Card preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">

        {/* Image placeholder */}
        <div className="relative h-36 bg-gradient-to-br from-[#1A1A2E] via-[#16213e] to-[#0f3460] overflow-hidden">
          <div className="absolute top-6 left-6 w-24 h-24 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="absolute bottom-4 right-6 w-20 h-20 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Star size={64} className="text-white" />
          </div>
          {budget > 0 && (
            <div className="absolute top-3 right-3 bg-[#F59E0B] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
              {fmt(budget)} FCFA
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {type && (
              <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${color.bg} ${color.text}`}>
                {type}
              </span>
            )}
            {urgBadge && (
              <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${urgBadge.cls}`}>
                {urgBadge.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">
            {title || <span className="text-gray-300">Titre de votre mission…</span>}
          </h3>

          {/* Description */}
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed min-h-[2rem]">
            {description || <span className="text-gray-300">Expliquez ici les détails de la mission…</span>}
          </p>

          {/* Client row */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#1A6B4A] flex items-center justify-center shrink-0 overflow-hidden">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-[10px] font-bold">{initial}</span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-none">{profile?.full_name ?? "Vous"}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                  <MapPin size={9} />
                  {city || profile?.city || "Ville"}
                </p>
              </div>
            </div>
            {days && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Échéance</p>
                <p className="text-xs font-black text-gray-900 mt-0.5">{days} Jour{days > 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trust badge */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f0faf5] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-[#1A6B4A]" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">Confiance &amp; Sécurité</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Votre paiement est conservé en toute sécurité par EduCash et n&apos;est libéré que lorsque vous validez le travail final de l&apos;expert.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function NewMissionForm({ profile }) {
  const router = useRouter()
  const { toast } = useToast()

  const [title,       setTitle]       = useState("")
  const [type,        setType]        = useState("")
  const [city,        setCity]        = useState("")
  const [deadline,    setDeadline]    = useState("")
  const [urgency,     setUrgency]     = useState("low")
  const [description, setDescription] = useState("")
  const [budget,      setBudget]      = useState("")
  const [error,       setError]       = useState("")
  const [submitting,  setSubmitting]  = useState(false)

  const budgetNum = parseFloat(budget.replace(/\s/g, "")) || 0

  function handleBudgetChange(e) {
    // Garder que les chiffres
    const raw = e.target.value.replace(/[^\d]/g, "")
    setBudget(raw)
  }

  function validate() {
    if (!title.trim())             return "Le titre est requis."
    if (!type)                     return "Le type d'expertise est requis."
    if (!city)                     return "La localisation est requise."
    if (description.trim().length < 50) return "La description doit contenir au moins 50 caractères."
    if (budgetNum < 2000)          return "Le budget minimum est de 2 000 FCFA."
    return null
  }

  async function handlePublish() {
    const err = validate()
    if (err) { setError(err); return }
    setError("")
    setSubmitting(true)

    const result = await createMission({
      title: title.trim(),
      description: description.trim(),
      type,
      city,
      budget: budgetNum,
      urgency,
      deadline: deadline || null,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      toast({ message: result.error, type: "error" })
      return
    }

    toast({ message: "Mission publiée ! Les étudiants peuvent postuler.", type: "success" })
    router.push(`/client/missions/${result.id}`)
  }

  const labelCls = "text-[10px] font-black text-gray-400 uppercase tracking-widest"
  const inputCls = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors bg-white"

  return (
    <div className="max-w-[1200px] mx-auto">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
        <span
          className="hover:text-[#1A6B4A] cursor-pointer transition-colors"
          onClick={() => router.push("/client/missions")}
        >
          Missions
        </span>
        <ChevronRight size={13} className="text-gray-300" />
        <span className="text-gray-600">Nouvelle mission</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">

        {/* ── Colonne gauche : formulaire ──────────────────────────── */}
        <div className="flex flex-col gap-8">

          {/* Titre de la section */}
          <div>
            <h1 className="text-3xl font-black text-gray-900 leading-tight">
              Publier une nouvelle mission
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-lg">
              Décrivez vos besoins pour recevoir des propositions de la part de nos meilleurs étudiants qualifiés.
            </p>
          </div>

          {/* Formulaire */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-6">

            {/* Titre */}
            <div className="flex flex-col gap-2">
              <label className={labelCls}>Titre de la mission</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Ex : Garde d'enfants le samedi soir"
                className={inputCls}
              />
            </div>

            {/* Type + Ville */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Type d&apos;expertise</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sélectionner…</option>
                  {MISSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelCls}>Localisation (ville)</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Cotonou, Parakou…</option>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deadline + Urgence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Date limite de rendu</label>
                <input
                  type="date"
                  value={deadline}
                  min={TODAY}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={inputCls}
                  suppressHydrationWarning
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelCls}>Niveau d&apos;urgence</label>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map(({ value, label }) => {
                    const isActive = urgency === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUrgency(value)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all touch-manipulation ${
                          isActive
                            ? "bg-[#1A6B4A] text-white border-[#1A6B4A] shadow-sm"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Description détaillée</label>
                <span className={`text-xs font-medium ${description.length < 50 ? "text-amber-500" : "text-gray-400"}`}>
                  {description.length}
                  {description.length < 50 && ` / min 50`}
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Expliquez ici les détails de la mission, les outils requis, et le volume de travail attendu…"
                className={`${inputCls} resize-none py-3`}
              />
            </div>

            {/* Budget */}
            <div className="flex flex-col gap-2">
              <label className={labelCls}>Budget proposé (FCFA)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={budget ? fmt(budgetNum) : ""}
                  onChange={handleBudgetChange}
                  placeholder="0"
                  className={`${inputCls} text-2xl font-black pr-16 py-3`}
                  suppressHydrationWarning
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                  FCFA
                </span>
              </div>
              {budgetNum >= 2000 ? (
                <p className="text-xs text-[#1A6B4A] font-semibold">
                  Montant reçu par l&apos;étudiant : {fmt(Math.round(budgetNum * 0.88))} FCFA (commission 12% déduite)
                </p>
              ) : (
                <p className="text-xs text-gray-400">Un budget attractif augmente vos chances de trouver un expert qualifié rapidement.</p>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => router.push("/client/missions")}
                disabled={submitting}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors touch-manipulation disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
              >
                {submitting ? (
                  <><Loader2 size={15} className="animate-spin" /> Publication…</>
                ) : (
                  <><Send size={15} /> Publier la mission</>
                )}
              </button>
            </div>
          </div>

          {/* Badge membre */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-6 h-6 rounded-full bg-[#1A6B4A] flex items-center justify-center">
              <ShieldCheck size={13} className="text-white" />
            </div>
            <span className="font-semibold text-gray-700">Identité Vérifiée</span>
            <span className="text-gray-300">·</span>
            <span className="text-[#F59E0B] font-semibold">Membre Premium</span>
          </div>
        </div>

        {/* ── Colonne droite : aperçu sticky ───────────────────────── */}
        <div className="lg:sticky lg:top-8">
          <LivePreview
            title={title}
            type={type}
            city={city}
            description={description}
            budget={budgetNum}
            urgency={urgency}
            deadline={deadline}
            profile={profile}
          />
        </div>
      </div>
    </div>
  )
}
