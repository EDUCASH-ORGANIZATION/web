"use server"

// Demandes de paiement d'achats (RD-ACHATS-01 ST-04) : actions serveur et lecteurs, sans interface.
//
// Modèle : le client paie le vendeur directement par MoMo, HORS EduCash. Aucune action ne touche au portefeuille,
// au séquestre, à la commission ni à `wallet_transactions`. L'estimation d'achats n'est jamais additionnée.
//
// Ordre de CHAQUE action : (1) requireRole du bon rôle, première instruction ; (2) validation zod (fichier
// `requests.js`, ST-03) ; (3) chemins de preuve (isOwnedProofPath) ; (4) mission lue avec le client de SESSION
// (création) ou demande relue en service role RESTREINTE aux demandes de l'appelant (les autres actions, où seule la
// demande donne la mission) ; (5) machine à états (allowedActions), version attendue ; (6) plafonds, numéro à payer,
// existence des preuves ; (7) écriture conditionnelle (statut ET version) ; (8) ligne `purchase_event` dans la
// conversation (obligatoire : le temps réel et les non lus en dépendent) ; (9) notification in-app ; (10) revalidation.
// Le client service role n'est JAMAIS créé si le rôle, la validation, les preuves ou (création) la mission refusent.
// Toute écriture dans `purchase_requests`, `messages` et `reports` passe par le service role, après ces contrôles
// (le trigger SQL `guard_purchase_requests` impose en plus la machine à états).
//
// Réponses : `{ success: true, ... }` ou `{ error, ... }` avec un message vouvoyé neutre (seul `error.code` est
// journalisé). `stale: true` : la demande a changé depuis sa lecture (version ou statut). `unavailable: true` : le
// script 94 n'est pas appliqué (42P01, PGRST205, 42703, PGRST204), rien n'est écrit.
//
// Limites documentées :
// - la limite de 20 demandes par mission ne peut pas être verrouillée côté PostgREST (pas de `select ... for update`,
//   aucune fonction SQL à appeler) : après l'insertion, la demande relit les numéros d'ordre et s'annule elle-même si
//   son rang dans les demandes non annulées dépasse 20. Des créations simultanées ne dépassent donc jamais 20 de façon
//   durable ; au pire, deux créations en course s'annulent toutes les deux (côté prudent). Le numéro d'ordre (maximum
//   plus un) est protégé par l'unicité (mission, seq) : sur 23505, une seule nouvelle tentative ;
// - les plafonds (5 écritures par 10 minutes, 10 signalements par 24 h) sont comptés en base par lecture puis écriture,
//   non atomiques : des envois simultanés peuvent les dépasser de quelques unités ;
// - le téléversement des preuves se fait côté navigateur avec `upsert: false` (le script 94 refuse l'écrasement) ; une
//   preuve remplacée à la modification reste dans le compartiment (purge liée à la durée de conservation D8) ;
// - le « numéro à payer » est comparé au téléphone de profil de l'ÉTUDIANT seulement. Le comparer aussi à celui du
//   client donnerait à l'étudiant un moyen de tester des numéros pour deviner le téléphone privé du client ;
// - si la ligne système d'une transition n'a pas pu être écrite après deux essais, la transition reste valable
//   (l'état est porté par la demande) et l'échec est journalisé ; si c'est la carte d'une CRÉATION qui échoue, la demande
//   est annulée aussitôt (une demande sans carte serait invisible dans la conversation).

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { isUuid } from "@/lib/vitrine/ids"
import { insertPurchaseMessage } from "@/lib/purchases/purchase-messages"
import { notifyPurchaseEvent } from "@/lib/purchases/purchase-notify"
import { reportReference } from "@/lib/messaging/moderation-rules"
import { isOwnedProofPath } from "@/lib/purchases/proofs"
import {
  PURCHASE_CREATE_REFUSALS,
  PURCHASE_MAX_PER_MISSION,
  allowedActions,
  canCreateRequest,
  createPurchaseSchema,
  editPurchaseSchema,
  isProfilePhone,
  markPaidSchema,
  nextSeq,
  purchaseMessageContent,
  purchaseTotals,
  purchaseVersionSchema,
  reportPurchaseSchema,
} from "@/lib/purchases/requests"
import {
  PARTY_COLUMN,
  PURCHASE_ERR,
  REQUEST_COLUMNS,
  cleanItems,
  cleanReportDetails,
  cleanVendorName,
  isMissingPurchaseSchema,
  loadMission,
  loadOwnRequest,
  proofsExist,
  readMissionPurchaseRequests,
  readRequestReports,
  reportLimitReached,
  signProofs,
  toPurchaseRequestView,
  writeLimitReached,
} from "@/lib/actions/purchase-request-core"

const UNIQUE_VIOLATION = "23505"
const TRIGGER_REFUSAL = "42501"
const LIST_LIMIT = 200

const unavailableResponse = () => ({ error: PURCHASE_ERR.unavailable, unavailable: true })
const staleResponse = () => ({ error: PURCHASE_ERR.stale, stale: true })
const summary = (row) => ({ id: row.id, seq: row.seq, status: row.status, version: row.version })

function openService() {
  try {
    return createServiceClient()
  } catch {
    console.error("[purchase-request.actions] configuration serveur")
    return null
  }
}

function revalidateMission(missionId) {
  revalidatePath(`/messages/${missionId}`)
  revalidatePath(`/client/messages/${missionId}`)
  revalidatePath(`/student/missions/${missionId}`)
  revalidatePath(`/client/missions/${missionId}`)
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)

// Validation zod : le premier message est celui du schéma (déjà vouvoyé). Une entrée qui n'est pas un objet, ou un
// message qui n'est pas du français du schéma (message par défaut de zod), donne le message générique.
function parse(schema, input, fallback = PURCHASE_ERR.invalid) {
  if (!isObject(input)) return { error: fallback }
  const result = schema.safeParse(input)
  if (result.success) return { data: result.data }
  const message = result.error.issues[0]?.message
  return { error: typeof message === "string" && !/^(Invalid|Expected|Required)/i.test(message) ? message : fallback }
}

// ─── Contexte d'une demande existante ────────────────────────────────────────────────────────

// Demande de l'appelant (lecture restreinte à sa partie) puis mission de la demande lue avec le client de SESSION
// (la RLS limite la lecture au client propriétaire et à l'étudiant retenu), qui doit relier les mêmes deux parties.
async function loadRequestContext({ supabase, role, user, requestId }) {
  const service = openService()
  if (!service) return { response: { error: PURCHASE_ERR.generic } }
  const own = await loadOwnRequest(service, { requestId, role, userId: user.id })
  if (own.status === "unavailable") return { response: unavailableResponse() }
  if (own.status === "error") return { response: { error: PURCHASE_ERR.generic } }
  if (own.status === "missing") return { response: { error: PURCHASE_ERR.notFound } }
  const { row } = own
  const loaded = await loadMission(supabase, row.mission_id, { clientId: role === "client" ? user.id : undefined })
  if (loaded.status === "error") return { response: { error: PURCHASE_ERR.generic } }
  if (loaded.status === "forbidden") return { response: { error: PURCHASE_ERR.notFound } }
  const { mission } = loaded
  if (mission.clientId !== row.client_id || mission.selectedStudentId !== row.student_id) {
    return { response: { error: PURCHASE_ERR.notFound } }
  }
  return { ctx: { service, row, mission } }
}

// Statut de départ et statut d'arrivée de chaque action : une action déjà faite (double clic) répond succès sans
// rien réécrire ; une action dont le statut de départ n'est plus le bon, ou dont la version a changé, répond `stale`.
const FROM_STATUS = { edit: "pending", cancel: "pending", markPaid: "pending", confirmReceived: "paid" }
const DONE_STATUS = { cancel: "cancelled", markPaid: "paid", confirmReceived: "received" }

function checkAction({ row, mission, role, action, expectedVersion }) {
  if (DONE_STATUS[action] && row.status === DONE_STATUS[action]) {
    return { response: { success: true, already: true, request: summary(row) } }
  }
  if (row.status !== FROM_STATUS[action] || row.version !== expectedVersion) return { response: staleResponse() }
  const allowed = allowedActions({ status: row.status, role, missionStatus: mission.status })
  if (!allowed.includes(action)) return { response: { error: PURCHASE_ERR.notAllowed } }
  return {}
}

// Écriture conditionnelle : la ligne n'est modifiée que si son statut ET sa version sont ceux qui ont été contrôlés.
// Aucune ligne modifiée : course (double clic, autre partie, autre onglet), on relit pour répondre selon l'état réel.
async function updateIfCurrent({ service, row, role, userId, patch, target }) {
  const { data, error } = await service
    .from("purchase_requests")
    .update(patch)
    .eq("id", row.id)
    .eq(PARTY_COLUMN[role], userId)
    .eq("status", row.status)
    .eq("version", row.version)
    .select(REQUEST_COLUMNS)
  if (isMissingPurchaseSchema(error)) return { response: unavailableResponse() }
  if (error && error.code === TRIGGER_REFUSAL) return { response: { error: PURCHASE_ERR.notAllowed } }
  if (error) {
    console.error("[purchase-request.actions] écriture", error.code ?? "erreur")
    return { response: { error: PURCHASE_ERR.generic } }
  }
  if (data?.length === 1) return { updated: data[0] }

  const again = await loadOwnRequest(service, { requestId: row.id, role, userId })
  if (again.status === "ok" && target && again.row.status === target) {
    return { response: { success: true, already: true, request: summary(again.row) } }
  }
  return { response: staleResponse() }
}

// Ligne système obligatoire de la conversation, deux essais ; un échec définitif est journalisé sans annuler la transition.
async function emitEvent(service, row, actorId, event) {
  const content = purchaseMessageContent("purchase_event", row.seq, event)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await insertPurchaseMessage(service, { request: row, type: "purchase_event", actorId, content })
    if (result.ok) return true
    if (result.reason !== "failed") break
  }
  console.error("[purchase-request.actions] ligne système non écrite", event)
  return false
}

// Après une transition réussie : ligne système, notification à l'autre partie, revalidation.
async function announce({ service, updated, mission, auth, event }) {
  await emitEvent(service, updated, auth.user.id, event)
  await notifyPurchaseEvent({
    event,
    request: updated,
    mission,
    actorId: auth.user.id,
    actorName: auth.profile?.full_name,
    version: updated.version,
  })
  revalidateMission(mission.id)
}

// Téléphone de profil de l'étudiant (colonne privée), lu par le client SERVICE ROLE passé par l'action, après ses
// contrôles, pour la seule comparaison avec le numéro à payer. Il n'est jamais renvoyé ni journalisé. Le fichier figure dans
// SERVER_ALLOWLIST du garde « colonnes privées » (profile.actions.test.js).
async function payeeIsProfilePhone(service, userId, payeeNumber) {
  const { data, error } = await service.from("profiles").select("user_id, phone").eq("user_id", userId).maybeSingle()
  if (error) {
    console.error("[purchase-request.actions] profil", error.code ?? "erreur")
    return { error: true }
  }
  return { same: isProfilePhone(payeeNumber, data?.phone) }
}

function proofsOfStudent(data, userId) {
  return (
    isOwnedProofPath(data.payeePhotoPath, { ownerId: userId, requestId: data.requestId, kind: "payee" }) &&
    isOwnedProofPath(data.ticketPhotoPath, { ownerId: userId, requestId: data.requestId, kind: "ticket" })
  )
}

// ─── Création ────────────────────────────────────────────────────────────────────────────────

const LISTED_COLUMNS = "id, seq, status, version, student_id, mission_id"

// Annule la demande qu'on vient de créer (carte non écrite, ou 21e demande en course). Meilleur effort.
async function cancelOwn(service, row, userId) {
  const { error } = await service
    .from("purchase_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("student_id", userId)
    .eq("status", "pending")
    .eq("version", row.version)
  if (error) console.error("[purchase-request.actions] annulation de repli", error.code ?? "erreur")
}

/**
 * Crée une demande de paiement d'achats (étudiant retenu, mission en cours avec achats). `requestId` est choisi par le
 * client avant le téléversement des preuves (dossier `purchase-proofs/<student_id>/<requestId>/`) ; le rejeu du même
 * `requestId` (double clic) répond succès sans rien réécrire.
 * @param {{ missionId: string, requestId: string, payeeKind: "merchant"|"personal", payeeNumber: string,
 *   payeePhotoPath: string, vendorName: string, items?: string, amount: number|string, ticketPhotoPath: string }} input
 * @returns {Promise<{ success: true, replay?: boolean, request: { id: string, seq: number, status: string, version: number } }
 *   | { error: string, unavailable?: true }>}
 */
export async function createPurchaseRequest(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user, profile } = auth

  const parsed = parse(createPurchaseSchema, input)
  if (parsed.error) return { error: parsed.error }
  const data = parsed.data
  if (!proofsOfStudent(data, user.id)) return { error: PURCHASE_ERR.proof }
  const vendorName = cleanVendorName(data.vendorName)
  const items = cleanItems(data.items)
  if (vendorName.length < 2) return { error: PURCHASE_ERR.invalid }

  // Mission (client de session) : l'étudiant de la session est l'étudiant RETENU, la mission est en cours avec achats.
  const loaded = await loadMission(supabase, data.missionId)
  if (loaded.status === "error") return { error: PURCHASE_ERR.generic }
  if (loaded.status === "forbidden") return { error: PURCHASE_ERR.conversation }
  const { mission } = loaded
  if (mission.selectedStudentId !== user.id || mission.clientId === user.id) return { error: PURCHASE_ERR.conversation }
  const early = canCreateRequest({
    role: "student",
    missionStatus: mission.status,
    purchasesEstimate: mission.purchasesEstimate,
    activeCount: 0,
    nextSeq: 1,
  })
  if (!early.ok) return { error: early.message }

  // Tous les contrôles sans base de service sont passés : le service role peut être créé.
  const service = openService()
  if (!service) return { error: PURCHASE_ERR.generic }

  const listRequests = () =>
    service.from("purchase_requests").select(LISTED_COLUMNS).eq("mission_id", mission.id).limit(LIST_LIMIT)
  const listed = await listRequests()
  if (isMissingPurchaseSchema(listed.error)) return unavailableResponse()
  if (listed.error) {
    console.error("[createPurchaseRequest] liste", listed.error.code ?? "erreur")
    return { error: PURCHASE_ERR.generic }
  }
  const replayOf = (existing) =>
    existing.student_id === user.id && existing.mission_id === mission.id && existing.status !== "cancelled"
      ? { success: true, replay: true, request: summary(existing) }
      : { error: PURCHASE_ERR.generic }
  const rows = listed.data ?? []
  const already = rows.find((r) => r.id === data.requestId)
  if (already) return replayOf(already)

  const check = canCreateRequest({
    role: "student",
    missionStatus: mission.status,
    purchasesEstimate: mission.purchasesEstimate,
    activeCount: rows.filter((r) => r.status !== "cancelled").length,
    nextSeq: nextSeq(rows),
  })
  if (!check.ok) return { error: check.message }

  const same = await payeeIsProfilePhone(service, user.id, data.payeeNumber)
  if (same.error) return { error: PURCHASE_ERR.generic }
  if (same.same) return { error: PURCHASE_ERR.payeeSelf }

  const limit = await writeLimitReached(service, user.id)
  if (limit.available === false) return unavailableResponse()
  if (limit.error) return { error: PURCHASE_ERR.generic }
  if (limit.limited) return { error: PURCHASE_ERR.rate }

  const exist = await proofsExist(service, [data.payeePhotoPath, data.ticketPhotoPath])
  if (!exist.ok) return { error: exist.reason === "missing" ? PURCHASE_ERR.proof : PURCHASE_ERR.generic }

  // Insertion. Sur 23505 : soit la même demande existe déjà (double clic concurrent, réponse de rejeu), soit le
  // numéro d'ordre vient d'être pris (une seule nouvelle tentative avec un numéro recalculé).
  let current = rows
  let row = null
  for (let attempt = 0; attempt < 2 && !row; attempt += 1) {
    const seq = nextSeq(current)
    if (seq === null) return { error: PURCHASE_CREATE_REFUSALS.limit }
    const { data: inserted, error } = await service
      .from("purchase_requests")
      .insert({
        id: data.requestId,
        mission_id: mission.id,
        seq,
        student_id: user.id,
        client_id: mission.clientId,
        payee_kind: data.payeeKind,
        payee_number: data.payeeNumber,
        payee_photo_path: data.payeePhotoPath,
        ticket_photo_path: data.ticketPhotoPath,
        vendor_name: vendorName,
        items,
        amount: data.amount,
      })
      .select(REQUEST_COLUMNS)
      .single()
    if (!error && inserted) {
      row = inserted
      break
    }
    if (isMissingPurchaseSchema(error)) return unavailableResponse()
    if (error?.code === TRIGGER_REFUSAL) return { error: PURCHASE_ERR.conversation }
    if (error?.code !== UNIQUE_VIOLATION) {
      console.error("[createPurchaseRequest] écriture", error?.code ?? "erreur")
      return { error: PURCHASE_ERR.generic }
    }
    const stored = await service.from("purchase_requests").select(LISTED_COLUMNS).eq("id", data.requestId).maybeSingle()
    if (stored.error) {
      console.error("[createPurchaseRequest] relecture", stored.error.code ?? "erreur")
      return { error: PURCHASE_ERR.generic }
    }
    if (stored.data) return replayOf(stored.data)
    const refreshed = await listRequests()
    if (refreshed.error) return { error: PURCHASE_ERR.generic }
    current = refreshed.data ?? []
  }
  if (!row) return { error: PURCHASE_ERR.generic }

  // Limite de 20 : rang de la nouvelle demande parmi les demandes non annulées (les plus anciennes numéros gardent leur place).
  const after = await listRequests()
  if (!after.error) {
    const rank = (after.data ?? []).filter((r) => r.status !== "cancelled" && r.seq <= row.seq).length
    if (rank > PURCHASE_MAX_PER_MISSION) {
      await cancelOwn(service, row, user.id)
      return { error: PURCHASE_CREATE_REFUSALS.limit }
    }
  } else {
    console.error("[createPurchaseRequest] recomptage", after.error.code ?? "erreur")
  }

  // Carte de la conversation : sans elle la demande serait invisible, elle est donc annulée si la carte n'a pas pu être écrite.
  let card = { ok: false, reason: "failed" }
  for (let attempt = 0; attempt < 2 && card.reason === "failed"; attempt += 1) {
    card = await insertPurchaseMessage(service, {
      request: row,
      type: "purchase_request",
      actorId: user.id,
      content: purchaseMessageContent("purchase_request", row.seq),
    })
    if (card.ok) break
  }
  if (!card.ok) {
    await cancelOwn(service, row, user.id)
    return card.reason === "unavailable" ? unavailableResponse() : { error: PURCHASE_ERR.generic }
  }

  await notifyPurchaseEvent({
    event: "requested",
    request: row,
    mission,
    actorId: user.id,
    actorName: profile?.full_name,
    version: row.version,
  })
  revalidateMission(mission.id)
  return { success: true, request: summary(row) }
}

// ─── Modification, annulation, paiement, réception ───────────────────────────────────────────

/**
 * Modifie une demande encore EN ATTENTE (étudiant, mission en cours). `expectedVersion` est la version lue : si elle a
 * changé, `{ stale: true }` et rien n'est écrit. Une modification qui ne change rien est refusée (`unchanged: true`).
 * @param {{ requestId: string, expectedVersion: number, payeeKind: string, payeeNumber: string, payeePhotoPath: string,
 *   vendorName: string, items?: string, amount: number|string, ticketPhotoPath: string }} input
 */
export async function editPurchaseRequest(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = parse(editPurchaseSchema, input)
  if (parsed.error) return { error: parsed.error }
  const data = parsed.data
  if (!proofsOfStudent(data, user.id)) return { error: PURCHASE_ERR.proof }
  const vendorName = cleanVendorName(data.vendorName)
  const items = cleanItems(data.items)
  if (vendorName.length < 2) return { error: PURCHASE_ERR.invalid }

  const loaded = await loadRequestContext({ supabase, role: "student", user, requestId: data.requestId })
  if (loaded.response) return loaded.response
  const { service, row, mission } = loaded.ctx

  const check = checkAction({ row, mission, role: "student", action: "edit", expectedVersion: data.expectedVersion })
  if (check.response) return check.response

  const same = await payeeIsProfilePhone(service, user.id, data.payeeNumber)
  if (same.error) return { error: PURCHASE_ERR.generic }
  if (same.same) return { error: PURCHASE_ERR.payeeSelf }

  const content = {
    payee_kind: data.payeeKind,
    payee_number: data.payeeNumber,
    payee_photo_path: data.payeePhotoPath,
    ticket_photo_path: data.ticketPhotoPath,
    vendor_name: vendorName,
    items,
    amount: data.amount,
  }
  if (Object.entries(content).every(([column, value]) => row[column] === value)) {
    return { error: PURCHASE_ERR.noChange, unchanged: true }
  }

  const limit = await writeLimitReached(service, user.id)
  if (limit.available === false) return unavailableResponse()
  if (limit.error) return { error: PURCHASE_ERR.generic }
  if (limit.limited) return { error: PURCHASE_ERR.rate }

  // Seules les photos remplacées sont vérifiées dans le compartiment (les autres y sont déjà).
  const changed = [
    content.payee_photo_path !== row.payee_photo_path ? content.payee_photo_path : null,
    content.ticket_photo_path !== row.ticket_photo_path ? content.ticket_photo_path : null,
  ].filter(Boolean)
  const exist = await proofsExist(service, changed)
  if (!exist.ok) return { error: exist.reason === "missing" ? PURCHASE_ERR.proof : PURCHASE_ERR.generic }

  const written = await updateIfCurrent({
    service,
    row,
    role: "student",
    userId: user.id,
    patch: { ...content, version: row.version + 1, edited_at: new Date().toISOString() },
  })
  if (written.response) return written.response
  await announce({ service, updated: written.updated, mission, auth, event: "updated" })
  return { success: true, request: summary(written.updated) }
}

/**
 * Annule une demande encore EN ATTENTE (étudiant, mission en cours). Déjà annulée : succès sans rien réécrire.
 * @param {{ requestId: string, expectedVersion: number }} input
 */
export async function cancelPurchaseRequest(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = parse(purchaseVersionSchema, input)
  if (parsed.error) return { error: parsed.error }
  const { requestId, expectedVersion } = parsed.data

  const loaded = await loadRequestContext({ supabase, role: "student", user, requestId })
  if (loaded.response) return loaded.response
  const { service, row, mission } = loaded.ctx

  const check = checkAction({ row, mission, role: "student", action: "cancel", expectedVersion })
  if (check.response) return check.response

  const written = await updateIfCurrent({
    service,
    row,
    role: "student",
    userId: user.id,
    patch: { status: "cancelled", cancelled_at: new Date().toISOString() },
    target: "cancelled",
  })
  if (written.response) return written.response
  await announce({ service, updated: written.updated, mission, auth, event: "cancelled" })
  return { success: true, request: summary(written.updated) }
}

/**
 * « Payé » : le client indique avoir payé le vendeur HORS EduCash (aucun mouvement d'argent ici). Capture du SMS
 * obligatoire (dossier du client), case « bénéficiaire vérifié » obligatoire, référence facultative. Mission en cours ou
 * terminée (D5). `expectedVersion` périmée : `{ stale: true }`. Déjà payée : succès sans rien réécrire.
 * @param {{ requestId: string, expectedVersion: number, smsPhotoPath: string, beneficiaryConfirmed: true, paidReference?: string }} input
 */
export async function markPurchasePaid(input) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = parse(markPaidSchema, input)
  if (parsed.error) return { error: parsed.error }
  const data = parsed.data
  if (!isOwnedProofPath(data.smsPhotoPath, { ownerId: user.id, requestId: data.requestId, kind: "sms" })) {
    return { error: PURCHASE_ERR.proof }
  }

  const loaded = await loadRequestContext({ supabase, role: "client", user, requestId: data.requestId })
  if (loaded.response) return loaded.response
  const { service, row, mission } = loaded.ctx

  const check = checkAction({ row, mission, role: "client", action: "markPaid", expectedVersion: data.expectedVersion })
  if (check.response) return check.response

  const exist = await proofsExist(service, [data.smsPhotoPath])
  if (!exist.ok) return { error: exist.reason === "missing" ? PURCHASE_ERR.proof : PURCHASE_ERR.generic }

  const written = await updateIfCurrent({
    service,
    row,
    role: "client",
    userId: user.id,
    patch: {
      status: "paid",
      paid_at: new Date().toISOString(),
      sms_photo_path: data.smsPhotoPath,
      paid_reference: data.paidReference,
      beneficiary_confirmed: true,
    },
    target: "paid",
  })
  if (written.response) return written.response
  await announce({ service, updated: written.updated, mission, auth, event: "paid" })
  return { success: true, request: summary(written.updated) }
}

/**
 * « Reçu par le vendeur » : l'étudiant confirme que le vendeur a reçu le paiement (demande payée ; mission en cours ou
 * terminée, D5). La carte est ensuite verrouillée. Déjà confirmée : succès sans rien réécrire.
 * @param {{ requestId: string, expectedVersion: number }} input
 */
export async function confirmPurchaseReceived(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = parse(purchaseVersionSchema, input)
  if (parsed.error) return { error: parsed.error }
  const { requestId, expectedVersion } = parsed.data

  const loaded = await loadRequestContext({ supabase, role: "student", user, requestId })
  if (loaded.response) return loaded.response
  const { service, row, mission } = loaded.ctx

  const check = checkAction({ row, mission, role: "student", action: "confirmReceived", expectedVersion })
  if (check.response) return check.response

  const written = await updateIfCurrent({
    service,
    row,
    role: "student",
    userId: user.id,
    patch: { status: "received", received_at: new Date().toISOString() },
    target: "received",
  })
  if (written.response) return written.response
  await announce({ service, updated: written.updated, mission, auth, event: "received" })
  return { success: true, request: summary(written.updated) }
}

// ─── Signalement ─────────────────────────────────────────────────────────────────────────────

// Signalement existant de l'appelant pour cette demande : sa référence, ou null.
async function findOwnReport(service, requestId, reporterId) {
  const { data, error } = await service
    .from("reports")
    .select("number")
    .eq("purchase_request_id", requestId)
    .eq("reporter_id", reporterId)
    .limit(1)
  if (isMissingPurchaseSchema(error)) return { unavailable: true }
  if (error) {
    console.error("[purchase-request.actions] doublon", error.code ?? "erreur")
    return { error: true }
  }
  const number = data?.[0]?.number
  return { reference: number === undefined ? null : reportReference(Number(number)) }
}

// Passage conditionnel à « Signalé » (rien si la demande l'est déjà ou si elle est annulée). Le trigger SQL exige
// qu'une ligne `reports` existe déjà : le signalement est donc écrit avant. Meilleur effort, journalisé.
async function flagReported(service, row) {
  const { data, error } = await service
    .from("purchase_requests")
    .update({ status: "reported", reported_at: new Date().toISOString() })
    .eq("id", row.id)
    .in("status", ["pending", "paid", "received"])
    .select(REQUEST_COLUMNS)
  if (error) {
    console.error("[purchase-request.actions] passage à signalé", error.code ?? "erreur")
    return row
  }
  return data?.[0] ?? row
}

async function reportPurchase(role, input) {
  const auth = await requireRole([role])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = parse(reportPurchaseSchema, input, PURCHASE_ERR.reportInvalid)
  if (parsed.error) return { error: parsed.error }
  const { requestId, reason } = parsed.data

  const loaded = await loadRequestContext({ supabase, role, user, requestId })
  if (loaded.response) return loaded.response
  const { service, row, mission } = loaded.ctx

  // Doublon : succès idempotent avec la référence existante (une fois par partie et par demande). Si la demande n'a pas
  // pu passer à « Signalé » la première fois, on la rattrape ici.
  const existing = await findOwnReport(service, row.id, user.id)
  if (existing.unavailable) return unavailableResponse()
  if (existing.error) return { error: PURCHASE_ERR.reportFailed }
  if (existing.reference) {
    if (row.status !== "reported") await flagReported(service, row)
    return { success: true, already: true, reference: existing.reference }
  }

  const actions = allowedActions({ status: row.status, role, missionStatus: mission.status, alreadyReportedByMe: false })
  if (!actions.includes("report")) return { error: PURCHASE_ERR.notAllowed }

  const limit = await reportLimitReached(service, user.id)
  if (limit.available === false) return unavailableResponse()
  if (limit.error) return { error: PURCHASE_ERR.reportFailed }
  if (limit.limited) return { error: PURCHASE_ERR.reportLimit }

  const otherId = role === "student" ? row.client_id : row.student_id
  const { data: report, error } = await service
    .from("reports")
    .insert({
      source: "user",
      target_type: "purchase_request",
      purchase_request_id: row.id,
      mission_id: row.mission_id,
      reporter_id: user.id,
      reported_user_id: otherId,
      reason,
      details: cleanReportDetails(parsed.data.details),
    })
    .select("number")
    .single()
  if (isMissingPurchaseSchema(error)) return unavailableResponse()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const again = await findOwnReport(service, row.id, user.id)
      if (again.reference) return { success: true, already: true, reference: again.reference }
    }
    console.error("[purchase-request.actions] signalement", error.code ?? "erreur")
    return { error: PURCHASE_ERR.reportFailed }
  }
  const reference = reportReference(Number(report?.number))
  if (!reference) return { error: PURCHASE_ERR.reportFailed }

  const flagged = await flagReported(service, row)
  await emitEvent(service, flagged, user.id, "reported")
  await notifyPurchaseEvent({
    event: "reported",
    request: flagged,
    mission,
    actorId: user.id,
    actorName: auth.profile?.full_name,
    version: flagged.version,
  })
  revalidateMission(mission.id)
  return { success: true, reference }
}

/**
 * Signale une demande d'achats (étudiant). Une fois par partie et par demande (rejeu : succès avec la même référence),
 * 10 signalements au plus par 24 h. L'explication passe par le masquage des coordonnées. Aucun remboursement ni
 * compensation : l'équipe EduCash examine, l'autre partie est prévenue.
 * @param {{ requestId: string, reason: string, details: string }} input
 */
export async function reportPurchaseRequestAsStudent(input) {
  return reportPurchase("student", input)
}

/**
 * Signale une demande d'achats (client). Mêmes règles que côté étudiant.
 * @param {{ requestId: string, reason: string, details: string }} input
 */
export async function reportPurchaseRequestAsClient(input) {
  return reportPurchase("client", input)
}

// ─── Lecteurs ────────────────────────────────────────────────────────────────────────────────

async function readPurchases(role, auth, missionId) {
  const { supabase, user } = auth
  if (!isUuid(missionId)) return { notFound: true }
  const loaded = await loadMission(supabase, missionId, { clientId: role === "client" ? user.id : undefined })
  if (loaded.status === "error") return { error: PURCHASE_ERR.load }
  if (loaded.status === "forbidden") return { notFound: true }
  const { mission } = loaded

  const base = {
    available: true,
    missionId: mission.id,
    missionStatus: mission.status,
    purchasesEstimate: mission.purchasesEstimate,
  }
  // Un étudiant qui n'est pas retenu (candidat d'une mission ouverte) n'a aucune demande : liste vide, rien n'est lu.
  if (role === "student" && mission.selectedStudentId !== user.id) {
    return { ...base, requests: [], totals: purchaseTotals([]), canCreate: false }
  }

  const service = openService()
  if (!service) return { error: PURCHASE_ERR.load }
  const listed = await readMissionPurchaseRequests(service, { missionId: mission.id, role, userId: user.id })
  if (listed.available === false) return { available: false }
  if (listed.error) return { error: PURCHASE_ERR.load }
  const { rows } = listed

  const reports = await readRequestReports(service, rows.map((r) => r.id))
  if (reports.available === false) return { available: false }
  if (reports.error) return { error: PURCHASE_ERR.load }

  const urls = await signProofs(service, rows)
  const viewer = { id: user.id, role, missionStatus: mission.status }
  const requests = rows.map((row) => toPurchaseRequestView(row, viewer, reports.rows, urls))
  const totals = purchaseTotals(rows.map((r) => ({ status: r.status, amount: r.amount })))
  const canCreate =
    role === "student" &&
    canCreateRequest({
      role,
      missionStatus: mission.status,
      purchasesEstimate: mission.purchasesEstimate,
      activeCount: rows.filter((r) => r.status !== "cancelled").length,
      nextSeq: nextSeq(rows),
    }).ok
  return { ...base, requests, totals, canCreate }
}

/**
 * Demandes d'une mission vues par l'étudiant retenu, avec des adresses de photos signées pour 120 s (chemins jamais
 * renvoyés, sauf ceux de ses propres photos pour la modification). Vide pour un étudiant non retenu.
 * @param {{ missionId: string }} input
 * @returns {Promise<{ available: true, missionId: string, missionStatus: string, purchasesEstimate: number|null,
 *   requests: object[], totals: object, canCreate: boolean } | { available: false } | { notFound: true } | { error: string }>}
 */
export async function getStudentPurchaseRequests({ missionId } = {}) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  return readPurchases("student", auth, missionId)
}

/**
 * Demandes d'une mission vues par le client de la mission : numéro à payer, nom du vendeur et photos signées pour 120 s
 * (chemins jamais renvoyés). Mission d'un autre client : `{ notFound: true }`.
 * @param {{ missionId: string }} input
 */
export async function getClientPurchaseRequests({ missionId } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  return readPurchases("client", auth, missionId)
}
