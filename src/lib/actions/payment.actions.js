"use server"

import { getCurrentUser } from "@/lib/actions/auth.actions"
import { createClient } from "@/lib/supabase/server"

/**
 * Initie un paiement FedaPay pour une mission terminée.
 * @param {{ missionId: string }} params
 * @returns {Promise<{ paymentUrl: string } | { error: string }>}
 */
export async function initiatePayment({ missionId }) {
  const user = await getCurrentUser()
  if (!user) return { error: "Non authentifié" }

  const supabase = await createClient()

  // 1. Charge la mission avec le profil de l'étudiant retenu
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("*, profiles!selected_student_id(user_id, full_name)")
    .eq("id", missionId)
    .eq("client_id", user.id)
    .single()

  if (missionError || !mission) {
    return { error: "Mission introuvable ou accès refusé." }
  }

  if (!mission.selected_student_id) {
    return { error: "Aucun étudiant sélectionné pour cette mission." }
  }

  if (mission.status !== "in_progress") {
    return { error: "La mission doit être en cours pour procéder au paiement." }
  }

  // 2. Crée l'entrée dans transactions (status = 'pending')
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      mission_id: missionId,
      client_id: user.id,
      student_id: mission.selected_student_id,
      amount_total: mission.budget,
      commission: mission.budget * 0.12,
      amount_student: mission.budget * 0.88,
      status: "pending",
    })
    .select()
    .single()

  if (txError || !transaction) {
    console.error("Transaction insert error:", txError)
    return { error: "Impossible de créer la transaction." }
  }

  // 3. Appelle l'Edge Function pour créer la transaction FedaPay
  const { data: fnData, error: fnError } = await supabase.functions.invoke(
    "create-fedapay-transaction",
    {
      body: {
        missionId,
        amount: mission.budget,
        clientId: user.id,
        studentId: mission.selected_student_id,
        transactionId: transaction.id,
      },
    }
  )

  if (fnError || !fnData?.payment_url) {
    console.error("Edge function error:", fnError, fnData)
    // Nettoie la transaction pending si l'Edge Function échoue
    await supabase.from("transactions").delete().eq("id", transaction.id)
    return { error: fnData?.error || "Erreur lors de la création du paiement FedaPay." }
  }

  // 4. Met à jour la transaction avec l'id FedaPay
  await supabase
    .from("transactions")
    .update({ fedapay_id: String(fnData.fedapay_id) })
    .eq("id", transaction.id)

  return { paymentUrl: fnData.payment_url }
}
