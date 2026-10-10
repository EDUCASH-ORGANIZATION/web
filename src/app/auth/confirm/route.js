import { handleAuthConfirm } from "@/lib/auth/confirm-handler"

/**
 * Retour des liens d'email Supabase (confirmation d'inscription, réinitialisation).
 * URL reçue : /auth/confirm?flow=signup|recovery&next=...&code=... ou &token_hash=...&type=...
 */
export async function GET(request) {
  return handleAuthConfirm(request)
}
