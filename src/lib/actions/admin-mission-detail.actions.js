"use server"

import { todayInBenin } from "@/lib/vitrine/dates"
import { isUuid } from "@/lib/vitrine/ids"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { reportReference } from "@/lib/messaging/moderation-rules"
import { requestNumber } from "@/lib/purchases/requests"
import { purchasesSummary } from "@/lib/admin-space/mission-detail"
import { inChunks, requireAdminService } from "./admin-context"
import { readCompletionDeclared } from "./mission-completion-core"
import { REQUEST_COLUMNS, isMissingPurchaseSchema, signProofs } from "./purchase-request-core"

const ERR_LOAD = "Cette mission n'a pas pu être chargée. Réessayez dans un instant."

// Colonnes explicites : jamais de select("*"), aucune donnée privée de profil (ni téléphone ni e-mail),
// jamais la table des messages (aucune lecture de conversation par l'admin).
const MISSION_COLUMNS =
  "id, title, description, type, city, budget, urgency, deadline, status, created_at, updated_at, client_id, selected_student_id, purchases_estimate"
const APPLICATION_COLUMNS = "id, student_id, status, created_at"
const LEDGER_TYPES = ["reserve", "release", "commission", "refund"]
const APPLICATIONS_LIMIT = 100
const LEDGER_LIMIT = 100
const REVIEWS_LIMIT = 10
const PURCHASES_LIMIT = 200
const PURCHASE_REPORT_COLUMNS = "id, number, purchase_request_id, reporter_id, reason, status, created_at"

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
 * Demandes de paiement d'achats d'une mission (RD-ACHATS-01), lues par l'admin après le contrôle de rôle : demandes,
 * preuves en URL signées de 120 s (le chemin du fichier ne quitte jamais le serveur) et signalements liés. Les achats
 * sont payés par le client hors EduCash : rien n'est additionné à l'argent de la mission. Tant que le script 94 n'est
 * pas appliqué (table absente), le bloc est indisponible sans faire échouer la page ; toute autre erreur de lecture
 * donne `reason: "error"` (le bloc le dit, la mission reste lisible).
 * @returns {Promise<object>}
 */
async function readPurchases(service, mission) {
  const estimate = purchasesEstimateOf(mission.purchases_estimate)
  const requests = await service
    .from("purchase_requests")
    .select(REQUEST_COLUMNS)
    .eq("mission_id", mission.id)
    .order("seq", { ascending: true })
    .limit(PURCHASES_LIMIT)
  if (isMissingPurchaseSchema(requests.error)) return { available: false, reason: "missing", estimate }
  if (requests.error) {
    console.error("[admin-mission-detail] demandes d'achats:", requests.error.code ?? "erreur")
    return { available: false, reason: "error", estimate }
  }
  const rows = requests.data ?? []

  let reports = []
  let reportsAvailable = true
  if (rows.length > 0) {
    const res = await service
      .from("reports")
      .select(PURCHASE_REPORT_COLUMNS)
      .in("purchase_request_id", rows.map((r) => r.id))
      .order("created_at", { ascending: true })
      .limit(PURCHASES_LIMIT)
    if (res.error) {
      reportsAvailable = false
      if (!isMissingPurchaseSchema(res.error)) console.error("[admin-mission-detail] signalements d'achats:", res.error.code ?? "erreur")
    } else {
      reports = res.data ?? []
    }
  }

  const urls = await signProofs(service, rows)
  const roleOf = (userId) => (userId === mission.client_id ? "client" : userId === mission.selected_student_id ? "student" : null)
  const items = rows.map((row) => ({
    id: row.id,
    seq: row.seq,
    number: requestNumber(row.seq),
    status: row.status,
    vendorName: row.vendor_name ?? "",
    items: row.items ?? null,
    amount: Number(row.amount) || 0,
    payeeKind: row.payee_kind,
    payeeNumber: row.payee_number ?? "",
    payeePhotoUrl: urls[row.payee_photo_path] ?? null,
    ticketPhotoUrl: urls[row.ticket_photo_path] ?? null,
    smsPhotoUrl: row.sms_photo_path ? (urls[row.sms_photo_path] ?? null) : null,
    paidReference: row.paid_reference ?? null,
    createdAt: row.created_at ?? null,
    editedAt: row.edited_at ?? null,
    paidAt: row.paid_at ?? null,
    receivedAt: row.received_at ?? null,
    reportedAt: row.reported_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    reports: reports
      .filter((r) => r.purchase_request_id === row.id)
      .map((r) => ({
        id: r.id,
        reference: reportReference(Number(r.number)),
        reason: r.reason,
        status: r.status,
        byRole: roleOf(r.reporter_id),
        createdAt: r.created_at ?? null,
      })),
  }))

  return { available: true, estimate, reportsAvailable, items, totals: purchasesSummary(items, estimate) }
}

/**
 * Détail d'une mission pour l'admin (AD07), lecture seule : mission, parties (noms publics), candidatures, fin
 * déclarée et fin enregistrée, avis, mouvements du grand livre de la mission et demandes de paiement d'achats avec
 * leurs preuves. Aucune action d'argent, aucun message.
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

    const [applications, completion, reviews, ledger, declared, purchases] = await Promise.all([
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
      // Lecture séparée de `missions` (par clé primaire, en parallèle) : colonne absente -> aucune déclaration, sans
      // faire échouer la lecture principale.
      readCompletionDeclared(service, [mission.id]),
      readPurchases(service, mission),
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
      purchases,
    }
  } catch (err) {
    console.error("[admin-mission-detail] lecture:", err?.message)
    return { error: ERR_LOAD }
  }
}
