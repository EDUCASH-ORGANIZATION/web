import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Client Supabase avec la clé service role : contourne la RLS.
 * Réservé au code serveur (server actions, routes API), et seulement APRÈS un contrôle
 * d'identité, de rôle et de propriété. Ne jamais l'importer depuis un composant ou un hook
 * (garde-fou : `service-client.guard.test.js`).
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Configuration serveur incomplète : SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL manquante")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
