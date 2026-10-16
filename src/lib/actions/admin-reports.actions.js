"use server"

import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import { clipMasked, maskContacts } from "@/lib/messaging/contact-filter"
import { CONTACT_ALERT_WINDOW_DAYS, REPORT_REASONS, reportReference } from "@/lib/messaging/moderation-rules"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { MEDIA_BUCKET } from "@/lib/client-space/conversations"
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
const REPORT_COLUMNS =
  "id, number, source, target_type, message_id, mission_id, reporter_id, reported_user_id, reason, status, handled_by, handled_at, created_at"
const REPORT_DETAIL_COLUMNS = `${REPORT_COLUMNS}, details, resolution_note, updated_at`
const MESSAGE_COLUMNS = "id, sender_id, receiver_id, type, content, media_url, location_lat, location_lng, created_at"

// Onglets de la file : valeur d'URL -> statuts de la base.
const TABS = {
  "a-traiter": ["open", "in_progress"],
  resolus: ["resolved"],
  classes: ["dismissed"],
}
const DEFAULT_TAB = "a-traiter"
const OPEN_STATUSES = TABS[DEFAULT_TAB]
const REASON_LABELS = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]))

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

/** Table absente (script 92 pas encore appliqué) : code Postgres 42P01 ou code PostgREST PGRST205. */
function isMissingTable(error) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205") return true
  return /schema cache|does not exist/i.test(String(error.message ?? ""))
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

function toItem(row, names, titles) {
  return {
    id: row.id,
    reference: reportReference(Number(row.number)),
    source: row.source,
    reason: row.reason,
    reasonLabel: REASON_LABELS[row.reason] ?? "Autre",
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
 * `tri` (`anciens` par défaut, `recents`) et `page` (à partir de 1). Une valeur inconnue retombe sur le défaut.
 * Table absente : `{ unavailable: true }`, liste vide, sans erreur.
 * @param {Record<string, string | string[] | undefined>} [searchParams]
 */
export async function listAdminReports(searchParams = {}) {
  const ctx = await requireAdminService()
  if (ctx.error) return { error: ctx.error }
  const { service } = ctx

  const rawTab = first(searchParams?.statut)
  const tab = Object.hasOwn(TABS, rawTab) ? rawTab : DEFAULT_TAB
  const sort = first(searchParams?.tri) === "recents" ? "recents" : "anciens"
  const rawPage = Number(first(searchParams?.page))
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10_000 ? rawPage : 1
  const empty = { tab, sort, page, pageSize: PAGE_SIZE, total: 0, items: [], counts: { "a-traiter": 0, resolus: 0, classes: 0 } }

  try {
    const from = (page - 1) * PAGE_SIZE
    const ascending = sort === "anciens"
    const { data, error, count } = await service
      .from("reports")
      .select(REPORT_COLUMNS, { count: "exact" })
      .in("status", TABS[tab])
      .order("created_at", { ascending })
      .order("number", { ascending })
      .range(from, from + PAGE_SIZE - 1)
    if (isMissingTable(error)) return { ...empty, unavailable: true, message: ERR_UNAVAILABLE }
    if (error) throw new Error("Lecture impossible.")

    const rows = data ?? []
    const [names, titles, counts] = await Promise.all([
      readNames(service, rows.flatMap((r) => [r.reporter_id, r.reported_user_id, r.handled_by])),
      readMissionTitles(service, rows.map((r) => r.mission_id)),
      readTabCounts(service),
    ])
    return { ...empty, total: count ?? rows.length, items: rows.map((r) => toItem(r, names, titles)), counts }
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
    const { data: row, error } = await service.from("reports").select(REPORT_DETAIL_COLUMNS).eq("id", id).maybeSingle()
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

    logAdminAction({ adminId: admin.userId, action: "report_viewed", targetId: row.id })

    return {
      report: {
        ...toItem(row, names, titles),
        targetType: row.target_type,
        details: row.details ?? null,
        resolutionNote: row.resolution_note ?? null,
        updatedAt: row.updated_at ?? null,
      },
      message,
      events,
    }
  } catch (err) {
    console.error("[getAdminReport]", err)
    return { error: ERR_LOAD }
  }
}

async function transition(ctx, id, { from, to, note, action }) {
  const { service, admin } = ctx
  if (!isUuid(id)) return { error: "Ce signalement est introuvable." }

  try {
    const { data: current, error } = await service.from("reports").select("id, status").eq("id", id).maybeSingle()
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
