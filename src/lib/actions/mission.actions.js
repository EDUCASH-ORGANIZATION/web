"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireRole } from "@/lib/auth/require-role"
import { callWalletRpc } from "@/lib/wallet/wallet-rpc"
import { paymentsEnabled } from "@/lib/constants/payments"
import {
  CITIES,
  COMMISSION_RATE,
  MIN_MISSION_BUDGET,
  MISSION_TYPES,
  MISSION_URGENCIES,
} from "@/lib/supabase/database.constants"

const ERR_GENERIC = "Une erreur est survenue. Réessayez dans un instant."
const ERR_PAYMENTS_OFF = "La publication de missions est en cours d'activation."

// Colonnes publiques de `profiles` (aucune colonne privée : phone, fcm_token, rejection_reason...).
const PUBLIC_PROFILE_COLUMNS =
  "id, user_id, full_name, city, avatar_url, bio, role, is_verified, verified_until, rating, missions_done, is_suspended, created_at, updated_at"

/**
 * Fonds encore réservés pour une mission : réservation moins remboursements déjà passés.
 * Lecture avec le client service role (le grand livre n'est pas lisible par tous).
 * @returns {Promise<{ left: number, moved: boolean } | { error: true }>} `left` vaut 0 pour une mission héritée sans réservation ;
 * `moved` indique qu'au moins un mouvement existe au grand livre pour cette mission.
 */
async function reservedLeft(service, clientId, missionId) {
  const { data, error } = await service
    .from("wallet_transactions")
    .select("type, amount")
    .eq("user_id", clientId)
    .eq("mission_id", missionId)
    .in("type", ["reserve", "refund"])
  if (error) {
    console.error("[mission] lecture du grand livre impossible", error)
    return { error: true }
  }
  let left = 0
  for (const row of data ?? []) {
    left += row.type === "reserve" ? Number(row.amount) : -Number(row.amount)
  }
  return { left: Math.max(left, 0), moved: (data ?? []).length > 0 }
}

/**
 * Retire une mission créée dont la réservation a échoué.
 * Aucun mouvement au grand livre : suppression (sinon annulation). La base refuse de supprimer
 * une mission qui a des mouvements : on rembourse alors le reste réservé, puis on l'annule.
 * @returns {Promise<boolean>} false si la mission n'a pas pu être retirée proprement.
 */
async function discardMission(service, clientId, missionId) {
  const reserved = await reservedLeft(service, clientId, missionId)
  if (reserved.error) return false

  if (!reserved.moved) {
    const { error } = await service.from("missions").delete().eq("id", missionId)
    if (!error) return true
    console.error("[createMission] suppression impossible, annulation", error)
  } else if (reserved.left > 0) {
    const refund = await callWalletRpc(service, "wallet_refund", {
      p_client_id:  clientId,
      p_mission_id: missionId,
      p_amount:     reserved.left,
    })
    if (!refund.ok) {
      console.error("[createMission] remboursement impossible, mission conservée", refund)
      return false
    }
  }

  const { error: cancelError } = await service
    .from("missions")
    .update({ status: "cancelled" })
    .eq("id", missionId)
  if (cancelError) {
    console.error("[createMission] annulation impossible", cancelError)
    return false
  }
  return true
}

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
 * Charge une mission par son id avec le profil public du client joint.
 *
 * @param {string} id
 * @returns {Promise<(import('@/lib/supabase/database.constants').Mission & { profiles: import('@/lib/supabase/database.constants').Profile }) | null>}
 */
export async function getMission(id) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("missions")
    .select(`*, profiles!client_id(${PUBLIC_PROFILE_COLUMNS})`)
    .eq("id", id)
    .single()

  if (error) return null
  return data
}

/**
 * Crée une nouvelle mission pour le client connecté.
 * Ordre obligatoire : insertion `open` PUIS réservation des fonds (service role).
 * Si la réservation échoue, la mission est retirée.
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
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { user } = auth

  if (!paymentsEnabled()) return { error: ERR_PAYMENTS_OFF }

  const { title, description, type, city, budget, urgency, deadline } = data ?? {}
  const budgetNum = Number(budget)

  if (typeof title !== "string" || !title.trim()) return { error: "Le titre est requis." }
  if (typeof description !== "string" || !description.trim()) return { error: "La description est requise." }
  if (!MISSION_TYPES.includes(type)) return { error: "Le type de mission est invalide." }
  if (!CITIES.includes(city)) return { error: "La ville est invalide." }
  if (!Number.isInteger(budgetNum) || budgetNum < MIN_MISSION_BUDGET) {
    return { error: `Le budget minimum est de ${new Intl.NumberFormat("fr-FR").format(MIN_MISSION_BUDGET)} FCFA.` }
  }
  if (urgency != null && !MISSION_URGENCIES.includes(urgency)) return { error: "L'urgence est invalide." }

  const service = createServiceClient()

  // 1. Vérification du solde avant publication
  const { data: wallet, error: walletError } = await service
    .from("wallets")
    .select("balance, reserved")
    .eq("user_id", user.id)
    .maybeSingle()
  if (walletError || !wallet) return { error: "Impossible de vérifier votre portefeuille. Réessayez." }

  const available = (wallet.balance ?? 0) - (wallet.reserved ?? 0)
  if (available < budgetNum) {
    return {
      error:     "wallet_insufficient",
      available,
      required:  budgetNum,
      shortfall: budgetNum - available,
    }
  }

  // 2. Insertion de la mission (le client est celui de la session, jamais celui du corps)
  const { data: mission, error } = await service
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

  if (error || !mission) {
    if (error) console.error("[createMission] insertion impossible", error)
    return { error: ERR_GENERIC }
  }

  // 3. Réservation des fonds : succès seulement si error nul ET data.success vrai
  const reserve = await callWalletRpc(service, "wallet_reserve", {
    p_user_id:    user.id,
    p_amount:     budgetNum,
    p_mission_id: mission.id,
  })

  if (!reserve.ok) {
    const discarded = await discardMission(service, user.id, mission.id)
    if (!discarded) return { error: ERR_GENERIC }
    return { error: "Impossible de réserver les fonds. Vérifiez votre solde et réessayez." }
  }

  revalidatePath("/client/missions")
  revalidatePath("/student/missions")

  return { id: mission.id }
}

/**
 * Confirme la fin d'une mission et libère les fonds vers l'étudiant.
 *
 * @param {string} missionId
 * @returns {Promise<{ success: true, amountStudent: number } | { error: string }>}
 */
export async function confirmMission(missionId) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { user } = auth

  const service = createServiceClient()

  // 1. Charge la mission et contrôle la propriété
  const { data: mission, error: missionError } = await service
    .from("missions")
    .select("id, title, budget, client_id, selected_student_id, status")
    .eq("id", missionId)
    .maybeSingle()

  if (missionError || !mission) return { error: "Mission introuvable." }
  if (mission.client_id !== user.id) return { error: "Action non autorisée." }
  if (mission.status === "done")     return { error: "Cette mission est déjà terminée." }
  if (mission.status !== "in_progress") return { error: "Cette mission n'est pas en cours." }
  if (!mission.selected_student_id) return { error: "Aucun étudiant sélectionné pour cette mission." }

  // 2. Libère les fonds (un second appel est refusé par la fonction SQL)
  const release = await callWalletRpc(service, "wallet_release", {
    p_client_id:       mission.client_id,
    p_student_id:      mission.selected_student_id,
    p_mission_id:      missionId,
    p_amount_total:    mission.budget,
    p_commission_rate: COMMISSION_RATE,
  })
  if (!release.ok) return { error: "Impossible de libérer les fonds pour cette mission." }

  const amountStudent = release.data.amount_student ?? 0

  // 3. Marque la mission comme terminée, seulement après le succès de la libération
  const { error: doneError } = await service
    .from("missions")
    .update({ status: "done" })
    .eq("id", missionId)
    .eq("client_id", user.id)
    .eq("status", "in_progress")
  if (doneError) console.error("[confirmMission] statut done non enregistré après libération", doneError)

  // 4. Notification email à l'étudiant (adresse lue via l'API admin du client service role)
  try {
    const { data: userData } = await service.auth.admin.getUserById(mission.selected_student_id)
    const studentEmail = userData?.user?.email

    if (studentEmail) {
      const { data: studentProfile } = await service
        .from("profiles")
        .select("full_name")
        .eq("user_id", mission.selected_student_id)
        .maybeSingle()

      const amountFormatted = new Intl.NumberFormat("fr-FR").format(amountStudent)

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

  return { success: true, amountStudent }
}

/**
 * Annule une mission ouverte du client connecté (seul statut accepté : `cancelled`).
 * Une mission financée est d'abord remboursée de ses fonds réservés restants ; si le
 * remboursement échoue, le statut ne change pas. Une mission héritée sans réservation
 * est annulée directement. L'annulation d'une mission en cours est réservée à l'admin.
 *
 * @param {string} id
 * @param {'cancelled'} status
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function updateMissionStatus(id, status) {
  if (status !== "cancelled") return { error: "Ce changement de statut n'est pas autorisé." }

  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { user } = auth

  const service = createServiceClient()

  const { data: mission, error: missionError } = await service
    .from("missions")
    .select("id, client_id, status")
    .eq("id", id)
    .maybeSingle()

  if (missionError || !mission || mission.client_id !== user.id) return { error: "Mission introuvable." }
  if (mission.status === "in_progress") {
    return { error: "Une mission en cours ne peut pas être annulée ici. Contactez le support." }
  }
  if (mission.status !== "open") return { error: "Cette mission ne peut plus être annulée." }

  // Remboursement des fonds réservés restants (aucun s'il s'agit d'une mission héritée)
  const reserved = await reservedLeft(service, user.id, id)
  if (reserved.error) return { error: ERR_GENERIC }

  if (reserved.left > 0) {
    const refund = await callWalletRpc(service, "wallet_refund", {
      p_client_id:  user.id,
      p_mission_id: id,
      p_amount:     reserved.left,
    })
    if (!refund.ok) return { error: "Le remboursement a échoué. La mission n'a pas été annulée." }
  }

  const { data: updated, error } = await service
    .from("missions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("client_id", user.id)
    .eq("status", "open")
    .select("id")

  if (error || !updated?.length) {
    if (error) console.error("[updateMissionStatus] statut non enregistré", error)
    return { error: ERR_GENERIC }
  }

  revalidatePath("/client/missions/" + id)
  revalidatePath("/client/missions")

  return { success: true }
}
