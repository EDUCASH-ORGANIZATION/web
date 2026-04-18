"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/auth.actions"
import { getWallet } from "@/lib/actions/wallet.actions"

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

  // 1. Vérification du solde wallet avant publication
  const walletResult = await getWallet(user.id)
  if (walletResult.error) return { error: "Impossible de vérifier votre wallet. Réessayez." }

  const { available } = walletResult
  const budgetNum     = Number(budget)

  if (available < budgetNum) {
    return {
      error:     "wallet_insufficient",
      available,
      required:  budgetNum,
      shortfall: budgetNum - available,
    }
  }

  // 2. Insertion de la mission
  const { data: mission, error } = await supabase
    .from("missions")
    .insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      type,
      city,
      budget: budgetNum,
      urgency: urgency ?? "low",
      deadline: deadline || null,
      status: "open",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  // 3. Réservation des fonds dans le wallet
  const { error: reserveError } = await supabase.rpc("wallet_reserve", {
    p_user_id:   user.id,
    p_amount:    budgetNum,
    p_mission_id: mission.id,
  })

  if (reserveError) {
    // Rollback : supprime la mission si la réservation échoue
    await supabase.from("missions").delete().eq("id", mission.id)
    return { error: "Impossible de réserver les fonds. Vérifiez votre solde et réessayez." }
  }

  revalidatePath("/client/missions")
  revalidatePath("/student/missions")

  return { id: mission.id }
}

/**
 * Confirme la fin d'une mission et libère les fonds wallet vers l'étudiant.
 *
 * @param {string} missionId
 * @returns {Promise<{ success: true, amountStudent: number } | { error: string }>}
 */
export async function confirmMission(missionId) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié." }

  const supabase = await createClient()

  // 1. Charge la mission
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id, title, budget, client_id, selected_student_id, status")
    .eq("id", missionId)
    .single()

  if (missionError || !mission) return { error: "Mission introuvable." }
  if (mission.client_id !== user.id) return { error: "Action non autorisée." }
  if (mission.status === "done")     return { error: "Cette mission est déjà terminée." }
  if (!mission.selected_student_id) return { error: "Aucun étudiant sélectionné pour cette mission." }

  // 2. Libère les fonds via wallet_release (SQL SECURITY DEFINER)
  const { data: releaseResult, error: releaseError } = await supabase.rpc("wallet_release", {
    p_client_id:    mission.client_id,
    p_student_id:   mission.selected_student_id,
    p_mission_id:   missionId,
    p_amount_total: mission.budget,
  })

  if (releaseError) return { error: releaseError.message }
  if (!releaseResult?.success) return { error: releaseResult?.error ?? "Échec de la libération des fonds." }

  // 3. Marque la mission comme terminée
  await supabase
    .from("missions")
    .update({ status: "done" })
    .eq("id", missionId)

  // 4. Notification email à l'étudiant
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(mission.selected_student_id)
    const studentEmail = userData?.user?.email

    if (studentEmail) {
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", mission.selected_student_id)
        .single()

      const amountFormatted = new Intl.NumberFormat("fr-FR").format(releaseResult.amount_student ?? 0)

      const { sendEmail } = await import("@/lib/email/index")
      await sendEmail("payment-received-wallet", studentEmail, {
        firstName:    studentProfile?.full_name?.split(" ")[0] ?? "Étudiant",
        missionTitle: mission.title,
        amount:       amountFormatted,
      })
    }
  } catch (emailErr) {
    console.error("[confirmMission] Erreur envoi email:", emailErr)
  }

  revalidatePath("/client/missions/" + missionId)
  revalidatePath("/client/dashboard")

  return { success: true, amountStudent: releaseResult.amount_student ?? 0 }
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

  // Si annulation, rembourser les fonds réservés avant de changer le statut
  if (status === "cancelled") {
    const { data: mission } = await supabase
      .from("missions")
      .select("client_id, budget, status")
      .eq("id", id)
      .eq("client_id", user.id)
      .single()

    if (!mission) return { error: "Mission introuvable." }

    // Remboursement uniquement si des fonds étaient réservés (statut open ou in_progress)
    if (mission.status === "open" || mission.status === "in_progress") {
      const { error: refundError } = await supabase.rpc("wallet_refund", {
        p_user_id:   user.id,
        p_amount:    mission.budget,
        p_mission_id: id,
      })

      if (refundError) {
        console.error("[updateMissionStatus] wallet_refund error:", refundError)
        // On continue quand même — le statut doit être mis à jour
      }
    }
  }

  const { error } = await supabase
    .from("missions")
    .update({ status })
    .eq("id", id)
    .eq("client_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/client/missions/" + id)
  revalidatePath("/client/missions")

  return { success: true }
}
