import "server-only"
import { notify } from "@/lib/notifications/notify"
import {
  purchaseCancelled,
  purchasePaid,
  purchaseReceived,
  purchaseReported,
  purchaseRequested,
  purchaseUpdated,
} from "@/lib/notifications/catalog"
import { isUuid } from "@/lib/vitrine/ids"

// Notifications in-app des demandes de paiement d'achats (RD-ACHATS-01 ST-04). Jamais bloquantes : `notify` ne lève
// pas d'exception et cette fonction non plus, un échec d'écriture n'annule ni ne fait échouer l'action métier. Les
// textes viennent du catalogue (aucun numéro, nom de vendeur ni montant) et la clé d'idempotence est
// `purchase:<demande>:<événement>:<version>`. AUCUNE notification aux administrateurs (compteur /admin/reports).
// ST-17 y ajoutera les e-mails.

/** Événements qui donnent une notification, avec le rôle de l'acteur attendu. */
const EVENTS = {
  requested: "student",
  updated: "student",
  cancelled: "student",
  received: "student",
  paid: "client",
  reported: "either",
}

/**
 * Prévient l'AUTRE partie d'une demande. Le destinataire est déduit de la demande : jamais l'acteur, jamais un tiers.
 * @param {{ event: "requested"|"updated"|"cancelled"|"paid"|"received"|"reported",
 *   request: { id: string, mission_id: string, student_id: string, client_id: string },
 *   mission: { id: string, title: string }, actorId: string, actorName?: string|null, version: number }} input
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifyPurchaseEvent({ event, request, mission, actorId, actorName, version } = {}) {
  try {
    const expected = EVENTS[event]
    if (!expected || !isUuid(actorId) || !isUuid(request?.id) || !isUuid(request?.mission_id)) return { ok: false }
    const { student_id: studentId, client_id: clientId } = request
    if (actorId !== studentId && actorId !== clientId) return { ok: false }
    const actorRole = actorId === studentId ? "student" : "client"
    if (expected !== "either" && expected !== actorRole) return { ok: false }
    const recipientId = actorRole === "student" ? clientId : studentId
    if (!isUuid(recipientId) || recipientId === actorId) return { ok: false }

    const base = { requestId: request.id, missionId: request.mission_id, missionTitle: mission?.title ?? "", version }
    let notification
    switch (event) {
      case "requested":
        notification = purchaseRequested({ ...base, studentId: actorId, studentName: actorName })
        break
      case "updated":
        notification = purchaseUpdated({ ...base, studentId: actorId, studentName: actorName })
        break
      case "cancelled":
        notification = purchaseCancelled({ ...base, studentId: actorId, studentName: actorName })
        break
      case "received":
        notification = purchaseReceived({ ...base, studentId: actorId, studentName: actorName })
        break
      case "paid":
        notification = purchasePaid({ ...base, clientId: actorId, clientName: actorName })
        break
      default:
        notification = purchaseReported({ ...base, actorId })
    }
    return await notify({ recipientId, ...notification })
  } catch (err) {
    console.error("[purchase-notify] notification", err?.code ?? "erreur")
    return { ok: false }
  }
}
