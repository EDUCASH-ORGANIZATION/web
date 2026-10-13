"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireUser, requireRole } from "@/lib/auth/require-role"
import { toOwnedAvatarUrl, toOwnedStoragePath } from "@/lib/storage/owned-paths"

// Colonnes de la ligne de l'appelant, lues côté serveur : les colonnes privées (phone,
// rejection_reason, verification_submitted_at, card_url) ne sont plus lisibles avec la session.
const MY_PROFILE_COLUMNS =
  "user_id, full_name, city, avatar_url, bio, role, is_verified, verified_until, phone, rejection_reason, verification_submitted_at"
const MY_STUDENT_PROFILE_COLUMNS =
  "user_id, school, level, skills, availability, card_url"

const ERR_AVATAR = "Cette photo n'est pas valide. Envoie-la à nouveau."
const ERR_CARD = "Cette carte n'est pas valide. Envoie-la à nouveau."

/**
 * Lit la ligne `profiles` de l'utilisateur connecté, colonnes privées comprises.
 * Le filtre sur `user.id` vient de la session, jamais d'un paramètre.
 *
 * @returns {Promise<{ profile: object | null } | { error: string }>}
 */
export async function getMyProfile() {
  try {
    const auth = await requireUser()
    if (auth.error) return { error: auth.error }

    const { data, error } = await createServiceClient()
      .from("profiles")
      .select(MY_PROFILE_COLUMNS)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (error) {
      console.error("[getMyProfile]", error.message)
      return { error: "Impossible de charger ton profil." }
    }
    return { profile: data ?? null }
  } catch (err) {
    console.error("[getMyProfile]", err)
    return { error: "Impossible de charger ton profil." }
  }
}

/**
 * Lit la ligne `student_profiles` de l'utilisateur connecté, `card_url` comprise.
 *
 * @returns {Promise<{ studentProfile: object | null } | { error: string }>}
 */
export async function getMyStudentProfile() {
  try {
    const auth = await requireUser()
    if (auth.error) return { error: auth.error }

    const { data, error } = await createServiceClient()
      .from("student_profiles")
      .select(MY_STUDENT_PROFILE_COLUMNS)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (error) {
      console.error("[getMyStudentProfile]", error.message)
      return { error: "Impossible de charger ton profil." }
    }
    return { studentProfile: data ?? null }
  } catch (err) {
    console.error("[getMyStudentProfile]", err)
    return { error: "Impossible de charger ton profil." }
  }
}

/**
 * Met à jour le profil d'un étudiant connecté.
 * L'avatar est uploadé côté client - on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, bio, school, level, availability, skills: string[], avatarUrl?: string }} data
 */
export async function updateStudentProfile(data) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: ERR_AVATAR }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phone?.trim() || null,
      bio: bio?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateStudentProfile]", profileError.message)
      return { error: "Impossible d'enregistrer ton profil." }
    }

    const { error: studentError } = await supabase
      .from("student_profiles")
      .upsert(
        {
          user_id: user.id,
          school: school?.trim() || null,
          level: level?.trim() || null,
          availability: availability?.trim() || null,
          skills: Array.isArray(skills) ? skills : [],
        },
        { onConflict: "user_id" }
      )

    if (studentError) {
      console.error("[updateStudentProfile]", studentError.message)
      return { error: "Impossible d'enregistrer ton profil." }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateStudentProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Enregistre la carte étudiante (upload fait côté client). Seul le chemin dans le bucket privé
 * `student-cards` est stocké, et il doit se trouver dans le dossier de l'appelant.
 *
 * @param {string} cardUrl - chemin dans le bucket, ou URL Storage du projet (normalisée en chemin)
 */
export async function saveStudentCardUrl(cardUrl) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const cardPath = toOwnedStoragePath(cardUrl, "student-cards", user.id)
    if (!cardPath) return { error: ERR_CARD }

    const { error: updateError } = await supabase
      .from("student_profiles")
      .upsert({ user_id: user.id, card_url: cardPath }, { onConflict: "user_id" })

    if (updateError) {
      console.error("[saveStudentCardUrl]", updateError.message)
      return { error: "Impossible d'enregistrer ta carte étudiante." }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[saveStudentCardUrl]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Met à jour le profil étudiant ET la carte si une nouvelle est fournie.
 * L'avatar et la carte sont uploadés côté client - on reçoit les URLs.
 *
 * @param {{
 *   fullName: string,
 *   city: string,
 *   phone?: string,
 *   bio?: string,
 *   school?: string,
 *   level?: string,
 *   availability?: string,
 *   skills?: string[],
 *   avatarUrl?: string,
 *   cardUrl?: string,
 * }} data
 */
export async function updateStudentProfileWithCard(data) {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl, cardUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: ERR_AVATAR }

    const cardPath = cardUrl ? toOwnedStoragePath(cardUrl, "student-cards", user.id) : null
    if (cardUrl && !cardPath) return { error: ERR_CARD }

    // Mise à jour du profil principal
    const profileUpdate = {
      full_name: fullName.trim(),
      city:      city.trim(),
      phone:     phone?.trim() || null,
      bio:       bio?.trim()   || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    // Si une nouvelle carte est soumise : repasse en attente de vérification
    if (cardPath) {
      profileUpdate.is_verified               = false
      profileUpdate.rejection_reason          = null
      profileUpdate.verification_submitted_at = new Date().toISOString()
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateStudentProfileWithCard]", profileError.message)
      return { error: "Impossible d'enregistrer ton profil." }
    }

    // Mise à jour du profil académique
    const studentUpdate = {
      user_id:      user.id,
      school:       school?.trim()      || null,
      level:        level?.trim()       || null,
      availability: availability?.trim() || null,
      skills:       Array.isArray(skills) ? skills : [],
    }
    if (cardPath) studentUpdate.card_url = cardPath

    const { error: studentError } = await supabase
      .from("student_profiles")
      .upsert(studentUpdate, { onConflict: "user_id" })

    if (studentError) {
      console.error("[updateStudentProfileWithCard]", studentError.message)
      return { error: "Impossible d'enregistrer ton profil." }
    }

    revalidatePath("/profile")
    revalidatePath("/student/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateStudentProfileWithCard]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Met à jour le profil d'un client connecté.
 * L'avatar est uploadé côté client - on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, companyName, avatarUrl?: string }} data
 */
export async function updateClientProfile(data) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const { fullName, city, phone, companyName, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const avatar = avatarUrl ? toOwnedAvatarUrl(avatarUrl, user.id) : null
    if (avatarUrl && !avatar) return { error: "Ce logo n'est pas valide. Envoyez-le à nouveau." }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phone?.trim() || null,
      bio: companyName?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatar

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) {
      console.error("[updateClientProfile]", profileError.message)
      return { error: "Impossible d'enregistrer ton profil." }
    }

    revalidatePath("/client/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateClientProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}
