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
import { isMissingCompletionColumn, readCompletionDeclared } from "./mission-completion-core"

const ERR_LOAD = "Les missions n'ont pas pu être chargées. Réessayez dans un instant."

// Colonnes publiques seulement. La date de déclaration de fin (`completion_declared_at`) n'est jamais dans ce
// select : elle est lue à part (lecture tolérante) pour que la liste se rende même colonne absente.
const COLUMNS =
  "id, title, type, city, budget, status, deadline, created_at, client_id, selected_student_id, profiles!client_id(full_name)"

// Un onglet impose un statut ; « à confirmer » = en cours avec une fin déclarée par l'étudiant.
function withTab(query, statut) {
  if (statut === "toutes") return query
  if (statut === "a-confirmer") return query.eq("status", "in_progress").not("completion_declared_at", "is", null)
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
  return withFilters(withTab(service.from("missions").select(COLUMNS), statut), params)
}

function countQuery(service, params, statut) {
  const base = service.from("missions").select("id", { count: "exact", head: true })
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
    // Colonne de déclaration absente (script 90 non appliqué) : l'onglet « à confirmer » compte 0 et reste vide.
    let toConfirmUnavailable = false
    MISSION_TABS.forEach((tab, index) => {
      const { error, count } = results[index]
      if (tab === "a-confirmer" && isMissingCompletionColumn(error)) {
        toConfirmUnavailable = true
        counts[tab] = 0
        return
      }
      if (error) throw new Error("Comptage impossible.")
      counts[tab] = count ?? 0
    })

    const total = counts[params.statut]
    const { page, pageCount } = clampPage(params.page, total)
    const from = (page - 1) * MISSIONS_ADMIN_PAGE_SIZE
    let missions = []
    if (!(params.statut === "a-confirmer" && toConfirmUnavailable)) {
      const { data, error } = await listQuery(service, params, params.statut)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + MISSIONS_ADMIN_PAGE_SIZE - 1)
      if (error) throw new Error("Lecture impossible.")
      missions = data ?? []
    }
    const declared = (await readCompletionDeclared(service, missions.map((m) => m.id))).byId
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
      awaitingConfirm: m.status === "in_progress" && Boolean(declared.get(m.id)),
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
