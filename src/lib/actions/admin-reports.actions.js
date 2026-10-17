"use server"

import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import { clipMasked, maskContacts } from "@/lib/messaging/contact-filter"
import { CONTACT_ALERT_WINDOW_DAYS, REPORT_REASONS, reportReference } from "@/lib/messaging/moderation-rules"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { MEDIA_BUCKET } from "@/lib/client-space/conversations"
import { notify } from "@/lib/notifications/notify"
import { purchaseReportClosed } from "@/lib/notifications/catalog"
import { isOwnedProofPath } from "@/lib/purchases/proofs"
import {
  PAYEE_KINDS,
  PURCHASE_REPORT_REASONS,
  formatPayeeNumber,
  formatPurchaseAmount,
  requestNumber,
  statusBadge,
} from "@/lib/purchases/requests"
import { inChunks, logAdminAction, requireAdminService } from "./admin-context"

const ERR_LOAD = "Les signalements n'ont pas pu être chargés. Réessayez dans un instant."
const ERR_WRITE = "Le signalement n'a pas pu être mis à jour. Réessayez dans un instant."
const ERR_UNAVAILABLE = "Les signalements ne sont pas disponibles pour le moment. Réessayez plus tard."
const ERR_STATE = "Ce signalement ne peut plus être modifié de cette façon."
const ERR_NOTE_LONG = "La note ne peut pas dépasser 500 caractères."
const ERR_NOTE_TYPE = "La note n'est pas valide."

const REPORT_NOTE_MAX = 500
const PAGE_SIZE = 20
const MEDIA_SIGNED_TTL = 300
const DAY_MS = 86_400_000

// Colonnes explicites : jamais de select("*"), aucune colonne privée de profil (téléphone, e-mail, carte...).
// `purchase_request_id` (script 94) est lue à part : sans le script 94, la lecture retombe sur les colonnes de base
// et la file des signalements de messages continue de fonctionner telle quelle.
const REPORT_COLUMNS =
  "id, number, source, target_type, message_id, mission_id, reporter_id, reported_user_id, reason, status, handled_by, handled_at, created_at"
const REPORT_DETAIL_COLUMNS = `${REPORT_COLUMNS}, details, resolution_note, updated_at`
const PURCHASE_LINK_COLUMN = "purchase_request_id"
const MESSAGE_COLUMNS = "id, sender_id, receiver_id, type, content, media_url, location_lat, location_lng, created_at"

// Onglets de la file : valeur d'URL -> statuts de la base.
const TABS = {
  "a-traiter": ["open", "in_progress"],
  resolus: ["resolved"],
  classes: ["dismissed"],
}
const DEFAULT_TAB = "a-traiter"
const OPEN_STATUSES = TABS[DEFAULT_TAB]
const CLOSED_STATUSES = [...TABS.resolus, ...TABS.classes]
const REASON_LABELS = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]))
const PURCHASE_REASON_LABELS = Object.fromEntries(PURCHASE_REPORT_REASONS.map((r) => [r.value, r.label]))
const PAYEE_KIND_LABELS = Object.fromEntries(PAYEE_KINDS.map((k) => [k.value, k.label]))

// Types de cible de la file : valeur d'URL (`type`) -> valeur de `reports.target_type`.
const TYPES = {
  messages: "message",
  "demande-paiement-achats": "purchase_request",
}
const PURCHASE_TARGET = "purchase_request"
const TYPE_LABELS = { message: "Message", [PURCHASE_TARGET]: "Demande de paiement d'achats" }
const PURCHASE_REQUEST_LIST_COLUMNS = "id, seq, vendor_name, amount"

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

/** Table absente (script 92 pas encore appliqué) : code Postgres 42P01 ou code PostgREST PGRST205. */
function isMissingTable(error) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205") return true
  return /schema cache|does not exist/i.test(String(error.message ?? ""))
}

/** Colonne absente (script 94 pas encore appliqué) : code Postgres 42703 ou code PostgREST PGRST204. */
function isMissingColumn(error) {
  return Boolean(error) && (error.code === "42703" || error.code === "PGRST204")
}

/**
 * Lecture de `reports` avec la colonne du lien d'achat, puis sans elle si le script 94 manque. `run(columns)` renvoie
 * la réponse de la requête.
 */
async function readReports(run, baseColumns) {
  const extended = await run(`${baseColumns}, ${PURCHASE_LINK_COLUMN}`)
  if (!isMissingColumn(extended.error)) return extended
  return run(baseColumns)
}

function normalizeNote(raw) {
  if (raw === undefined || raw === null) return { value: null }
  if (typeof raw !== "string") return { error: ERR_NOTE_TYPE }
  const trimmed = raw.trim()
  if (trimmed.length > REPORT_NOTE_MAX) return { error: ERR_NOTE_LONG }
  if (trimmed === "") return { value: null }
  // Défense en profondeur : une coordonnée saisie dans la note est masquée comme dans la messagerie.
  return { value: clipMasked(maskContacts(trimmed).text, REPORT_NOTE_MAX) }
}

// Nombre de signalements par onglet (indicateurs de la file). Sonde GET, comme `countOpenAdminReports`.
async function readTabCounts(service) {
  const entries = await Promise.all(
    Object.entries(TABS).map(async ([tab, statuses]) => {
      const { error, count } = await service.from("reports").select("id", { count: "exact" }).in("status", statuses).limit(1)
      if (error) throw new Error("Lecture impossible.")
      return [tab, count ?? 0]
    }),
  )
  return Object.fromEntries(entries)
}

async function readNames(service, ids) {
  const names = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("profiles").select("user_id, full_name").in("user_id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) names.set(row.user_id, publicDisplayName(row.full_name ?? ""))
  }
  return names
}

async function readMissionTitles(service, ids) {
  const titles = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("missions").select("id, title").in("id", chunk)
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) titles.set(row.id, row.title ?? "")
  }
  return titles
}

// Résumé des demandes d'achats visées par une page de la file. Table absente (script 94) : aucun résumé, sans erreur.
async function readPurchaseSummaries(service, ids) {
  const summaries = new Map()
  for (const chunk of inChunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await service.from("purchase_requests").select(PURCHASE_REQUEST_LIST_COLUMNS).in("id", chunk)
    if (isMissingTable(error) || isMissingColumn(error)) return summaries
    if (error) throw new Error("Lecture impossible.")
    for (const row of data ?? []) summaries.set(row.id, { seq: row.seq, vendorName: row.vendor_name, amount: row.amount })
  }
  return summaries
}

function reasonLabelOf(row) {
  const labels = row.target_type === PURCHASE_TARGET ? PURCHASE_REASON_LABELS : REASON_LABELS
  return labels[row.reason] ?? "Autre"
}

/** Cible lisible d'une demande d'achats : « N° 2 · vendeur · 12 500 FCFA » (les parties absentes sont omises). */
function purchaseTargetDetail(request) {
  if (!request) return ""
  return [requestNumber(request.seq), request.vendorName, formatPurchaseAmount(request.amount)].filter(Boolean).join(" · ")
}

function toItem(row, names, titles, requests = new Map()) {
  const isPurchase = row.target_type === PURCHASE_TARGET
  return {
    id: row.id,
    reference: reportReference(Number(row.number)),
    source: row.source,
    targetType: isPurchase ? PURCHASE_TARGET : "message",
    typeLabel: TYPE_LABELS[isPurchase ? PURCHASE_TARGET : "message"],
    targetDetail: isPurchase ? purchaseTargetDetail(requests.get(row.purchase_request_id)) : "",
    reason: row.reason,
    reasonLabel: reasonLabelOf(row),
    status: row.status,
    createdAt: row.created_at,
    missionId: row.mission_id,
    missionTitle: titles.get(row.mission_id) ?? "",
    reporter: row.reporter_id ? { id: row.reporter_id, name: names.get(row.reporter_id) ?? "" } : null,
    reported: { id: row.reported_user_id, name: names.get(row.reported_user_id) ?? "" },
    handledBy: row.handled_by ? { id: row.handled_by, name: names.get(row.handled_by) ?? "" } : null,
    handledAt: row.handled_at ?? null,
  }
}

/**
 * File des signalements (AD09). `searchParams` : `statut` (`a-traiter` par défaut, `resolus`, `classes`),
 * `type` (`messages` ou `demande-paiement-achats`, tous les types par défaut), `tri` (`anciens` par défaut,
 * `recents`) et `page` (à partir de 1). Une valeur inconnue retombe sur le défaut. Les demandes de paiement d'achats
 * passent toujours en premier (l'argent d'abord), quel que soit le tri.
 * Table absente : `{ unavailable: true }`, liste vide, sans erreur.
 * @param {Record<string, string | string[] | undefined>} [searchParams]
 */
export async function listAdminReports(searchParams = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const rawTab = first(searchParams?.statut)
  const tab = Object.hasOwn(TABS, rawTab) ? rawTab : DEFAULT_TAB
  const rawType = first(searchParams?.type)
  const type = Object.hasOwn(TYPES, rawType) ? rawType : null
  const sort = first(searchParams?.tri) === "recents" ? "recents" : "anciens"
  const rawPage = Number(first(searchParams?.page))
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10_000 ? rawPage : 1
  const empty = { tab, type, sort, page, pageSize: PAGE_SIZE, total: 0, items: [], counts: { "a-traiter": 0, resolus: 0, classes: 0 } }

  try {
    const from = (page - 1) * PAGE_SIZE
    const ascending = sort === "anciens"
    const { data, error, count } = await readReports((columns) => {
      let query = service.from("reports").select(columns, { count: "exact" }).in("status", TABS[tab])
      if (type) query = query.eq("target_type", TYPES[type])
      // `purchase_request` se classe après `message` par ordre alphabétique : tri décroissant = argent d'abord.
      return query
        .order("target_type", { ascending: false })
        .order("created_at", { ascending })
        .order("number", { ascending })
        .range(from, from + PAGE_SIZE - 1)
    }, REPORT_COLUMNS)
    if (isMissingTable(error)) return { ...empty, unavailable: true, message: ERR_UNAVAILABLE }
    if (error) throw new Error("Lecture impossible.")

    const rows = data ?? []
    const [names, titles, counts, requests] = await Promise.all([
      readNames(service, rows.flatMap((r) => [r.reporter_id, r.reported_user_id, r.handled_by])),
      readMissionTitles(service, rows.map((r) => r.mission_id)),
      readTabCounts(service),
      readPurchaseSummaries(
        service,
        rows.filter((r) => r.target_type === PURCHASE_TARGET).map((r) => r.purchase_request_id),
      ),
    ])
    return { ...empty, total: count ?? rows.length, items: rows.map((r) => toItem(r, names, titles, requests)), counts }
  } catch (err) {
    console.error("[listAdminReports]", err)
    return { error: ERR_LOAD }
  }
}

/** Nombre de signalements « à traiter » (ouverts ou en cours). Table absente ou illisible : 0, sans erreur. */
export async function countOpenAdminReports() {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }

  try {
    // Sonde GET (pas HEAD) : la lecture d'une table absente répond une erreur exploitable.
    const { error, count } = await ctx.service
      .from("reports")
      .select("id", { count: "exact" })
      .in("status", OPEN_STATUSES)
      .limit(1)
    if (isMissingTable(error)) return { count: 0, unavailable: true }
    if (error) throw new Error("Lecture impossible.")
    return { count: count ?? 0 }
  } catch (err) {
    console.error("[countOpenAdminReports]", err)
    return { count: 0 }
  }
}

async function signMedia(service, message) {
  if (message.type === "text" || !message.media_url) return null
  const path = toOwnedStoragePath(message.media_url, MEDIA_BUCKET, message.sender_id)
  if (!path) return null
  try {
    const { data, error } = await service.storage.from(MEDIA_BUCKET).createSignedUrl(path, MEDIA_SIGNED_TTL)
    return error ? null : (data?.signedUrl ?? null)
  } catch {
    return null
  }
}

async function readAutoEvents(service, userId) {
  const since = new Date(Date.now() - CONTACT_ALERT_WINDOW_DAYS * DAY_MS).toISOString()
  const { data, error } = await service
    .from("message_contact_events")
    .select("kinds, action")
    .eq("sender_id", userId)
    .gte("created_at", since)
    .limit(1000)
  if (isMissingTable(error)) return null
  if (error) throw new Error("Lecture impossible.")
  const byKind = {}
  let total = 0
  for (const row of data ?? []) {
    total += 1
    for (const kind of row.kinds ?? []) byKind[kind] = (byKind[kind] ?? 0) + 1
  }
  return { windowDays: CONTACT_ALERT_WINDOW_DAYS, total, byKind }
}

// Nature, déposant et rôle de chaque preuve d'une demande (chemin du compartiment `purchase-proofs`).
const PROOF_SLOTS = [
  { kind: "payee", column: "payee_photo_path", owner: "student_id" },
  { kind: "ticket", column: "ticket_photo_path", owner: "student_id" },
  { kind: "sms", column: "sms_photo_path", owner: "client_id" },
]

function proofLabel(kind, payeeKind) {
  if (kind === "ticket") return "Ticket"
  if (kind === "sms") return "Capture du SMS"
  return payeeKind === "personal" ? "Photo du numéro personnel" : "Photo du numéro marchand"
}

/**
 * Demande d'achats visée par un signalement (AD10), lue par le service role. Aucune lecture si la demande n'appartient
 * pas à la mission du signalement ou si l'auteur du signalement n'en est pas une des deux parties : dans ces cas, ou si
 * la table manque (script 94), `null`. Les preuves sont signées pour 120 s, jamais renvoyées en chemin brut, et un
 * chemin hors du dossier de son déposant n'est pas signé.
 */
async function readPurchase(service, report) {
  if (!isUuid(report.purchase_request_id)) return null
  // Chargé à la demande : ce module serveur ("server-only") n'est utile que pour le détail d'une demande d'achats, et
  // la file des signalements de messages (et le compteur du shell admin) ne doivent pas en dépendre au chargement.
  const { REQUEST_COLUMNS, isMissingPurchaseSchema, signProofs } = await import("./purchase-request-core")
  const { data: request, error } = await service
    .from("purchase_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", report.purchase_request_id)
    .maybeSingle()
  if (isMissingPurchaseSchema(error)) return null
  if (error) throw new Error("Lecture impossible.")
  if (!request || request.mission_id !== report.mission_id) return null
  if (report.reporter_id !== request.student_id && report.reporter_id !== request.client_id) return null

  const owned = {}
  for (const slot of PROOF_SLOTS) {
    const path = request[slot.column]
    owned[slot.column] = isOwnedProofPath(path, { ownerId: request[slot.owner], requestId: request.id, kind: slot.kind }) ? path : null
  }
  const urls = await signProofs(service, [{ ...owned }])
  const names = await readNames(service, [request.student_id, request.client_id])

  const proofs = PROOF_SLOTS.filter((slot) => slot.kind !== "sms" || request.paid_at || request.sms_photo_path).map((slot) => ({
    kind: slot.kind,
    label: proofLabel(slot.kind, request.payee_kind),
    url: owned[slot.column] ? (urls[owned[slot.column]] ?? null) : null,
    at: slot.kind === "sms" ? (request.paid_at ?? null) : (request.created_at ?? null),
  }))

  const badge = statusBadge(request.status)
  return {
    id: request.id,
    seq: request.seq,
    number: requestNumber(request.seq),
    status: request.status,
    statusLabel: badge.label,
    statusTone: badge.variant,
    amount: request.amount,
    vendorName: request.vendor_name ?? "",
    items: request.items ?? null,
    payeeKindLabel: PAYEE_KIND_LABELS[request.payee_kind] ?? "",
    payeeNumber: formatPayeeNumber(request.payee_number),
    createdAt: request.created_at ?? null,
    paidAt: request.paid_at ?? null,
    paidReference: request.paid_reference ?? null,
    beneficiaryConfirmed: request.beneficiary_confirmed === true,
    receivedAt: request.received_at ?? null,
    reportedAt: request.reported_at ?? null,
    student: { id: request.student_id, name: names.get(request.student_id) ?? "" },
    client: { id: request.client_id, name: names.get(request.client_id) ?? "" },
    proofs,
  }
}

/**
 * Détail d'un signalement (AD10). Le message signalé est lu par le service role : texte tel que stocké (déjà
 * masqué), image ou vocal par URL signée de 300 s (jamais `media_url` brut), position réduite à son type.
 * Pour un signalement automatique : nombre d'événements par type sur 30 jours, jamais de valeur.
 * @param {string} id
 */
export async function getAdminReport(id) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service, admin } = ctx

  if (!isUuid(id)) return { notFound: true }

  try {
    const { data: row, error } = await readReports(
      (columns) => service.from("reports").select(columns).eq("id", id).maybeSingle(),
      REPORT_DETAIL_COLUMNS,
    )
    if (isMissingTable(error)) return { unavailable: true, message: ERR_UNAVAILABLE }
    if (error) throw new Error("Lecture impossible.")
    if (!row) return { notFound: true }

    const [names, titles] = await Promise.all([
      readNames(service, [row.reporter_id, row.reported_user_id, row.handled_by]),
      readMissionTitles(service, [row.mission_id]),
    ])

    let message = null
    if (row.message_id) {
      const { data: m, error: mErr } = await service.from("messages").select(MESSAGE_COLUMNS).eq("id", row.message_id).maybeSingle()
      if (mErr) throw new Error("Lecture impossible.")
      if (m) {
        const isText = m.type === "text" || !m.type
        const mediaUrl = await signMedia(service, m)
        message = {
          id: m.id,
          type: m.type ?? "text",
          text: isText ? (m.content ?? "") : null,
          mediaUrl,
          mediaAvailable: isText || m.type === "location" ? null : mediaUrl !== null,
          lat: m.type === "location" ? (m.location_lat ?? null) : null,
          lng: m.type === "location" ? (m.location_lng ?? null) : null,
          senderId: m.sender_id,
          createdAt: m.created_at,
        }
      }
    }

    const events = row.source === "auto" ? await readAutoEvents(service, row.reported_user_id) : null
    const purchase = row.target_type === PURCHASE_TARGET ? await readPurchase(service, row) : null
    const item = toItem(row, names, titles)
    if (purchase) item.targetDetail = purchaseTargetDetail(purchase)

    logAdminAction({
      adminId: admin.userId,
      action: "report_viewed",
      targetId: row.id,
      after: purchase ? { purchaseRequestId: purchase.id } : null,
    })

    return {
      report: {
        ...item,
        details: row.details ?? null,
        resolutionNote: row.resolution_note ?? null,
        updatedAt: row.updated_at ?? null,
      },
      message,
      events,
      purchase,
    }
  } catch (err) {
    console.error("[getAdminReport]", err)
    return { error: ERR_LOAD }
  }
}

/**
 * Clôture d'un signalement de demande d'achats : prévient les DEUX parties de la demande (`purchase_report_closed`),
 * jamais les administrateurs. Les parties viennent de la demande (pas du signalement) et la demande doit être de la
 * mission du signalement avec l'auteur du signalement parmi ses parties ; sinon aucune notification. La clé
 * d'idempotence porte le NUMÉRO DU SIGNALEMENT à la place de la version de la demande : si les deux parties signalent
 * à la même version, la clôture du second signalement n'est pas dédoublonnée à tort, et un rejeu de la clôture d'un
 * même signalement l'est. Ne lève jamais d'exception : la clôture déjà écrite reste valable.
 */
async function notifyReportClosed(service, reportId, number) {
  try {
    const { data: report, error } = await service
      .from("reports")
      .select("purchase_request_id, mission_id, reporter_id")
      .eq("id", reportId)
      .maybeSingle()
    if (error || !report || !isUuid(report.purchase_request_id)) return
    const { data: request, error: requestError } = await service
      .from("purchase_requests")
      .select("id, mission_id, student_id, client_id")
      .eq("id", report.purchase_request_id)
      .maybeSingle()
    if (requestError || !request) return
    const isParty = report.reporter_id === request.student_id || report.reporter_id === request.client_id
    if (request.mission_id !== report.mission_id || !isParty || !isUuid(request.student_id) || !isUuid(request.client_id)) return

    const { data: mission } = await service.from("missions").select("id, title").eq("id", request.mission_id).maybeSingle()
    const base = { requestId: request.id, missionId: request.mission_id, missionTitle: mission?.title ?? "", version: Number(number) }
    // Le lien de chaque destinataire pointe vers la conversation avec l'autre partie.
    await Promise.all([
      notify({ recipientId: request.client_id, ...purchaseReportClosed({ ...base, actorId: request.student_id }) }),
      notify({ recipientId: request.student_id, ...purchaseReportClosed({ ...base, actorId: request.client_id }) }),
    ])
  } catch (err) {
    console.error("[notifyReportClosed]", err?.code ?? "erreur")
  }
}

async function transition(ctx, id, { from, to, note, action }) {
  const { service, admin } = ctx
  if (!isUuid(id)) return { error: "Ce signalement est introuvable." }

  try {
    const { data: current, error } = await service.from("reports").select("id, status, target_type, number").eq("id", id).maybeSingle()
    if (isMissingTable(error)) return { error: ERR_UNAVAILABLE, unavailable: true }
    if (error) throw new Error("Lecture impossible.")
    if (!current) return { error: "Ce signalement est introuvable." }
    if (!from.includes(current.status)) return { error: ERR_STATE }

    const now = new Date().toISOString()
    const values = { status: to, handled_by: admin.userId, handled_at: now, updated_at: now }
    if (note !== undefined) values.resolution_note = note

    // Mise à jour conditionnelle : si un autre administrateur a changé le statut entre-temps, aucune ligne.
    const { data: updated, error: upErr } = await service
      .from("reports")
      .update(values)
      .eq("id", id)
      .eq("status", current.status)
      .select("id")
    if (upErr) throw new Error("Écriture impossible.")
    if (!updated || updated.length === 0) return { error: ERR_STATE }

    logAdminAction({
      adminId: admin.userId,
      action,
      targetId: id,
      before: { status: current.status },
      after: { status: to },
      reason: note ?? null,
    })
    if (current.target_type === PURCHASE_TARGET && CLOSED_STATUSES.includes(to)) await notifyReportClosed(service, id, current.number)
    return { success: true, status: to }
  } catch (err) {
    console.error(`[${action}]`, err)
    return { error: ERR_WRITE }
  }
}

/** Prend en charge un signalement ouvert (open -> in_progress). */
export async function takeReport(id) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  return transition(ctx, id, { from: ["open"], to: "in_progress", action: "report_taken" })
}

/**
 * Résout un signalement pris en charge (in_progress -> resolved). Note facultative, 500 caractères au plus,
 * passée par `maskContacts`. La suspension d'un compte reste une décision humaine prise depuis la fiche utilisateur.
 * @param {string} id
 * @param {{ note?: string }} [input]
 */
export async function resolveReport(id, input) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const note = normalizeNote(input?.note)
  if (note.error) return { error: note.error }
  return transition(ctx, id, { from: ["in_progress"], to: "resolved", note: note.value, action: "report_resolved" })
}

/**
 * Classe un signalement pris en charge (in_progress -> dismissed). Mêmes règles de note que `resolveReport`.
 * @param {string} id
 * @param {{ note?: string }} [input]
 */
export async function dismissReport(id, input) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const note = normalizeNote(input?.note)
  if (note.error) return { error: note.error }
  return transition(ctx, id, { from: ["in_progress"], to: "dismissed", note: note.value, action: "report_dismissed" })
}
