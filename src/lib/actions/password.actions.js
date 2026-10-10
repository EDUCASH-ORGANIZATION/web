"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { mapAuthError, authErrorCode, authErrorMessage } from "@/lib/auth/errors"
import { makeForgotSchema, makeResetSchema, parseFormData } from "@/lib/auth/schemas"
import { formAudience } from "@/lib/auth/form-audience"
import { authRedirectUrl } from "@/lib/auth/destinations"
import { RECOVERY_COOKIE, recoveryCookieOptions } from "@/lib/auth/cookies"

/**
 * Demande de lien de réinitialisation. Champs : email, role ou next (pour le ton).
 * Même réponse que le compte existe ou non : seuls rate_limited et network sont révélés.
 * @param {object | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<{ status?: "sent", fieldErrors?: Record<string, string>, formError?: string, code?: "rate_limited" | "network" }>}
 */
export async function requestPasswordReset(_prevState, formData) {
  const audience = formAudience(formData)
  const parsed = parseFormData(makeForgotSchema(audience), formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authRedirectUrl({
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj",
      flow: "recovery",
    }),
  })

  const code = authErrorCode(error)
  if (error && (code === "rate_limited" || code === "network")) {
    return { code, formError: mapAuthError(error, audience).message }
  }
  return { status: "sent" }
}

/**
 * Nouveau mot de passe. Exige la session de récupération ET le cookie ec_recovery posé par /auth/confirm.
 * Champs : password, confirmPassword, role ou next (pour le ton).
 * Succès : session fermée, cookie supprimé, l'utilisateur se reconnecte avec son nouveau mot de passe.
 * @param {object | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<{ status?: "updated", fieldErrors?: Record<string, string>, formError?: string, code?: "expired" | "same_password" | "rate_limited" | "network" | "unknown" }>}
 */
export async function updatePassword(_prevState, formData) {
  const audience = formAudience(formData)
  const expired = { code: "expired", formError: authErrorMessage("session_expired", audience) }

  const cookieStore = await cookies()
  if (!cookieStore.get(RECOVERY_COOKIE)?.value) return expired

  const parsed = parseFormData(makeResetSchema(audience), formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return expired

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    const { code, message } = mapAuthError(error, audience)
    if (code === "session_expired") return expired
    return { code, formError: message }
  }

  await supabase.auth.signOut()
  cookieStore.set(RECOVERY_COOKIE, "", { ...recoveryCookieOptions(), maxAge: 0 })
  return { status: "updated" }
}
