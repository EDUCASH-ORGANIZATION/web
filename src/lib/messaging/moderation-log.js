import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import { CONTACT_ALERT_THRESHOLD, CONTACT_ALERT_WINDOW_DAYS, CONTACT_KINDS } from "@/lib/messaging/moderation-rules"

// Journal de modération de la messagerie (RD-MSG-01, tables du script 92). Module serveur : il écrit avec le
// client service role, UNIQUEMENT après les contrôles d'identité, de rôle et de propriété de l'action appelante.
//
// - Le journal garde le TYPE détecté et le nombre d'occurrences, JAMAIS la valeur (numéro, adresse, lien).
// - Aucune fonction ne lève : un journal en panne ne doit jamais faire échouer l'envoi d'un message.
// - Avant l'application du script 92, les tables n'existent pas : réponse "unavailable", avertissement court.
// - Aucun console.* ne reçoit de contenu : seulement un code d'erreur de la base.

/** Codes de table ou de colonne absente (table non créée, cache de schéma PostgREST, colonne inconnue). */
const MISSING_CODES = new Set(["42P01", "PGRST205", "42703", "PGRST204"])
const DUPLICATE_CODE = "23505"
const DAY_MS = 24 * 60 * 60 * 1000
const COUNT_MIN = 1
const COUNT_MAX = 50

const isMissing = (error) => Boolean(error) && MISSING_CODES.has(error.code)

function warn(label, error) {
  console.warn(`[moderation-log] ${label}`, typeof error?.code === "string" ? error.code : "erreur")
}

/**
 * Inscrit une détection dans le journal. Le type est conservé, jamais la valeur.
 * @param {{ messageId: string, missionId: string, senderId: string, kinds: string[], count: number, action: "masked"|"flagged", client?: object }} input
 * @returns {Promise<"ok" | "unavailable" | "error">} ne lève jamais
 */
export async function recordContactEvent({ messageId, missionId, senderId, kinds, count, action, client } = {}) {
  try {
    const known = [...new Set(Array.isArray(kinds) ? kinds : [])].filter((k) => CONTACT_KINDS.includes(k))
    if (known.length === 0 || (action !== "masked" && action !== "flagged")) return "error"
    const matchCount = Math.min(COUNT_MAX, Math.max(COUNT_MIN, Number.isFinite(count) ? Math.trunc(count) : COUNT_MIN))
    const service = client ?? createServiceClient()
    const { error } = await service.from("message_contact_events").insert({
      message_id: messageId ?? null,
      mission_id: missionId,
      sender_id: senderId,
      kinds: known,
      match_count: matchCount,
      action,
    })
    if (error) {
      warn(isMissing(error) ? "journal indisponible" : "journal", error)
      return isMissing(error) ? "unavailable" : "error"
    }
    return "ok"
  } catch {
    warn("journal", null)
    return "error"
  }
}

/**
 * Ouvre une alerte automatique (reports, source auto) quand l'expéditeur atteint le seuil de messages masqués sur
 * la fenêtre glissante. Une seule alerte ouverte par utilisateur : un doublon (23505) est ignoré. Le comptage est
 * une lecture GET (un HEAD ne remonte pas le code d'erreur, donc ne permettrait pas de détecter une table absente).
 * @param {{ senderId: string, missionId: string, messageId: string, client?: object }} input
 * @returns {Promise<"opened" | "below" | "exists" | "unavailable" | "error">} ne lève jamais
 */
export async function maybeOpenAutoReport({ senderId, missionId, messageId, client } = {}) {
  try {
    const service = client ?? createServiceClient()
    const since = new Date(Date.now() - CONTACT_ALERT_WINDOW_DAYS * DAY_MS).toISOString()
    const { data, error } = await service
      .from("message_contact_events")
      .select("id")
      .eq("sender_id", senderId)
      .eq("action", "masked")
      .gte("created_at", since)
      .limit(CONTACT_ALERT_THRESHOLD)
    if (error) {
      warn(isMissing(error) ? "journal indisponible" : "comptage", error)
      return isMissing(error) ? "unavailable" : "error"
    }
    if (!Array.isArray(data) || data.length < CONTACT_ALERT_THRESHOLD) return "below"

    const { error: insertError } = await service.from("reports").insert({
      source: "auto",
      target_type: "message",
      message_id: messageId,
      mission_id: missionId,
      reporter_id: null,
      reported_user_id: senderId,
      reason: "contact_details",
      status: "open",
    })
    if (insertError) {
      if (insertError.code === DUPLICATE_CODE) return "exists"
      warn(isMissing(insertError) ? "signalements indisponibles" : "alerte", insertError)
      return isMissing(insertError) ? "unavailable" : "error"
    }
    return "opened"
  } catch {
    warn("alerte", null)
    return "error"
  }
}
