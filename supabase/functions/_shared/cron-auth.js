// Authentification des fonctions declenchees par une tache planifiee (secret partage).
// Aucune dependance Deno : importe aussi par Vitest.
// Fermee par defaut : sans secret configure, la fonction refuse tout appel.

export const CRON_SECRET_HEADER = "x-cron-secret"

// Comparaison en temps constant : le temps ne depend pas de la position du premier ecart,
// et une longueur differente est traitee dans la meme boucle.
export function secretsMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" || expected === "") return false
  const encoder = new TextEncoder()
  const a = encoder.encode(received)
  const b = encoder.encode(expected)
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

// Retourne null si l'appel est authentifie, sinon la reponse a renvoyer :
// 503 si le secret n'est pas configure, 401 si l'en-tete est absent ou different.
// Les corps de reponse sont neutres (aucun detail de configuration).
export function cronAuthGuard(headers, secret, extraHeaders = {}) {
  const json = (status, error) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...extraHeaders, "Content-Type": "application/json" },
    })

  if (typeof secret !== "string" || secret === "") return json(503, "Service indisponible")
  if (!secretsMatch(headers.get(CRON_SECRET_HEADER), secret)) return json(401, "Non autorisé")
  return null
}
