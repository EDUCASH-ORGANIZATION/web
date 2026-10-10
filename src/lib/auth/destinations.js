// Destinations et liens du parcours d'authentification. JS pur : importable côté client et serveur.
import { safeNextPath, isNextAllowedForRole } from "@/lib/utils/safe-next"

const DASHBOARDS = {
  student: "/dashboard",
  client: "/client/dashboard",
  admin: "/admin/dashboard",
}

const ONBOARDING = {
  student: "/auth/register/student",
  client: "/auth/register/client",
}

const SIGNUP_ROLES = ["student", "client"]

function query(pairs) {
  const parts = pairs
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  return parts.length ? `?${parts.join("&")}` : ""
}

/** Tableau de bord d'un rôle, ou null pour un rôle inconnu. */
export function dashboardFor(role) {
  return DASHBOARDS[role] ?? null
}

/** Écran d'onboarding d'un rôle (student, client), sinon null. */
export function onboardingPathFor(role) {
  return ONBOARDING[role] ?? null
}

/** Ajoute `next` (encodé) à un chemin, seulement s'il est sûr. */
export function withNext(path, next) {
  const safe = safeNextPath(next)
  if (!safe) return path
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(safe)}`
}

export function loginHref({ next } = {}) {
  return withNext("/auth/login", next)
}

/**
 * Lien d'inscription. `redirect` est l'alias historique de `next`.
 * Un rôle autre que student ou client est ignoré.
 */
export function registerHref({ role, next, redirect } = {}) {
  const safe = safeNextPath(next) ?? safeNextPath(redirect)
  return `/auth/register${query([
    ["role", SIGNUP_ROLES.includes(role) ? role : ""],
    ["next", safe],
  ])}`
}

/**
 * Public d'un écran : client si role=client ou si next est sous /client, sinon `fallback`.
 * @returns {"student" | "client"}
 */
export function audienceFor({ role, next } = {}, fallback = "student") {
  if (role === "client") return "client"
  const safe = safeNextPath(next)
  if (safe && /^\/client(\/|$)/.test(safe.split(/[?#]/)[0])) return "client"
  return fallback
}

/**
 * Où envoyer un utilisateur authentifié.
 * Profil incomplet -> onboarding (next conservé s'il est autorisé), sinon next autorisé,
 * sinon tableau de bord. Un rôle inconnu n'obtient jamais de next.
 */
export function resolvePostAuth({ role, profileComplete, next } = {}) {
  const dashboard = dashboardFor(role)
  if (!dashboard) return "/"

  const safe = safeNextPath(next)
  const allowed = safe && isNextAllowedForRole(safe, role) ? safe : null

  const onboarding = onboardingPathFor(role)
  if (!profileComplete && onboarding) return withNext(onboarding, allowed)

  return allowed ?? dashboard
}

/** URL de retour des emails Supabase : `${appUrl}/auth/confirm?flow=...&next=...`. */
export function authRedirectUrl({ appUrl, flow, next }) {
  if (flow !== "signup" && flow !== "recovery") {
    throw new Error(`Flux d'authentification inconnu : ${flow}`)
  }
  const base = String(appUrl ?? "").replace(/\/+$/, "")
  return `${base}/auth/confirm${query([
    ["flow", flow],
    ["next", safeNextPath(next)],
  ])}`
}

function read(params, ...keys) {
  for (const key of keys) {
    const value = typeof params.get === "function" ? params.get(key) : params[key]
    if (typeof value === "string" && value) return value
  }
  return ""
}

/**
 * Cause d'un lien d'authentification refusé.
 * @param {URLSearchParams | Record<string, string | undefined>} params
 *   erreur de redirection Supabase (`error`, `error_code`, `error_description`) ou erreur d'API (`code`, `message`)
 * @returns {"expire" | "utilise" | "autre-appareil" | "invalide"}
 */
export function linkErrorCause(params) {
  const source = params ?? {}
  const code = read(source, "error_code", "errorCode", "code").toLowerCase()
  const text = read(source, "error_description", "errorDescription", "message").toLowerCase()

  if (code === "bad_code_verifier" || /code verifier/.test(text)) return "autre-appareil"
  if (code === "otp_expired" || code === "flow_state_expired" || /expire/.test(text)) return "expire"
  if (code === "flow_state_not_found") return "utilise"
  if (/already (been )?used|consumed|already confirmed/.test(text)) return "utilise"
  return "invalide"
}
