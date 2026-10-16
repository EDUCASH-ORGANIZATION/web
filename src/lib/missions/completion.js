// Fin de mission déclarée par l'étudiant (RD-DONE-01). Pur : importable côté client et serveur.
// Le statut de la mission ne change pas (open, in_progress, done, cancelled). « Terminé, à confirmer » =
// mission en cours ET date de déclaration renseignée (`missions.completion_declared_at`). Le client
// confirme ensuite la fin (confirmMission) : seule cette confirmation libère les fonds.
import { formatDateFr } from "../app/format.js"

/**
 * État de fin d'une mission.
 *  - "none" : pas de déclaration (mission ouverte, ou en cours sans déclaration)
 *  - "declared" : en cours, fin déclarée, en attente de la confirmation du client
 *  - "confirmed" : mission terminée (la date de déclaration éventuelle est conservée)
 *  - "cancelled" : mission annulée
 * @param {{ status?: string|null, completionDeclaredAt?: string|null }} mission
 * @returns {"none"|"declared"|"confirmed"|"cancelled"}
 */
export function completionState({ status, completionDeclaredAt } = {}) {
  if (status === "done") return "confirmed"
  if (status === "cancelled") return "cancelled"
  if (status === "in_progress" && Boolean(completionDeclaredAt)) return "declared"
  return "none"
}

/**
 * Le bouton « J'ai terminé » n'est proposé qu'à l'étudiant retenu d'une mission en cours, sans
 * déclaration, et si la colonne existe en base (`available`).
 * @param {{ status?: string|null, isSelected?: boolean, completionDeclaredAt?: string|null, available?: boolean }} input
 * @returns {boolean}
 */
export function canDeclareCompletion({ status, isSelected, completionDeclaredAt, available } = {}) {
  return (
    available === true &&
    isSelected === true &&
    status === "in_progress" &&
    !completionDeclaredAt
  )
}

/** Textes partagés (vouvoiement, aucun délai, aucune promesse de paiement automatique). */
export const COMPLETION_COPY = Object.freeze({
  action: "J'ai terminé",
  confirmTitle: "Vous confirmez avoir terminé ?",
  confirmSubmit: "Oui, j'ai terminé",
  confirmCancel: "Annuler",
  declaredBadge: "Terminé, à confirmer",
  toConfirmBadge: "À confirmer",
  unavailable: "Cette fonction n'est pas encore disponible.",
  /** @param {string|null|undefined} iso */
  declaredOn(iso) {
    if (!iso || Number.isNaN(Date.parse(iso))) return "Fin déclarée"
    return `Fin déclarée le ${formatDateFr(iso)}`
  },
})
