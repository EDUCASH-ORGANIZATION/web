"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"

/**
 * Charge les missions ouvertes avec filtres optionnels.
 *
 * @param {{ city?: string, type?: string, urgency?: string, limit?: number, offset?: number }} filters
 * @returns {Promise<import('@/lib/supabase/database.constants').Mission[]>}
 */
export async function getMissions(filters = {}) {
  const { city, type, urgency, limit = 20, offset = 0 } = filters

  const supabase = await createClient()

  let query = supabase
    .from("missions")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (city)    query = query.eq("city", city)
  if (type)    query = query.eq("type", type)
  if (urgency) query = query.eq("urgency", urgency)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return data ?? []
}

/**
 * Charge une mission par son id avec le profil du client joint.
 *
 * @param {string} id
 * @returns {Promise<(import('@/lib/supabase/database.constants').Mission & { profiles: import('@/lib/supabase/database.constants').Profile }) | null>}
 */
export async function getMission(id) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("missions")
    .select("*, profiles!client_id(*)")
    .eq("id", id)
    .single()

  if (error) return null
  return data
}

/**
 * Crée une nouvelle mission pour le client connecté.
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   type: string,
 *   city: string,
 *   budget: number,
 *   urgency: 'low' | 'medium' | 'high',
 *   deadline?: string | null
 * }} data
 * @returns {Promise<{ id: string } | { error: string }>}
 */
export async function createMission(data) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }
  if (user.user_metadata?.role !== "client") return { error: "Seuls les clients peuvent créer des missions." }

  const { title, description, type, city, budget, urgency, deadline } = data

  if (!title?.trim())       return { error: "Le titre est requis." }
  if (!description?.trim()) return { error: "La description est requise." }
  if (!type)                return { error: "Le type de mission est requis." }
  if (!city)                return { error: "La ville est requise." }
  if (!budget || budget <= 0) return { error: "Le budget doit être supérieur à 0." }

  const supabase = await createClient()

  const { data: mission, error } = await supabase
    .from("missions")
    .insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      type,
      city,
      budget: Number(budget),
      urgency: urgency ?? "low",
      deadline: deadline || null,
      status: "open",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/client/missions")
  revalidatePath("/missions")

  return { id: mission.id }
}

/**
 * Met à jour le statut d'une mission.
 *
 * @param {string} id
 * @param {'open' | 'in_progress' | 'done' | 'cancelled'} status
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function updateMissionStatus(id, status) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }

  const supabase = await createClient()

  const { error } = await supabase
    .from("missions")
    .update({ status })
    .eq("id", id)
    .eq("client_id", user.id) // garde : seul le propriétaire peut modifier

  if (error) return { error: error.message }

  revalidatePath("/client/missions/" + id)
  revalidatePath("/client/missions")

  return { success: true }
}
