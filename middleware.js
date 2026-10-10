import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { matchesRoutePrefix } from "@/lib/utils/route-match"
import { safeNextPath, isNextAllowedForRole } from "@/lib/utils/safe-next"
import { dashboardFor } from "@/lib/auth/destinations"

// Pages /auth/* accessibles même si l'utilisateur est déjà connecté
// (onboarding, retour des liens d'email, réinitialisation, lien expiré)
const AUTH_OPEN_WHEN_LOGGED_IN = [
  "/auth/register/student",
  "/auth/register/client",
  "/auth/callback",
  "/auth/confirm",
  "/auth/reset-password",
  "/auth/link-expired",
]

// Navigation seulement : user_metadata est modifiable par l'utilisateur, l'autorité reste profiles.role.
function dashboardOf(role) {
  return dashboardFor(role) ?? "/dashboard"
}

// Redirection vers le login en gardant la requête dans `next` (ex. pré-remplissage
// de la publication). safeNextPath évite toute redirection ouverte ; au-delà de la
// limite de longueur, on retombe sur le chemin seul.
function loginRedirect(request) {
  const { pathname, search } = request.nextUrl
  const loginUrl = new URL("/auth/login", request.url)
  loginUrl.searchParams.set("next", safeNextPath(pathname + search) ?? pathname)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request) {
  // /clients n'existe plus : les liens déjà partagés arrivent sur l'accueil (requête conservée).
  // Placé avant l'appel Supabase : aucune session à rafraîchir pour une redirection publique.
  if (request.nextUrl.pathname === "/clients") {
    const home = new URL("/", request.url)
    home.search = request.nextUrl.search
    return NextResponse.redirect(home, 308)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session - ne jamais supprimer cet appel.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Routes /auth/* ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/auth")) {
    // Laisser passer les pages de complétion de profil même si connecté
    if (AUTH_OPEN_WHEN_LOGGED_IN.some((p) => pathname.startsWith(p))) {
      return response
    }

    // Connecté → rediriger vers le dashboard selon le rôle
    if (user) {
      const role = user.user_metadata?.role ?? "student"
      // Connecté sur /auth/login?next= : retour vers le next autorisé pour son rôle.
      if (pathname === "/auth/login") {
        const next = safeNextPath(request.nextUrl.searchParams.get("next"))
        if (next && isNextAllowedForRole(next, role)) {
          return NextResponse.redirect(new URL(next, request.url))
        }
      }
      return NextResponse.redirect(new URL(dashboardOf(role), request.url))
    }
    // Note : /client/dashboard est servi par (client)/dashboard/page.js

    return response
  }

  // ── Routes espace étudiant (groupe (student)) ──────────────────────────────
  // /dashboard, /applications, /messages, /profile
  const STUDENT_ONLY = ["/dashboard", "/applications", "/messages", "/profile", "/student"]
  if (STUDENT_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      return loginRedirect(request)
    }
    const role = user.user_metadata?.role ?? "student"
    if (role !== "student") {
      return NextResponse.redirect(new URL(dashboardOf(role), request.url))
    }
    return response
  }

  // ── Routes /admin/* ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return loginRedirect(request)
    }
    const role = user.user_metadata?.role ?? "student"
    if (role !== "admin") {
      const dashboard = role === "client" ? "/client/dashboard" : "/dashboard"
      return NextResponse.redirect(new URL(dashboard, request.url))
    }
    return response
  }

  // ── Routes /student/* et /client/* ─────────────────────────────────────────
  const PROTECTED = [
    { prefix: "/student", role: "student" },
    { prefix: "/client", role: "client" },
  ]

  for (const { prefix, role: requiredRole } of PROTECTED) {
    if (matchesRoutePrefix(pathname, prefix)) {
      // Non connecté → login
      if (!user) {
        return loginRedirect(request)
      }

      // Mauvais rôle → son propre dashboard
      const role = user.user_metadata?.role ?? "student"
      if (role !== requiredRole) {
        return NextResponse.redirect(new URL(dashboardOf(role), request.url))
      }

      break
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
}
