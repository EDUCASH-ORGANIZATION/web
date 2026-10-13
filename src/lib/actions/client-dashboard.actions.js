"use server"

// Plafonds de lecture connus (documentés aussi dans .agents/tasks/RD-CLIENT-01/plan.md, « Limites connues ») :
// - 100 missions actives au plus (ACTIVE_LIMIT), les plus récentes d'abord ;
// - 20 missions terminées récentes au plus (DONE_LIMIT) pour « avis à laisser » : une mission plus ancienne
//   sans avis n'y figure pas ;
// - les candidatures en attente sont lues en une requête, soumise au plafond PostgREST de 1000 lignes
//   (max-rows) : au-delà, les compteurs par mission peuvent être sous-estimés. Un comptage exact ne
//   conviendrait pas : il faut le nombre ET la plus ancienne date par mission, d'où la lecture des lignes.

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getWallet } from "@/lib/actions/wallet.actions"
import { firstName } from "@/lib/vitrine/public-name"

const ERR_DASHBOARD = "Impossible de charger votre tableau de bord."

// Bornes de lecture : un client a rarement plus de quelques missions actives en même temps.
const ACTIVE_LIMIT = 100
const DONE_LIMIT = 20

const byId = (rows, key) => new Map((rows ?? []).map((row) => [row[key], row]))

/**
 * @typedef {Object} DashboardMission
 * @property {string} id
 * @property {string} title
 * @property {"open"|"in_progress"} status
 * @property {number} budget Budget en séquestre (FCFA)
 * @property {string|null} deadline "AAAA-MM-JJ"
 * @property {string} createdAt
 * @property {string|null} studentName Prénom de l'étudiant retenu (mission en cours)
 * @property {number} pendingCount Candidatures en attente (missions ouvertes)
 * @property {string|null} oldestPendingAt Date de la plus ancienne candidature en attente
 *
 * @typedef {Object} DashboardData
 * @property {string} firstName Prénom du client, "" si inconnu
 * @property {{ available: number, escrow: number }} wallet
 * @property {number} totalMissions Toutes missions confondues (0 : nouveau client)
 * @property {DashboardMission[]} active Missions ouvertes et en cours, les plus récentes d'abord
 * @property {Array<{ id: string, title: string, studentName: string|null }>} toReview Missions terminées sans avis du client
 */

/**
 * Données du tableau de bord client : portefeuille, missions actives avec candidatures en attente,
 * missions terminées sans avis du client. Réservé au rôle client (`requireRole`), colonnes publiques
 * seulement (jamais de téléphone ni de `select("*")` sur les profils), erreurs neutres.
 * @returns {Promise<{ data: DashboardData } | { error: string }>}
 */
export async function getClientDashboard() {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: ERR_DASHBOARD }
    const { supabase, user, profile } = auth

    const [activeRes, totalRes, doneRes, walletRes] = await Promise.all([
      supabase
        .from("missions")
        .select("id, title, status, budget, deadline, created_at, selected_student_id")
        .eq("client_id", user.id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(ACTIVE_LIMIT),
      supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
      supabase
        .from("missions")
        .select("id, title, selected_student_id, updated_at")
        .eq("client_id", user.id)
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(DONE_LIMIT),
      getWallet(user.id),
    ])

    for (const res of [activeRes, totalRes, doneRes]) {
      if (res.error) {
        console.error("[getClientDashboard]", res.error.message)
        return { error: ERR_DASHBOARD }
      }
    }
    // Un solde illisible ne se remplace pas par 0 : l'écran passe en erreur.
    if (walletRes.error) return { error: ERR_DASHBOARD }

    const active = activeRes.data ?? []
    const done = doneRes.data ?? []
    const openIds = active.filter((m) => m.status === "open").map((m) => m.id)
    const doneIds = done.map((m) => m.id)
    const studentIds = [...new Set([...active, ...done].map((m) => m.selected_student_id).filter(Boolean))]

    const [pendingRes, reviewsRes, namesRes] = await Promise.all([
      openIds.length > 0
        ? supabase.from("applications").select("mission_id, created_at").eq("status", "pending").in("mission_id", openIds)
        : { data: [], error: null },
      doneIds.length > 0
        ? supabase.from("reviews").select("mission_id").eq("reviewer_id", user.id).in("mission_id", doneIds)
        : { data: [], error: null },
      studentIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", studentIds)
        : { data: [], error: null },
    ])
    for (const res of [pendingRes, reviewsRes, namesRes]) {
      if (res.error) {
        console.error("[getClientDashboard]", res.error.message)
        return { error: ERR_DASHBOARD }
      }
    }

    const names = byId(namesRes.data, "user_id")
    const studentName = (id) => (id ? firstName(names.get(id)?.full_name, { fallback: "" }) || null : null)

    const pendingByMission = new Map()
    for (const app of pendingRes.data ?? []) {
      const cur = pendingByMission.get(app.mission_id) ?? { count: 0, oldest: null }
      cur.count += 1
      if (!cur.oldest || app.created_at < cur.oldest) cur.oldest = app.created_at
      pendingByMission.set(app.mission_id, cur)
    }
    const reviewed = new Set((reviewsRes.data ?? []).map((r) => r.mission_id))

    return {
      data: {
        firstName: firstName(profile?.full_name, { fallback: "" }),
        wallet: {
          available: Number(walletRes.available) || 0,
          escrow: Number(walletRes.wallet?.reserved) || 0,
        },
        totalMissions: totalRes.count ?? 0,
        active: active.map((m) => {
          const pending = pendingByMission.get(m.id)
          return {
            id: m.id,
            title: m.title,
            status: m.status,
            budget: Number(m.budget) || 0,
            deadline: m.deadline ?? null,
            createdAt: m.created_at,
            studentName: m.status === "in_progress" ? studentName(m.selected_student_id) : null,
            pendingCount: pending?.count ?? 0,
            oldestPendingAt: pending?.oldest ?? null,
          }
        }),
        toReview: done
          .filter((m) => !reviewed.has(m.id))
          .map((m) => ({ id: m.id, title: m.title, studentName: studentName(m.selected_student_id) })),
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getClientDashboard]", err)
    return { error: ERR_DASHBOARD }
  }
}
