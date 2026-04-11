"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const VALID_ROLES = ["student", "client"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function dashboardFor(role) {
  if (role === "client") return "/client/dashboard"
  if (role === "admin")  return "/admin/dashboard"
  return "/dashboard"
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

  if (error) return { error: error.message }

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
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." }
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

  if (error) return { error: error.message }

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
