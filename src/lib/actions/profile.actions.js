"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * Met à jour le profil d'un étudiant connecté.
 * L'avatar est uploadé côté client — on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, bio, school, level, availability, skills: string[], avatarUrl?: string }} data
 */
export async function updateStudentProfile(data) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Non authentifié." }

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phone?.trim() || null,
      bio: bio?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatarUrl

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) return { error: profileError.message }

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

    if (studentError) return { error: studentError.message }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateStudentProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Enregistre l'URL de la carte étudiante (upload fait côté client).
 *
 * @param {string} cardUrl - URL publique de la carte dans Supabase Storage
 */
export async function saveStudentCardUrl(cardUrl) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Non authentifié." }

    if (!cardUrl) return { error: "URL de carte manquante." }

    const { error: updateError } = await supabase
      .from("student_profiles")
      .upsert({ user_id: user.id, card_url: cardUrl }, { onConflict: "user_id" })

    if (updateError) return { error: updateError.message }

    revalidatePath("/profile")
    return { success: true }
  } catch (err) {
    console.error("[saveStudentCardUrl]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}

/**
 * Met à jour le profil étudiant ET la carte si une nouvelle est fournie.
 * L'avatar et la carte sont uploadés côté client — on reçoit les URLs.
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
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Non authentifié." }

    const { fullName, city, phone, bio, school, level, availability, skills, avatarUrl, cardUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    // Mise à jour du profil principal
    const profileUpdate = {
      full_name: fullName.trim(),
      city:      city.trim(),
      phone:     phone?.trim() || null,
      bio:       bio?.trim()   || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatarUrl

    // Si une nouvelle carte est soumise : repasse en attente de vérification
    if (cardUrl) {
      profileUpdate.is_verified               = false
      profileUpdate.rejection_reason          = null
      profileUpdate.verification_submitted_at = new Date().toISOString()
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) return { error: profileError.message }

    // Mise à jour du profil académique
    const studentUpdate = {
      user_id:      user.id,
      school:       school?.trim()      || null,
      level:        level?.trim()       || null,
      availability: availability?.trim() || null,
      skills:       Array.isArray(skills) ? skills : [],
    }
    if (cardUrl) studentUpdate.card_url = cardUrl

    const { error: studentError } = await supabase
      .from("student_profiles")
      .upsert(studentUpdate, { onConflict: "user_id" })

    if (studentError) return { error: studentError.message }

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
 * L'avatar est uploadé côté client — on reçoit ici uniquement son URL (string).
 *
 * @param {{ fullName, city, phone, companyName, avatarUrl?: string }} data
 */
export async function updateClientProfile(data) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Non authentifié." }

    const { fullName, city, phone, companyName, avatarUrl } = data

    if (!fullName?.trim()) return { error: "Le nom complet est requis." }
    if (!city?.trim())     return { error: "La ville est requise." }

    const profileUpdate = {
      full_name: fullName.trim(),
      city: city.trim(),
      phone: phone?.trim() || null,
      bio: companyName?.trim() || null,
    }
    if (avatarUrl) profileUpdate.avatar_url = avatarUrl

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user.id)

    if (profileError) return { error: profileError.message }

    revalidatePath("/client/profile")
    return { success: true }
  } catch (err) {
    console.error("[updateClientProfile]", err)
    return { error: "Une erreur inattendue est survenue. Réessayez." }
  }
}
