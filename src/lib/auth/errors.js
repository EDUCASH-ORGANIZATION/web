// Correspondance des erreurs Supabase Auth vers { code, message }.
// Jamais de message anglais brut : un cas inconnu donne le code "unknown".

const MESSAGES = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  email_not_confirmed: "Votre adresse email n'est pas encore confirmée. Ouvrez l'email que nous vous avons envoyé.",
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  session_expired: "Votre session a expiré. Reconnectez-vous.",
  network: "Problème de connexion. Vérifiez votre réseau et réessayez.",
  email_taken: "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
  suspended: "Votre compte est suspendu. Contactez-nous pour en savoir plus.",
  same_password: "Choisissez un mot de passe différent de l'ancien.",
  weak_password: "Votre mot de passe ne respecte pas toutes les règles.",
  unknown: "Une erreur est survenue. Réessayez dans un instant.",
}

/** Message d'un code connu (vouvoiement pour tous les publics). */
export function authErrorMessage(code) {
  return MESSAGES[code] ?? MESSAGES.unknown
}

/** Code stable d'une erreur Supabase Auth (champs `code`, `status`, `name`, `message`). */
export function authErrorCode(error) {
  if (!error) return "unknown"
  const code = String(error.code ?? "").toLowerCase()
  const text = String(error.message ?? "").toLowerCase()
  const name = String(error.name ?? "")

  if (code === "invalid_credentials" || /invalid login credentials/.test(text)) return "invalid_credentials"
  if (code === "email_not_confirmed" || /email not confirmed|email address not confirmed/.test(text)) {
    return "email_not_confirmed"
  }
  if (code === "user_already_exists" || code === "email_exists" || /already registered/.test(text)) {
    return "email_taken"
  }
  if (code === "same_password" || /different from the old password/.test(text)) return "same_password"
  if (code === "weak_password") return "weak_password"
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    /rate limit|too many requests|security purposes/.test(text)
  ) {
    return "rate_limited"
  }
  if (
    code === "session_expired" ||
    code === "session_not_found" ||
    code === "refresh_token_not_found" ||
    code === "otp_expired" ||
    /auth session missing|jwt expired|session.*(expired|missing)/.test(text)
  ) {
    return "session_expired"
  }
  if (
    name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    /fetch failed|failed to fetch|network/.test(text)
  ) {
    return "network"
  }
  return "unknown"
}

/**
 * @param {object} error erreur renvoyée par supabase.auth
 * @returns {{ code: string, message: string }}
 */
export function mapAuthError(error) {
  const code = authErrorCode(error)
  return { code, message: authErrorMessage(code) }
}
