"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { sendEmail } from "@/lib/email/index"

const ERR_GENERIC = "Une erreur est survenue. Réessaie dans un instant."

/**
 * Lit l'adresse email d'un compte via l'API d'administration (client service role).
 * Réservé au serveur : la session utilisateur n'a pas accès à `auth.admin`.
 * Ne lève jamais : renvoie null si l'adresse est introuvable ou si la configuration manque.
 *
 * @param {string} userId
 * @returns {Promise<string | null>}
 */
async function getAuthEmail(userId) {
  try {
    const service = createServiceClient()
    const { data } = await service.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch (err) {
    console.error("[application.actions] Lecture de l'email impossible:", err?.message)
    return null
  }
}

/**
 * Lit le nom affiché d'un profil (colonne publique).
 *
 * @param {any} supabase
 * @param {string} userId
 * @returns {Promise<string | null>}
 */
async function getFullName(supabase, userId) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.full_name ?? null
}

/**
 * Postule à une mission.
 *
 * @param {{ missionId: string, message: string }} params
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function apply({ missionId, message }) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  if (!missionId) return { error: "Mission introuvable." }
  if (!message?.trim()) return { error: "Le message de candidature est requis." }

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, client_id, status")
    .eq("id", missionId)
    .maybeSingle()

  if (!mission) return { error: "Mission introuvable." }
  if (mission.status !== "open") return { error: "Cette mission n'accepte plus de candidatures." }
  if (mission.client_id === user.id) return { error: "Tu ne peux pas postuler à ta propre mission." }

  // Vérifie qu'aucune candidature n'existe déjà
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("mission_id", missionId)
    .eq("student_id", user.id)
    .maybeSingle()

  if (existing) return { error: "Tu as déjà postulé à cette mission." }

  const { error: insertError } = await supabase
    .from("applications")
    .insert({
      mission_id: missionId,
      student_id: user.id,
      message: message.trim(),
      status: "pending",
    })

  if (insertError) {
    console.error("[apply] Insertion refusée:", insertError.message)
    return { error: ERR_GENERIC }
  }

  // Notifie le client (échec d'email sans conséquence sur la candidature)
  try {
    const [studentName, clientName, clientEmail] = await Promise.all([
      getFullName(supabase, user.id),
      getFullName(supabase, mission.client_id),
      getAuthEmail(mission.client_id),
    ])

    if (clientEmail) {
      await sendEmail("new-application", clientEmail, {
        clientName: clientName ?? "Client",
        studentName: studentName ?? "Un étudiant",
        missionTitle: mission.title,
        messageExcerpt: message.trim().substring(0, 100),
        missionId,
      })
    }
  } catch (emailErr) {
    console.error("[apply] Erreur email:", emailErr)
  }

  revalidatePath("/student/applications")
  revalidatePath("/missions/" + missionId)

  return { success: true }
}

/**
 * Retourne toutes les candidatures d'un étudiant avec les missions jointes.
 *
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
export async function getStudentApplications(studentId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("applications")
    .select("*, missions(title, type, city, budget, status)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Retourne toutes les candidatures pour une mission avec les profils étudiants.
 *
 * @param {string} missionId
 * @returns {Promise<Array>}
 */
export async function getMissionApplications(missionId) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("applications")
    .select("*, profiles!student_id(full_name, avatar_url, rating, missions_done), student_profiles!student_id(school, skills)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Accepte une candidature, met la mission en cours, rejette les autres.
 * Ordre obligatoire (garde SQL) : candidature acceptée, puis mission en cours avec
 * l'étudiant retenu, puis rejet des autres. Si la mission ne passe pas en cours,
 * la candidature est remise en attente.
 *
 * @param {{ applicationId: string, studentId: string, missionId: string }} params
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function acceptApplication({ applicationId, studentId, missionId }) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  if (!applicationId || !studentId || !missionId) return { error: "Candidature introuvable." }

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, client_id, status")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .maybeSingle()

  if (!mission) return { error: "Mission introuvable." }
  if (mission.status !== "open") return { error: "Cette mission n'est plus ouverte." }

  // 1. Accepte la candidature (de cette mission, de cet étudiant, encore en attente)
  const { data: accepted, error: acceptError } = await supabase
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId)
    .eq("mission_id", missionId)
    .eq("student_id", studentId)
    .eq("status", "pending")
    .select("id")

  if (acceptError) {
    console.error("[acceptApplication] Acceptation refusée:", acceptError.message)
    return { error: ERR_GENERIC }
  }
  if (!accepted?.length) return { error: "Cette candidature n'est plus disponible." }

  // 2. Passe la mission en cours avec l'étudiant sélectionné
  const { data: started, error: missionError } = await supabase
    .from("missions")
    .update({ status: "in_progress", selected_student_id: studentId })
    .eq("id", missionId)
    .eq("client_id", user.id)
    .eq("status", "open")
    .select("id")

  if (missionError || !started?.length) {
    if (missionError) console.error("[acceptApplication] Mission non démarrée:", missionError.message)
    // Compensation : la candidature redevient en attente
    const { error: undoError } = await supabase
      .from("applications")
      .update({ status: "pending" })
      .eq("id", applicationId)
      .eq("status", "accepted")
    if (undoError) {
      console.error("[acceptApplication] Compensation en échec:", undoError.message)
    }
    return { error: ERR_GENERIC }
  }

  // 3. Rejette les autres candidatures encore en attente
  const { data: rejectedApps, error: rejectError } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("mission_id", missionId)
    .neq("id", applicationId)
    .eq("status", "pending")
    .select("student_id")

  if (rejectError) {
    console.error("[acceptApplication] Erreur rejet des autres candidatures:", rejectError.message)
  }

  // 4. Notifie (échec d'email sans conséquence sur l'acceptation)
  try {
    const missionTitle = mission.title ?? "Mission EduCash"
    const [clientName, studentName, studentEmail] = await Promise.all([
      getFullName(supabase, user.id),
      getFullName(supabase, studentId),
      getAuthEmail(studentId),
    ])

    if (studentEmail) {
      await sendEmail("application-accepted", studentEmail, {
        studentName: studentName ?? "Étudiant",
        missionTitle,
        clientName: clientName ?? "le client",
        missionId,
      })
    }

    if (rejectedApps?.length) {
      await Promise.allSettled(
        rejectedApps.map(async ({ student_id: rejectedId }) => {
          const [rName, rEmail] = await Promise.all([
            getFullName(supabase, rejectedId),
            getAuthEmail(rejectedId),
          ])
          if (rEmail) {
            await sendEmail("application-rejected", rEmail, {
              studentName: rName ?? "Étudiant",
              missionTitle,
            })
          }
        })
      )
    }
  } catch (emailErr) {
    console.error("[acceptApplication] Erreur emails:", emailErr)
  }

  revalidatePath("/client/missions/" + missionId)
  revalidatePath("/client/missions")

  return { success: true }
}

/**
 * Rejette une candidature en attente d'une mission du client connecté.
 *
 * @param {string} applicationId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function rejectApplication(applicationId) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  if (!applicationId) return { error: "Candidature introuvable." }

  const { data: application } = await supabase
    .from("applications")
    .select("id, mission_id, status")
    .eq("id", applicationId)
    .maybeSingle()

  if (!application) return { error: "Candidature introuvable." }

  const { data: mission } = await supabase
    .from("missions")
    .select("id")
    .eq("id", application.mission_id)
    .eq("client_id", user.id)
    .maybeSingle()

  if (!mission) return { error: "Candidature introuvable." }
  if (application.status !== "pending") return { error: "Cette candidature n'est plus en attente." }

  const { data: rejected, error } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId)
    .eq("mission_id", mission.id)
    .eq("status", "pending")
    .select("id")

  if (error) {
    console.error("[rejectApplication] Rejet refusé:", error.message)
    return { error: ERR_GENERIC }
  }
  if (!rejected?.length) return { error: "Cette candidature n'est plus en attente." }

  revalidatePath("/client/missions/" + mission.id)
  revalidatePath("/client/missions")

  return { success: true }
}
