import "server-only"
import { isProfilePhone } from "@/lib/purchases/requests"

// Comparaison du « numéro à payer » au téléphone de profil de l'ÉTUDIANT (RD-ACHATS-01 ST-04). Module serveur SANS
// "use server". C'est le seul fichier des demandes d'achats qui lit une colonne privée de profils (`phone`) : il figure
// seul dans la liste d'autorisation du garde « colonnes privées ». Le client service role est passé par l'action,
// APRÈS ses contrôles d'identité, de rôle et de propriété ; seul le téléphone de l'étudiant de la session est lu,
// jamais celui du client (un oracle permettrait de deviner son téléphone). Le téléphone n'est ni renvoyé ni journalisé.

/**
 * @param {object} service client Supabase service role (déjà obtenu après les contrôles de l'action)
 * @param {string} userId identifiant de l'étudiant de la session
 * @param {string} payeeNumber numéro à payer normalisé
 * @returns {Promise<{ same: boolean } | { error: true }>}
 */
export async function payeeIsProfilePhone(service, userId, payeeNumber) {
  const { data, error } = await service.from("profiles").select("user_id, phone").eq("user_id", userId).maybeSingle()
  if (error) {
    console.error("[purchase-payee] profil", error.code ?? "erreur")
    return { error: true }
  }
  return { same: isProfilePhone(payeeNumber, data?.phone) }
}
