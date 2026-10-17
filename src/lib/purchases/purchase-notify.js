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
import { createServiceClient } from "@/lib/supabase/service"
import { isUuid } from "@/lib/vitrine/ids"

// Notifications in-app des demandes de paiement d'achats (RD-ACHATS-01 ST-04). Jamais bloquantes : `notify` ne lève
// pas d'exception et cette fonction non plus, un échec d'écriture n'annule ni ne fait échouer l'action métier. Les
// textes viennent du catalogue (aucun numéro, nom de vendeur ni montant) et la clé d'idempotence est
// `purchase:<demande>:<événement>:<version>`. AUCUNE notification aux administrateurs (compteur /admin/reports).
//
// E-mails (RD-ACHATS-01 ST-17) : trois événements seulement (demande au client, paiement indiqué à l'étudiant,
// signalement à l'autre partie). La ligne de notification sert de marqueur d'idempotence : l'e-mail n'est envoyé que
// si la notification de CET événement (même clé) n'existait pas encore et vient d'être écrite, donc un rejeu ne
// renvoie rien. L'adresse est lue par le service role (jamais exposée). Un échec d'e-mail (clé Resend absente,
// domaine non vérifié, 403) n'a aucun effet sur l'action ni sur la notification ; seuls des codes sont journalisés,
// jamais d'adresse, de nom ni de titre. Les gabarits ne reçoivent ni numéro, ni nom de vendeur, ni montant.

/** Événements qui donnent une notification, avec le rôle de l'acteur attendu. */
const EVENTS = {
  requested: "student",
  updated: "student",
  cancelled: "student",
  received: "student",
  paid: "client",
  reported: "either",
}

/** Événements qui donnent aussi un e-mail, avec le gabarit (src/lib/email/templates). */
const EMAIL_TEMPLATES = {
  requested: "purchase-requested",
  paid: "purchase-paid",
  reported: "purchase-reported",
}

const EMAIL_TITLE_MAX = 80

// Vrai seulement si la lecture a réussi ET qu'aucune notification de cet événement n'existe pour le destinataire.
async function isFirstDelivery(service, recipientId, dedupeKey) {
  try {
    const { data, error } = await service
      .from("notifications")
      .select("id")
      .eq("recipient_id", recipientId)
      .eq("dedupe_key", dedupeKey)
      .limit(1)
    if (error) {
      console.error("[purchase-notify] idempotence", error?.code ?? "erreur")
      return false
    }
    return Array.isArray(data) && data.length === 0
  } catch (err) {
    console.error("[purchase-notify] idempotence", err?.code ?? "erreur")
    return false
  }
}

// Envoie l'e-mail à l'autre partie. Ne lève jamais.
async function sendPurchaseEmail(service, { template, recipientId, data }) {
  try {
    const { data: userData } = await service.auth.admin.getUserById(recipientId)
    const email = userData?.user?.email
    if (!email) return
    const { sendEmail } = await import("@/lib/email/index")
    const sent = await sendEmail(template, email, data)
    if (sent?.error) console.error("[purchase-notify] e-mail non envoyé")
  } catch (err) {
    console.error("[purchase-notify] e-mail", err?.code ?? "erreur")
  }
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
    const template = EMAIL_TEMPLATES[event]
    let service = null
    let firstDelivery = false
    if (template) {
      try {
        service = createServiceClient()
        firstDelivery = await isFirstDelivery(service, recipientId, notification.dedupeKey)
      } catch (err) {
        console.error("[purchase-notify] service", err?.code ?? "erreur")
      }
    }

    const result = await notify({ recipientId, ...notification })
    if (result?.ok && firstDelivery) {
      await sendPurchaseEmail(service, {
        template,
        recipientId,
        data: {
          recipient: actorRole === "student" ? "client" : "student",
          missionTitle: String(mission?.title ?? "").slice(0, EMAIL_TITLE_MAX),
          missionId: request.mission_id,
          studentId,
          requestId: request.id,
        },
      })
    }
    return result
  } catch (err) {
    console.error("[purchase-notify] notification", err?.code ?? "erreur")
    return { ok: false }
  }
}
