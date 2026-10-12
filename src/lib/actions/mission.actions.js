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
const ERR_NOT_CANCELLABLE = "Cette mission ne peut plus être annulée."
const ERR_PAYMENTS_OFF = "La publication de missions est en cours d'activation."

// Colonnes publiques de `profiles` (aucune colonne privée : phone, fcm_token, rejection_reason...).
const PUBLIC_PROFILE_COLUMNS =
  "id, user_id, full_name, city, avatar_url, bio, role, is_verified, verified_until, rating, missions_done, is_suspended, created_at, updated_at"

/**
 * Indique si au moins un mouvement de réservation ou de remboursement existe au grand livre
 * pour cette mission. Lecture avec le client service role (le grand livre n'est pas lisible par tous).
 * @returns {Promise<{ moved: boolean } | { error: true }>}
 */
async function ledgerHasMovements(service, clientId, missionId) {
  const { data, error } = await service
    .from("wallet_transactions")
    .select("type")
    .eq("user_id", clientId)
    .eq("mission_id", missionId)
    .in("type", ["reserve", "refund"])
  if (error) {
    console.error("[mission] lecture du grand livre impossible", error)
    return { error: true }
  }
  return { moved: (data ?? []).length > 0 }
}

/**
 * Annule une mission ouverte de façon atomique : la fonction SQL `wallet_cancel_mission` verrouille la
 * mission, exige le statut `open`, rembourse le reste réservé et passe la mission en `cancelled`
 * dans la même transaction. À appeler avec le client service role, après contrôle de propriété.
 * @returns {Promise<{ ok: true } | { ok: false, code: string | null }>}
 */
async function cancelMissionAtomic(service, clientId, missionId) {
  const cancel = await callWalletRpc(service, "wallet_cancel_mission", {
    p_mission_id: missionId,
    p_client_id:  clientId,
  })
  return cancel.ok ? { ok: true } : { ok: false, code: cancel.code }
}

/**
 * Retire une mission créée dont la réservation a échoué.
 * Aucun mouvement au grand livre : suppression (sinon annulation). La base refuse de supprimer
 * une mission qui a des mouvements : on l'annule alors de façon atomique (remboursement du reste
 * réservé et passage en `cancelled` dans la même transaction).
 * @returns {Promise<boolean>} false si la mission n'a pas pu être retirée proprement.
 */
async function discardMission(service, clientId, missionId) {
  const ledger = await ledgerHasMovements(service, clientId, missionId)
  if (ledger.error) return false

  if (!ledger.moved) {
    const { error } = await service.from("missions").delete().eq("id", missionId)
    if (!error) return true
    console.error("[createMission] suppression impossible, annulation", error)
  }

  const cancelled = await cancelMissionAtomic(service, clientId, missionId)
  if (!cancelled.ok) {
    console.error("[createMission] annulation impossible, mission conservée", cancelled)
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
  const { city, type, urgency, offset = 0 } = filters
  const limit = Math.min(Math.max(1, Number(filters.limit) || 20), 50)

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
  const { data: done, error: doneError } = await service
    .from("missions")
    .update({ status: "done" })
    .eq("id", missionId)
    .eq("client_id", user.id)
    .eq("status", "in_progress")
    .select("id")
  if (doneError || !done?.length) {
    console.error(
      "[confirmMission] ALERTE : fonds libérés mais statut done non enregistré, intervention manuelle requise",
      { missionId, error: doneError ?? null },
    )
    return { error: ERR_GENERIC }
  }

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
 * L'annulation est atomique côté SQL (`wallet_cancel_mission`) : verrou de la mission, statut `open`
 * exigé, remboursement du reste réservé et passage en `cancelled` dans la même transaction.
 * L'annulation d'une mission en cours est réservée à l'admin.
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
    .select("id, client_id")
    .eq("id", id)
    .maybeSingle()

  if (missionError || !mission || mission.client_id !== user.id) return { error: "Mission introuvable." }

  const cancelled = await cancelMissionAtomic(service, user.id, id)
  if (!cancelled.ok) {
    if (cancelled.code === "invalid_status") return { error: ERR_NOT_CANCELLABLE }
    if (cancelled.code === "forbidden") return { error: "Mission introuvable." }
    return { error: ERR_GENERIC }
  }

  revalidatePath("/client/missions/" + id)
  revalidatePath("/client/missions")

  return { success: true }
}
