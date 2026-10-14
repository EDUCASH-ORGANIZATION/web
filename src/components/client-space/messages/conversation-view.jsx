"use client"

import Link from "next/link"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { useMessageMediaUpload, useRealtimeMessages } from "@/hooks/use-realtime-messages"
import { getClientMessageMedia, markClientConversationRead, sendClientMessage } from "@/lib/actions/message.actions"
import { MEDIA_CONTENT, dayOf, formatDayLabel } from "@/lib/client-space/conversations"
import { Bubble } from "./bubble"
import { Composer, LockedComposer } from "./composer"
import { StatusBanner } from "./status-banner"

const ERR_SEND = "Non envoyé. Votre message n'a pas pu être envoyé."
const ERR_UPLOAD = "Non envoyé. Votre fichier n'a pas pu être téléversé."

const LOCKED_TEXT = {
  done: "Mission terminée : cette conversation est en lecture seule.",
  cancelled: "Mission annulée : cette conversation est en lecture seule.",
  rejected: "Candidature refusée : cette conversation est en lecture seule.",
  closed: "Un autre étudiant a été retenu : cette conversation est en lecture seule.",
}

/**
 * Livre un message : téléverse d'abord le fichier (image, message vocal), puis appelle l'action serveur.
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

// Message en attente d'envoi ou en échec, affiché comme une bulle de l'utilisateur.
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
 * Conversation (mission, étudiant) : en-tête, bandeau de statut, journal des messages (annoncé poliment),
 * saisie. Les messages arrivent par le temps réel du hook, l'envoi passe par l'action serveur.
 * @param {{ conversation: object, now?: string }} props `conversation` : réponse de getClientConversation
 */
export function ConversationView({ conversation, now }) {
  const { userId, missionId, studentId, student, mission, state, canWrite } = conversation
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const markRead = useCallback(() => {
    markClientConversationRead({ missionId, studentId }).catch(() => {})
  }, [missionId, studentId])
  const resolveMedia = useCallback(
    (messageIds) => getClientMessageMedia({ missionId, studentId, messageIds }),
    [missionId, studentId],
  )
  const { messages, append, refreshMedia } = useRealtimeMessages({
    missionId,
    studentId,
    userId,
    initialMessages: conversation.messages,
    onIncoming: markRead,
    resolveMedia,
  })
  const upload = useMessageMediaUpload(userId)
  const [pending, setPending] = useState([])
  const counter = useRef(0)
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
      setPending((list) => list.map((p) => (p.localId === item.localId ? { ...p, status: "sending", error: null } : p)))
      const outcome = await deliverMessage(item, {
        upload,
        send: (payload) => sendClientMessage({ missionId, studentId, ...payload }),
      })
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
    [upload, append, missionId, studentId],
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
    <section className="conv2" aria-label={`Conversation avec ${student.name}`}>
      <header className="conv2__head">
        <Link className="btn-icon btn-icon--plain" href="/client/messages" aria-label="Retour aux messages">
          <Icon name="i-arrow-left" />
        </Link>
        <Avatar name={student.name} src={student.avatarUrl} />
        <div className="conv2__who">
          <h1 className="conv2__name">{student.name}</h1>
          <span className="conv2__sub">{mission.title}</span>
        </div>
      </header>

      <StatusBanner state={state} missionId={missionId} studentId={studentId} />

      <div ref={chatRef} className="chat" role="log" aria-label="Messages de la conversation" aria-relevant="additions">
        {empty ? (
          <div className="msg-system">
            <Icon name="i-message" />
            {canWrite
              ? `Aucun message pour l'instant. Écrivez à ${student.name} pour démarrer la discussion.`
              : "Aucun message dans cette conversation."}
          </div>
        ) : null}
        {messages.map((message, index) => (
          <Fragment key={message.id}>
            {index === 0 || dayOf(message.createdAt) !== dayOf(messages[index - 1].createdAt) ? (
              <span className="chat__day">{formatDayLabel(message.createdAt, nowDate)}</span>
            ) : null}
            <Bubble message={message} onMediaError={refreshMedia} senderName={student.name} />
          </Fragment>
        ))}
        {pending.map((item) => (
          <Bubble
            key={item.localId}
            message={pendingMessage(item)}
            senderName={student.name}
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

export default ConversationView
