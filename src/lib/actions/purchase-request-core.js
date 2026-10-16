import "server-only"
import { clipMasked, maskContacts } from "@/lib/messaging/contact-filter"
import { reportReference } from "@/lib/messaging/moderation-rules"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { isUuid } from "@/lib/vitrine/ids"
import {
  ITEMS_MAX,
  PURCHASE_REPORT_LIMIT,
  PURCHASE_WRITE_LIMIT,
  REPORT_DETAILS_MAX,
  VENDOR_NAME_MAX,
  allowedActions,
} from "@/lib/purchases/requests"
import { PROOF_BUCKET, PROOF_SIGNED_URL_SECONDS } from "@/lib/purchases/proofs"

// Cœur testable des actions de demandes de paiement d'achats (RD-ACHATS-01 ST-04) : lectures, vues, signature des
// preuves, nettoyage des textes et plafonds. Module serveur SANS "use server" : il n'ouvre jamais de client service
// role lui-même, l'appelant lui passe un client DÉJÀ obtenu après ses contrôles d'identité, de rôle et de propriété.
// Aucune colonne privée de profils n'est lue ici, aucune erreur de base n'est renvoyée telle quelle : seul
// `error.code` est journalisé.

/** Messages d'erreur renvoyés aux utilisateurs (vouvoiement, aucun détail de base). */
export const PURCHASE_ERR = {
  generic: "Une erreur est survenue. Veuillez réessayer dans un instant.",
  load: "Impossible de charger les demandes de paiement. Veuillez réessayer.",
  unavailable: "Les demandes de paiement d'achats ne sont pas disponibles pour le moment. Veuillez réessayer plus tard.",
  notFound: "Cette demande est introuvable.",
  conversation: "Cette conversation n'est pas disponible.",
  stale: "Cette demande a changé. Rouvrez-la pour continuer.",
  notAllowed: "Cette action n'est plus possible pour cette demande.",
  proof: "Une photo est introuvable ou n'est pas valide. Ajoutez-la de nouveau.",
  payeeSelf: "Indiquez le numéro MoMo du vendeur, et non un numéro de profil EduCash.",
  rate: "Vous modifiez vos demandes trop vite. Patientez quelques minutes avant de réessayer.",
  reportLimit: "Vous avez atteint la limite de signalements pour aujourd'hui. Veuillez réessayer plus tard.",
  noChange: "Vous n'avez modifié aucune information de la demande.",
  invalid: "Votre demande n'est pas valide. Vérifiez les informations saisies.",
  reportInvalid: "Votre signalement n'est pas valide. Vérifiez le motif et l'explication.",
  reportFailed: "Votre signalement n'a pas pu être envoyé. Veuillez réessayer.",
}

// Codes d'une table ou d'une colonne absente (script 94 non appliqué) : Postgres 42P01 et 42703, PostgREST PGRST205
// (cache de schéma) et PGRST204 (colonne inconnue).
const MISSING_SCHEMA_CODES = ["42P01", "PGRST205", "42703", "PGRST204"]

/**
 * L'erreur indique-t-elle que la table ou la colonne des demandes n'existe pas encore ?
 * @param {{ code?: string, message?: string }|null|undefined} error
 * @returns {boolean}
 */
export function isMissingPurchaseSchema(error) {
  if (!error) return false
  return MISSING_SCHEMA_CODES.includes(error.code) || /schema cache|does not exist/i.test(error.message ?? "")
}

/** Colonnes lues d'une demande : jamais `updated_at`, jamais de colonne d'un autre domaine. */
export const REQUEST_COLUMNS =
  "id, mission_id, seq, student_id, client_id, status, payee_kind, payee_number, payee_photo_path, ticket_photo_path, " +
  "vendor_name, items, amount, version, paid_at, sms_photo_path, paid_reference, beneficiary_confirmed, " +
  "received_at, cancelled_at, reported_at, created_at, edited_at"

const MISSION_COLUMNS = "id, title, status, client_id, selected_student_id, purchases_estimate"
const REPORT_COLUMNS = "purchase_request_id, reporter_id, status, reason, number"
const MAX_ROWS = 200

/** Colonne de la demande qui désigne la partie de l'appelant. */
export const PARTY_COLUMN = { student: "student_id", client: "client_id" }

// ─── Lectures ────────────────────────────────────────────────────────────────────────────────

/**
 * Mission lue avec le client de SESSION (la RLS limite déjà la lecture au client, à l'étudiant retenu ou à une
 * mission ouverte). `clientId` ajoute la propriété d'une mission au client indiqué.
 * @returns {Promise<{ status: "ok", mission: object } | { status: "forbidden" } | { status: "error" }>}
 */
export async function loadMission(supabase, missionId, { clientId } = {}) {
  if (!isUuid(missionId)) return { status: "forbidden" }
  let query = supabase.from("missions").select(MISSION_COLUMNS).eq("id", missionId)
  if (clientId) query = query.eq("client_id", clientId)
  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("[purchase-requests] mission", error.code ?? "erreur")
    return { status: "error" }
  }
  if (!data || !isUuid(data.client_id)) return { status: "forbidden" }
  return {
    status: "ok",
    mission: {
      id: data.id,
      title: typeof data.title === "string" ? data.title : "",
      status: data.status,
      clientId: data.client_id,
      selectedStudentId: data.selected_student_id ?? null,
      purchasesEstimate: purchasesEstimateOf(data.purchases_estimate),
    },
  }
}

/**
 * Demande de l'appelant : la lecture est RESTREINTE à ses propres demandes (colonne de sa partie égale à son
 * identifiant), donc une demande d'un tiers et une demande inexistante donnent la même réponse.
 * @returns {Promise<{ status: "ok", row: object } | { status: "missing" } | { status: "unavailable" } | { status: "error" }>}
 */
export async function loadOwnRequest(service, { requestId, role, userId }) {
  const column = PARTY_COLUMN[role]
  if (!column || !isUuid(requestId) || !isUuid(userId)) return { status: "missing" }
  const { data, error } = await service
    .from("purchase_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq(column, userId)
    .maybeSingle()
  if (isMissingPurchaseSchema(error)) return { status: "unavailable" }
  if (error) {
    console.error("[purchase-requests] demande", error.code ?? "erreur")
    return { status: "error" }
  }
  return data ? { status: "ok", row: data } : { status: "missing" }
}

/**
 * Demandes d'une mission pour une partie (les siennes seulement), numéro d'ordre croissant.
 * @returns {Promise<{ available: false } | { error: true } | { available: true, rows: object[] }>}
 */
export async function readMissionPurchaseRequests(service, { missionId, role, userId }) {
  const column = PARTY_COLUMN[role]
  if (!column || !isUuid(missionId) || !isUuid(userId)) return { error: true }
  const { data, error } = await service
    .from("purchase_requests")
    .select(REQUEST_COLUMNS)
    .eq("mission_id", missionId)
    .eq(column, userId)
    .order("seq", { ascending: true })
    .limit(MAX_ROWS)
  if (isMissingPurchaseSchema(error)) return { available: false }
  if (error) {
    console.error("[purchase-requests] liste", error.code ?? "erreur")
    return { error: true }
  }
  return { available: true, rows: data ?? [] }
}

/**
 * Signalements de ces demandes : motif, statut, auteur et numéro seulement (jamais le commentaire, la clôture ni
 * l'administrateur qui a traité).
 * @returns {Promise<{ available: false } | { error: true } | { available: true, rows: object[] }>}
 */
export async function readRequestReports(service, requestIds) {
  const ids = [...new Set((Array.isArray(requestIds) ? requestIds : []).filter(isUuid))]
  if (ids.length === 0) return { available: true, rows: [] }
  const { data, error } = await service.from("reports").select(REPORT_COLUMNS).in("purchase_request_id", ids).limit(MAX_ROWS)
  if (isMissingPurchaseSchema(error)) return { available: false }
  if (error) {
    console.error("[purchase-requests] signalements", error.code ?? "erreur")
    return { error: true }
  }
  return { available: true, rows: data ?? [] }
}

// ─── Preuves (compartiment privé) ────────────────────────────────────────────────────────────

/**
 * Adresse signée du compartiment des preuves, sur le projet Supabase seulement. Toute autre adresse est ignorée.
 * @param {unknown} value
 * @returns {string|null}
 */
export function safeProofUrl(value) {
  if (typeof value !== "string" || value === "") return null
  let origin
  try {
    origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
  } catch {
    return null
  }
  try {
    const url = new URL(value)
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return null
    const prefix = `/storage/v1/object/sign/${PROOF_BUCKET}/`
    if (!url.pathname.startsWith(prefix) || url.pathname.length === prefix.length) return null
    if (url.pathname.split("/").some((s) => s === "." || s === ".." || /%2e/i.test(s))) return null
    return `${url.origin}${url.pathname}${url.search}`
  } catch {
    return null
  }
}

/**
 * Adresses signées (120 s) des preuves de ces demandes, en UN appel, avec le client service role passé par
 * l'appelant (le compartiment n'a aucune politique de lecture). Les chemins ne quittent pas le serveur : le résultat
 * associe un chemin à une adresse, `toPurchaseRequestView` n'en garde que l'adresse. Une erreur laisse les adresses
 * absentes (la vue affiche « Photo indisponible »), jamais de repli sur une adresse publique.
 * @returns {Promise<Record<string, string>>}
 */
export async function signProofs(service, rows) {
  const paths = [
    ...new Set(
      (rows ?? [])
        .flatMap((r) => [r?.payee_photo_path, r?.ticket_photo_path, r?.sms_photo_path])
        .filter((p) => typeof p === "string" && p !== ""),
    ),
  ]
  if (paths.length === 0) return {}
  try {
    const { data, error } = await service.storage.from(PROOF_BUCKET).createSignedUrls(paths, PROOF_SIGNED_URL_SECONDS)
    if (error || !Array.isArray(data)) {
      console.error("[purchase-requests] signature", error?.statusCode ?? error?.code ?? "erreur")
      return {}
    }
    const signed = {}
    for (const item of data) {
      const url = item && !item.error ? safeProofUrl(item.signedUrl) : null
      if (url && paths.includes(item.path)) signed[item.path] = url
    }
    return signed
  } catch (e) {
    console.error("[purchase-requests] signature", e?.code ?? "erreur")
    return {}
  }
}

/**
 * Le fichier existe-t-il dans le compartiment ? Lecture de la liste du dossier (jamais une requête HEAD).
 * @returns {Promise<{ exists: boolean } | { error: true }>}
 */
export async function proofExists(service, path) {
  if (typeof path !== "string") return { exists: false }
  const slash = path.lastIndexOf("/")
  if (slash < 1) return { exists: false }
  const folder = path.slice(0, slash)
  const name = path.slice(slash + 1)
  try {
    const { data, error } = await service.storage.from(PROOF_BUCKET).list(folder, { limit: 5, search: name })
    if (error || !Array.isArray(data)) {
      console.error("[purchase-requests] objet", error?.statusCode ?? error?.code ?? "erreur")
      return { error: true }
    }
    return { exists: data.some((object) => object?.name === name) }
  } catch (e) {
    console.error("[purchase-requests] objet", e?.code ?? "erreur")
    return { error: true }
  }
}

/**
 * Toutes les preuves de la liste existent-elles ? Une liste vide est vraie.
 * @returns {Promise<{ ok: true } | { ok: false, reason: "missing"|"error" }>}
 */
export async function proofsExist(service, paths) {
  for (const path of paths) {
    const res = await proofExists(service, path)
    if (res.error) return { ok: false, reason: "error" }
    if (!res.exists) return { ok: false, reason: "missing" }
  }
  return { ok: true }
}

// ─── Textes libres ───────────────────────────────────────────────────────────────────────────

/** Nom du vendeur : coordonnées masquées puis coupé à la limite SQL (80). */
export function cleanVendorName(value) {
  return clipMasked(maskContacts(String(value ?? "")).text, VENDOR_NAME_MAX).trim()
}

/** Articles (facultatifs) : coordonnées masquées puis coupés à la limite SQL (120) ; null si vide. */
export function cleanItems(value) {
  if (value === null || value === undefined) return null
  const text = clipMasked(maskContacts(String(value)).text, ITEMS_MAX).trim()
  return text === "" ? null : text
}

/** Explication d'un signalement : coordonnées masquées puis coupée à la limite SQL (1 000). */
export function cleanReportDetails(value) {
  return clipMasked(maskContacts(String(value ?? "")).text, REPORT_DETAILS_MAX).trim()
}

// ─── Plafonds ────────────────────────────────────────────────────────────────────────────────

/**
 * Plafond d'écritures de l'étudiant : créations (lignes créées dans la fenêtre) plus modifications (lignes
 * « modifiée » de la conversation dans la fenêtre), 5 par 10 minutes. Comptage en base, valable entre instances ;
 * lecture puis écriture ne sont pas atomiques (des envois simultanés peuvent dépasser le plafond de quelques unités).
 * @returns {Promise<{ limited: boolean } | { available: false } | { error: true }>}
 */
export async function writeLimitReached(service, userId, now = Date.now()) {
  const { max, windowMinutes } = PURCHASE_WRITE_LIMIT
  const since = new Date(now - windowMinutes * 60 * 1000).toISOString()
  const [created, edited] = await Promise.all([
    service.from("purchase_requests").select("id").eq("student_id", userId).gte("created_at", since).limit(max),
    service
      .from("messages")
      .select("id")
      .eq("sender_id", userId)
      .eq("type", "purchase_event")
      .like("content", "%a été modifiée.")
      .gte("created_at", since)
      .limit(max),
  ])
  for (const res of [created, edited]) {
    if (isMissingPurchaseSchema(res.error)) return { available: false }
    if (res.error) {
      console.error("[purchase-requests] plafond", res.error.code ?? "erreur")
      return { error: true }
    }
  }
  return { limited: (created.data?.length ?? 0) + (edited.data?.length ?? 0) >= max }
}

/**
 * Plafond de signalements (tous types confondus : messages et demandes), 10 par 24 h et par auteur.
 * @returns {Promise<{ limited: boolean } | { available: false } | { error: true }>}
 */
export async function reportLimitReached(service, userId, now = Date.now()) {
  const { max, windowHours } = PURCHASE_REPORT_LIMIT
  const since = new Date(now - windowHours * 60 * 60 * 1000).toISOString()
  const { data, error } = await service.from("reports").select("id").eq("reporter_id", userId).gte("created_at", since).limit(max)
  if (isMissingPurchaseSchema(error)) return { available: false }
  if (error) {
    console.error("[purchase-requests] plafond signalements", error.code ?? "erreur")
    return { error: true }
  }
  return { limited: (data?.length ?? 0) >= max }
}

// ─── Vue envoyée à l'interface ───────────────────────────────────────────────────────────────

/**
 * Vue d'une demande pour une partie. Contrat des props des cartes (ST-05 et ST-06). Jamais de chemin de preuve
 * (sauf, pour l'étudiant qui modifie SA demande, les deux chemins de ses propres photos : le formulaire de
 * modification les renvoie tels quels), jamais de colonne d'identité de l'autre partie, jamais le commentaire d'un
 * signalement ni la clôture de l'administrateur.
 * @param {object} row ligne de purchase_requests
 * @param {{ id: string, role: "student"|"client", missionStatus: string }} viewer
 * @param {Array<{ purchase_request_id: string, reporter_id: string, status: string, reason: string, number: number|string }>} reports
 * @param {Record<string, string>} urls adresses signées par chemin
 */
export function toPurchaseRequestView(row, viewer, reports = [], urls = {}) {
  const own = (Array.isArray(reports) ? reports : [])
    .filter((r) => r?.purchase_request_id === row.id)
    .sort((a, b) => Number(a.number) - Number(b.number))
  const mine = own.find((r) => r.reporter_id === viewer.id)
  const alreadyReportedByMe = Boolean(mine)
  const reviewed = own.length > 0 && own.every((r) => r.status === "resolved" || r.status === "dismissed")
  const view = {
    id: row.id,
    seq: row.seq,
    status: row.status,
    version: row.version,
    amount: row.amount,
    vendorName: row.vendor_name,
    items: row.items ?? null,
    payeeKind: row.payee_kind,
    payeeNumber: row.payee_number,
    payeePhotoUrl: urls[row.payee_photo_path] ?? null,
    ticketPhotoUrl: urls[row.ticket_photo_path] ?? null,
    smsPhotoUrl: row.sms_photo_path ? (urls[row.sms_photo_path] ?? null) : null,
    createdAt: row.created_at,
    sentAt: row.created_at,
    editedAt: row.edited_at ?? null,
    paidAt: row.paid_at ?? null,
    receivedAt: row.received_at ?? null,
    paidReference: row.paid_reference ?? null,
    alreadyReportedByMe,
    reportReason: own[0]?.reason ?? null,
    reportReference: mine ? reportReference(Number(mine.number)) : null,
    reviewed,
    actions: allowedActions({
      status: row.status,
      role: viewer.role,
      missionStatus: viewer.missionStatus,
      alreadyReportedByMe,
    }),
  }
  if (viewer.role === "student") {
    view.payeePhotoPath = row.payee_photo_path
    view.ticketPhotoPath = row.ticket_photo_path
  }
  return view
}
