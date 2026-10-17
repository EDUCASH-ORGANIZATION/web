"use server"

// Messagerie (espace client C12 et C13, espace étudiant E06 et E07).
//
// Une conversation est une paire (mission, étudiant). Fonctions client : chaque export commence par
// requireRole(["client"]), puis établit côté serveur, à CHAQUE appel : la mission appartient au client de la
// session ; l'étudiant est l'étudiant retenu ou a une candidature à CETTE mission.
// Fonctions étudiant : chaque export commence par requireRole(["student"]). La conversation est (mission,
// étudiant = session) : l'étudiant y est retenu ou a une candidature à cette mission, et l'interlocuteur est
// DÉDUIT de la mission (`missions.client_id`), jamais lu dans l'entrée, l'adresse ou une ligne de message.
// La politique messages_insert de la base laisse envoyer à n'importe quel destinataire : ce sont ces actions
// qui refusent un destinataire tiers, et les lectures qui ignorent les messages d'un compte sans lien légitime.
// Insertion (RD-MSG-01) : par le client service role, APRÈS identité, rôle, paire et droit d'écriture. Le script 93
// retire le droit INSERT à authenticated et le trigger messages_rules ne protège plus le service role : `deliverMessage`
// refait donc chacune de ses règles (paire, expéditeur suspendu, 4000 caractères, média dans le dossier de
// l'expéditeur, bornes des coordonnées, expéditeur différent du destinataire). Les messages TEXTE passent par le
// masquage des coordonnées (le message part toujours) et le journal de détection ; photos, vocaux et positions
// ne sont jamais analysés. Aucune action ne modifie ni ne supprime un message (seul `read` change).
// L'expéditeur est toujours l'identifiant de la session. Aucune lecture ne renvoie de colonne privée de
// profils : nom public ("Prénom I."), avatar et initiales seulement.
//
// Messages d'achats (RD-ACHATS-01) : la carte `purchase_request` et la ligne système `purchase_event` sont écrites par le
// serveur seul (`src/lib/purchases/purchase-messages.js`). Aucun envoi utilisateur ne peut produire ces types
// (SENDABLE_MESSAGE_TYPES), ils ne passent jamais par le masquage des coordonnées et ne comptent pas dans le débit.
// Les lectures de conversation les exposent avec `purchaseRequestId`, et joignent les demandes (vues de
// purchase-request.actions.js) quand la mission prévoit des achats ou que le fil contient un message d'achat. Avant le
// script 94 (colonne et table absentes) les lectures retombent sur le rendu d'avant : aucune demande, aucune erreur.
//
// Limites documentées :
// - la boîte de réception lit les 1000 messages les plus récents de l'utilisateur ; une conversation dont
//   tous les messages sont plus anciens n'y figure pas ;
// - une conversation charge ses 200 derniers messages ;
// - débit : 20 messages par minute et par utilisateur, compté en base (valable entre instances). Le
//   comptage puis l'insertion ne sont pas atomiques : des envois simultanés peuvent dépasser la limite de
//   quelques messages, sans autre effet ;
// - politique RLS des missions (lecture si status = 'open', client, ou étudiant retenu) : un candidat NON retenu ne
//   lit plus une mission qui n'est plus ouverte. Côté étudiant, `loadStudentPair` ne trouve alors pas la mission : sa
//   conversation répond 404 et disparaît de la liste (E06). Ce n'est pas une faille (le refus est la valeur par
//   défaut), mais une limite de comportement. À la migration Neon (sans cette RLS), le comportement attendu doit
//   être décidé : conserver l'accès en lecture à l'historique, ou le fermer explicitement ;
// - la taille d'un fichier joint est bornée par le compartiment (10 Mo) et par le navigateur avant l'envoi ;
//   l'action contrôle le chemin (dossier de l'expéditeur) et le type d'après l'extension.

import { z } from "zod"
import { requireRole } from "@/lib/auth/require-role"
import { createServiceClient } from "@/lib/supabase/service"
import { detectSplitPhone, maskContacts, maskDigitRuns } from "@/lib/messaging/contact-filter"
import { maybeOpenAutoReport, recordContactEvent } from "@/lib/messaging/moderation-log"
import { MASKABLE_KINDS, SPLIT_LOOKBACK, SPLIT_WINDOW_MINUTES } from "@/lib/messaging/moderation-rules"
import { readCompletionDeclared } from "@/lib/actions/mission-completion-core"
import { toOwnedStoragePath, toProjectAvatarUrl } from "@/lib/storage/owned-paths"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import { getClientPurchaseRequests, getStudentPurchaseRequests } from "@/lib/actions/purchase-request.actions"
import { purchaseTotals } from "@/lib/purchases/requests"
import { netAmount } from "@/lib/constants/missions"
import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import {
  MEDIA_BUCKET,
  MEDIA_CONTENT,
  MEDIA_SIGNED_URL_TTL,
  MESSAGE_MAX_LENGTH,
  SENDABLE_MESSAGE_TYPES,
  buildConversations,
  conversationAccess,
  withCompletionDeclared,
  coordsValid,
  isPairRow,
  isPurchaseMessageType,
  mediaKindOfPath,
  mediaPathOf,
  mergeMessages,
  previewOf,
  safeSignedMediaUrl,
  toMessage,
} from "@/lib/client-space/conversations"

const ERR_LOAD = "Impossible de charger vos messages. Veuillez réessayer."
const ERR_SEND = "Votre message n'a pas pu être envoyé. Veuillez réessayer."
const ERR_UNAVAILABLE = "Cette conversation n'est pas disponible."
const ERR_READONLY = "Cette conversation est en lecture seule."
const ERR_INVALID = "Votre message n'est pas valide. Vérifiez son contenu et sa longueur."
const ERR_MEDIA = "Ce fichier n'est pas accepté. Choisissez une image ou un message vocal de 10 Mo au plus."
const ERR_RATE = "Vous envoyez des messages trop vite. Patientez un instant avant de réessayer."

const INBOX_ROWS_LIMIT = 1000
const THREAD_ROWS_LIMIT = 200
const SEND_LIMIT = 20
const SEND_WINDOW_MS = 60 * 1000

const INBOX_COLUMNS = "id, mission_id, sender_id, receiver_id, content, type, read, created_at"
const MEDIA_IDS_MAX = 50
const MESSAGE_COLUMNS =
  "id, mission_id, sender_id, receiver_id, content, type, media_url, location_lat, location_lng, read, created_at"
// Lecture d'un fil : ajoute le lien vers la demande d'achats (colonne créée par le script 94).
const THREAD_COLUMNS = `${MESSAGE_COLUMNS}, purchase_request_id`
const MISSION_COLUMNS = "id, title, status, selected_student_id, type, budget, purchases_estimate"
// Colonnes publiques seulement : jamais de select("*") sur profiles.
const PUBLIC_PROFILE_COLUMNS = "user_id, full_name, avatar_url"

// Identifiants en minuscules : les comparaisons expéditeur / destinataire / étudiant retenu ne dépendent pas de la casse.
const uuid = z.string().refine(isUuid).transform((value) => value.toLowerCase())
const sendSchema = z.object({
  missionId: uuid,
  studentId: uuid,
  type: z.enum(SENDABLE_MESSAGE_TYPES),
  content: z.string().max(MESSAGE_MAX_LENGTH).optional(),
  mediaPath: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const mediaIdsSchema = z.array(uuid).min(1).max(MEDIA_IDS_MAX)

const toMission = (m) => ({
  id: m.id,
  title: typeof m.title === "string" ? m.title : "",
  status: m.status,
  selectedStudentId: m.selected_student_id ?? null,
  type: typeof m.type === "string" ? m.type : null,
  budget: toBudget(m.budget),
  purchasesEstimate: purchasesEstimateOf(m.purchases_estimate),
})

// Budget en FCFA : la colonne peut arriver en chaîne (numeric). Nombre fini positif ou nul, sinon null.
function toBudget(raw) {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Informations de mission du volet de conversation : colonnes de la même ligne de mission, déjà contrôlée.
const toMissionInfo = (m) => ({
  title: m.title,
  status: m.status,
  type: m.type,
  budget: m.budget,
  purchasesEstimate: m.purchasesEstimate,
})

function toStudent(id, profile) {
  return {
    id,
    name: publicDisplayName(profile?.full_name),
    avatarUrl: typeof profile?.avatar_url === "string" && profile.avatar_url !== "" ? profile.avatar_url : null,
  }
}

// Côté étudiant, l'interlocuteur est le client : sa colonne avatar_url est écrite par lui (RLS de profils), donc une
// URL externe est possible (pixel de suivi). Seule une URL du projet Supabase, bucket avatars, est renvoyée.
function toClientParty(id, profile) {
  return { ...toStudent(id, profile), avatarUrl: toProjectAvatarUrl(profile?.avatar_url) }
}

/**
 * Établit que `studentId` est un interlocuteur légitime de `missionId` pour le client `userId`.
 * @returns {Promise<{ status: "ok", mission: object, access: object, application: object|null } | { status: "forbidden" } | { status: "error" }>}
 */
async function loadPair(supabase, userId, missionId, studentId) {
  if (!isUuid(missionId)) return { status: "forbidden" }
  const { data: missionRow, error } = await supabase
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("id", missionId)
    .eq("client_id", userId)
    .maybeSingle()
  if (error) {
    console.error("[message.actions] mission", error.message)
    return { status: "error" }
  }
  if (!missionRow) return { status: "forbidden" }
  const mission = toMission(missionRow)

  const candidateId = studentId ?? mission.selectedStudentId
  if (!isUuid(candidateId)) return { status: "forbidden" }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("status")
    .eq("mission_id", missionId)
    .eq("student_id", candidateId)
    .maybeSingle()
  if (appError) {
    console.error("[message.actions] candidature", appError.message)
    return { status: "error" }
  }

  const access = conversationAccess({ mission, application: application ?? null, studentId: candidateId })
  if (!access.allowed) return { status: "forbidden" }
  return { status: "ok", mission, access, application: application ?? null, studentId: candidateId }
}

/**
 * Adresses signées (1 h) des médias donnés, en UN appel, avec le client de SESSION : la politique de lecture
 * `message_media_select_participants` limite la signature aux participants du message (jamais de service role).
 * Une erreur ou une adresse invalide laisse le chemin absent du résultat : jamais de repli sur
 * l'adresse publique. Fonctionne que le compartiment soit public ou privé.
 * @param {object} supabase client de session
 * @param {string[]} paths chemins dans message-media
 * @returns {Promise<Record<string, string>>} adresse signée par chemin
 */
async function signMediaPaths(supabase, paths) {
  const unique = [...new Set(paths.filter((p) => typeof p === "string" && p !== ""))]
  if (unique.length === 0) return {}
  try {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, MEDIA_SIGNED_URL_TTL)
    if (error || !Array.isArray(data)) {
      console.error("[message.actions] signature", error?.message ?? "réponse inattendue")
      return {}
    }
    const signed = {}
    for (const item of data) {
      const url = !item?.error ? safeSignedMediaUrl(item?.signedUrl) : null
      if (url && unique.includes(item.path)) signed[item.path] = url
    }
    return signed
  } catch (e) {
    console.error("[message.actions] signature", e?.message)
    return {}
  }
}

/** Messages (toMessage) de lignes déjà filtrées, avec leurs médias signés en un seul appel. */
async function toSignedMessages(supabase, rows, userId) {
  const paths = rows.map((row) => (row.type === "image" || row.type === "voice" ? mediaPathOf(row.media_url, row.sender_id) : null))
  const signed = await signMediaPaths(supabase, paths.filter(Boolean))
  return rows.map((row) => toMessage(row, userId, signed)).filter(Boolean)
}

/**
 * Nouvelle signature des médias de messages d'une paire déjà établie. Le chemin vient de la ligne en base,
 * jamais de l'entrée ; un identifiant hors de la paire est ignoré (absent du résultat).
 */
async function resolvePairMedia(supabase, userId, otherId, missionId, messageIds) {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("mission_id", missionId)
    .in("id", messageIds)
  if (error) {
    console.error("[message.actions] médias", error.message)
    return { error: ERR_LOAD }
  }
  const rows = (data ?? []).filter(
    (row) =>
      messageIds.includes(row.id) &&
      row.mission_id === missionId &&
      isPairRow(row, userId, otherId) &&
      (row.type === "image" || row.type === "voice"),
  )
  const signed = await signMediaPaths(supabase, rows.map((row) => mediaPathOf(row.media_url, row.sender_id)).filter(Boolean))
  const media = {}
  for (const row of rows) {
    const path = mediaPathOf(row.media_url, row.sender_id)
    media[row.id] = (path && signed[path]) || null
  }
  return { media }
}

// Colonne de lien d'achat absente (script 94 non appliqué) : PostgREST répond 42703 ou PGRST204.
const isMissingLinkColumn = (error) =>
  Boolean(error) && ["42703", "PGRST204"].includes(error.code) && /purchase_request_id/.test(error.message ?? "")

/**
 * Derniers messages d'une paire dans une mission, avec le lien d'achat. Colonne absente : relecture à l'identique
 * sans elle (le rendu d'avant le script 94 : aucun message d'achat n'existe).
 */
async function readThreadRows(supabase, { missionId, userId, otherId }) {
  const read = (columns) =>
    supabase
      .from("messages")
      .select(columns)
      .eq("mission_id", missionId)
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: false })
      .limit(THREAD_ROWS_LIMIT)
  const first = await read(THREAD_COLUMNS)
  return isMissingLinkColumn(first.error) ? read(MESSAGE_COLUMNS) : first
}

const noPurchases = () => ({
  purchasesAvailable: false,
  purchaseRequests: [],
  purchaseTotals: purchaseTotals([]),
  purchaseCanCreate: false,
})

/**
 * Demandes d'achats d'une conversation, lues par les lecteurs de purchase-request.actions.js (rôle et propriété
 * revérifiés par eux, jamais de demande d'autrui). Lecture seulement quand la mission prévoit des achats ou que le fil
 * contient un message d'achat. Fonction indisponible (script 94 non appliqué), erreur ou refus : aucune demande et
 * `purchasesAvailable: false` - la conversation se charge toujours.
 * @returns {Promise<{ purchasesAvailable: boolean, purchaseRequests: object[], purchaseTotals: object, purchaseCanCreate: boolean }>}
 */
async function readConversationPurchases(role, mission, messages) {
  const hasPurchaseMessage = messages.some((m) => isPurchaseMessageType(m.type))
  if (!hasPurchaseMessage && mission.purchasesEstimate === null) return noPurchases()
  try {
    const read = await (role === "student" ? getStudentPurchaseRequests : getClientPurchaseRequests)({ missionId: mission.id })
    if (read?.available !== true || !Array.isArray(read.requests)) return noPurchases()
    return {
      purchasesAvailable: true,
      purchaseRequests: read.requests,
      purchaseTotals: read.totals ?? purchaseTotals([]),
      purchaseCanCreate: role === "student" && read.canCreate === true,
    }
  } catch (e) {
    console.error("[message.actions] achats", e?.code ?? "erreur")
    return noPurchases()
  }
}

/**
 * Conversations du client, une par (mission, étudiant), les plus récentes d'abord. Seules les paires
 * légitimes apparaissent : un message d'un compte sans candidature à la mission est ignoré.
 * @returns {Promise<{ conversations: Array<object> } | { error: string }>}
 */
export async function getClientConversations() {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const { data: rows, error } = await supabase
    .from("messages")
    .select(INBOX_COLUMNS)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(INBOX_ROWS_LIMIT)
  if (error) {
    console.error("[getClientConversations] messages", error.message)
    return { error: ERR_LOAD }
  }

  const built = buildConversations(rows ?? [], user.id)
  if (built.length === 0) return { conversations: [] }

  const missionIds = [...new Set(built.map((c) => c.missionId))]
  const studentIds = [...new Set(built.map((c) => c.studentId))]
  // Les missions du client d'abord : les candidatures ne sont lues que pour les missions retenues, jamais pour
  // des identifiants issus de messages écrits par un tiers.
  const missionsRes = await supabase.from("missions").select(MISSION_COLUMNS).eq("client_id", user.id).in("id", missionIds)
  if (missionsRes.error) {
    console.error("[getClientConversations] lecture", missionsRes.error.message)
    return { error: ERR_LOAD }
  }
  const ownedMissionIds = (missionsRes.data ?? []).map((m) => m.id)
  const [applicationsRes, profilesRes] = await Promise.all([
    ownedMissionIds.length > 0
      ? supabase.from("applications").select("mission_id, student_id, status").in("mission_id", ownedMissionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("user_id", studentIds),
  ])
  if (applicationsRes.error || profilesRes.error) {
    console.error("[getClientConversations] lecture", applicationsRes.error?.message ?? profilesRes.error?.message)
    return { error: ERR_LOAD }
  }

  const missions = new Map((missionsRes.data ?? []).map((m) => [m.id, toMission(m)]))
  const applications = new Map(
    (applicationsRes.data ?? []).map((a) => [`${a.mission_id}:${a.student_id}`, { status: a.status }]),
  )
  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]))

  const conversations = []
  for (const conv of built) {
    const mission = missions.get(conv.missionId)
    if (!mission) continue
    const access = conversationAccess({
      mission,
      application: applications.get(conv.key) ?? null,
      studentId: conv.studentId,
    })
    if (!access.allowed) continue
    const student = toStudent(conv.studentId, profiles.get(conv.studentId))
    conversations.push({
      key: conv.key,
      missionId: conv.missionId,
      studentId: conv.studentId,
      name: student.name,
      avatarUrl: student.avatarUrl,
      missionTitle: mission.title,
      state: access.state,
      preview: previewOf(conv.last),
      lastAt: conv.last.createdAt,
      unreadCount: conv.unreadCount,
    })
  }
  return { conversations }
}

/**
 * Une conversation (mission, étudiant) : en-tête, droit d'écriture et messages de cette paire seulement.
 * Sans `studentId`, l'interlocuteur est l'étudiant retenu de la mission. Mission d'un autre client,
 * identifiant mal formé ou étudiant sans lien avec la mission : `{ notFound: true }`.
 * @param {{ missionId: string, studentId?: string }} input
 * @returns {Promise<{ conversation: object } | { notFound: true } | { error: string }>}
 */
export async function getClientConversation({ missionId, studentId } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const pair = await loadPair(supabase, user.id, missionId, studentId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { notFound: true }
  const other = pair.studentId

  const [messagesRes, profileRes, completionAccess] = await Promise.all([
    readThreadRows(supabase, { missionId, userId: user.id, otherId: other }),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("user_id", other).maybeSingle(),
    readPairCompletion(supabase, pair.access, missionId).catch((e) => ({ failure: e })),
  ])
  if (messagesRes.error || profileRes.error || completionAccess.failure) {
    console.error(
      "[getClientConversation] lecture",
      messagesRes.error?.message ?? profileRes.error?.message ?? completionAccess.failure?.code ?? completionAccess.failure?.message,
    )
    return { error: ERR_LOAD }
  }

  // Seconde barrière : seules les lignes de la paire passent, quoi que renvoie la lecture.
  const pairMessages = await toSignedMessages(
    supabase,
    (messagesRes.data ?? []).filter((row) => row.mission_id === missionId && isPairRow(row, user.id, other)),
    user.id,
  )
  // Du plus ancien au plus récent, sans doublon.
  const messages = mergeMessages([], pairMessages)
  const purchases = await readConversationPurchases("client", pair.mission, messages)

  return {
    conversation: {
      userId: user.id,
      missionId,
      studentId: other,
      student: toStudent(other, profileRes.data),
      mission: toMissionInfo(pair.mission),
      relation: pair.mission.selectedStudentId === other ? "selected" : "candidate",
      state: completionAccess.state,
      completionDeclaredAt: completionAccess.completionDeclaredAt,
      completionAvailable: completionAccess.completionAvailable,
      canWrite: completionAccess.canWrite,
      messages,
      ...purchases,
    },
  }
}

// ─── Envoi commun client / étudiant ───────────────────────────────────────────────────────────────────────────

// Limite de la base (messages_rules) : le texte masqué peut dépasser la limite de saisie (2000) sans dépasser celle-ci.
const MESSAGE_DB_MAX = 4000

/**
 * Valide l'entrée d'un envoi et prépare le message (texte nettoyé, adresse du média reconstruite, coordonnées).
 * Le chemin du média doit être dans le dossier de l'expéditeur ; l'adresse publique est reconstruite ici.
 * @returns {{ draft: { missionId: string, type: string, text: string, mediaUrl: string|null, latitude: number|null, longitude: number|null } } | { error: string }}
 */
function buildDraft(supabase, userId, { missionId, type, content, mediaPath, lat, lng }) {
  // Les types d'achat ne s'envoient jamais : même hors du schéma, ce contrôle les refuse avant toute écriture.
  if (!SENDABLE_MESSAGE_TYPES.includes(type)) return { error: ERR_INVALID }
  let text
  let mediaUrl = null
  let latitude = null
  let longitude = null
  if (type === "text") {
    text = (content ?? "").trim()
    if (text === "" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return { error: ERR_INVALID }
  } else if (type === "location") {
    if (!coordsValid(lat, lng)) return { error: ERR_INVALID }
    text = MEDIA_CONTENT.location
    latitude = lat
    longitude = lng
  } else {
    const owned = toOwnedStoragePath(mediaPath, MEDIA_BUCKET, userId)
    if (!owned || mediaKindOfPath(owned) !== type) return { error: ERR_MEDIA }
    const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(owned)
    if (!publicData?.publicUrl) return { error: ERR_SEND }
    // Identifiant du média (URL publique canonique), pas une adresse servie : l'affichage passe par une adresse signée.
    mediaUrl = publicData.publicUrl
    text = MEDIA_CONTENT[type]
  }
  return { draft: { missionId, type, text, mediaUrl, latitude, longitude } }
}

/**
 * Règles de la base (trigger messages_rules) refaites ici : l'insertion se fait avec le service role, pour lequel
 * le trigger ne protège plus rien (il sort dès sa première ligne hors appelant API). Refus si :
 * identifiants invalides, expéditeur égal au destinataire, expéditeur suspendu, contenu de plus de 4000 caractères,
 * média hors du dossier de l'expéditeur, coordonnées hors bornes. La paire (client de la mission, étudiant candidat
 * ou retenu) est établie par loadPair / loadStudentPair (`pair`), l'écriture autorisée par `access.canWrite`.
 * @returns {boolean} vrai si l'envoi doit être refusé
 */
function violatesMessageRules({ pair, profile, senderId, receiverId, missionId, content, mediaUrl, latitude, longitude }) {
  if (!isUuid(senderId) || !isUuid(receiverId) || !isUuid(missionId)) return true
  if (senderId === receiverId) return true
  if (pair?.status !== "ok" || pair.access?.allowed !== true || pair.access.canWrite !== true) return true
  if (profile?.is_suspended === true) return true
  if (typeof content !== "string" || content === "" || content.length > MESSAGE_DB_MAX) return true
  if (mediaUrl !== null && !(typeof mediaUrl === "string" && mediaUrl.includes(`/${MEDIA_BUCKET}/${senderId}/`))) return true
  if (latitude !== null && !(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90)) return true
  if (longitude !== null && !(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180)) return true
  return false
}

/**
 * Masque les coordonnées d'un message TEXTE (jamais les autres types) : numéros, e-mails, liens, réseaux, et chiffres
 * d'un numéro coupé en plusieurs messages (D9). Les mots-clés seuls sont journalisés sans masquage.
 * @returns {{ content: string, kinds: string[], count: number, masked: boolean }}
 */
function moderateText(text, previousTexts) {
  const result = maskContacts(text)
  let content = result.masked ? result.text : text
  const kinds = new Set(result.kinds)
  let count = result.count
  let masked = result.masked
  if (previousTexts.length > 0 && detectSplitPhone(previousTexts, text)) {
    const digitsMasked = maskDigitRuns(content)
    kinds.add("phone_split")
    count += 1
    if (digitsMasked !== content) {
      content = digitsMasked
      masked = true
    }
  }
  return { content, kinds: [...kinds], count: Math.max(1, count), masked }
}

/**
 * Derniers messages texte de l'expéditeur dans la même paire sur la fenêtre de découpage, du plus ancien au plus
 * récent. Lecture avec le client de session.
 * @returns {Promise<string[] | null>} null si la lecture échoue
 */
async function readPreviousTexts(supabase, { missionId, senderId, receiverId }) {
  const since = new Date(Date.now() - SPLIT_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("messages")
    .select("content")
    .eq("mission_id", missionId)
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .eq("type", "text")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(SPLIT_LOOKBACK)
  if (error) return null
  return (data ?? [])
    .map((r) => r.content)
    .filter((c) => typeof c === "string")
    .reverse()
}

// Délai maximal d'attente du journal et de l'alerte après l'insertion du message.
const JOURNAL_DEADLINE_MS = 2000

/** Attend `work` au plus `ms` millisecondes ; ne lève jamais (le travail en retard continue sans être attendu). */
async function withDeadline(work, ms) {
  let timer
  const deadline = new Promise((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([work.catch(() => {}), deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fin commune de sendClientMessage et sendStudentMessage, APRÈS identité, rôle, paire et droit d'écriture :
 * règles de la base refaites, débit, masquage (texte seulement), insertion par le service role, puis journal et
 * alerte. Le journal ne fait jamais échouer l'envoi.
 * Limites acceptées : (1) les contrôles et l'insertion ne sont pas atomiques (suspension ou retrait de candidature entre
 * loadPair et l'insertion) ; (2) le découpage d'un numéro se contourne par 1 à 2 chiffres par message ou par un envoi
 * espacé de plus de SPLIT_WINDOW_MINUTES (D9) ; (3) si la signature du message inséré échoue complètement
 * (`toSignedMessages` vide), la réponse est ERR_SEND alors que le message existe (comportement antérieur).
 * @returns {Promise<{ success: true, message: object, contactMasked: { kinds: string[] } | null } | { error: string }>}
 */
async function deliverMessage({ tag, auth, pair, receiverId, draft }) {
  const { supabase, user, profile } = auth
  const { missionId, type, mediaUrl, latitude, longitude } = draft

  const rules = { pair, profile, senderId: user.id, receiverId, missionId, mediaUrl, latitude, longitude }
  if (violatesMessageRules({ ...rules, content: draft.text })) return { error: ERR_UNAVAILABLE }

  const since = new Date(Date.now() - SEND_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .in("type", SENDABLE_MESSAGE_TYPES)
    .gte("created_at", since)
  if (countError) {
    console.error(`[${tag}] débit`, countError.code ?? "erreur")
    return { error: ERR_SEND }
  }
  if ((count ?? 0) >= SEND_LIMIT) return { error: ERR_RATE }

  let content = draft.text
  let detection = null
  if (type === "text") {
    const previousTexts = await readPreviousTexts(supabase, { missionId, senderId: user.id, receiverId })
    if (previousTexts === null) {
      console.error(`[${tag}] découpage`)
      return { error: ERR_SEND }
    }
    detection = moderateText(draft.text, previousTexts)
    content = detection.content
    if (violatesMessageRules({ ...rules, content })) return { error: ERR_INVALID }
  }

  let service
  try {
    service = createServiceClient()
  } catch {
    console.error(`[${tag}] configuration serveur`)
    return { error: ERR_SEND }
  }
  // Destinataire dont le compte est fermé (colonne closed_at du script 96) : aucun message n'est écrit. Lecture en
  // erreur : refus aussi (fail-closed).
  const { data: receiver, error: receiverError } = await service
    .from("profiles")
    .select("closed_at")
    .eq("user_id", receiverId)
    .maybeSingle()
  if (receiverError) {
    console.error(`[${tag}] destinataire`, receiverError.code ?? "erreur")
    return { error: ERR_SEND }
  }
  if (receiver?.closed_at != null) return { error: ERR_UNAVAILABLE }

  const { data: row, error } = await service
    .from("messages")
    .insert({
      mission_id: missionId,
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      type,
      media_url: mediaUrl,
      location_lat: latitude,
      location_lng: longitude,
      read: false,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error || !row) {
    if (error) console.error(`[${tag}] insertion`, error.code ?? "erreur")
    return { error: ERR_SEND }
  }

  let contactMasked = null
  if (detection && detection.kinds.length > 0) {
    const masked = detection.masked
    if (masked) contactMasked = { kinds: detection.kinds.filter((k) => MASKABLE_KINDS.includes(k)) }
    // Le message est déjà inséré : au-delà du délai, l'envoi répond succès et le journal se termine (ou est abandonné) sans erreur.
    const journal = (async () => {
      await recordContactEvent({
        messageId: row.id,
        missionId,
        senderId: user.id,
        kinds: detection.kinds,
        count: detection.count,
        action: masked ? "masked" : "flagged",
        client: service,
      })
      if (masked) {
        await maybeOpenAutoReport({ senderId: user.id, missionId, messageId: row.id, client: service })
      }
    })()
    await withDeadline(journal, JOURNAL_DEADLINE_MS)
  }

  const [message] = await toSignedMessages(supabase, [row], user.id)
  if (!message) return { error: ERR_SEND }
  return { success: true, message, contactMasked }
}

/**
 * Envoie un message du client à l'étudiant d'une conversation. Texte, image, message vocal ou position.
 * `mediaPath` doit désigner un fichier du dossier de l'expéditeur dans `message-media` ; l'adresse
 * publique est reconstruite ici, jamais reprise du navigateur.
 * @param {{ missionId: string, studentId: string, type: "text"|"image"|"voice"|"location", content?: string, mediaPath?: string, lat?: number, lng?: number }} input
 * Les coordonnées d'un message texte sont masquées côté serveur (le message part toujours) : `contactMasked`.
 * @returns {Promise<{ success: true, message: object, contactMasked: { kinds: string[] } | null } | { error: string }>}
 */
export async function sendClientMessage(input) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { error: ERR_INVALID }
  const { studentId } = parsed.data

  const built = buildDraft(supabase, user.id, parsed.data)
  if (built.error) return { error: built.error }

  const pair = await loadPair(supabase, user.id, built.draft.missionId, studentId)
  if (pair.status === "error") return { error: ERR_SEND }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }
  if (!pair.access.canWrite) return { error: ERR_READONLY }

  return deliverMessage({ tag: "sendClientMessage", auth, pair, receiverId: pair.studentId, draft: built.draft })
}

/**
 * Nouvelles adresses signées de médias d'une conversation (temps réel, adresse expirée). Retourne
 * `{ media: { [messageId]: adresse|null } }` ; un message qui n'est pas de la paire est absent du résultat.
 * @param {{ missionId: string, studentId: string, messageIds: string[] }} input
 * @returns {Promise<{ media: Record<string, string|null> } | { error: string }>}
 */
export async function getClientMessageMedia({ missionId, studentId, messageIds } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth
  const ids = mediaIdsSchema.safeParse(messageIds)
  if (!ids.success || !isUuid(studentId)) return { error: ERR_INVALID }

  const pair = await loadPair(supabase, user.id, missionId, studentId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }
  return resolvePairMedia(supabase, user.id, pair.studentId, missionId, ids.data)
}

/**
 * Marque comme lus les messages REÇUS dans cette conversation (cette mission, cet étudiant) : jamais ceux
 * d'une autre mission ni d'un autre étudiant. Seule la colonne `read` est modifiée.
 * @param {{ missionId: string, studentId: string }} input
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markClientConversationRead({ missionId, studentId } = {}) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth
  if (!isUuid(studentId)) return { error: ERR_UNAVAILABLE }

  const pair = await loadPair(supabase, user.id, missionId, studentId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }

  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("mission_id", missionId)
    .eq("receiver_id", user.id)
    .eq("sender_id", pair.studentId)
    .eq("read", false)
  if (error) {
    console.error("[markClientConversationRead]", error.message)
    return { error: ERR_LOAD }
  }
  return { success: true }
}

// ─── Espace étudiant (E06 boîte de réception, E07 conversation) ───────────────────────────────────────────────

// `client_id` sert à DÉDUIRE l'interlocuteur : il n'est jamais renvoyé tel quel aux vues autrement que comme
// identifiant public de la paire.
const STUDENT_MISSION_COLUMNS =
  "id, title, status, selected_student_id, client_id, type, budget, purchases_estimate"

const studentSendSchema = z.object({
  missionId: uuid,
  type: z.enum(SENDABLE_MESSAGE_TYPES),
  content: z.string().max(MESSAGE_MAX_LENGTH).optional(),
  mediaPath: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

/**
 * Date de fin déclarée de la mission d'une conversation autorisée, lue SEULEMENT pour l'état `in_progress`
 * (paire déjà établie : mission du client, ou étudiant retenu). Colonne absente : `available: false`, date null.
 * Toute autre erreur lève, l'appelant répond par l'erreur neutre.
 */
async function readPairCompletion(supabase, access, missionId) {
  if (access.state !== "in_progress") return withCompletionDeclared(access, null)
  const { available, byId } = await readCompletionDeclared(supabase, [missionId])
  // Réponse sans la ligne (RLS, mission réattribuée) : indisponible, jamais un faux « non déclaré ».
  return withCompletionDeclared(access, byId.get(missionId) ?? null, available && byId.has(missionId))
}

const toStudentMission = (m) => ({ ...toMission(m), clientId: m.client_id })

/**
 * Établit que l'étudiant `userId` (la session) a une conversation légitime sur `missionId` : il est retenu ou
 * a une candidature à cette mission. L'interlocuteur est le client de la mission, lu en base.
 * @returns {Promise<{ status: "ok", mission: object, access: object, clientId: string } | { status: "forbidden" } | { status: "error" }>}
 */
async function loadStudentPair(supabase, userId, missionId) {
  if (!isUuid(userId) || !isUuid(missionId)) return { status: "forbidden" }
  const { data: missionRow, error } = await supabase
    .from("missions")
    .select(STUDENT_MISSION_COLUMNS)
    .eq("id", missionId)
    .maybeSingle()
  if (error) {
    console.error("[message.actions] mission (étudiant)", error.message)
    return { status: "error" }
  }
  if (!missionRow || !isUuid(missionRow.client_id) || missionRow.client_id === userId) return { status: "forbidden" }
  const mission = toStudentMission(missionRow)

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("status")
    .eq("mission_id", missionId)
    .eq("student_id", userId)
    .maybeSingle()
  if (appError) {
    console.error("[message.actions] candidature (étudiant)", appError.message)
    return { status: "error" }
  }

  const access = conversationAccess({ mission, application: application ?? null, studentId: userId })
  if (!access.allowed) return { status: "forbidden" }
  return { status: "ok", mission, access, clientId: mission.clientId }
}

/**
 * Conversations de l'étudiant, une par (mission, client), les plus récentes d'abord. Seules les paires
 * légitimes apparaissent : l'étudiant a candidaté ou est retenu, et l'interlocuteur est le client de la
 * mission. Un message d'un autre compte (même vers l'étudiant, même sur une de ses missions) est ignoré.
 * @returns {Promise<{ conversations: Array<object> } | { error: string }>}
 */
export async function getStudentConversations() {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth
  if (!isUuid(user.id)) return { error: ERR_LOAD }

  const { data: rows, error } = await supabase
    .from("messages")
    .select(INBOX_COLUMNS)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(INBOX_ROWS_LIMIT)
  if (error) {
    console.error("[getStudentConversations] messages", error.message)
    return { error: ERR_LOAD }
  }

  const built = buildConversations(rows ?? [], user.id)
  if (built.length === 0) return { conversations: [] }

  const missionIds = [...new Set(built.map((c) => c.missionId))].filter(isUuid)
  if (missionIds.length === 0) return { conversations: [] }
  // Les candidatures de la session seulement, puis les missions concernées : aucun identifiant issu d'un
  // message écrit par un tiers n'ouvre une lecture d'une autre personne.
  const [missionsRes, applicationsRes] = await Promise.all([
    supabase.from("missions").select(STUDENT_MISSION_COLUMNS).in("id", missionIds),
    supabase.from("applications").select("mission_id, status").eq("student_id", user.id).in("mission_id", missionIds),
  ])
  if (missionsRes.error || applicationsRes.error) {
    console.error("[getStudentConversations] lecture", missionsRes.error?.message ?? applicationsRes.error?.message)
    return { error: ERR_LOAD }
  }
  const missions = new Map((missionsRes.data ?? []).map((m) => [m.id, toStudentMission(m)]))
  const applications = new Map((applicationsRes.data ?? []).map((a) => [a.mission_id, { status: a.status }]))

  const legit = []
  for (const conv of built) {
    const mission = missions.get(conv.missionId)
    // L'interlocuteur du message doit être le client de la mission.
    if (!mission || mission.clientId !== conv.studentId) continue
    const access = conversationAccess({ mission, application: applications.get(conv.missionId) ?? null, studentId: user.id })
    if (!access.allowed) continue
    legit.push({ conv, mission, access })
  }
  if (legit.length === 0) return { conversations: [] }

  const clientIds = [...new Set(legit.map((l) => l.mission.clientId))]
  const profilesRes = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("user_id", clientIds)
  if (profilesRes.error) {
    console.error("[getStudentConversations] profils", profilesRes.error.message)
    return { error: ERR_LOAD }
  }
  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]))

  const conversations = legit.map(({ conv, mission, access }) => {
    const client = toClientParty(mission.clientId, profiles.get(mission.clientId))
    return {
      key: conv.key,
      missionId: conv.missionId,
      name: client.name,
      avatarUrl: client.avatarUrl,
      missionTitle: mission.title,
      state: access.state,
      preview: previewOf(conv.last),
      lastAt: conv.last.createdAt,
      unreadCount: conv.unreadCount,
      lastUnreadAt: conv.lastUnreadAt,
    }
  })
  return { conversations }
}

/**
 * Une conversation de l'étudiant : en-tête, droit d'écriture et messages de la paire (étudiant de la session,
 * client de la mission). Mission sans candidature ni sélection de l'étudiant, inexistante ou identifiant mal
 * formé : `{ notFound: true }`.
 * @param {{ missionId: string }} input
 * @returns {Promise<{ conversation: object } | { notFound: true } | { error: string }>}
 */
export async function getStudentConversation({ missionId } = {}) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const pair = await loadStudentPair(supabase, user.id, missionId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { notFound: true }
  const other = pair.clientId

  const [messagesRes, profileRes, completionAccess] = await Promise.all([
    readThreadRows(supabase, { missionId, userId: user.id, otherId: other }),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("user_id", other).maybeSingle(),
    readPairCompletion(supabase, pair.access, missionId).catch((e) => ({ failure: e })),
  ])
  if (messagesRes.error || profileRes.error || completionAccess.failure) {
    console.error(
      "[getStudentConversation] lecture",
      messagesRes.error?.message ?? profileRes.error?.message ?? completionAccess.failure?.code ?? completionAccess.failure?.message,
    )
    return { error: ERR_LOAD }
  }

  // Seconde barrière : seules les lignes de la paire passent, quoi que renvoie la lecture.
  const pairMessages = await toSignedMessages(
    supabase,
    (messagesRes.data ?? []).filter((row) => row.mission_id === missionId && isPairRow(row, user.id, other)),
    user.id,
  )
  const messages = mergeMessages([], pairMessages)
  const purchases = await readConversationPurchases("student", pair.mission, messages)

  return {
    conversation: {
      userId: user.id,
      missionId,
      clientId: other,
      client: toClientParty(other, profileRes.data),
      mission: { ...toMissionInfo(pair.mission), net: pair.mission.budget === null ? null : netAmount(pair.mission.budget) },
      state: completionAccess.state,
      completionDeclaredAt: completionAccess.completionDeclaredAt,
      completionAvailable: completionAccess.completionAvailable,
      canWrite: completionAccess.canWrite,
      messages,
      ...purchases,
    },
  }
}

/**
 * Envoie un message de l'étudiant au client de la mission. Texte, image, message vocal ou position. Le
 * destinataire est déduit de la mission : tout `receiver_id`, `sender_id` ou identifiant d'interlocuteur
 * présent dans l'entrée est ignoré. `mediaPath` doit désigner un fichier du dossier de l'expéditeur dans
 * `message-media` ; l'adresse publique est reconstruite ici, jamais reprise du navigateur.
 * @param {{ missionId: string, type: "text"|"image"|"voice"|"location", content?: string, mediaPath?: string, lat?: number, lng?: number }} input
 * @returns {Promise<{ success: true, message: object, contactMasked: { kinds: string[] } | null } | { error: string }>}
 */
export async function sendStudentMessage(input) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = studentSendSchema.safeParse(input)
  if (!parsed.success) return { error: ERR_INVALID }

  const built = buildDraft(supabase, user.id, parsed.data)
  if (built.error) return { error: built.error }

  const pair = await loadStudentPair(supabase, user.id, built.draft.missionId)
  if (pair.status === "error") return { error: ERR_SEND }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }
  if (!pair.access.canWrite) return { error: ERR_READONLY }

  return deliverMessage({ tag: "sendStudentMessage", auth, pair, receiverId: pair.clientId, draft: built.draft })
}

/**
 * Nouvelles adresses signées de médias de la conversation de l'étudiant (temps réel, adresse expirée).
 * @param {{ missionId: string, messageIds: string[] }} input
 * @returns {Promise<{ media: Record<string, string|null> } | { error: string }>}
 */
export async function getStudentMessageMedia({ missionId, messageIds } = {}) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth
  const ids = mediaIdsSchema.safeParse(messageIds)
  if (!ids.success) return { error: ERR_INVALID }

  const pair = await loadStudentPair(supabase, user.id, missionId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }
  return resolvePairMedia(supabase, user.id, pair.clientId, missionId, ids.data)
}

/**
 * Marque comme lus les messages REÇUS du client de cette mission : jamais ceux d'une autre mission ni d'un
 * autre expéditeur. Seule la colonne `read` est modifiée.
 * @param {{ missionId: string }} input
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function markStudentConversationRead({ missionId } = {}) {
  const auth = await requireRole(["student"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const pair = await loadStudentPair(supabase, user.id, missionId)
  if (pair.status === "error") return { error: ERR_LOAD }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }

  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("mission_id", missionId)
    .eq("receiver_id", user.id)
    .eq("sender_id", pair.clientId)
    .eq("read", false)
  if (error) {
    console.error("[markStudentConversationRead]", error.message)
    return { error: ERR_LOAD }
  }
  return { success: true }
}
