"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { Mail, Eye, EyeOff, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { login } from "@/lib/actions/auth.actions"
import { useToast } from "@/components/shared/toaster"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  async function onSubmit(values) {
    setServerError(null)

    const formData = new FormData()
    formData.set("email", values.email)
    formData.set("password", values.password)

    const result = await login(formData)

    // Si login() redirige, ce code n'est jamais atteint.
    // On arrive ici uniquement en cas d'erreur retournée.
    if (result?.error) {
      setServerError(result.error)
    }
  }

  function handleForgotPassword() {
    toast({ message: "La réinitialisation de mot de passe arrive bientôt.", type: "info" })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate suppressHydrationWarning className="flex flex-col gap-4">
      {/* Email */}
      <Input
        label="Adresse email"
        name="email"
        type="email"
        placeholder="toi@example.com"
        leftIcon={<Mail size={16} />}
        error={errors.email?.message}
        {...register("email", {
          required: "L'adresse email est requise.",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "L'adresse email n'est pas valide.",
          },
        })}
      />

      {/* Password */}
      <Input
        label="Mot de passe"
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder="••••••••"
        error={errors.password?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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

      {/* Mot de passe oublié */}
      <div className="flex justify-end -mt-2">
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-xs text-[#1A6B4A] hover:underline"
        >
          Mot de passe oublié ?
        </button>
      </div>

      {/* Erreur serveur */}
      {serverError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
        Se connecter
      </Button>

      {/* Lien inscription */}
      <p className="text-center text-sm text-gray-500">
        Pas encore inscrit ?{" "}
        <Link href="/auth/register" className="text-[#1A6B4A] font-medium hover:underline">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  )
}
