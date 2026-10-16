// @ds-screen RD-STUDENT-01
// Textes de la fin de mission côté étudiant (E05), partagés entre la carte serveur « À confirmer » et l'îlot
// client « J'ai terminé ». Vouvoiement, aucun délai, aucune promesse de versement automatique ; le séquestre n'est
// cité que si les paiements sont ouverts. Les textes communs viennent de COMPLETION_COPY (jamais modifié ici).
import { clientFirstName } from "@/lib/student-space/mission-view"

/**
 * Désignation du client dans une phrase : son prénom public, sinon « le client » (« Le client » en tête de phrase).
 * @param {string|null|undefined} clientName Nom public « Prénom N. »
 * @returns {{ lower: string, upper: string }}
 */
export function clientWho(clientName) {
  const first = clientFirstName(clientName)
  return { lower: first ?? "le client", upper: first ?? "Le client" }
}

/** Phrase de la carte « Vous avez fini ? » (non déclarée). */
export function declarePrompt(clientName, paymentsEnabled) {
  const who = clientWho(clientName).upper
  return paymentsEnabled
    ? `Déclarez la mission terminée. ${who} confirme ensuite la fin : votre part reste en séquestre jusqu'à sa confirmation, rien n'est versé automatiquement.`
    : `Déclarez la mission terminée. ${who} confirme ensuite la fin : rien n'est versé avant sa confirmation.`
}

/** Phrase sur le sort des fonds, carte « À confirmer » (déclarée). */
export function declaredFunds(paymentsEnabled) {
  return paymentsEnabled
    ? "Votre part reste en séquestre jusqu'à sa confirmation."
    : "Rien n'est versé avant sa confirmation."
}

/** Texte du toast de succès. */
export function declaredToast(clientName) {
  return `${clientWho(clientName).upper} doit maintenant confirmer la fin.`
}
