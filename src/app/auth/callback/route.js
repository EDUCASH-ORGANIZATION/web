import { handleAuthConfirm } from "@/lib/auth/confirm-handler"

/**
 * Ancienne adresse de retour des emails de confirmation (liens déjà envoyés).
 * Délègue au même traitement que /auth/confirm.
 */
export async function GET(request) {
  return handleAuthConfirm(request)
}
