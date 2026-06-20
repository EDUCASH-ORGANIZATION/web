"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const VALID_ROLES = ["student", "client"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password) {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères."
  if (!/[A-Z]/.test(password)) return "Le mot de passe doit contenir au moins une majuscule."
  if (!/[a-z]/.test(password)) return "Le mot de passe doit contenir au moins une minuscule."
  if (!/[0-9]/.test(password)) return "Le mot de passe doit contenir au moins un chiffre."
  if (!/[^A-Za-z0-9]/.test(password)) return "Le mot de passe doit contenir au moins un caractère spécial."
  return null
}

function dashboardFor(role) {
  if (role === "client") return "/client/dashboard"
  if (role === "admin")  return "/admin/dashboard"
  return "/dashboard"
}

function mapAuthError(message = "") {
  const normalized = message.toLowerCase().trim()
  if (normalized.includes("user already registered")) {
    return "Cette adresse email est déjà utilisée. Connecte-toi ou utilise une autre adresse."
  }
  if (normalized.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect."
  }
  if (normalized.includes("email not confirmed") || normalized.includes("email address not confirmed")) {
    return "L'adresse email n'a pas encore été confirmée. Vérifie ta boîte de réception."
  }
  if (normalized.includes("over email send rate limit") || normalized.includes("rate limit")) {
    return "Trop de tentatives. Réessaie dans quelques minutes."
  }
  if (normalized.includes("user not found") || normalized.includes("invalid email")) {
    return "Aucun compte n'est associé à cette adresse email."
  }
  if (normalized.includes("jwt") || normalized.includes("token")) {
    return "Ta session a expiré. Reconnecte-toi."
  }
  if (normalized.includes("network")) {
    return "Problème de connexion. Vérifie ton internet et réessaie."
  }
  // Fallback : message générique si l'erreur est en anglais brute
  return message
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function login(formData) {
  const email = formData.get("email")?.toString().trim() ?? ""
  const password = formData.get("password")?.toString() ?? ""

  if (!email) return { error: "L'adresse email est requise." }
  if (!validateEmail(email)) return { error: "L'adresse email n'est pas valide." }
  if (!password) return { error: "Le mot de passe est requis." }
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: mapAuthError(error.message) }

  const role = data.user?.user_metadata?.role ?? "student"
  redirect(dashboardFor(role))
}

export async function register(formData) {
  const email = formData.get("email")?.toString().trim() ?? ""
  const password = formData.get("password")?.toString() ?? ""
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? ""
  const role = formData.get("role")?.toString() ?? ""

  if (!email) return { error: "L'adresse email est requise." }
  if (!validateEmail(email)) return { error: "L'adresse email n'est pas valide." }
  if (!password) return { error: "Le mot de passe est requis." }
  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }
  if (confirmPassword !== password) return { error: "Les mots de passe ne correspondent pas." }
  if (!VALID_ROLES.includes(role)) return { error: "Le rôle sélectionné est invalide." }

  const supabase = await createClient()

  // Déconnecter toute session existante avant de créer un nouveau compte
  // (évite que le formulaire de profil tourne sous la mauvaise identité)
  const { data: { user: existingUser } } = await supabase.auth.getUser()
  if (existingUser) await supabase.auth.signOut()

  // emailRedirectTo : après confirmation email, Supabase redirige vers
  // /auth/callback qui échange le code et redirige vers la bonne page d'onboarding.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (error) return { error: mapAuthError(error.message) }

  // Si Supabase requiert une confirmation email, data.session est null
  // → on redirige vers une page d'attente plutôt que vers le formulaire de profil
  if (!data.session) {
    redirect("/auth/verify-email")
  }

  redirect(role === "client" ? "/auth/register/client" : "/auth/register/student")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}
