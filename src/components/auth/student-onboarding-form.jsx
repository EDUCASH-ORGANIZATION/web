"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { saveStudentProfile } from "@/lib/actions/profile.actions"
import { CITIES, MISSION_TYPES } from "@/lib/supabase/database.constants"
import clsx from "clsx"

export function StudentOnboardingForm() {
  const [selectedSkills, setSelectedSkills] = useState([])
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  function toggleSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  async function onSubmit(values) {
    setServerError(null)
    const formData = new FormData()
    formData.set("fullName", values.fullName)
    formData.set("phone", values.phone ?? "")
    formData.set("city", values.city)
    formData.set("school", values.school ?? "")
    formData.set("level", values.level ?? "")
    selectedSkills.forEach((s) => formData.append("skills", s))

    const result = await saveStudentProfile(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Nom complet */}
      <Input
        label="Nom complet *"
        name="fullName"
        placeholder="Ex : Kokou Mensah"
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

      {/* École */}
      <Input
        label="École / Université"
        name="school"
        placeholder="Ex : UNSTIM, UAC..."
        {...register("school")}
      />

      {/* Niveau */}
      <Input
        label="Niveau d'études"
        name="level"
        placeholder="Ex : Licence 2, Master 1..."
        {...register("level")}
      />

      {/* Compétences */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">
          Mes compétences <span className="text-gray-400 font-normal">(choisis tout ce qui te correspond)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {MISSION_TYPES.map((skill) => {
            const active = selectedSkills.includes(skill)
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
