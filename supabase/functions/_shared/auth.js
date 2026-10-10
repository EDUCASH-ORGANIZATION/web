// Utilitaires d'authentification et de CORS partages par les Edge Functions.
// Aucune dependance Deno : importe aussi par Vitest.

// Extrait le jeton d'un en-tete "Authorization: Bearer <jeton>".
export function extractBearerToken(headerValue) {
  if (typeof headerValue !== "string") return null
  const match = /^Bearer\s+(\S+)$/i.exec(headerValue.trim())
  return match ? match[1] : null
}

// Origine CORS : uniquement le domaine de l'app (APP_URL).
// Retourne null si APP_URL est absent ou invalide (l'en-tete doit alors etre omis).
export function corsOrigin(appUrl) {
  if (!appUrl) return null
  try {
    return new URL(appUrl).origin
  } catch {
    return null
  }
}

// En-tetes CORS : Access-Control-Allow-Origin omis sans origine configuree.
export function corsHeaders(appUrl) {
  const origin = corsOrigin(appUrl)
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  }
}
