"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CITIES, MISSION_TYPES } from "@/lib/supabase/database.constants"

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

  redirect("/student/dashboard")
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
