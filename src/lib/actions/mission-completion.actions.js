"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { isUuid } from "@/lib/vitrine/ids"
import { COMPLETION_COPY } from "@/lib/missions/completion"
import { isMissingCompletionColumn } from "@/lib/actions/mission-completion-core"

const ERR_GENERIC = "Une erreur est survenue. Réessayez dans un instant."
const ERR_NOT_FOUND = "Mission introuvable."
const ERR_NOT_IN_PROGRESS = "Cette mission n'est pas en cours."
const ERR_ALREADY_DONE = "Cette mission est déjà terminée."

const COLUMNS = "id, title, client_id, selected_student_id, status, completion_declared_at"

/**
 * Déclare la fin d'une mission : l'étudiant retenu indique avoir terminé, le client doit confirmer.
 * N'écrit qu'une date. Aucun mouvement de fonds, aucune notification ici. Le statut ne change pas.
 * L'écriture est UNE requête conditionnelle (étudiant retenu, mission en cours, date vide) ; le
 * trigger `guard_mission_completion_declared` refuse en base toute autre écriture de la colonne.
 *
 * @param {string} missionId
 * @returns {Promise<
 *   | { success: true, alreadyDeclared: boolean, declaredAt: string }
 *   | { error: string, code: "generic"|"not_found"|"not_in_progress"|"already_done"|"unavailable" }
 * >}
 */
export async function declareMissionCompletion(missionId) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error, code: "generic" }
  const { user } = auth

  if (!isUuid(missionId)) return { error: ERR_NOT_FOUND, code: "not_found" }

  const service = createServiceClient()

  const { data: mission, error: readError } = await service
    .from("missions")
    .select(COLUMNS)
    .eq("id", missionId)
    .maybeSingle()
  if (isMissingCompletionColumn(readError)) return { error: COMPLETION_COPY.unavailable, code: "unavailable" }
  if (readError) {
    console.error("[declareMissionCompletion] lecture", readError.code ?? "erreur")
    return { error: ERR_GENERIC, code: "generic" }
  }
  // Mission inconnue ou étudiant non retenu : même réponse, aucune information sur une mission tierce.
  if (!mission || mission.selected_student_id !== user.id) return { error: ERR_NOT_FOUND, code: "not_found" }
  if (mission.status === "done") return { error: ERR_ALREADY_DONE, code: "already_done" }
  if (mission.status !== "in_progress") return { error: ERR_NOT_IN_PROGRESS, code: "not_in_progress" }
  if (mission.completion_declared_at) {
    return { success: true, alreadyDeclared: true, declaredAt: mission.completion_declared_at }
  }

  const { data: updated, error: updateError } = await service
    .from("missions")
    .update({ completion_declared_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("selected_student_id", user.id)
    .eq("status", "in_progress")
    .is("completion_declared_at", null)
    .select("id, completion_declared_at")
  if (isMissingCompletionColumn(updateError)) return { error: COMPLETION_COPY.unavailable, code: "unavailable" }
  if (updateError) {
    console.error("[declareMissionCompletion] écriture", updateError.code ?? "erreur")
    return { error: ERR_GENERIC, code: "generic" }
  }

  if (updated?.length === 1) {
    revalidateMission(missionId)
    return { success: true, alreadyDeclared: false, declaredAt: updated[0].completion_declared_at }
  }

  // Aucune ligne modifiée : course avec confirmMission, double clic ou état changé. On relit et on répond
  // selon l'état réel (jamais de seconde écriture).
  const { data: current, error: rereadError } = await service
    .from("missions")
    .select(COLUMNS)
    .eq("id", missionId)
    .maybeSingle()
  if (isMissingCompletionColumn(rereadError)) return { error: COMPLETION_COPY.unavailable, code: "unavailable" }
  if (rereadError) {
    console.error("[declareMissionCompletion] relecture", rereadError.code ?? "erreur")
    return { error: ERR_GENERIC, code: "generic" }
  }
  if (!current || current.selected_student_id !== user.id) return { error: ERR_NOT_FOUND, code: "not_found" }
  if (current.status === "done") return { error: ERR_ALREADY_DONE, code: "already_done" }
  if (current.status !== "in_progress") return { error: ERR_NOT_IN_PROGRESS, code: "not_in_progress" }
  if (current.completion_declared_at) {
    return { success: true, alreadyDeclared: true, declaredAt: current.completion_declared_at }
  }
  return { error: ERR_GENERIC, code: "generic" }
}

function revalidateMission(missionId) {
  revalidatePath(`/student/missions/${missionId}`)
  revalidatePath(`/messages/${missionId}`)
  revalidatePath(`/client/missions/${missionId}`)
  revalidatePath(`/client/messages/${missionId}`)
}
