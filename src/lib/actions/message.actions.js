"use server"

// Messagerie de l'espace client (C12 boîte de réception, C13 conversation).
//
// Une conversation est une paire (mission, étudiant). Chaque export commence par requireRole(["client"]),
// puis établit côté serveur, à CHAQUE appel : la mission appartient au client de la session ; l'étudiant est
// l'étudiant retenu ou a une candidature à CETTE mission. La politique messages_insert de la base laisse
// envoyer à n'importe quel destinataire : c'est cette action qui refuse un destinataire tiers. L'expéditeur
// est toujours l'identifiant de la session. Aucune lecture ne renvoie de colonne privée de profils :
// nom public ("Prénom I."), avatar et initiales seulement.
//
// Limites documentées :
// - la boîte de réception lit les 1000 messages les plus récents de l'utilisateur ; une conversation dont
//   tous les messages sont plus anciens n'y figure pas ;
// - une conversation charge ses 200 derniers messages ;
// - débit : 20 messages par minute et par client, compté en base (valable entre instances) ;
// - la taille d'un fichier joint est bornée par le compartiment (10 Mo) et par le navigateur avant l'envoi ;
//   l'action contrôle le chemin (dossier de l'expéditeur) et le type d'après l'extension.

import { z } from "zod"
import { requireRole } from "@/lib/auth/require-role"
import { toOwnedStoragePath } from "@/lib/storage/owned-paths"
import { isUuid } from "@/lib/vitrine/ids"
import { publicDisplayName } from "@/lib/vitrine/public-name"
import {
  MEDIA_BUCKET,
  MEDIA_CONTENT,
  MESSAGE_MAX_LENGTH,
  buildConversations,
  conversationAccess,
  coordsValid,
  isPairRow,
  mediaKindOfPath,
  mergeMessages,
  previewOf,
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
const MESSAGE_COLUMNS =
  "id, mission_id, sender_id, receiver_id, content, type, media_url, location_lat, location_lng, read, created_at"
const MISSION_COLUMNS = "id, title, status, selected_student_id"
// Colonnes publiques seulement : jamais de select("*") sur profiles.
const PUBLIC_PROFILE_COLUMNS = "user_id, full_name, avatar_url"

const uuid = z.string().refine(isUuid)
const sendSchema = z.object({
  missionId: uuid,
  studentId: uuid,
  type: z.enum(["text", "image", "voice", "location"]),
  content: z.string().max(MESSAGE_MAX_LENGTH).optional(),
  mediaPath: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const toMission = (m) => ({
  id: m.id,
  title: typeof m.title === "string" ? m.title : "",
  status: m.status,
  selectedStudentId: m.selected_student_id ?? null,
})

function toStudent(id, profile) {
  return {
    id,
    name: publicDisplayName(profile?.full_name),
    avatarUrl: typeof profile?.avatar_url === "string" && profile.avatar_url !== "" ? profile.avatar_url : null,
  }
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
  const [missionsRes, applicationsRes, profilesRes] = await Promise.all([
    supabase.from("missions").select(MISSION_COLUMNS).eq("client_id", user.id).in("id", missionIds),
    supabase.from("applications").select("mission_id, student_id, status").in("mission_id", missionIds),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("user_id", studentIds),
  ])
  if (missionsRes.error || applicationsRes.error || profilesRes.error) {
    console.error(
      "[getClientConversations] lecture",
      missionsRes.error?.message ?? applicationsRes.error?.message ?? profilesRes.error?.message,
    )
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

  const [messagesRes, profileRes] = await Promise.all([
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("mission_id", missionId)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: false })
      .limit(THREAD_ROWS_LIMIT),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("user_id", other).maybeSingle(),
  ])
  if (messagesRes.error || profileRes.error) {
    console.error("[getClientConversation] lecture", messagesRes.error?.message ?? profileRes.error?.message)
    return { error: ERR_LOAD }
  }

  // Seconde barrière : seules les lignes de la paire passent, quoi que renvoie la lecture.
  const pairMessages = (messagesRes.data ?? [])
    .filter((row) => row.mission_id === missionId && isPairRow(row, user.id, other))
    .map((row) => toMessage(row, user.id))
    .filter(Boolean)
  // Du plus ancien au plus récent, sans doublon.
  const messages = mergeMessages([], pairMessages)

  return {
    conversation: {
      userId: user.id,
      missionId,
      studentId: other,
      student: toStudent(other, profileRes.data),
      mission: { title: pair.mission.title, status: pair.mission.status },
      state: pair.access.state,
      canWrite: pair.access.canWrite,
      messages,
    },
  }
}

/**
 * Envoie un message du client à l'étudiant d'une conversation. Texte, image, message vocal ou position.
 * `mediaPath` doit désigner un fichier du dossier de l'expéditeur dans `message-media` ; l'adresse
 * publique est reconstruite ici, jamais reprise du navigateur.
 * @param {{ missionId: string, studentId: string, type: "text"|"image"|"voice"|"location", content?: string, mediaPath?: string, lat?: number, lng?: number }} input
 * @returns {Promise<{ success: true, message: object } | { error: string }>}
 */
export async function sendClientMessage(input) {
  const auth = await requireRole(["client"])
  if (auth.error) return { error: auth.error }
  const { supabase, user } = auth

  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { error: ERR_INVALID }
  const { missionId, studentId, type, content, mediaPath, lat, lng } = parsed.data

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
    const owned = toOwnedStoragePath(mediaPath, MEDIA_BUCKET, user.id)
    if (!owned || mediaKindOfPath(owned) !== type) return { error: ERR_MEDIA }
    const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(owned)
    if (!publicData?.publicUrl) return { error: ERR_SEND }
    mediaUrl = publicData.publicUrl
    text = MEDIA_CONTENT[type]
  }

  const pair = await loadPair(supabase, user.id, missionId, studentId)
  if (pair.status === "error") return { error: ERR_SEND }
  if (pair.status === "forbidden") return { error: ERR_UNAVAILABLE }
  if (!pair.access.canWrite) return { error: ERR_READONLY }

  const since = new Date(Date.now() - SEND_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", since)
  if (countError) {
    console.error("[sendClientMessage] débit", countError.message)
    return { error: ERR_SEND }
  }
  if ((count ?? 0) >= SEND_LIMIT) return { error: ERR_RATE }

  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      mission_id: missionId,
      sender_id: user.id,
      receiver_id: studentId,
      content: text,
      type,
      media_url: mediaUrl,
      location_lat: latitude,
      location_lng: longitude,
      read: false,
    })
    .select(MESSAGE_COLUMNS)
    .single()
  const message = row && !error ? toMessage(row, user.id) : null
  if (!message) {
    if (error) console.error("[sendClientMessage] insertion", error.message)
    return { error: ERR_SEND }
  }
  return { success: true, message }
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
