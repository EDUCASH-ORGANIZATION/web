import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { matchesRoutePrefix } from "@/lib/utils/route-match"
import { safeNextPath, isNextAllowedForRole } from "@/lib/utils/safe-next"
import { dashboardFor } from "@/lib/auth/destinations"
import { getServerRole } from "@/lib/auth/server-role"
import {
  waitingModeEnabled,
  waitingHeaders,
  waitingPageHtml,
  waitingRobotsTag,
  isWaitingPassthrough,
  killSwitchServiceWorker,
} from "@/lib/site/waiting-mode"

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

// Stratégie du rôle (RD-SEC-01) : le rôle vient de profiles.role, lu avec la session de l'utilisateur
// (client anon + RLS, jamais de service role dans le middleware) via getServerRole. La lecture n'a lieu
// que lorsque le rôle sert : pages /auth hors liste ouverte quand on est connecté, et préfixes protégés.
// Les pages publiques et les visiteurs ne coûtent aucune requête de plus. Le middleware ne sert qu'à la
// navigation : chaque layout, page et server action revérifie le rôle côté serveur (fail-closed).
// user_metadata n'est jamais lu ici. Rôle introuvable (lecture en erreur ou aucun profil) :
// on laisse passer sur /auth (pas de boucle) et on renvoie vers l'accueil sur un préfixe protégé.
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

// Compte suspendu sur un préfixe protégé : retour au login avec le message. Sur /auth/*, il n'est pas
// renvoyé vers son espace (sinon boucle avec les layouts qui le renvoient ici). Lecture de profiles seule.
function suspendedRedirect(request) {
  return NextResponse.redirect(new URL("/auth/login?suspended=1", request.url))
}

// Mode attente (RD-STAGE-01) : répond sans aucun appel Supabase. Toutes les méthodes sont couvertes
// (GET, HEAD, POST des server actions). Les assets statiques exclus par le matcher restent servis.
function waitingResponse(request) {
  const { pathname } = request.nextUrl
  if (isWaitingPassthrough(pathname)) return NextResponse.next()
  if (pathname === "/sw.js") {
    return new NextResponse(killSwitchServiceWorker(), {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": waitingRobotsTag(),
      },
    })
  }
  if (pathname === "/manifest.json") {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": waitingRobotsTag() },
    })
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Service momentanément indisponible." }), {
      status: 503,
      headers: { ...waitingHeaders(), "Content-Type": "application/json; charset=utf-8" },
    })
  }
  return new NextResponse(waitingPageHtml(), { status: 503, headers: waitingHeaders() })
}

export async function middleware(request) {
  // Toute première instruction : mode attente, puis proxy d'images sans coût (ni session Supabase).
  if (waitingModeEnabled()) return waitingResponse(request)
  if (request.nextUrl.pathname === "/_next/image") return NextResponse.next()

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
      const { role, profile } = await getServerRole(supabase, user)
      if (!role) return response
      if (profile?.is_suspended === true) return response
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
  // /dashboard, /applications, /messages, /profile, /wallet
  const STUDENT_ONLY = ["/dashboard", "/applications", "/messages", "/profile", "/wallet", "/student"]
  if (STUDENT_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      return loginRedirect(request)
    }
    const { role, profile } = await getServerRole(supabase, user)
    if (!role) return NextResponse.redirect(new URL("/", request.url))
    if (profile?.is_suspended === true) return suspendedRedirect(request)
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
    const { role, profile } = await getServerRole(supabase, user)
    if (!role) return NextResponse.redirect(new URL("/", request.url))
    if (profile?.is_suspended === true) return suspendedRedirect(request)
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
      const { role, profile } = await getServerRole(supabase, user)
      if (!role) return NextResponse.redirect(new URL("/", request.url))
      if (profile?.is_suspended === true) return suspendedRedirect(request)
      if (role !== requiredRole) {
        return NextResponse.redirect(new URL(dashboardOf(role), request.url))
      }

      break
    }
  }

  return response
}

// Le mode attente repose entièrement sur ce matcher : chaque exclusion est ancrée (slash final ou `$`),
// sinon une route dynamique terminée par une extension (/missions/abc.png, /api/x.png) échapperait au
// middleware. Exclus : /_next/static/*, favicon.ico, sitemap.xml, robots.txt (chemins exacts), les
// images des dossiers public email/, logos/, icons/, images/ et les images à la racine sans sous-dossier
// (logos de la page d'attente). Un fichier racine absent de /public (/x.png) retombe sur la 404 globale
// statique, sans données. /attente.css passe par le middleware et y est exempté par comparaison exacte.
// Hors mode attente, /_next/image passe aussi par le middleware (une invocation de plus, sans Supabase).
export const config = {
  matcher: [
    "/((?!_next/static/|favicon\\.ico$|sitemap\\.xml$|robots\\.txt$|(?:email|logos|icons|images)/.+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
}
