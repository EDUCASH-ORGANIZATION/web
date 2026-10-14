"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { sendEmail } from "@/lib/email/index"

const ERR_NOT_FOUND = "Dossier introuvable ou déjà traité."
const ERR_VERIFY = "Impossible de valider ce dossier."
const ERR_REJECT = "Impossible de rejeter ce dossier."
const ERR_RESET = "Impossible de réinitialiser le dossier."
const ERR_SUSPEND = "Impossible de suspendre l'utilisateur."

// Contrôle admin (profiles.role, jamais user_metadata) puis client service role pour les écritures.
// Le client service role n'est ouvert qu'après un contrôle de rôle réussi.
async function adminService() {
  const auth = await requireRole(["admin"])
  if (auth.error) return { error: auth.error }
  try {
    return { service: createServiceClient() }
  } catch (err) {
    console.error("[admin.actions] client service indisponible:", err)
    return { error: "Configuration serveur incomplète." }
  }
}

// Écriture sur une ligne de profiles : exactement une ligne attendue.
// Retourne null en cas de succès, sinon le message neutre à renvoyer.
async function updateProfile(service, userId, values, tag, failMessage) {
  if (typeof userId !== "string" || userId.trim() === "") return ERR_NOT_FOUND
  const { data, error } = await service
    .from("profiles")
    .update(values)
    .eq("user_id", userId)
    .select("user_id")
  if (error) {
    console.error(`[${tag}]`, error)
    return failMessage
  }
  if (!Array.isArray(data) || data.length !== 1) {
    console.error(`[${tag}] lignes modifiées inattendues:`, data?.length ?? 0)
    return ERR_NOT_FOUND
  }
  return null
}

/**
 * Valide un étudiant : is_verified = true, verified_until = +1 an, email de confirmation.
 * @param {string} userId
 * @returns {Promise<{ success: true, verifiedUntil: string } | { error: string }>}
 */
export async function verifyStudent(userId) {
  const ctx = await adminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  // Calcule la date d'expiration (1 an, format YYYY-MM-DD)
  const verifiedUntil = new Date()
  verifiedUntil.setFullYear(verifiedUntil.getFullYear() + 1)
  const verifiedUntilISO = verifiedUntil.toISOString().split("T")[0]

  // Met à jour le profil
  const failure = await updateProfile(
    service,
    userId,
    { is_verified: true, verified_until: verifiedUntilISO, rejection_reason: null },
    "verifyStudent",
    ERR_VERIFY
  )
  if (failure) return { error: failure }

  // Charge les infos nécessaires pour l'email
  const [
    { data: profile },
    { data: studentProfile },
    { data: authData },
  ] = await Promise.all([
    service.from("profiles").select("full_name").eq("user_id", userId).single(),
    service.from("student_profiles").select("school").eq("user_id", userId).maybeSingle(),
    service.auth.admin.getUserById(userId),
  ])

  const email = authData?.user?.email
  if (email) {
    await sendEmail("verification-approved", email, {
      name:          profile?.full_name?.split(" ")[0] ?? "Étudiant",
      school:        studentProfile?.school ?? "votre établissement",
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
  const ctx = await adminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const finalReason = reason || "Informations insuffisantes."

  // Met à jour le profil
  const failure = await updateProfile(
    service,
    userId,
    { is_verified: false, verified_until: null, rejection_reason: finalReason },
    "rejectStudent",
    ERR_REJECT
  )
  if (failure) return { error: failure }

  // Charge les infos pour l'email
  const [
    { data: profile },
    { data: authData },
  ] = await Promise.all([
    service.from("profiles").select("full_name").eq("user_id", userId).single(),
    service.auth.admin.getUserById(userId),
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
  const ctx = await adminService()
  if (ctx.error) return { error: ctx.error }

  const failure = await updateProfile(ctx.service, userId, { rejection_reason: null }, "resetRejection", ERR_RESET)
  if (failure) return { error: failure }

  revalidatePath("/admin/verifications")
  return { success: true }
}

/**
 * Suspend un utilisateur (is_suspended = true dans profiles).
 * @param {string} userId
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function suspendUser(userId) {
  const ctx = await adminService()
  if (ctx.error) return { error: ctx.error }

  const failure = await updateProfile(ctx.service, userId, { is_suspended: true }, "suspendUser", ERR_SUSPEND)
  if (failure) return { error: failure }

  revalidatePath("/admin/users")
  return { success: true }
}
