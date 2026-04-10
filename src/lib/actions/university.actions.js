"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Charge toutes les universités actives, triées par nom.
 *
 * @returns {Promise<Array<{ id: string, name: string, short_name: string|null, city: string|null }>>}
 */
export async function getUniversities() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("universities")
    .select("id, name, short_name, city")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    console.error("[getUniversities]", error.message)
    return []
  }

  return data ?? []
}

/**
 * Déclenche la vérification des badges expirés via une fonction SQL RPC.
 * À appeler depuis un cron ou depuis le dashboard admin.
 *
 * La fonction SQL `check_verification_expiry` doit être créée dans Supabase :
 *   - Repasse is_verified = false pour tout étudiant dont le badge a
 *     expiré (verified_at + VERIFICATION_VALIDITY_DAYS < now())
 *
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function checkExpiredVerifications() {
  const supabase = await createClient()

  const { error } = await supabase.rpc("check_verification_expiry")

  if (error) {
    console.error("[checkExpiredVerifications]", error.message)
    return { error: error.message }
  }

  return { success: true }
}
