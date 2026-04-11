import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Route Handler Supabase Auth Callback.
 *
 * Supabase redirige ici après confirmation email (signup) ou OAuth.
 * On échange le "code" contre une session, puis on redirige vers
 * la bonne page d'onboarding selon le rôle.
 *
 * URL reçue : /auth/callback?code=xxx
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get("code")
  const error = searchParams.get("error")

  // Supabase peut renvoyer une erreur dans l'URL (ex : lien expiré)
  if (error) {
    console.error("[auth/callback] error from Supabase:", error, searchParams.get("error_description"))
    return NextResponse.redirect(
      new URL(`/auth/register?error=${encodeURIComponent(error)}`, origin)
    )
  }

  if (!code) {
    // Pas de code → retour à l'inscription
    return NextResponse.redirect(new URL("/auth/register", origin))
  }

  const supabase = await createClient()

  // Échange le code PKCE contre une session active
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data?.user) {
    console.error("[auth/callback] exchangeCodeForSession error:", exchangeError?.message)
    return NextResponse.redirect(
      new URL("/auth/register?error=lien_invalide_ou_expire", origin)
    )
  }

  // Détermine la destination selon le rôle stocké dans user_metadata
  const role = data.user.user_metadata?.role ?? "student"

  if (role === "client") {
    return NextResponse.redirect(new URL("/auth/register/client", origin))
  }
  if (role === "student") {
    return NextResponse.redirect(new URL("/auth/register/student", origin))
  }
  if (role === "admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", origin))
  }

  // Fallback
  return NextResponse.redirect(new URL("/dashboard", origin))
}
