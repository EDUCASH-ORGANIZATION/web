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

// Vrai si la colonne existe, faux si elle manque ; toute autre erreur est levée.
async function probeDeclarationColumn(service) {
  const { error } = await service.from("missions").select("completion_declared_at").limit(1)
  if (isMissingCompletionColumn(error)) {
    console.error("[admin-missions] colonne completion_declared_at absente", error.code)
    return false
  }
  if (error) throw new Error("Lecture impossible.")
  return true
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
    // Sonde GET (renvoie un corps, donc le code d'erreur) : une requête HEAD en erreur n'a pas de corps et ne
    // permettrait pas de reconnaître la colonne absente. Lancée en parallèle des compteurs qui n'en dépendent pas.
    const probe = probeDeclarationColumn(service)
    const independent = MISSION_TABS.filter((tab) => tab !== "a-confirmer")
    const independentCounts = Promise.all(independent.map((tab) => countQuery(service, params, tab)))
    const available = await probe

    // Colonne absente (script 90 non appliqué) : « à confirmer » compte 0 et reste vide, sans requête sur la colonne.
    const toConfirmResult = available ? await countQuery(service, params, "a-confirmer") : { count: 0, error: null }
    const results = await independentCounts
    const counts = {}
    for (const tab of MISSION_TABS) {
      const result = tab === "a-confirmer" ? toConfirmResult : results[independent.indexOf(tab)]
      if (result.error) throw new Error("Comptage impossible.")
      counts[tab] = result.count ?? 0
    }

    const total = counts[params.statut]
    const { page, pageCount } = clampPage(params.page, total)
    const from = (page - 1) * MISSIONS_ADMIN_PAGE_SIZE
    let missions = []
    if (!(params.statut === "a-confirmer" && !available)) {
      const { data, error } = await listQuery(service, params, params.statut)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + MISSIONS_ADMIN_PAGE_SIZE - 1)
      if (error) throw new Error("Lecture impossible.")
      missions = data ?? []
    }
    const declared = available ? (await readCompletionDeclared(service, missions.map((m) => m.id))).byId : new Map()
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
