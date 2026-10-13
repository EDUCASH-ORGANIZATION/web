"use server"

// Lectures de la page Publier une mission (C03). Toute action commence par requireRole(["client"]) :
// le layout ne protège ni les navigations côté client ni les server actions.
// - `getDuplicatePrefill` : ne lit QUE une mission du client connecté (filtre sur client_id) ; une mission d'un
//   autre client, un identifiant invalide ou une lecture en erreur donnent `null`, sans rien révéler.
// - `getPublishPage` : solde disponible (information seulement : le serveur de `createMission` reste l'autorité
//   au moment de publier) et mission à dupliquer. Un solde illisible n'empêche pas de rédiger.
// Aucune écriture ici : la publication passe par `createMission`, inchangée.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getWallet } from "@/lib/actions/wallet.actions"
import { duplicateValues, parseDuplicateId } from "@/lib/client-space/publish-schema"

const ERR_PAGE = "Impossible de charger la publication de mission."

// Colonnes lues : celles que l'on reprend, rien de plus.
const DUPLICATE_COLUMNS = "title, description, type, city, budget, urgency"

async function readDuplicate(supabase, userId, rawId) {
  const id = parseDuplicateId(rawId)
  if (!id) return null
  const { data, error } = await supabase
    .from("missions")
    .select(DUPLICATE_COLUMNS)
    .eq("id", id)
    .eq("client_id", userId)
    .maybeSingle()
  if (error) {
    console.error("[getDuplicatePrefill]", error.message)
    return null
  }
  return data ? duplicateValues(data) : null
}

/**
 * Valeurs d'une mission du client connecté, pour préremplir une nouvelle publication
 * (titre, description, type, ville, budget, urgence ; jamais l'échéance).
 * @param {string} id Identifiant de la mission (UUID)
 * @returns {Promise<Partial<import("@/lib/client-space/publish-schema").PublishValues> | null>}
 */
export async function getDuplicatePrefill(id) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return null
    return await readDuplicate(auth.supabase, auth.user.id, id)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getDuplicatePrefill]", err)
    return null
  }
}

/**
 * Données de la page : solde disponible (`null` si illisible) et mission dupliquée (`null` si absente,
 * étrangère au client ou invalide).
 * @param {{ duplicate?: string }} [params]
 * @returns {Promise<{ data: { available: number|null, duplicate: object|null } } | { error: string }>}
 */
export async function getPublishPage({ duplicate } = {}) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: ERR_PAGE }
    const { supabase, user } = auth
    const [walletRes, dup] = await Promise.all([getWallet(user.id), readDuplicate(supabase, user.id, duplicate)])
    const available = walletRes?.error ? null : Number(walletRes?.available)
    return { data: { available: Number.isFinite(available) ? available : null, duplicate: dup } }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getPublishPage]", err)
    return { error: ERR_PAGE }
  }
}
