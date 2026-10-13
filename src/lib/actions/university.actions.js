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
