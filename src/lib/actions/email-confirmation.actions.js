"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { mapAuthError, authErrorCode } from "@/lib/auth/errors"
import { makeResendSchema, parseFormData } from "@/lib/auth/schemas"
import { formAudience } from "@/lib/auth/form-audience"
import { authRedirectUrl } from "@/lib/auth/destinations"
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/cookies"
import { safeNextPath } from "@/lib/utils/safe-next"

/**
 * Renvoi de l'email de confirmation. Champs : email (sinon cookie ec_pending_email), next, role.
 * Même réponse que l'adresse existe ou non : seuls rate_limited et network sont révélés.
 * @param {object | null} _prevState
 * @param {FormData} formData
 * @returns {Promise<{ status?: "sent", fieldErrors?: Record<string, string>, formError?: string, code?: "rate_limited" | "network" }>}
 */
export async function resendSignupConfirmation(_prevState, formData) {
  const audience = formAudience(formData)

  const cookieStore = await cookies()
  const fromForm = formData.get("email")?.toString().trim() ?? ""
  const raw = fromForm || cookieStore.get(PENDING_EMAIL_COOKIE)?.value || ""

  const body = new FormData()
  body.set("email", raw)
  const parsed = parseFormData(makeResendSchema(audience), body)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: authRedirectUrl({
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj",
        flow: "signup",
        next: safeNextPath(formData.get("next")?.toString()),
      }),
    },
  })

  const code = authErrorCode(error)
  if (error && (code === "rate_limited" || code === "network")) {
    return { code, formError: mapAuthError(error, audience).message }
  }
  return { status: "sent" }
}
