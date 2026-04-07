"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { sendEmail } from "@/lib/email/index"

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
    const [{ data: studentProfile }, { data: { user: clientAuthUser } }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
      supabase.auth.admin.getUserById(mission.client_id).catch(() => ({ data: { user: null } })),
    ])

    const clientEmail = clientAuthUser?.email ?? null
    const clientName = mission.profiles?.full_name ?? "Client"

    if (clientEmail) {
      await sendEmail("new-application", clientEmail, {
        clientName,
        studentName: studentProfile?.full_name ?? "Un étudiant",
        missionTitle: mission.title,
        messageExcerpt: message.trim().substring(0, 100),
        missionId,
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

  // 5. Charge le profil du client pour le nom
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single()

  const clientName = clientProfile?.full_name ?? "le client"

  // 6. Notifie l'étudiant accepté via auth.admin
  try {
    const { data: acceptedProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", studentId)
      .single()

    const { data: { user: acceptedAuthUser } } = await supabase.auth.admin.getUserById(studentId)
    const acceptedEmail = acceptedAuthUser?.email ?? null

    if (acceptedEmail) {
      await sendEmail("application-accepted", acceptedEmail, {
        studentName: acceptedProfile?.full_name ?? "Étudiant",
        missionTitle,
        clientName,
        missionId,
      })
    }

    // 7. Notifie les candidats rejetés
    if (rejectedApps?.length) {
      const rejectedIds = rejectedApps.map((a) => a.student_id)
      await Promise.allSettled(
        rejectedIds.map(async (rejectedStudentId) => {
          const [{ data: rProfile }, { data: { user: rAuthUser } }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("user_id", rejectedStudentId).single(),
            supabase.auth.admin.getUserById(rejectedStudentId),
          ])
          const rEmail = rAuthUser?.email ?? null
          if (rEmail) {
            await sendEmail("application-rejected", rEmail, {
              studentName: rProfile?.full_name ?? "Étudiant",
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
