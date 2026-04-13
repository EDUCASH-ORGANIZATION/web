"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, User2, Building2, Heart, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/shared/toaster"
import { useSupabase } from "@/components/shared/supabase-provider"
import { Logo } from "@/components/shared/logo"
import { CITIES } from "@/lib/supabase/database.constants"
import clsx from "clsx"

const CLIENT_TYPES = [
  {
    value: "particulier",
    label: "Particulier",
    description: "Besoin ponctuel à la maison",
    icon: User2,
  },
  {
    value: "pme",
    label: "PME / Entreprise",
    description: "Missions professionnelles",
    icon: Building2,
  },
  {
    value: "association",
    label: "Association",
    description: "Projets à impact social",
    icon: Heart,
  },
]

export default function ClientOnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { supabase } = useSupabase()

  const [clientType, setClientType] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fullName, setFullName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const logoInputRef = useRef(null)
  const cityRef = useRef(null)
  const phoneRef = useRef(null)

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    const name = fullName.trim()
    const city = cityRef.current?.value

    if (!name) { setError("Le nom complet ou nom d'entreprise est requis."); return }
    if (!city) { setError("Veuillez choisir une ville."); return }
    setError("")
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié.")
      if (user.user_metadata?.role !== "client") throw new Error("Session incorrecte. Reconnecte-toi en tant que client.")

      let avatarUrl = null

      if (logoFile) {
        const ext = logoFile.name.split(".").pop()
        const fileName = `${user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, logoFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: name,
        phone: phoneRef.current?.value.trim() || null,
        city,
        role: "client",
        avatar_url: avatarUrl,
        bio: clientType,
      }, { onConflict: "user_id" })
      if (profileError) throw profileError

      toast({ message: "Bienvenue sur EduCash !", type: "success" })
      router.push("/client/dashboard")
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.")
      setIsSubmitting(false)
    }
  }

  const initial = fullName.trim()[0]?.toUpperCase()

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <Logo size="lg" />
          <span className="text-2xl font-black tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
          </span>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Votre profil client</h1>
            <p className="mt-1 text-sm text-gray-500">
              Ces informations seront visibles sur vos missions publiées.
            </p>
          </div>

          {/* Sélection type client */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700">Vous êtes… *</p>
            <div className="grid grid-cols-3 gap-3">
              {CLIENT_TYPES.map(({ value, label, description, icon: Icon }) => {
                const selected = clientType === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setClientType(value)}
                    className={clsx(
                      "flex flex-col items-start gap-2 rounded-xl border-2 px-3 py-3 text-left transition-all duration-150",
                      selected
                        ? "border-[#1A6B4A] bg-[#f0faf5]"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <Icon
                      size={22}
                      className={selected ? "text-[#1A6B4A]" : "text-gray-400"}
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className={clsx("text-sm font-semibold leading-tight", selected ? "text-[#1A6B4A]" : "text-gray-800")}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Upload logo */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-[#1A6B4A] transition-colors overflow-hidden flex items-center justify-center"
              aria-label="Choisir un logo ou une photo"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Aperçu logo" className="w-full h-full object-cover" />
              ) : initial ? (
                <span className="text-3xl font-bold text-[#1A6B4A]">{initial}</span>
              ) : (
                <Camera size={28} className="text-gray-400" />
              )}
            </button>
            <p className="text-xs text-gray-500">Logo ou photo (optionnel)</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          {/* Nom complet / entreprise */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Nom complet ou nom d&apos;entreprise *
            </label>
            <input
              suppressHydrationWarning
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Adjoua Koffi ou Koffi & Associés"
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

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            isLoading={isSubmitting}
            disabled={!clientType}
            onClick={handleSubmit}
          >
            Créer mon profil →
          </Button>
        </div>
      </div>
    </main>
  )
}
