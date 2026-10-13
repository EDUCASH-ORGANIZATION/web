"use server"

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"
import { isPastDeadline, todayInBenin } from "@/lib/vitrine/dates"

const TABS = ["open", "in_progress", "done", "cancelled"]
// Plafond de lecture : un client n'a jamais autant de missions, la borne évite une lecture sans limite.
const MISSIONS_LIMIT = 500
const MISSION_COLUMNS = "id, title, type, city, budget, deadline, status, created_at, applications(id, student_id, status)"
const ERR_LOAD = "Impossible de charger vos missions."

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

// Onglet demandé : `onglet`, sinon les alias `tab` puis `status`. Toute valeur inconnue revient à « open ».
function resolveTab({ onglet, tab, status }) {
  for (const candidate of [onglet, tab, status]) {
    const value = firstValue(candidate)
    if (typeof value === "string" && TABS.includes(value)) return value
  }
  return "open"
}

// Recherche normalisée : texte seul, sans caractère de contrôle, bornée.
function normalizeSearch(raw) {
  const value = firstValue(raw)
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, SEARCH_MAX_LENGTH)
}

/**
 * Motif ILIKE littéral. \, %, _ et * (alias de % pour PostgREST) sont échappés par un antislash.
 * La virgule, les parenthèses et les guillemets, qui structurent une condition PostgREST, sont remplacés
 * par le joker d'un seul caractère : le motif ne contient plus aucun caractère de syntaxe et reste valable
 * même si la condition était un jour placée dans un `.or()`.
 */
function likePattern(text) {
  const escaped = text
    .replace(/[\\%_*]/g, (c) => `\\${c}`)
    .replace(/[,()"'`]/g, "_")
  return `%${escaped}%`
}

function toMission(row, today, reviewed) {
  const applications = Array.isArray(row.applications) ? row.applications : []
  const accepted = applications.find((a) => a.status === "accepted")
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    city: row.city ?? null,
    budget: row.budget ?? 0,
    deadline: row.deadline ?? null,
    status: row.status,
    createdAt: row.created_at,
    overdue: row.status === "open" && isPastDeadline(row.deadline, today),
    applicationsCount: applications.length,
    pendingCount: applications.filter((a) => a.status === "pending").length,
    studentId: accepted?.student_id ?? null,
    reviewed,
  }
}

// Échéance dépassée en tête, puis la plus récente d'abord (ordre de lecture conservé).
function sortMissions(missions) {
  return [...missions].sort((a, b) => Number(b.overdue) - Number(a.overdue))
}

/**
 * Missions du client connecté pour l'onglet demandé, avec les compteurs des quatre statuts.
 * `requireRole(["client"])` d'abord. Les compteurs, comme la liste, tiennent compte de la recherche `q`.
 *
 * @param {{ onglet?: string, tab?: string, status?: string, q?: string }} [params] valeurs brutes de l'URL
 * @returns {Promise<
 *   { error: string } |
 *   { onglet: string, q: string, today: string,
 *     counts: { open: number, in_progress: number, done: number, cancelled: number }, total: number,
 *     missions: Array<{ id: string, title: string, type: string, city: string|null, budget: number,
 *       deadline: string|null, status: string, createdAt: string, overdue: boolean,
 *       applicationsCount: number, pendingCount: number, studentId: string|null, reviewed: boolean }> }
 * >}
 */
export async function getClientMissions(params = {}) {
  try {
    const auth = await requireRole(["client"])
    if (auth.error) return { error: auth.error }
    const { supabase, user } = auth

    const onglet = resolveTab(params ?? {})
    const q = normalizeSearch(params?.q)
    const today = todayInBenin()

    let query = supabase.from("missions").select(MISSION_COLUMNS).eq("client_id", user.id)
    if (q) query = query.ilike("title", likePattern(q))
    const { data, error } = await query.order("created_at", { ascending: false }).limit(MISSIONS_LIMIT)
    if (error) {
      console.error("[getClientMissions]", error.message)
      return { error: ERR_LOAD }
    }

    const rows = Array.isArray(data) ? data : []
    const counts = { open: 0, in_progress: 0, done: 0, cancelled: 0 }
    for (const row of rows) if (row.status in counts) counts[row.status] += 1
    const current = rows.filter((row) => row.status === onglet)

    // Avis déjà donné : lu seulement pour l'onglet Terminées, borné aux missions affichées.
    let reviewedIds = new Set()
    if (onglet === "done" && current.length > 0) {
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("mission_id")
        .eq("reviewer_id", user.id)
        .in("mission_id", current.map((row) => row.id))
      if (reviewsError) {
        console.error("[getClientMissions] reviews", reviewsError.message)
        return { error: ERR_LOAD }
      }
      reviewedIds = new Set((reviews ?? []).map((r) => r.mission_id))
    }

    return {
      onglet,
      q,
      today,
      counts,
      total: counts.open + counts.in_progress + counts.done + counts.cancelled,
      missions: sortMissions(current.map((row) => toMission(row, today, reviewedIds.has(row.id)))),
    }
  } catch (err) {
    unstable_rethrow(err)
    console.error("[getClientMissions]", err)
    return { error: ERR_LOAD }
  }
}
