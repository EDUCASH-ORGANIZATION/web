// Cookies d'authentification posés par les actions et routes serveur.
// Valeurs et options uniquement : l'écriture se fait avec `cookies()` de next/headers côté appelant.

/** Adresse en attente de confirmation (écran de vérification), jamais dans l'URL. */
export const PENDING_EMAIL_COOKIE = "ec_pending_email"
export const PENDING_EMAIL_MAX_AGE = 60 * 60 * 24

/** Marque une session de récupération de mot de passe ouverte via /auth/confirm. */
export const RECOVERY_COOKIE = "ec_recovery"
export const RECOVERY_MAX_AGE = 60 * 15

function baseOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge,
  }
}

export function pendingEmailCookieOptions() {
  return baseOptions(PENDING_EMAIL_MAX_AGE)
}

export function recoveryCookieOptions() {
  return baseOptions(RECOVERY_MAX_AGE)
}
