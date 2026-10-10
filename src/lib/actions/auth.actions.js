"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { mapAuthError, authErrorMessage } from "@/lib/auth/errors"
import { makeLoginSchema, makeRegisterSchema, parseFormData } from "@/lib/auth/schemas"
import { getServerRole } from "@/lib/auth/server-role"
import { PENDING_EMAIL_COOKIE, pendingEmailCookieOptions } from "@/lib/auth/cookies"
import { formAudience } from "@/lib/auth/form-audience"
import { authRedirectUrl, resolvePostAuth, withNext } from "@/lib/auth/destinations"
import { safeNextPath } from "@/lib/utils/safe-next"

/**
 * Contrat commun des actions de formulaire (useActionState) : l'état précédent est le premier
 * argument, le FormData le second. En cas de succès elles redirigent (jamais de retour).
 *
 * @typedef {object} AuthActionState
 * @property {Record<string, string>} [fieldErrors] message par champ (email, password, role, cgu...)
 * @property {string} [formError] message affichable au-dessus du formulaire, adapté à l'audience
 * @property {string} [code] invalid_credentials | email_not_confirmed | rate_limited | session_expired |
 *   network | email_taken | suspended | unknown
 * @property {string} [contactHref] lien d'aide (code suspended seulement)
 */

function text(formData, key) {
  return formData.get(key)?.toString() ?? ""
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Connexion. Champs : email, password, next (facultatif), role ou audience (facultatif).
 * @param {AuthActionState | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<AuthActionState>}
 */
export async function login(_prevState, formData) {
  const audience = formAudience(formData)
  const parsed = parseFormData(makeLoginSchema(audience), formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    const { code, message } = mapAuthError(error, audience)
    return { code, formError: message }
  }

  // Le rôle d'autorisation vient de profiles, jamais de user_metadata.
  const { role, profile, profileComplete, error: roleError } = await getServerRole(supabase, data.user)

  // Lecture du profil impossible : on refuse plutôt que d'accorder un accès sans rôle vérifié.
  if (roleError) {
    await supabase.auth.signOut()
    return { code: "unknown", formError: authErrorMessage("unknown", audience) }
  }

  if (profile?.is_suspended) {
    await supabase.auth.signOut()
    return {
      code: "suspended",
      formError: authErrorMessage("suspended", audience),
      contactHref: "/contact",
    }
  }

  redirect(resolvePostAuth({ role, profileComplete, next: text(formData, "next") }))
}

/**
 * Inscription. Champs : role (student | client), email, password, confirmPassword, cgu, next (facultatif).
 * Redirige vers /auth/verify-email (role et next en requête, jamais l'email) ou vers l'onboarding
 * quand Supabase ouvre une session immédiate.
 * @param {AuthActionState | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<AuthActionState>}
 */
export async function register(_prevState, formData) {
  const audience = formAudience(formData)
  const parsed = parseFormData(makeRegisterSchema(audience), formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const { email, password, role } = parsed.data
  const next = safeNextPath(text(formData, "next"))

  const supabase = await createClient()

  // Déconnecter toute session existante avant de créer un nouveau compte
  // (évite que l'onboarding tourne sous la mauvaise identité)
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser()
  if (existingUser) await supabase.auth.signOut()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
      emailRedirectTo: authRedirectUrl({ appUrl: appUrl(), flow: "signup", next }),
    },
  })

  if (error) {
    const { code, message } = mapAuthError(error, audience)
    return code === "email_taken"
      ? { code, fieldErrors: { email: message } }
      : { code, formError: message }
  }

  // Adresse déjà inscrite : Supabase renvoie un faux utilisateur sans identité.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      code: "email_taken",
      fieldErrors: { email: authErrorMessage("email_taken", audience) },
    }
  }

  // Confirmation par email requise : pas de session, on attend sur l'écran de vérification.
  if (!data.session) {
    const cookieStore = await cookies()
    cookieStore.set(PENDING_EMAIL_COOKIE, email, pendingEmailCookieOptions())
    redirect(withNext(`/auth/verify-email?role=${role}`, next))
  }

  redirect(resolvePostAuth({ role, profileComplete: false, next }))
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
