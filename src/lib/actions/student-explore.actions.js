// @ds-screen RD-STUDENT-01
"use server"

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { getMyProfile, getMyStudentProfile } from "@/lib/actions/profile.actions"
import { escrowSplit } from "@/lib/app/money"
import { notExpiredFilter, parseExploreParams } from "@/lib/student-space/explore-query"
import { verificationView } from "@/lib/student-space/verification-status"
import { MISSIONS_PAGE_SIZE } from "@/lib/constants/missions"

const MISSION_COLUMNS = "id, title, type, city, budget, urgency, deadline, created_at"
const ERR_LOAD = "Impossible de charger les missions."

// PostgREST : page au-delà du dernier résultat, traitée comme une liste vide.
const OUT_OF_RANGE = "PGRST103"

// Statut de vérification de l'étudiant connecté, pour la note de la page. Les colonnes privées sont lues par les
// lectures de profile.actions.js (service role côté serveur) ; seul le statut calculé est renvoyé, jamais une
// colonne brute. Lecture en échec : null (la note est alors masquée, la liste reste utilisable).
async function readVerification() {
  try {
    const [profileRes, studentRes] = await Promise.all([getMyProfile(), getMyStudentProfile()])
    if (profileRes.error || studentRes.error || !profileRes.profile) {
      console.error("[getStudentExplore] vérification", profileRes.error ?? studentRes.error ?? "profil introuvable")
      return null
    }
    const { profile, studentProfile } = { profile: profileRes.profile, studentProfile: studentRes.studentProfile }
    const view = verificationView({
      isVerified: profile.is_verified === true,
      verifiedUntil: profile.verified_until ?? null,
      hasCard: Boolean(studentProfile?.card_url),
      rejectionReason: profile.rejection_reason ?? null,
    })
    return { key: view.key, label: view.label, canApply: view.canApply, action: view.action }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentExplore] vérification", err)
    return null
  }
}

/**
 * Missions ouvertes et non expirées pour l'explorateur de l'étudiant (E02).
 * `requireRole(["student"])` d'abord. Les paramètres de l'URL passent par `parseExploreParams` : toute valeur
 * hors liste est ignorée, la recherche est échappée (%, _, \, virgule, parenthèses ; `*` reste un joker accepté) avant le motif ILIKE.
 *
 * @param {Record<string, string | string[] | undefined>} [params] valeurs brutes de l'URL
 * @returns {Promise<
 *   { error: string } |
 *   { filters: { q: string, type: string, cities: string[], urgency: string, budget: string, sort: string, page: number },
 *     hasFilter: boolean, total: number, pageSize: number,
 *     verification: { key: string, label: string, canApply: boolean, action: { label: string, href: string } | null } | null,
 *     missions: Array<{ id: string, title: string, type: string, city: string|null, budget: number, net: number,
 *       urgent: boolean, deadline: string|null, applicationStatus: "pending"|"accepted"|"rejected"|null }> }
 * >}
 */
export async function getStudentExplore(params = {}) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  try {
    const query = parseExploreParams(params)

    let builder = supabase
      .from("missions")
      .select(MISSION_COLUMNS, { count: "exact" })
      .eq("status", "open")
      .or(notExpiredFilter())

    if (query.likePattern) builder = builder.ilike("title", query.likePattern)
    if (query.type) builder = builder.eq("type", query.type)
    if (query.cities.length === 1) builder = builder.eq("city", query.cities[0])
    else if (query.cities.length > 1) builder = builder.in("city", query.cities)
    if (query.urgencyValue) builder = builder.eq("urgency", query.urgencyValue)
    if (query.budgetRange) {
      builder = builder.gte("budget", query.budgetRange.min)
      if (query.budgetRange.max !== undefined) builder = builder.lte("budget", query.budgetRange.max)
    }
    builder = builder
      .order(query.order.column, { ascending: query.order.ascending })
      .order("created_at", { ascending: false })
      .range(query.range.from, query.range.to)

    const [listRes, verification] = await Promise.all([builder, readVerification()])
    const outOfRange = listRes.error?.code === OUT_OF_RANGE
    if (listRes.error && !outOfRange) {
      console.error("[getStudentExplore]", listRes.error.message)
      return { error: ERR_LOAD }
    }

    const rows = outOfRange || !Array.isArray(listRes.data) ? [] : listRes.data

    // Candidatures de l'étudiant sur les missions de la page : une carte déjà postulée garde sa place avec son statut.
    const applied = new Map()
    if (rows.length > 0) {
      const { data: applications, error: applicationsError } = await supabase
        .from("applications")
        .select("mission_id, status")
        .eq("student_id", user.id)
        .in("mission_id", rows.map((row) => row.id))
      if (applicationsError) console.error("[getStudentExplore] candidatures", applicationsError.message)
      for (const application of applications ?? []) applied.set(application.mission_id, application.status)
    }

    return {
      filters: {
        q: query.q,
        type: query.type,
        cities: query.cities,
        urgency: query.urgency,
        budget: query.budget,
        sort: query.sort,
        page: query.page,
      },
      hasFilter: query.hasFilter,
      total: outOfRange ? 0 : Number(listRes.count) || 0,
      pageSize: MISSIONS_PAGE_SIZE,
      verification,
      missions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        city: row.city ?? null,
        budget: row.budget ?? 0,
        net: escrowSplit(row.budget).student,
        urgent: row.urgency === "high",
        deadline: row.deadline ?? null,
        applicationStatus: applied.get(row.id) ?? null,
      })),
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getStudentExplore]", err)
    return { error: ERR_LOAD }
  }
}
