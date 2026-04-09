"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { CITIES } from "@/lib/supabase/database.constants"

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

export async function saveStudentProfile(formData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié." }

  const fullName = formData.get("fullName")?.toString().trim() ?? ""
  const phone = formData.get("phone")?.toString().trim() ?? ""
  const city = formData.get("city")?.toString() ?? ""
  const school = formData.get("school")?.toString().trim() ?? ""
  const level = formData.get("level")?.toString().trim() ?? ""
  const skills = formData.getAll("skills")

  if (!fullName) return { error: "Le nom complet est requis." }
  if (!city || !CITIES.includes(city)) return { error: "Veuillez choisir une ville valide." }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: fullName,
    phone: phone || null,
    city,
    role: "student",
  })

  if (profileError) return { error: profileError.message }

  const { error: studentError } = await supabase.from("student_profiles").upsert({
    user_id: user.id,
    school: school || null,
    level: level || null,
    skills,
  })

  if (studentError) return { error: studentError.message }

  redirect("/dashboard")
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

export async function saveClientProfile(formData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié." }

  const fullName = formData.get("fullName")?.toString().trim() ?? ""
  const phone = formData.get("phone")?.toString().trim() ?? ""
  const city = formData.get("city")?.toString() ?? ""
  const companyName = formData.get("companyName")?.toString().trim() ?? ""

  if (!fullName) return { error: "Le nom complet est requis." }
  if (!city || !CITIES.includes(city)) return { error: "Veuillez choisir une ville valide." }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: fullName,
    phone: phone || null,
    city,
    role: "client",
    bio: companyName || null,
  })

  if (error) return { error: error.message }

  redirect("/client/dashboard")
}
