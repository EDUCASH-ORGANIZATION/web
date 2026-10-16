"use client"

// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { useMessageMediaUpload, useRealtimeMessages } from "@/hooks/use-realtime-messages"
import { getStudentMessageMedia, markStudentConversationRead, sendStudentMessage } from "@/lib/actions/message.actions"
import { studentMessagesHref, studentMissionHref } from "@/lib/app/student-routes"
import { MEDIA_CONTENT, dayOf, formatDayLabel } from "@/lib/client-space/conversations"
import { Bubble } from "./bubble"
import { Composer, LockedComposer } from "./composer"
import { StatusBanner } from "./status-banner"

const ERR_SEND = "Non envoyé. Votre message n'a pas pu être envoyé."
const ERR_UPLOAD = "Non envoyé. Votre fichier n'a pas pu être téléversé."

const LOCKED_TEXT = {
  done: "Mission terminée : cette conversation est en lecture seule.",
  cancelled: "Mission annulée : cette conversation est en lecture seule.",
  rejected: "Candidature non retenue : cette conversation est en lecture seule.",
  closed: "Un autre étudiant a été retenu : cette conversation est en lecture seule.",
}

/**
 * Remet un message : téléverse d'abord le fichier (image, message vocal), puis appelle l'action serveur.
 * Ne lève jamais : renvoie `{ ok: true, message }` ou `{ ok: false, error, mediaPath }` (le chemin déjà
 * téléversé est conservé pour qu'une reprise ne téléverse pas deux fois).
 * @param {{ type: string, content?: string, file?: Blob, ext?: string, mediaPath?: string, lat?: number, lng?: number }} item
 * @param {{ upload: (file: Blob, ext: string) => Promise<string>, send: (payload: object) => Promise<{ message?: object, error?: string }> }} deps
 */
export async function deliverMessage(item, { upload, send }) {
  let mediaPath = item.mediaPath
  try {
    if ((item.type === "image" || item.type === "voice") && !mediaPath) {
      try {
        mediaPath = await upload(item.file, item.ext)
      } catch {
        return { ok: false, error: ERR_UPLOAD, mediaPath: undefined }
      }
    }
    const result = await send({ type: item.type, content: item.content, mediaPath, lat: item.lat, lng: item.lng })
    if (!result || result.error || !result.message) {
      return { ok: false, error: result?.error ? `Non envoyé. ${result.error}` : ERR_SEND, mediaPath }
    }
    return { ok: true, message: result.message }
  } catch {
    return { ok: false, error: ERR_SEND, mediaPath }
  }
}

// Message en attente d'envoi ou en échec, affiché comme une bulle de l'étudiant.
function pendingMessage(item) {
  return {
    id: `pending-${item.localId}`,
    mine: true,
    type: "text",
    content: item.type === "text" ? item.content : MEDIA_CONTENT[item.type],
    mediaUrl: null,
    lat: null,
    lng: null,
    createdAt: "",
    read: false,
  }
}

/**
 * Conversation (mission, client) de l'étudiant : en-tête, bandeau de statut, journal des messages (annoncé
 * poliment), zone d'écriture. Les messages arrivent par le temps réel du hook (l'autre partie est le client),
 * l'envoi et le marquage « lu » passent par les actions serveur : aucune écriture depuis le navigateur.
 * @param {{ conversation: object, now?: string, paymentsEnabled?: boolean }} props `conversation` : réponse de
 *   getStudentConversation ; `paymentsEnabled` : lu côté serveur par la page (formulation du bandeau)
 */
export function StudentConversationView({ conversation, now, paymentsEnabled = false }) {
  const { userId, missionId, clientId, client, mission, state, canWrite, completionDeclaredAt, completionAvailable } =
    conversation
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const markRead = useCallback(() => {
    markStudentConversationRead({ missionId }).catch(() => {})
  }, [missionId])
  const resolveMedia = useCallback(
    (messageIds) => getStudentMessageMedia({ missionId, messageIds }),
    [missionId],
  )
  const { messages, append, refreshMedia } = useRealtimeMessages({
    missionId,
    studentId: clientId,
    userId,
    initialMessages: conversation.messages,
    onIncoming: markRead,
    resolveMedia,
  })
  const upload = useMessageMediaUpload(userId)
  const [pending, setPending] = useState([])
  const counter = useRef(0)
  const inFlight = useRef(new Set())
  const chatRef = useRef(null)

  useEffect(() => {
    markRead()
  }, [markRead])

  // Défilement vers le dernier message, sans déplacer le focus.
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, pending.length])

  const run = useCallback(
    async (item) => {
      if (inFlight.current.has(item.localId)) return
      inFlight.current.add(item.localId)
      setPending((list) => list.map((p) => (p.localId === item.localId ? { ...p, status: "sending", error: null } : p)))
      const outcome = await deliverMessage(item, {
        upload,
        send: (payload) => sendStudentMessage({ missionId, ...payload }),
      })
      inFlight.current.delete(item.localId)
      if (outcome.ok) {
        append(outcome.message)
        setPending((list) => list.filter((p) => p.localId !== item.localId))
      } else {
        setPending((list) =>
          list.map((p) =>
            p.localId === item.localId ? { ...p, status: "failed", error: outcome.error, mediaPath: outcome.mediaPath ?? p.mediaPath } : p,
          ),
        )
      }
    },
    [upload, append, missionId],
  )

  function onSend(payload) {
    counter.current += 1
    const item = { localId: counter.current, ...payload, status: "sending", error: null }
    setPending((list) => [...list, item])
    run(item)
  }

  const retry = (localId) => {
    const item = pending.find((p) => p.localId === localId)
    if (item) run(item)
  }
  const dismiss = (localId) => setPending((list) => list.filter((p) => p.localId !== localId))

  const empty = messages.length === 0 && pending.length === 0

  return (
    <section className="e2-07-pane" aria-label={`Conversation avec ${client.name}`}>
      <header className="e2-07-head e2-07-mhead">
        <Link className="iconbtn2 e2-07-back" href={studentMessagesHref()} aria-label="Retour aux messages">
          <Icon name="i-arrow-left" />
        </Link>
        <div className="e2-who">
          <Avatar name={client.name} src={client.avatarUrl} />
          <div className="e2-07-who">
            <h2 className="e2-who__name e2-07-name">{client.name}</h2>
            <div className="e2-who__sub">{mission.title}</div>
          </div>
        </div>
        <Link className="btn btn--soft btn--sm e2-07-head__action" href={studentMissionHref(missionId)}>
          <Icon name="i-briefcase" />
          <span className="e2-07-head__label">Voir la mission</span>
        </Link>
      </header>

      <StatusBanner
        state={state}
        missionId={missionId}
        mission={mission}
        paymentsEnabled={paymentsEnabled}
        completionDeclaredAt={completionDeclaredAt}
        completionAvailable={completionAvailable}
      />

      <div
        ref={chatRef}
        className="chat e2-07-chat"
        role="log"
        aria-live="polite"
        aria-label="Messages de la conversation"
        aria-relevant="additions"
      >
        {empty ? (
          <div className="msg-system">
            <Icon name="i-message" />
            {canWrite
              ? `Aucun message pour l'instant. Écrivez à ${client.name} pour démarrer la discussion.`
              : "Aucun message dans cette conversation."}
          </div>
        ) : null}
        {messages.map((message, index) => (
          <Fragment key={message.id}>
            {index === 0 || dayOf(message.createdAt) !== dayOf(messages[index - 1].createdAt) ? (
              <span className="chat__day">{formatDayLabel(message.createdAt, nowDate)}</span>
            ) : null}
            <Bubble message={message} onMediaError={refreshMedia} senderName={client.name} />
          </Fragment>
        ))}
        {pending.map((item) => (
          <Bubble
            key={item.localId}
            message={pendingMessage(item)}
            senderName={client.name}
            status={item.status}
            error={item.error}
            onRetry={() => retry(item.localId)}
            onDismiss={() => dismiss(item.localId)}
          />
        ))}
      </div>

      {canWrite ? <Composer onSend={onSend} /> : <LockedComposer text={LOCKED_TEXT[state] ?? LOCKED_TEXT.closed} />}
    </section>
  )
}

export default StudentConversationView
