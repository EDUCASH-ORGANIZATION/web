"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { sendEmail } from "@/lib/email"

/**
 * Postule à une mission.
 *
 * @param {{ missionId: string, message: string }} params
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function apply({ missionId, message }) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }
  if (user.user_metadata?.role !== "student") return { error: "Seuls les étudiants peuvent postuler." }
  if (!message?.trim()) return { error: "Le message de candidature est requis." }

  const supabase = await createClient()

  // Vérifie qu'aucune candidature n'existe déjà
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("mission_id", missionId)
    .eq("student_id", user.id)
    .maybeSingle()

  if (existing) return { error: "Tu as déjà postulé à cette mission." }

  // Insère la candidature
  const { error: insertError } = await supabase
    .from("applications")
    .insert({
      mission_id: missionId,
      student_id: user.id,
      message: message.trim(),
      status: "pending",
    })

  if (insertError) return { error: insertError.message }

  // Charge mission + email client pour notifier
  const { data: mission } = await supabase
    .from("missions")
    .select("title, client_id, profiles!client_id(full_name)")
    .eq("id", missionId)
    .single()

  if (mission) {
    const { data: clientAuthUser } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", mission.client_id)
      .single()

    // Récupère l'email du client depuis auth.users via la fonction RPC ou admin
    // On utilise le profil de l'étudiant pour le nom
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single()

    // Note : l'email client est dans auth.users, non accessible côté client.
    // On l'envoie via l'email de l'utilisateur connecté dans le JWT (client_id).
    // En prod, utiliser une Edge Function ou la service_role pour récupérer l'email.
    // Ici on notifie seulement si l'email est disponible dans les métadonnées.
    const clientEmail = mission.profiles?.email ?? null

    if (clientEmail) {
      await sendEmail("new-application", clientEmail, {
        missionTitle: mission.title,
        missionId,
        studentName: studentProfile?.full_name ?? "Un étudiant",
        message: message.trim(),
      })
    }
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
 *
 * @param {{ applicationId: string, studentId: string, missionId: string }} params
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function acceptApplication({ applicationId, studentId, missionId }) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }
  if (user.user_metadata?.role !== "client") return { error: "Action réservée aux clients." }

  const supabase = await createClient()

  // 1. Accepte la candidature
  const { error: acceptError } = await supabase
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId)

  if (acceptError) return { error: acceptError.message }

  // 2. Passe la mission en cours avec l'étudiant sélectionné
  const { error: missionError } = await supabase
    .from("missions")
    .update({ status: "in_progress", selected_student_id: studentId })
    .eq("id", missionId)
    .eq("client_id", user.id) // garde : seul le propriétaire

  if (missionError) return { error: missionError.message }

  // 3. Rejette toutes les autres candidatures de cette mission
  const { data: rejectedApps, error: rejectError } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("mission_id", missionId)
    .neq("id", applicationId)
    .select("student_id")

  if (rejectError) {
    console.error("[acceptApplication] Erreur rejet des autres candidatures:", rejectError.message)
  }

  // 4. Charge les infos pour les emails
  const { data: mission } = await supabase
    .from("missions")
    .select("title")
    .eq("id", missionId)
    .single()

  const missionTitle = mission?.title ?? "Mission EduCash"

  // 5. Notifie l'étudiant accepté
  const { data: acceptedProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", studentId)
    .single()

  // Note : emails via auth.users non accessibles sans service_role.
  // Les emails seront envoyés via Edge Function en production.
  // Ici on log l'intention pour faciliter l'intégration future.
  console.info(`[email] Accepté : ${acceptedProfile?.full_name} pour "${missionTitle}"`)

  if (rejectedApps?.length) {
    console.info(`[email] Rejetés : ${rejectedApps.length} candidature(s) pour "${missionTitle}"`)
  }

  revalidatePath("/client/missions/" + missionId)
  revalidatePath("/client/missions")

  return { success: true }
}

/**
 * Rejette une candidature.
 *
 * @param {string} applicationId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function rejectApplication(applicationId) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }

  const supabase = await createClient()

  const { error } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId)

  if (error) return { error: error.message }

  return { success: true }
}
