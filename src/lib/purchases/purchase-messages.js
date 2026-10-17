import "server-only"
import { isUuid } from "@/lib/vitrine/ids"
import { PURCHASE_MESSAGE_TYPES, isPurchaseMessageContent } from "@/lib/purchases/requests"
import { isMissingPurchaseSchema } from "@/lib/actions/purchase-request-core"

// Insertion des messages d'achats (RD-ACHATS-01 ST-04) : la carte `purchase_request` et les lignes système
// `purchase_event`. Module serveur SANS "use server" : s'il était exporté par un fichier d'actions, chaque fonction
// deviendrait une action appelable depuis le navigateur.
//
// Depuis le script 93, aucun utilisateur n'insère dans `messages` et le trigger `messages_rules` ne protège plus le
// service role (il sort dès sa première ligne hors appelant API). Cette fonction refait donc, comme `deliverMessage`,
// chacune de ses règles, et lit la base plutôt que de croire l'appelant :
// - type d'achat seulement, contenu EXACTEMENT égal au texte fixe du serveur (jamais de numéro, de vendeur ni de montant),
//   donc jamais passé par le filtre de coordonnées ;
// - la demande relue en base correspond à celle fournie (mission, étudiant, client, numéro d'ordre) ;
// - l'acteur est l'une des deux parties, le destinataire est FORCÉ à l'autre partie, expéditeur différent du destinataire ;
// - la mission relie bien ce client et cet étudiant retenu ;
// - l'expéditeur n'est pas suspendu ;
// - 4 000 caractères au plus.
// La clé étrangère composite (purchase_request_id, mission_id) de la base impose en plus la même mission.
// Le client service role est fourni par l'appelant, APRÈS ses propres contrôles d'identité, de rôle et de propriété.

const CONTENT_MAX = 4000

const MESSAGE_COLUMNS = "id, created_at"

const refused = { ok: false, reason: "refused" }
const failed = { ok: false, reason: "failed" }

/**
 * Insère un message d'achat.
 * @param {object} service client Supabase service role (déjà obtenu après les contrôles de l'action)
 * @param {{ request: { id: string, mission_id: string, student_id: string, client_id: string, seq: number },
 *   type: "purchase_request"|"purchase_event", actorId: string, content: string }} input
 * @returns {Promise<{ ok: true, message: { id: string, createdAt: string } } | { ok: false, reason: "refused"|"unavailable"|"failed" }>}
 */
export async function insertPurchaseMessage(service, { request, type, actorId, content } = {}) {
  if (!PURCHASE_MESSAGE_TYPES.includes(type)) return refused
  const { id, mission_id: missionId, student_id: studentId, client_id: clientId, seq } = request ?? {}
  if (![id, missionId, studentId, clientId, actorId].every(isUuid)) return refused
  if (studentId === clientId) return refused
  if (actorId !== studentId && actorId !== clientId) return refused
  // La carte est toujours envoyée par l'étudiant.
  if (type === "purchase_request" && actorId !== studentId) return refused
  const receiverId = actorId === studentId ? clientId : studentId
  if (actorId === receiverId) return refused
  if (typeof content !== "string" || content === "" || content.length > CONTENT_MAX) return refused
  if (!isPurchaseMessageContent(type, seq, content)) return refused

  const [requestRes, missionRes, senderRes] = await Promise.all([
    service.from("purchase_requests").select("id, mission_id, student_id, client_id, seq").eq("id", id).maybeSingle(),
    service.from("missions").select("id, client_id, selected_student_id").eq("id", missionId).maybeSingle(),
    service.from("profiles").select("user_id, is_suspended").eq("user_id", actorId).maybeSingle(),
  ])
  for (const res of [requestRes, missionRes, senderRes]) {
    if (isMissingPurchaseSchema(res.error)) return { ok: false, reason: "unavailable" }
    if (res.error) {
      console.error("[purchase-messages] lecture", res.error.code ?? "erreur")
      return failed
    }
  }
  const stored = requestRes.data
  if (
    !stored ||
    stored.mission_id !== missionId ||
    stored.student_id !== studentId ||
    stored.client_id !== clientId ||
    stored.seq !== seq
  ) {
    return refused
  }
  const mission = missionRes.data
  if (!mission || mission.client_id !== clientId || mission.selected_student_id !== studentId) return refused
  if (!senderRes.data || senderRes.data.is_suspended === true) return refused

  const { data, error } = await service
    .from("messages")
    .insert({
      mission_id: missionId,
      sender_id: actorId,
      receiver_id: receiverId,
      content,
      type,
      purchase_request_id: id,
      read: false,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  if (isMissingPurchaseSchema(error)) return { ok: false, reason: "unavailable" }
  if (error || !data) {
    console.error("[purchase-messages] insertion", error?.code ?? "erreur")
    return failed
  }
  return { ok: true, message: { id: data.id, createdAt: data.created_at } }
}
