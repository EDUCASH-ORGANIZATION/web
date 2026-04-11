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
 * Valide un étudiant : is_verified = true, verified_until = +1 an, email de confirmation.
 * @param {string} userId
 * @returns {Promise<{ success: true, verifiedUntil: string } | { error: string }>}
 */
export async function verifyStudent(userId) {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()
  const admin    = getAdminClient()

  // Calcule la date d'expiration (1 an, format YYYY-MM-DD)
  const verifiedUntil = new Date()
  verifiedUntil.setFullYear(verifiedUntil.getFullYear() + 1)
  const verifiedUntilISO = verifiedUntil.toISOString().split("T")[0]

  // Met à jour le profil
  const { error } = await supabase
    .from("profiles")
    .update({
      is_verified:      true,
      verified_until:   verifiedUntilISO,
      rejection_reason: null,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[verifyStudent]", error)
    return { error: error.message }
  }

  // Charge les infos nécessaires pour l'email
  const [
    { data: profile },
    { data: studentProfile },
    { data: authData },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", userId).single(),
    supabase.from("student_profiles").select("school").eq("user_id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ])

  const email = authData?.user?.email
  if (email) {
    await sendEmail("verification-approved", email, {
      name:          profile?.full_name?.split(" ")[0] ?? "Étudiant",
      school:        studentProfile?.school ?? "ton établissement",
      verifiedUntil: verifiedUntilISO,
      appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? "https://educash.bj",
    }).catch((err) => console.error("[verifyStudent] email:", err))
  }

  revalidatePath("/admin/verifications")
  revalidatePath("/admin/dashboard")
  return { success: true, verifiedUntil: verifiedUntilISO }
}

/**
 * Rejette un étudiant avec un motif + message optionnel + email de notification.
 * @param {string} userId
 * @param {string} reason
 * @param {string} [customMessage]
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function rejectStudent(userId, reason, customMessage = "") {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: e.message }
  }

  const supabase = await createClient()
  const admin    = getAdminClient()

  const finalReason = reason || "Informations insuffisantes."

  // Met à jour le profil
  const { error } = await supabase
    .from("profiles")
    .update({
      is_verified:      false,
      verified_until:   null,
      rejection_reason: finalReason,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[rejectStudent]", error)
    return { error: error.message }
  }

  // Charge les infos pour l'email
  const [
    { data: profile },
    { data: authData },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", userId).single(),
    admin.auth.admin.getUserById(userId),
  ])

  const email = authData?.user?.email
  if (email) {
    await sendEmail("verification-rejected", email, {
      name:            profile?.full_name?.split(" ")[0] ?? "Étudiant",
      rejectionReason: finalReason,
      customMessage:   customMessage || null,
      appUrl:          process.env.NEXT_PUBLIC_APP_URL ?? "https://educash.bj",
    }).catch((err) => console.error("[rejectStudent] email:", err))
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
