"use server"

import { todayInBenin } from "@/lib/vitrine/dates"
import { isUuid } from "@/lib/vitrine/ids"
import { inChunks, requireAdminService } from "./admin-context"
import { readCompletionDeclared } from "./mission-completion-core"

const ERR_LOAD = "Cette mission n'a pas pu être chargée. Réessayez dans un instant."

// Colonnes explicites : jamais de select("*"), aucune donnée privée de profil (ni téléphone ni e-mail),
// jamais la table des messages (aucune lecture de conversation par l'admin).
const MISSION_COLUMNS =
  "id, title, description, type, city, budget, urgency, deadline, status, created_at, updated_at, client_id, selected_student_id"
const APPLICATION_COLUMNS = "id, student_id, status, created_at"
const LEDGER_TYPES = ["reserve", "release", "commission", "refund"]
const APPLICATIONS_LIMIT = 100
const LEDGER_LIMIT = 100
const REVIEWS_LIMIT = 10

async function readNames(service, ids) {
  const names = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("profiles").select("user_id, full_name").in("user_id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) names.set(row.user_id, row.full_name ?? "")
  }
  return names
}

function check(result) {
  if (result.error) throw new Error("Lecture impossible.")
  return result
}

/**
 * Détail d'une mission pour l'admin (AD07), lecture seule : mission, parties (noms publics), candidatures, fin
 * déclarée et fin enregistrée, avis et mouvements du grand livre de la mission. Aucune action d'argent, aucun message.
 * Un identifiant mal formé ou inconnu donne `{ notFound: true }` (la page répond 404).
 * @param {string} id
 */
export async function getAdminMissionDetail(id) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  if (!isUuid(id)) return { notFound: true }

  try {
    const { data: mission, error } = await service.from("missions").select(MISSION_COLUMNS).eq("id", id).maybeSingle()
    if (error) throw new Error("Lecture impossible.")
    if (!mission) return { notFound: true }

    const [applications, completion, reviews, ledger, declared] = await Promise.all([
      service
        .from("applications")
        .select(APPLICATION_COLUMNS, { count: "exact" })
        .eq("mission_id", mission.id)
        .order("created_at", { ascending: false })
        .limit(APPLICATIONS_LIMIT),
      service.from("mission_completions").select("created_at").eq("mission_id", mission.id).maybeSingle(),
      service
        .from("reviews")
        .select("id, reviewer_id, rating, comment, created_at")
        .eq("mission_id", mission.id)
        .order("created_at", { ascending: false })
        .limit(REVIEWS_LIMIT),
      service
        .from("wallet_transactions")
        .select("id, user_id, type, amount, created_at")
        .eq("mission_id", mission.id)
        .in("type", LEDGER_TYPES)
        .order("created_at", { ascending: true })
        .limit(LEDGER_LIMIT),
      // Lecture tolérante : colonne absente -> aucune déclaration, la page se rend.
      readCompletionDeclared(service, [mission.id]),
    ])
    for (const result of [applications, completion, reviews, ledger]) check(result)
    const declaredAt = declared.byId.get(mission.id) ?? null

    const applicationRows = applications.data ?? []
    const names = await readNames(service, [
      mission.client_id,
      mission.selected_student_id,
      ...applicationRows.map((a) => a.student_id),
    ])

    const roleOf = (userId) =>
      userId === mission.client_id ? "client" : userId && userId === mission.selected_student_id ? "student" : null

    return {
      today: todayInBenin(),
      mission: {
        id: mission.id,
        title: mission.title ?? "",
        description: mission.description ?? "",
        type: mission.type,
        city: mission.city ?? null,
        budget: Number(mission.budget) || 0,
        urgency: mission.urgency ?? null,
        deadline: mission.deadline ?? null,
        status: mission.status,
        createdAt: mission.created_at,
        updatedAt: mission.updated_at ?? null,
        clientId: mission.client_id,
        selectedStudentId: mission.selected_student_id ?? null,
      },
      client: { id: mission.client_id, name: names.get(mission.client_id) ?? "" },
      student: mission.selected_student_id
        ? { id: mission.selected_student_id, name: names.get(mission.selected_student_id) ?? "" }
        : null,
      applications: {
        total: applications.count ?? applicationRows.length,
        items: applicationRows.map((a) => ({
          id: a.id,
          studentId: a.student_id,
          name: names.get(a.student_id) ?? "",
          status: a.status,
          createdAt: a.created_at,
          selected: a.student_id === mission.selected_student_id,
        })),
      },
      completion: { declaredAt, finishedAt: completion.data?.created_at ?? null },
      reviews: (reviews.data ?? []).map((r) => ({
        id: r.id,
        rating: Number(r.rating) || 0,
        comment: r.comment ?? null,
        createdAt: r.created_at,
        byRole: roleOf(r.reviewer_id),
      })),
      ledger: (ledger.data ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        type: m.type,
        amount: Number(m.amount) || 0,
        createdAt: m.created_at,
        party: roleOf(m.user_id),
      })),
    }
  } catch (err) {
    console.error("[admin-mission-detail] lecture:", err?.message)
    return { error: ERR_LOAD }
  }
}
