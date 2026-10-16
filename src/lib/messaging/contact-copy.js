// Textes visibles de la protection des coordonnées dans la messagerie (RD-MSG-01). Module pur, au vouvoiement.
// Les vues (composeur, bulles, politique de confidentialité) importent ces constantes : aucun texte en dur ailleurs.

import { MASKABLE_KINDS } from "@/lib/messaging/moderation-rules"

/** Ancre de la section « analyse des messages » de la politique de confidentialité. */
export const PRIVACY_MESSAGES_HREF = "/legal/privacy#analyse-des-messages"

/** Bandeau non bloquant du composeur : le texte contient une coordonnée (elle sera masquée à l'envoi). */
export const CONTACT_WARNING_COPY =
  "Pour votre sécurité et la protection du paiement, les coordonnées (numéro, e-mail, lien) sont masquées. Utilisez la messagerie EduCash : texte, photo, message vocal ou position."

/** Bandeau non bloquant du composeur : mot-clé de contournement (WhatsApp, paiement direct...), sans masquage. */
export const KEYWORD_WARNING_COPY =
  "Pour votre sécurité, gardez vos échanges et vos paiements dans EduCash. Un contact ou un paiement en dehors de l'application n'est pas protégé."

/** Mention permanente de la messagerie : information sur l'analyse automatique. */
export const ANALYSIS_NOTICE_COPY =
  "Les messages sont analysés automatiquement pour repérer les coordonnées, par sécurité, pour lutter contre la fraude et pour faire respecter les conditions d'utilisation."

/** Libellé du lien vers PRIVACY_MESSAGES_HREF. */
export const ANALYSIS_NOTICE_LINK_LABEL = "En savoir plus"

/** Note affichée à l'expéditeur après l'envoi d'un message dont des coordonnées ont été masquées. */
export const MASKED_SENDER_NOTE = "Votre message a été envoyé. Les coordonnées qu'il contenait ont été masquées."

/** Note affichée au destinataire sous un message dont des coordonnées ont été masquées. */
export const MASKED_RECIPIENT_NOTE = "Des coordonnées ont été masquées dans ce message."

/**
 * Texte du bandeau du composeur selon les types détectés (`kinds` de detectContacts).
 * @param {string[]} kinds
 * @returns {string | null} null si rien à signaler
 */
export function contactWarning(kinds) {
  if (!Array.isArray(kinds)) return null
  if (kinds.some((k) => MASKABLE_KINDS.includes(k))) return CONTACT_WARNING_COPY
  if (kinds.includes("contact_keyword") || kinds.includes("payment_keyword")) return KEYWORD_WARNING_COPY
  return null
}
