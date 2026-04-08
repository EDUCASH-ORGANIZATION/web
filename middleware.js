import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

// Pages /auth/* accessibles même si l'utilisateur est déjà connecté
// (complétion de profil post-inscription)
const AUTH_OPEN_WHEN_LOGGED_IN = [
  "/auth/register/student",
  "/auth/register/client",
]

export async function middleware(request) {
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

  // Rafraîchit la session — ne jamais supprimer cet appel.
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

    // Connecté → rediriger vers le dashboard
    if (user) {
      const role = user.user_metadata?.role ?? "student"
      const dashboard = role === "client" ? "/client/dashboard" : "/dashboard"
      return NextResponse.redirect(new URL(dashboard, request.url))
    }
    // Note : /client/dashboard est servi par (client)/dashboard/page.js

    return response
  }

  // ── Routes espace étudiant (groupe (student)) ──────────────────────────────
  // /dashboard, /applications, /messages, /profile
  const STUDENT_ONLY = ["/dashboard", "/applications", "/messages", "/profile", "/student"]
  if (STUDENT_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = user.user_metadata?.role ?? "student"
    if (role !== "student") {
      return NextResponse.redirect(new URL("/client/dashboard", request.url))
    }
    return response
  }

  // ── Routes /admin/* ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
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
    if (pathname.startsWith(prefix)) {
      // Non connecté → login
      if (!user) {
        const loginUrl = new URL("/auth/login", request.url)
        loginUrl.searchParams.set("next", pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Mauvais rôle → son propre dashboard
      const role = user.user_metadata?.role ?? "student"
      if (role !== requiredRole) {
        const dashboard = role === "client" ? "/client/dashboard" : "/dashboard"
        return NextResponse.redirect(new URL(dashboard, request.url))
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
