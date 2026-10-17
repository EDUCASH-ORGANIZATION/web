import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

// État du compte destinataire d'un message (RD-CLOSE-01, colonne closed_at du script 96). Module serveur : la lecture
// passe par le client service role (le profil d'un tiers n'est pas lisible en session), UNIQUEMENT après les contrôles
// d'identité, de rôle et de propriété de l'action appelante. Séparé de message.actions.js, où le service role reste
// réservé à l'insertion du message (garde message-media.guard.test.js).

/**
 * Indique si le compte destinataire est fermé. Fail-closed : toute erreur (configuration, lecture) est rendue à
 * l'appelant, qui refuse l'envoi.
 * @param {string} receiverId
 * @returns {Promise<{ closed: boolean } | { error: { code?: string } }>}
 */
export async function readReceiverClosure(receiverId) {
  let client
  try {
    client = createServiceClient()
  } catch {
    return { error: { code: "configuration" } }
  }
  const { data, error } = await client.from("profiles").select("closed_at").eq("user_id", receiverId).maybeSingle()
  if (error) return { error }
  return { closed: data?.closed_at != null }
}
