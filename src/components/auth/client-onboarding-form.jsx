"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { saveClientProfile } from "@/lib/actions/profile.actions"
import { CITIES } from "@/lib/supabase/database.constants"
import clsx from "clsx"

export function ClientOnboardingForm() {
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  async function onSubmit(values) {
    setServerError(null)
    const formData = new FormData()
    formData.set("fullName", values.fullName)
    formData.set("phone", values.phone ?? "")
    formData.set("city", values.city)
    formData.set("companyName", values.companyName ?? "")

    const result = await saveClientProfile(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Nom complet */}
      <Input
        label="Nom complet *"
        name="fullName"
        placeholder="Ex : Adjoua Koffi"
        error={errors.fullName?.message}
        {...register("fullName", { required: "Le nom complet est requis." })}
      />

      {/* Téléphone */}
      <Input
        label="Numéro de téléphone"
        name="phone"
        type="tel"
        placeholder="+229 XX XX XX XX"
        {...register("phone")}
      />

      {/* Ville */}
      <div className="flex flex-col gap-1">
        <label htmlFor="city" className="text-sm font-medium text-gray-700">
          Ville *
        </label>
        <select
          id="city"
          className={clsx(
            "h-10 w-full rounded-lg border px-3 text-sm bg-white text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent",
            errors.city ? "border-red-500" : "border-gray-300"
          )}
          {...register("city", { required: "Veuillez choisir une ville." })}
        >
          <option value="">Sélectionner une ville</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
      </div>

      {/* Nom entreprise / organisation */}
      <Input
        label="Entreprise ou organisation"
        name="companyName"
        placeholder="Ex : Koffi & Associés (optionnel)"
        {...register("companyName")}
      />

      {serverError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
        Accéder à mon espace
      </Button>
    </form>
  )
}
