// Drapeau serveur des paiements, partage par les Edge Functions.
// Aucune dependance Deno : importe aussi par Vitest.
// Ferme par defaut : seule la valeur exacte "true" active les paiements.

export const PAYMENTS_DISABLED_MESSAGE = "Paiements désactivés"

// Vrai uniquement si la variable PAYMENTS_ENABLED vaut exactement "true".
export function paymentsEnabled(value) {
  return value === "true"
}

// Retourne null si les paiements sont actifs, sinon la reponse 503 a renvoyer.
// `headers` : en-tetes CORS a joindre a la reponse.
export function paymentsGuard(value, headers = {}) {
  if (paymentsEnabled(value)) return null
  return new Response(JSON.stringify({ error: PAYMENTS_DISABLED_MESSAGE }), {
    status: 503,
    headers: { ...headers, "Content-Type": "application/json" },
  })
}
