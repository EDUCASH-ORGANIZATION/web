"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { sendEmail } from "@/lib/email/index"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { isUuid } from "@/lib/vitrine/ids"
import { todayInBenin, isPastDeadline } from "@/lib/vitrine/dates"
import { verificationFromRows } from "@/lib/student-space/verification-status"
import { notify } from "@/lib/notifications/notify"
import { isClosedEmail } from "@/lib/account-closure/closure-rules"
import { applicationAccepted, applicationReceived, applicationRejected } from "@/lib/notifications/catalog"

// Un seul registre, vouvoyé, pour tous les rôles.
const ERR_GENERIC = "Une erreur est survenue. Réessayez dans un instant."
const ERR_FORBIDDEN = "Vous n'avez pas les droits pour effectuer cette action."
const ERR_DEADLINE_PASSED = "L'échéance de cette mission est dépassée."
const ERR_LOAD = "Impossible de charger les candidatures."
const MESSAGE_MAX = 500
// Décision D2 : refus de candidature selon le statut de vérification (espace étudiant).
const ERR_CANNOT_APPLY = {
  not_submitted: "Envoyez votre carte étudiante pour pouvoir postuler.",
  rejected: "Votre carte a été refusée, renvoyez-la pour pouvoir postuler.",
  expired: "Votre badge a expiré, renouvelez-le pour pouvoir postuler.",
}

/** Borne le nombre de lignes renvoyées (défaut 100, maximum 200). */
function boundedLimit(limit) {
  return Math.min(Math.max(1, Number(limit) || 100), 200)
}

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
 * Indique si le compte d'un étudiant est fermé ou suspendu (lecture service role, colonnes non exposées).
 * Fail-closed : une erreur de lecture ou un profil introuvable valent refus.
 *
 * @param {string} studentId
 * @returns {Promise<boolean>}
 */
async function isStudentUnavailable(studentId) {
  try {
    const { data, error } = await createServiceClient()
      .from("profiles")
      .select("closed_at, is_suspended")
      .eq("user_id", studentId)
      .maybeSingle()
    if (error || !data) return true
    return data.closed_at != null || data.is_suspended === true
  } catch (err) {
    console.error("[application.actions] Lecture de l'état du compte impossible:", err?.message)
    return true
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
 * Écrit une notification sans jamais faire échouer l'action appelante : `notify` ne lève pas, et la
 * construction du texte est elle-même protégée. Le résultat de l'action métier ne dépend pas de ce qui suit.
 *
 * @param {() => Promise<unknown>} write
 * @returns {Promise<void>}
 */
async function safeNotify(write) {
  try {
    await write()
  } catch (err) {
    console.error("[application.actions] notification ignorée:", err?.code ?? "erreur")
  }
}

/**
 * Statut de vérification de l'étudiant, calculé côté serveur. Les colonnes privées (carte, motif de refus) sont
 * lues par `getMyProfile` et `getMyStudentProfile` (service role, filtre sur l'identifiant de la session) : seul le
 * statut calculé est utilisé, jamais renvoyé.
 *
 * @returns {Promise<import("@/lib/student-space/verification-status").VerificationView | null>} null si la lecture échoue
 */
async function readVerification() {
  try {
    const [profileRes, studentRes] = await Promise.all([getMyProfile(), getMyStudentProfile()])
    if (profileRes.error || studentRes.error || !profileRes.profile) {
      console.error("[apply] Lecture du statut de vérification:", profileRes.error ?? studentRes.error ?? "profil introuvable")
      return null
    }
    return verificationFromRows(profileRes.profile, studentRes.studentProfile)
  } catch (err) {
    console.error("[apply] Lecture du statut de vérification:", err?.message)
    return null
  }
}

/**
 * Postule à une mission. Refuse l'étudiant dont la carte n'a jamais été envoyée, a été refusée ou dont le badge a
 * expiré (décision D2) : le contrôle est fait ici, il ne dépend pas de l'interface.
 *
 * @param {{ missionId: string, message: string }} params
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function apply({ missionId, message }) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  if (!isUuid(missionId)) return { error: "Mission introuvable." }
  if (typeof message !== "string" || !message.trim()) return { error: "Le message de candidature est requis." }
  if (message.trim().length > MESSAGE_MAX) {
    return { error: `Le message ne doit pas dépasser ${MESSAGE_MAX} caractères.` }
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id, title, client_id, status, deadline")
    .eq("id", missionId)
    .maybeSingle()

  if (missionError) {
    console.error("[apply] mission", missionError.message)
    return { error: ERR_GENERIC }
  }
  if (!mission) return { error: "Mission introuvable." }
  if (mission.status !== "open") return { error: "Cette mission n'accepte plus de candidatures." }
  if (isPastDeadline(mission.deadline, todayInBenin())) return { error: ERR_DEADLINE_PASSED }
  if (mission.client_id === user.id) return { error: "Vous ne pouvez pas postuler à votre propre mission." }

  // Vérifie qu'aucune candidature n'existe déjà
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("mission_id", missionId)
    .eq("student_id", user.id)
    .maybeSingle()

  if (existing) return { error: "Vous avez déjà postulé à cette mission." }

  const verification = await readVerification()
  if (!verification) return { error: ERR_GENERIC }
  if (!verification.canApply) return { error: ERR_CANNOT_APPLY[verification.key] ?? ERR_GENERIC }

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

  // Nom de l'étudiant lu une seule fois, à la première demande, puis partagé par la notification et l'e-mail.
  let studentNameRead = null
  const readStudentName = () => (studentNameRead ??= getFullName(supabase, user.id))

  // Notification in-app au client (échec sans conséquence sur la candidature)
  await safeNotify(async () => {
    const studentName = await readStudentName()
    await notify({
      recipientId: mission.client_id,
      ...applicationReceived({
        missionId,
        missionTitle: mission.title,
        studentId: user.id,
        studentName,
      }),
    })
  })

  // Notifie le client (échec d'email sans conséquence sur la candidature)
  try {
    const [studentName, clientName, clientEmail] = await Promise.all([
      readStudentName(),
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

  revalidatePath("/applications")
  revalidatePath("/missions/" + missionId)

  return { success: true }
}

/**
 * Retourne les candidatures d'une mission du client connecté avec les profils étudiants.
 * Refus si la mission n'appartient pas au client de la session.
 *
 * @param {string} missionId
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array>}
 */
export async function getMissionApplications(missionId, { limit } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) throw new Error(auth.error)
  const { supabase, user } = auth

  const { data: mission } = await supabase
    .from("missions")
    .select("id")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .maybeSingle()
  if (!mission) throw new Error(ERR_FORBIDDEN)

  const { data, error } = await supabase
    .from("applications")
    .select("*, profiles!student_id(full_name, avatar_url, rating, missions_done), student_profiles!student_id(school, skills)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit(limit))

  if (error) {
    console.error("[getMissionApplications]", error.message)
    throw new Error(ERR_LOAD)
  }
  const rows = data ?? []

  // Les candidatures d'étudiants dont le compte est fermé ne sont plus présentées au client.
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))]
  if (studentIds.length === 0) return rows
  const { data: closed, error: closedError } = await createServiceClient()
    .from("profiles")
    .select("user_id")
    .in("user_id", studentIds)
    .not("closed_at", "is", null)
  if (closedError) {
    console.error("[getMissionApplications] Etat des comptes:", closedError.message)
    throw new Error(ERR_LOAD)
  }
  const closedIds = new Set((closed ?? []).map((row) => row.user_id))
  return rows.filter((row) => !closedIds.has(row.student_id))
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

  if (await isStudentUnavailable(studentId)) return { error: "Cette candidature n'est plus disponible." }

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
    // Compensation (client service role) : la candidature redevient en attente
    const { data: undone, error: undoError } = await createServiceClient()
      .from("applications")
      .update({ status: "pending" })
      .eq("id", applicationId)
      .eq("status", "accepted")
      .select("id")
    if (undoError || !undone?.length) {
      console.error("[acceptApplication] Compensation en échec:", undoError?.message ?? "aucune ligne remise en attente")
    }
    return { error: "Cette mission n'est plus disponible." }
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

  // 4. Notifications in-app : l'étudiant retenu et les étudiants non retenus (échec sans conséquence)
  await safeNotify(async () => {
    const clientName = await getFullName(supabase, user.id)
    await Promise.all([
      notify({
        recipientId: studentId,
        ...applicationAccepted({
          missionId,
          missionTitle: mission.title,
          clientId: user.id,
          clientName,
          studentId,
        }),
      }),
      ...(rejectedApps ?? []).map(({ student_id: rejectedId }) =>
        notify({
          recipientId: rejectedId,
          ...applicationRejected({ missionId, missionTitle: mission.title, clientId: user.id, studentId: rejectedId }),
        }),
      ),
    ])
  })

  // 5. Notifie par email (échec sans conséquence sur l'acceptation)
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
          if (rEmail && !isClosedEmail(rEmail)) {
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
    .select("id, mission_id, student_id, status")
    .eq("id", applicationId)
    .maybeSingle()

  if (!application) return { error: "Candidature introuvable." }

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title")
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

  await safeNotify(() =>
    notify({
      recipientId: application.student_id,
      ...applicationRejected({
        missionId: mission.id,
        missionTitle: mission.title,
        clientId: user.id,
        studentId: application.student_id,
      }),
    }),
  )

  revalidatePath("/client/missions/" + mission.id)
  revalidatePath("/client/missions")

  return { success: true }
}
