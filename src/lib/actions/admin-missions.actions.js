"use server"

import { todayInBenin } from "@/lib/vitrine/dates"
import { escapeLike } from "@/lib/student-space/explore-query"
import {
  MISSIONS_ADMIN_PAGE_SIZE,
  MISSION_TABS,
  clampPage,
  parseMissionsParams,
} from "@/lib/admin-space/missions"
import { inChunks, requireAdminService } from "./admin-context"

const ERR_LOAD = "Les missions n'ont pas pu être chargées. Réessayez dans un instant."

// Colonnes publiques seulement ; la fin enregistrée est lue par la relation 1-1 `mission_completions`.
const COLUMNS =
  "id, title, type, city, budget, status, deadline, created_at, client_id, selected_student_id, " +
  "profiles!client_id(full_name), mission_completions(mission_id)"

// Un onglet impose un statut ; « à confirmer » = en cours avec une fin enregistrée (jointure interne).
function withTab(query, statut) {
  if (statut === "toutes") return query
  if (statut === "a-confirmer") return query.eq("status", "in_progress")
  return query.eq("status", statut)
}

// Filtres communs (titre, ville, type) : une colonne par condition, jamais de `.or()` avec une saisie.
function withFilters(query, { q, ville, type }) {
  let out = query
  if (q) out = out.ilike("title", `%${escapeLike(q)}%`)
  if (ville) out = out.eq("city", ville)
  if (type) out = out.eq("type", type)
  return out
}

function listQuery(service, params, statut) {
  const select =
    statut === "a-confirmer"
      ? COLUMNS.replace("mission_completions(mission_id)", "mission_completions!inner(mission_id)")
      : COLUMNS
  return withFilters(withTab(service.from("missions").select(select), statut), params)
}

function countQuery(service, params, statut) {
  const select = statut === "a-confirmer" ? "id, mission_completions!inner(mission_id)" : "id"
  const base = service.from("missions").select(select, { count: "exact", head: true })
  return withFilters(withTab(base, statut), params)
}

async function readStudentNames(service, ids) {
  const names = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("profiles").select("user_id, full_name").in("user_id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) names.set(row.user_id, row.full_name ?? "")
  }
  return names
}

function completionOf(row) {
  const value = row.mission_completions
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

/**
 * Liste des missions pour l'admin (AD06), lecture seule : onglets par statut avec compteurs, recherche par titre,
 * filtres ville et type, pagination serveur (25 par page, page hors limites ramenée à la dernière).
 * @param {{ q?: string, statut?: string, ville?: string, type?: string, page?: number|string }} [rawParams]
 */
export async function listAdminMissions(rawParams = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const params = parseMissionsParams(rawParams)
  try {
    const counts = {}
    const results = await Promise.all(MISSION_TABS.map((tab) => countQuery(service, params, tab)))
    MISSION_TABS.forEach((tab, index) => {
      if (results[index].error) throw new Error("Comptage impossible.")
      counts[tab] = results[index].count ?? 0
    })

    const total = counts[params.statut]
    const { page, pageCount } = clampPage(params.page, total)
    const from = (page - 1) * MISSIONS_ADMIN_PAGE_SIZE
    const { data, error } = await listQuery(service, params, params.statut)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + MISSIONS_ADMIN_PAGE_SIZE - 1)
    if (error) throw new Error("Lecture impossible.")

    const missions = data ?? []
    const students = await readStudentNames(service, missions.map((m) => m.selected_student_id))
    const rows = missions.map((m) => ({
      id: m.id,
      title: m.title ?? "",
      type: m.type,
      city: m.city ?? null,
      budget: Number(m.budget) || 0,
      status: m.status,
      deadline: m.deadline ?? null,
      createdAt: m.created_at,
      clientId: m.client_id,
      clientName: m.profiles?.full_name ?? "",
      studentId: m.selected_student_id ?? null,
      studentName: m.selected_student_id ? (students.get(m.selected_student_id) ?? "") : "",
      awaitingConfirm: m.status === "in_progress" && completionOf(m),
    }))

    return {
      statut: params.statut,
      q: params.q,
      ville: params.ville,
      type: params.type,
      page,
      pageCount,
      total,
      counts,
      rows,
      today: todayInBenin(),
    }
  } catch (err) {
    console.error("[admin-missions] lecture:", err?.message)
    return { error: ERR_LOAD }
  }
}
