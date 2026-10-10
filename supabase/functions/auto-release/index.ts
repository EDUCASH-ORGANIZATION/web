// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

import { corsHeaders } from "../_shared/auth.js"
import { PAYMENTS_DISABLED_MESSAGE } from "../_shared/payments-flag.js"

const CORS = corsHeaders(Deno.env.get("APP_URL"))

// Fonction inerte : aucun paiement automatique (une mission ne passe jamais
// a done et aucun fonds n'est libere sans action explicite du client).
serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  return new Response(JSON.stringify({ error: PAYMENTS_DISABLED_MESSAGE }), {
    status: 503,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
})
