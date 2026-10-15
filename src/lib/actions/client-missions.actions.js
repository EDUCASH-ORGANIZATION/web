"use server"

import { unstable_rethrow } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { SEARCH_MAX_LENGTH } from "@/lib/constants/missions"
import { isPastDeadline, todayInBenin } from "@/lib/vitrine/dates"

const TABS = ["open", "in_progress", "done", "cancelled"]
// Plafond de la liste de l'onglet courant : un client n'a jamais autant de missions, la borne évite une
// lecture sans limite. Les compteurs d'onglets, eux, sont exacts (requêtes `count` séparées, sans plafond).
const MISSIONS_LIMIT = 500
const MISSION_COLUMNS =
  "id, title, type, city, budget, deadline, status, created_at, purchases_estimate, applications(id, student_id, status)"
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
  // Array.from découpe par point de code : une paire de substitution (emoji) n'est jamais coupée en deux.
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, SEARCH_MAX_LENGTH).join("")
}

/**
 * Motif ILIKE littéral. \, % et _ sont échappés par un antislash.
 * L'étoile (PostgREST la transforme en %), la virgule, les parenthèses et les guillemets, qui structurent
 * une condition PostgREST, sont remplacés par le joker d'un seul caractère : le motif ne contient plus
 * aucun caractère de syntaxe et reste valable même si la condition était un jour placée dans un `.or()`.
 */
function likePattern(text) {
  const escaped = text
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[*,()"'`]/g, "_")
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
    // Présent seulement pour une mission avec achats (estimation positive) : pastille « Avec achats ».
    ...(purchasesEstimateOf(row.purchases_estimate) !== null ? { withPurchases: true } : {}),
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

    const pattern = q ? likePattern(q) : null
    const filtered = (builder) => (pattern ? builder.ilike("title", pattern) : builder)
    const countOf = (status) =>
      filtered(supabase.from("missions").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", status))
    const [listRes, ...countRes] = await Promise.all([
      filtered(supabase.from("missions").select(MISSION_COLUMNS).eq("client_id", user.id).eq("status", onglet))
        .order("created_at", { ascending: false })
        .limit(MISSIONS_LIMIT),
      ...TABS.map(countOf),
    ])
    const failed = [listRes, ...countRes].find((res) => res.error)
    if (failed) {
      console.error("[getClientMissions]", failed.error.message)
      return { error: ERR_LOAD }
    }

    const current = Array.isArray(listRes.data) ? listRes.data : []
    const counts = Object.fromEntries(TABS.map((tab, i) => [tab, Number(countRes[i].count) || 0]))

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
