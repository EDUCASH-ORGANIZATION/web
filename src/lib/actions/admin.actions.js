"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { sendEmail } from "@/lib/email/index"

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function assertAdmin() {
  const user = await getCurrentUser()
  if (!user || user.user_metadata?.role !== "admin") {
    throw new Error("Accès refusé — rôle admin requis.")
  }
  return user
}

/**
 * Valide un étudiant : is_verified = true + email de bienvenue.
 * @param {string} userId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function verifyStudent(userId) {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()
  const admin = getAdminClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ is_verified: true })
    .eq("user_id", userId)
    .select("full_name")
    .single()

  if (profileError) {
    console.error("[verifyStudent]", profileError)
    return { error: "Impossible de mettre à jour le profil." }
  }

  // Récupère l'email via service role
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(userId)
    if (user?.email) {
      await sendEmail("welcome-verified", user.email, {
        name: profile.full_name ?? "Étudiant",
      })
    }
  } catch (emailErr) {
    console.error("[verifyStudent] email:", emailErr)
  }

  revalidatePath("/admin/verifications")
  return { success: true }
}

/**
 * Rejette un étudiant avec un motif + email de notification.
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function rejectStudent(userId, reason) {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()
  const admin = getAdminClient()

  // Marque le profil comme rejeté (is_verified reste false, on stocke le motif)
  const { data: profile, error: updateError } = await supabase
    .from("profiles")
    .update({
      is_verified: false,
      rejection_reason: reason || "Informations insuffisantes.",
    })
    .eq("user_id", userId)
    .select("full_name")
    .single()

  if (updateError) {
    console.error("[rejectStudent]", updateError)
    return { error: "Impossible de mettre à jour le profil." }
  }

  // Envoie un email de notification
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(userId)
    if (user?.email) {
      await sendEmail("verification-rejected", user.email, {
        name: profile?.full_name ?? "Étudiant",
        reason: reason || "Informations insuffisantes.",
      })
    }
  } catch (emailErr) {
    console.error("[rejectStudent] email:", emailErr)
  }

  revalidatePath("/admin/verifications")
  revalidatePath("/admin/dashboard")
  return { success: true }
}

/**
 * Réinitialise le rejet d'un étudiant pour lui permettre de soumettre à nouveau.
 * @param {string} userId
 */
export async function resetRejection(userId) {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ rejection_reason: null })
    .eq("user_id", userId)

  if (error) {
    console.error("[resetRejection]", error)
    return { error: "Impossible de réinitialiser le dossier." }
  }

  revalidatePath("/admin/verifications")
  return { success: true }
}

/**
 * Suspend un utilisateur (is_suspended = true dans profiles).
 * @param {string} userId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function suspendUser(userId) {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ is_suspended: true })
    .eq("user_id", userId)

  if (error) {
    console.error("[suspendUser]", error)
    return { error: "Impossible de suspendre l'utilisateur." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}
