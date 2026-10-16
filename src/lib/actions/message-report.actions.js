"use server"

// Signalement d'un message reçu (espaces client et étudiant, RD-MSG-01).
//
// Chaque export commence par requireRole. Le message est lu avec le client de SESSION (RLS : seuls l'expéditeur et
// le destinataire le voient), puis les contrôles sont refaits côté serveur : l'appelant est le destinataire (jamais
// l'expéditeur), et la mission relie bien le client et l'étudiant de la conversation. Seule l'écriture passe par le
// client service role, après ces contrôles. Un signalement par message et par auteur (unicité en base) ; au plus
// REPORT_DAILY_LIMIT signalements par auteur sur 24 h. Le commentaire libre passe par maskContacts avant stockage et
// n'est jamais journalisé. Avant le script 92 (table reports absente), la réponse est « indisponible ».

import { z } from "zod"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { maskContacts } from "@/lib/messaging/contact-filter"
import { REPORT_DETAILS_MAX, REPORT_REASONS, reportReference } from "@/lib/messaging/moderation-rules"
import { isUuid } from "@/lib/vitrine/ids"

const ERR_INVALID = "Votre signalement n'est pas valide. Vérifiez le motif et la longueur du commentaire."
const ERR_UNAVAILABLE_MESSAGE = "Ce message n'est pas disponible pour un signalement."
const ERR_FAILED = "Votre signalement n'a pas pu être envoyé. Veuillez réessayer."
const ERR_LIMIT = "Vous avez atteint la limite de signalements pour aujourd'hui. Veuillez réessayer plus tard."
const ERR_SERVICE_DOWN = "Le signalement est momentanément indisponible. Veuillez réessayer plus tard."

const REPORT_DAILY_LIMIT = 10
const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000
const UNIQUE_VIOLATION = "23505"

// Codes d'une table absente : Postgres (42P01) et PostgREST (PGRST205 cache de schéma, PGRST200 relation).
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST200"]

// Caractères de contrôle refusés, hors tabulation et sauts de ligne.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

const reportSchema = z.object({
  messageId: z.string().refine(isUuid),
  reason: z.enum(REPORT_REASONS.map((r) => r.value)),
  details: z
    .string()
    .max(REPORT_DETAILS_MAX)
    .refine((s) => !CONTROL_CHARS.test(s))
    .optional(),
})

const isMissingTable = (error) =>
  MISSING_TABLE_CODES.includes(error?.code) || /schema cache|does not exist/i.test(error?.message ?? "")

/** Commentaire facultatif : coordonnées masquées, espaces rognés, vide = absent. */
function cleanDetails(details) {
  if (typeof details !== "string") return null
  const trimmed = details.trim()
  if (trimmed === "") return null
  return maskContacts(trimmed).text
}

/** Référence du signalement existant (message, auteur), ou null. */
async function findExisting(service, messageId, reporterId) {
  const { data, error } = await service
    .from("reports")
    .select("number")
    .eq("message_id", messageId)
    .eq("reporter_id", reporterId)
    .limit(1)
  if (error) return { error }
  const number = data?.[0]?.number
  return { reference: number === undefined ? null : reportReference(Number(number)) }
}

/**
 * Établit que le message est reçu par l'appelant et que la mission relie les deux parties.
 * @returns {Promise<{ status: "ok", message: object } | { status: "forbidden" } | { status: "error" }>}
 */
async function loadReportableMessage(supabase, userId, role, messageId) {
  const { data: message, error } = await supabase
    .from("messages")
    .select("id, mission_id, sender_id, receiver_id, type")
    .eq("id", messageId)
    .maybeSingle()
  if (error) {
    console.error("[message-report.actions] message", error.message)
    return { status: "error" }
  }
  if (!message || !isUuid(message.mission_id) || !isUuid(message.sender_id)) return { status: "forbidden" }
  if (message.receiver_id !== userId || message.sender_id === userId) return { status: "forbidden" }

  const clientId = role === "client" ? userId : message.sender_id
  const studentId = role === "client" ? message.sender_id : userId

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id, client_id, selected_student_id")
    .eq("id", message.mission_id)
    .maybeSingle()
  if (missionError) {
    console.error("[message-report.actions] mission", missionError.message)
    return { status: "error" }
  }
  if (!mission || mission.client_id !== clientId) return { status: "forbidden" }
  if (mission.selected_student_id === studentId) return { status: "ok", message }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("status")
    .eq("mission_id", message.mission_id)
    .eq("student_id", studentId)
    .maybeSingle()
  if (appError) {
    console.error("[message-report.actions] candidature", appError.message)
    return { status: "error" }
  }
  if (!application) return { status: "forbidden" }
  return { status: "ok", message }
}

async function reportMessage(role, input) {
  const auth = await requireRole([role])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth
  if (!isUuid(user.id)) return { error: ERR_FAILED }

  const parsed = reportSchema.safeParse(input ?? {})
  if (!parsed.success) return { error: ERR_INVALID }
  const { messageId, reason } = parsed.data

  const loaded = await loadReportableMessage(supabase, user.id, role, messageId)
  if (loaded.status === "error") return { error: ERR_FAILED }
  if (loaded.status === "forbidden") return { error: ERR_UNAVAILABLE_MESSAGE }
  const { message } = loaded

  const service = createServiceClient()

  // Doublon : succès idempotent avec la référence existante, avant le plafond. Sert aussi de sonde de la table.
  const existing = await findExisting(service, messageId, user.id)
  if (existing.error) {
    if (isMissingTable(existing.error)) return { error: ERR_SERVICE_DOWN }
    console.error("[message-report.actions] doublon", existing.error.code)
    return { error: ERR_FAILED }
  }
  if (existing.reference) return { success: true, reference: existing.reference }

  const since = new Date(Date.now() - REPORT_WINDOW_MS).toISOString()
  const { data: recent, error: limitError } = await service
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .gte("created_at", since)
    .limit(REPORT_DAILY_LIMIT)
  if (limitError) {
    if (isMissingTable(limitError)) return { error: ERR_SERVICE_DOWN }
    console.error("[message-report.actions] plafond", limitError.code)
    return { error: ERR_FAILED }
  }
  if ((recent?.length ?? 0) >= REPORT_DAILY_LIMIT) return { error: ERR_LIMIT }

  const { data: row, error } = await service
    .from("reports")
    .insert({
      source: "user",
      target_type: "message",
      message_id: message.id,
      mission_id: message.mission_id,
      reporter_id: user.id,
      reported_user_id: message.sender_id,
      reason,
      details: cleanDetails(parsed.data.details),
    })
    .select("number")
    .single()

  if (error) {
    if (isMissingTable(error)) return { error: ERR_SERVICE_DOWN }
    if (error.code === UNIQUE_VIOLATION) {
      const again = await findExisting(service, messageId, user.id)
      if (again.reference) return { success: true, reference: again.reference }
    }
    console.error("[message-report.actions] écriture", error.code)
    return { error: ERR_FAILED }
  }
  const reference = reportReference(Number(row?.number))
  if (!reference) return { error: ERR_FAILED }
  return { success: true, reference }
}

/**
 * Signale un message reçu par le client de la session.
 * @param {{ messageId: string, reason: string, details?: string }} input
 * @returns {Promise<{ success: true, reference: string } | { error: string }>}
 */
export async function reportClientMessage(input) {
  return reportMessage("client", input)
}

/**
 * Signale un message reçu par l'étudiant de la session.
 * @param {{ messageId: string, reason: string, details?: string }} input
 * @returns {Promise<{ success: true, reference: string } | { error: string }>}
 */
export async function reportStudentMessage(input) {
  return reportMessage("student", input)
}
