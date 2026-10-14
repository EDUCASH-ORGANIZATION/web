"use server"

// Plafonds de lecture connus :
// - 100 missions en cours au plus (ACTIVE_LIMIT) et 20 missions terminées récentes (DONE_LIMIT) pour
//   « avis à laisser » : une mission terminée plus ancienne sans avis n'y figure pas ;
// - les messages non lus sont comptés exactement, mais seuls les 100 plus récents servent à désigner
//   la conversation à ouvrir ;
// - les gains du mois sont lus par pages de 1000 lignes (plafond PostgREST), 5 pages au plus ; au-delà ou
//   en cas d'erreur, la valeur est `null` (la ligne n'est pas affichée : jamais un faux 0).

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getWallet } from "@/lib/actions/wallet.actions"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { escrowSplit } from "@/lib/app/money"
import { todayInBenin } from "@/lib/app/format"
import { firstName } from "@/lib/vitrine/public-name"
import { verificationView } from "@/lib/student-space/verification-status"

const ERR_DASHBOARD = "Impossible de charger votre tableau de bord."

const ACTIVE_LIMIT = 100
const DONE_LIMIT = 20
const UNREAD_LIMIT = 100
const LEDGER_PAGE_SIZE = 1000
const LEDGER_MAX_PAGES = 5

/**
 * @typedef {Object} StudentDashboardData
 * @property {string} firstName Prénom de l'étudiant, "" si inconnu
 * @property {{ available: number, escrowToCome: number, earnedThisMonth: number|null }} wallet
 *   `escrowToCome` : somme de la part nette (escrowSplit) des missions en cours ; `earnedThisMonth` : `release` du mois
 * @property {import("@/lib/student-space/verification-status").VerificationView} verification Statut calculé seulement
 *   (jamais la carte, le motif de refus ni la date de dépôt)
 * @property {Array<{ id: string, title: string, clientName: string, budget: number }>} inProgress Missions en cours
 * @property {Array<{ missionId: string, title: string, clientName: string, count: number }>} unread Messages non lus
 *   d'un client, une entrée par mission en cours, le plus récent d'abord
 * @property {{ count: number, lastAt: string|null }} pendingApplications
 * @property {{ value: number, reviewsCount: number }} rating
 * @property {Array<{ id: string, title: string, clientName: string }>} toReview Missions terminées sans avis de l'étudiant
 * @property {boolean} hasActivity Au moins une candidature ou une mission (faux : nouvel inscrit)
 */

/** Gains du mois : somme des `release` (net de l'étudiant) depuis le 1er du mois au Bénin. */
async function readEarnedThisMonth(supabase, userId, today) {
  const since = `${today.slice(0, 7)}-01T00:00:00+01:00`
  let total = 0
  for (let page = 0; page < LEDGER_MAX_PAGES; page++) {
    const from = page * LEDGER_PAGE_SIZE
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "release")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + LEDGER_PAGE_SIZE - 1)
    if (error) {
      console.error("[getStudentDashboard] gains du mois", error.message)
      return null
    }
    const rows = data ?? []
    for (const row of rows) total += Math.abs(Number(row.amount ?? 0))
    if (!Number.isFinite(total)) return null
    if (rows.length < LEDGER_PAGE_SIZE) return total
  }
  return null
}

/**
 * Données du tableau de bord étudiant : portefeuille, statut de vérification, missions en cours, messages non lus,
 * candidatures en attente, note, avis à laisser. Réservé au rôle étudiant (`requireRole`), colonnes explicites
 * (jamais de `select("*")` sur les profils), aucune donnée d'un autre étudiant, erreurs neutres.
 * Les colonnes privées (carte, motif de refus) sont lues côté serveur (service role) par `getMyProfile` et
 * `getMyStudentProfile` après le contrôle du rôle, puis réduites à un statut calculé avant de sortir de l'action.
 * @returns {Promise<{ data: StudentDashboardData } | { error: string }>}
 */
export async function getStudentDashboard() {
  try {
    const auth = await requireRole(["student"])
    if (auth.error) return { error: ERR_DASHBOARD }
    const { supabase, user, profile } = auth
    const today = todayInBenin()

    const [progressRes, doneRes, pendingRes, appsTotalRes, reviewsCountRes, unreadRes, ratingRes, privateRes, cardRes, walletRes, earned] =
      await Promise.all([
        supabase
          .from("missions")
          .select("id, title, budget, client_id")
          .eq("selected_student_id", user.id)
          .eq("status", "in_progress")
          .order("updated_at", { ascending: false })
          .limit(ACTIVE_LIMIT),
        supabase
          .from("missions")
          .select("id, title, client_id")
          .eq("selected_student_id", user.id)
          .eq("status", "done")
          .order("updated_at", { ascending: false })
          .limit(DONE_LIMIT),
        supabase
          .from("applications")
          .select("created_at", { count: "exact" })
          .eq("student_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("student_id", user.id),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("reviewed_id", user.id),
        supabase
          .from("messages")
          .select("mission_id, created_at", { count: "exact" })
          .eq("receiver_id", user.id)
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(UNREAD_LIMIT),
        supabase.from("profiles").select("rating").eq("user_id", user.id).maybeSingle(),
        getMyProfile(),
        getMyStudentProfile(),
        getWallet(user.id),
        readEarnedThisMonth(supabase, user.id, today),
      ])

    for (const res of [progressRes, doneRes, pendingRes, appsTotalRes, reviewsCountRes, unreadRes, ratingRes]) {
      if (res.error) {
        console.error("[getStudentDashboard]", res.error.message)
        return { error: ERR_DASHBOARD }
      }
    }
    // Colonnes privées : lues par les lectures serveur de profile.actions (service role, filtre sur la session).
    if (privateRes.error || cardRes.error) return { error: ERR_DASHBOARD }
    // Un solde illisible ne se remplace pas par 0 : l'écran passe en erreur.
    if (walletRes.error) return { error: ERR_DASHBOARD }

    const inProgress = progressRes.data ?? []
    const done = doneRes.data ?? []
    const doneIds = done.map((m) => m.id)
    const clientIds = [...new Set([...inProgress, ...done].map((m) => m.client_id).filter(Boolean))]

    const [reviewedRes, namesRes] = await Promise.all([
      doneIds.length > 0
        ? supabase.from("reviews").select("mission_id").eq("reviewer_id", user.id).in("mission_id", doneIds)
        : { data: [], error: null },
      clientIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds)
        : { data: [], error: null },
    ])
    for (const res of [reviewedRes, namesRes]) {
      if (res.error) {
        console.error("[getStudentDashboard]", res.error.message)
        return { error: ERR_DASHBOARD }
      }
    }

    const names = new Map((namesRes.data ?? []).map((p) => [p.user_id, p.full_name]))
    const clientName = (id) => firstName(names.get(id), { fallback: "votre client" })
    const reviewed = new Set((reviewedRes.data ?? []).map((r) => r.mission_id))

    // Messages non lus rattachés à une mission en cours de l'étudiant : une entrée par mission, la plus récente d'abord.
    const progressById = new Map(inProgress.map((m) => [m.id, m]))
    const unreadByMission = new Map()
    for (const msg of unreadRes.data ?? []) {
      if (!progressById.has(msg.mission_id)) continue
      unreadByMission.set(msg.mission_id, (unreadByMission.get(msg.mission_id) ?? 0) + 1)
    }

    const privateRow = privateRes.profile ?? {}
    const verification = verificationView(
      {
        isVerified: privateRow.is_verified === true,
        verifiedUntil: privateRow.verified_until ?? null,
        hasCard: Boolean(cardRes.studentProfile?.card_url),
        rejectionReason: privateRow.rejection_reason ?? null,
      },
      today,
    )

    return {
      data: {
        firstName: firstName(profile?.full_name, { fallback: "" }),
        wallet: {
          available: Number(walletRes.available) || 0,
          escrowToCome: inProgress.reduce((sum, m) => sum + escrowSplit(m.budget).student, 0),
          earnedThisMonth: earned,
        },
        verification,
        inProgress: inProgress.map((m) => ({
          id: m.id,
          title: m.title,
          clientName: clientName(m.client_id),
          budget: Number(m.budget) || 0,
        })),
        unread: [...unreadByMission].map(([missionId, count]) => {
          const mission = progressById.get(missionId)
          return { missionId, title: mission.title, clientName: clientName(mission.client_id), count }
        }),
        pendingApplications: {
          count: pendingRes.count ?? 0,
          lastAt: pendingRes.data?.[0]?.created_at ?? null,
        },
        rating: { value: Number(ratingRes.data?.rating) || 0, reviewsCount: reviewsCountRes.count ?? 0 },
        toReview: done
          .filter((m) => !reviewed.has(m.id))
          .map((m) => ({ id: m.id, title: m.title, clientName: clientName(m.client_id) })),
        hasActivity: (appsTotalRes.count ?? 0) > 0 || inProgress.length > 0 || done.length > 0,
      },
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentDashboard]", err)
    return { error: ERR_DASHBOARD }
  }
}
