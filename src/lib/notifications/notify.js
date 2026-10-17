import { createServiceClient } from "@/lib/supabase/service"
import { isValidNotification } from "./catalog.js"

// Un destinataire dont le compte est fermé ne reçoit rien (`notify`, `notifyMany`) ; `notifyAdmins` est inchangé.
// Écriture tolérante des notifications (RD-NOTIF-01). `notify` et `notifyAdmins` ne lèvent JAMAIS : un échec
// d'écriture ne doit ni annuler ni faire échouer l'action métier. Le journal ne contient qu'un code d'erreur
// (jamais d'adresse, de téléphone, de nom ni de texte de notification).
// Les écritures passent par le client service role : la table n'a aucune politique d'insertion pour les
// utilisateurs. Module serveur : `server-only` est importé par `@/lib/supabase/service`, qu'il ne peut pas
// contourner. À appeler seulement APRÈS le contrôle d'identité, de rôle et de propriété de l'action.

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"])

function logFailure(error) {
  const code = typeof error?.code === "string" ? error.code : null
  if (code && MISSING_TABLE_CODES.has(code)) {
    console.warn("[notifications] table indisponible, notification ignorée")
    return
  }
  console.error("[notifications] écriture impossible", code ?? "erreur")
}

function toRow(recipientId, n) {
  return {
    recipient_id: recipientId,
    type: n.type,
    title: n.title,
    body: n.body ?? "",
    mission_id: n.missionId ?? null,
    actor_id: n.actorId ?? null,
    dedupe_key: n.dedupeKey,
  }
}

// Comptes fermés parmi les destinataires (colonne closed_at du script 96). Lecture en erreur : null, et l'appelant
// n'écrit rien (une notification vers un compte fermé est pire qu'une notification perdue).
async function closedRecipients(service, ids) {
  const { data, error } = await service.from("profiles").select("user_id").in("user_id", ids).not("closed_at", "is", null)
  if (error) {
    logFailure(error)
    return null
  }
  return new Set((data ?? []).map((row) => row.user_id))
}

async function insertRows(service, rows) {
  // Un doublon (recipient_id, dedupe_key) est ignoré : rejouer un événement ne crée rien.
  return service
    .from("notifications")
    .upsert(rows, { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true })
}

/**
 * Écrit une notification pour un destinataire.
 * @param {{ recipientId: string } & ReturnType<typeof import("./catalog.js").applicationReceived>} input
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notify(input) {
  try {
    const recipientId = input?.recipientId
    if (typeof recipientId !== "string" || recipientId === "" || !isValidNotification(input)) {
      console.error("[notifications] notification invalide, ignorée")
      return { ok: false }
    }
    const service = createServiceClient()
    const closed = await closedRecipients(service, [recipientId])
    if (!closed) return { ok: false }
    if (closed.has(recipientId)) return { ok: true }
    const { error } = await insertRows(service, [toRow(recipientId, input)])
    if (error) {
      logFailure(error)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    logFailure(err)
    return { ok: false }
  }
}

/**
 * Écrit une notification pour plusieurs destinataires (chacun a sa propre clé d'idempotence par destinataire).
 * @param {string[]} recipientIds
 * @param {ReturnType<typeof import("./catalog.js").applicationReceived>} notification
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifyMany(recipientIds, notification) {
  try {
    const ids = [...new Set((Array.isArray(recipientIds) ? recipientIds : []).filter((id) => typeof id === "string" && id !== ""))]
    if (ids.length === 0) return { ok: true }
    if (!isValidNotification(notification)) {
      console.error("[notifications] notification invalide, ignorée")
      return { ok: false }
    }
    const service = createServiceClient()
    const closed = await closedRecipients(service, ids)
    if (!closed) return { ok: false }
    const open = ids.filter((id) => !closed.has(id))
    if (open.length === 0) return { ok: true }
    const { error } = await insertRows(service, open.map((id) => toRow(id, notification)))
    if (error) {
      logFailure(error)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    logFailure(err)
    return { ok: false }
  }
}

/**
 * Écrit une notification pour tous les administrateurs non suspendus (seul `user_id` est lu).
 * @param {ReturnType<typeof import("./catalog.js").cardSubmitted>} notification
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifyAdmins(notification) {
  try {
    if (!isValidNotification(notification)) {
      console.error("[notifications] notification invalide, ignorée")
      return { ok: false }
    }
    const service = createServiceClient()
    const { data, error } = await service
      .from("profiles")
      .select("user_id")
      .eq("role", "admin")
      .eq("is_suspended", false)
    if (error) {
      logFailure(error)
      return { ok: false }
    }
    const ids = (data ?? []).map((row) => row.user_id).filter(Boolean)
    if (ids.length === 0) return { ok: true }
    const { error: writeError } = await insertRows(service, ids.map((id) => toRow(id, notification)))
    if (writeError) {
      logFailure(writeError)
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    logFailure(err)
    return { ok: false }
  }
}
