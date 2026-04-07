"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { GraduationCap, Briefcase, Eye, EyeOff, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { register as registerAction } from "@/lib/actions/auth.actions"
import clsx from "clsx"

const ROLE_OPTIONS = [
  {
    value: "student",
    label: "Je suis étudiant",
    description: "Je cherche des missions rémunérées",
    icon: GraduationCap,
  },
  {
    value: "client",
    label: "Je cherche un prestataire",
    description: "Je publie des missions ponctuelles",
    icon: Briefcase,
  },
]

export function RegisterForm() {
  const [role, setRole] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  const password = watch("password")

  async function onSubmit(values) {
    setServerError(null)

    const formData = new FormData()
    formData.set("email", values.email)
    formData.set("password", values.password)
    formData.set("confirmPassword", values.confirmPassword)
    formData.set("role", role)

    const result = await registerAction(formData)

    if (result?.error) {
      setServerError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate suppressHydrationWarning className="flex flex-col gap-5">
      {/* Sélection du rôle — boutons purs, pas de radio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const selected = role === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={clsx(
                "flex flex-col items-start gap-2 rounded-xl border-2 px-4 py-4 text-left transition-all duration-150 touch-manipulation",
                selected
                  ? "border-[#1A6B4A] bg-[#f0faf5]"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <Icon
                size={28}
                className={selected ? "text-[#1A6B4A]" : "text-gray-400"}
                strokeWidth={1.75}
              />
              <div>
                <p className={clsx("text-sm font-semibold", selected ? "text-[#1A6B4A]" : "text-gray-800")}>
                  {label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Email */}
      <Input
        label="Adresse email"
        name="email"
        type="email"
        placeholder="toi@example.com"
        error={errors.email?.message}
        {...register("email", {
          required: "L'adresse email est requise.",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "L'adresse email n'est pas valide.",
          },
        })}
      />

      {/* Mot de passe */}
      <Input
        label="Mot de passe"
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder="Minimum 8 caractères"
        error={errors.password?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register("password", {
          required: "Le mot de passe est requis.",
          minLength: {
            value: 8,
            message: "Le mot de passe doit contenir au moins 8 caractères.",
          },
        })}
      />

      {/* Confirmer le mot de passe */}
      <Input
        label="Confirmer le mot de passe"
        name="confirmPassword"
        type={showConfirm ? "text" : "password"}
        placeholder="Répète ton mot de passe"
        error={errors.confirmPassword?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showConfirm ? "Masquer" : "Afficher"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register("confirmPassword", {
          required: "Veuillez confirmer ton mot de passe.",
          validate: (value) =>
            value === password || "Les mots de passe ne correspondent pas.",
        })}
      />

      {/* Erreur serveur */}
      {serverError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
        disabled={!role}
      >
        Créer mon compte
      </Button>

      <p className="text-center text-sm text-gray-500">
        Déjà inscrit ?{" "}
        <Link href="/auth/login" className="text-[#1A6B4A] font-medium hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
