import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerRole } from "@/lib/auth/server-role"
import { linkErrorCause, resolvePostAuth } from "@/lib/auth/destinations"
import {
  PENDING_EMAIL_COOKIE,
  RECOVERY_COOKIE,
  pendingEmailCookieOptions,
  recoveryCookieOptions,
} from "@/lib/auth/cookies"

// Types de jeton acceptés pour verifyOtp (liens des gabarits Supabase).
const OTP_TYPES = ["signup", "recovery", "email"]

// Ferme la session. Si la révocation échoue, les cookies de session Supabase (sb-*) sont supprimés
// explicitement : un échec ne doit jamais laisser une session ouverte.
async function revokeSession(supabase) {
  const { error } = (await supabase.auth.signOut()) ?? {}
  if (!error) return
  const store = await cookies()
  for (const { name } of store.getAll()) {
    if (name.startsWith("sb-")) store.delete(name)
  }
}

/**
 * Traite un lien d'email Supabase : `code` (PKCE, même appareil) ou `token_hash` + `type`
 * (tout appareil). Utilisé par /auth/confirm et /auth/callback.
 * - compte suspendu (les deux flux) : signOut puis /auth/login?suspended=1
 * - recovery : cookie ec_recovery puis /auth/reset-password
 * - signup : rôle lu dans profiles, puis onboarding ou next autorisé
 * - erreur : /auth/link-expired?cause=...&flow=...
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleAuthConfirm(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const flow =
    searchParams.get("flow") === "recovery" || type === "recovery" ? "recovery" : "signup"

  const failure = (cause) =>
    NextResponse.redirect(new URL(`/auth/link-expired?cause=${cause}&flow=${flow}`, origin))

  if (searchParams.get("error") || searchParams.get("error_code")) {
    return failure(linkErrorCause(searchParams))
  }

  const supabase = await createClient()
  let result

  if (tokenHash && OTP_TYPES.includes(type)) {
    result = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  } else if (code) {
    result = await supabase.auth.exchangeCodeForSession(code)
  } else {
    return failure("invalide")
  }

  const user = result?.data?.user
  if (result?.error || !user) {
    return failure(linkErrorCause({ code: result?.error?.code, message: result?.error?.message }))
  }

  // Un compte suspendu ne garde aucune session : pas de cookie de récupération, pas d'onboarding.
  const serverRole = await getServerRole(supabase, user)
  if (serverRole.error) {
    await revokeSession(supabase)
    return failure("invalide")
  }
  if (serverRole.profile?.is_suspended) {
    await revokeSession(supabase)
    return NextResponse.redirect(new URL("/auth/login?suspended=1", origin))
  }

  if (flow === "recovery") {
    const response = NextResponse.redirect(new URL("/auth/reset-password", origin))
    response.cookies.set(RECOVERY_COOKIE, "1", recoveryCookieOptions())
    return response
  }

  const { role, profileComplete } = serverRole
  const destination = resolvePostAuth({
    role,
    profileComplete,
    next: searchParams.get("next"),
  })

  const response = NextResponse.redirect(new URL(destination, origin))
  // L'adresse n'a plus à être rappelée une fois le compte confirmé.
  response.cookies.set(PENDING_EMAIL_COOKIE, "", { ...pendingEmailCookieOptions(), maxAge: 0 })
  return response
}
