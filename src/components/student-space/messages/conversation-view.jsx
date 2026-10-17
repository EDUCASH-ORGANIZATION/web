"use client"

// @ds-screen RD-STUDENT-01
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { MessagingNotice } from "@/components/messaging/messaging-notice"
import { REPORT_FALLBACK_ERROR, ReportDialog } from "@/components/messaging/report-dialog"
import { usePurchaseProofUpload } from "@/hooks/use-purchase-proof-upload"
import { useMessageMediaUpload, useRealtimeMessages } from "@/hooks/use-realtime-messages"
import { getStudentMessageMedia, markStudentConversationRead, sendStudentMessage } from "@/lib/actions/message.actions"
import { reportStudentMessage } from "@/lib/actions/message-report.actions"
import { studentMessagesHref, studentMissionHref } from "@/lib/app/student-routes"
import { MEDIA_CONTENT, dayOf, formatDayLabel, isPurchaseMessageType } from "@/lib/client-space/conversations"
import { MASKED_SENDER_NOTE } from "@/lib/messaging/contact-copy"
import { nextSeq } from "@/lib/purchases/requests"
import { Bubble, purchaseAnchorId } from "./bubble"
import { Composer, LockedComposer } from "./composer"
import { PurchaseDialogs, newRequestId } from "./purchase-flow"
import { StatusBanner } from "./status-banner"

const ERR_SEND = "Non envoyé. Votre message n'a pas pu être envoyé."
const ERR_UPLOAD = "Non envoyé. Votre fichier n'a pas pu être téléversé."

// Délai pendant lequel les relectures des demandes sont regroupées (une action et son message temps réel arrivent ensemble).
const REFRESH_WINDOW_MS = 400

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
    // Seuls les types masqués sont transmis, jamais la valeur masquée.
    const masked = result.contactMasked?.kinds?.length ? { contactMasked: { kinds: result.contactMasked.kinds } } : {}
    return { ok: true, message: result.message, ...masked }
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
 * Demandes de paiement d'achats (RD-ACHATS-01) : le bouton ticket du composeur n'existe que si la conversation le
 * permet (`purchasesAvailable` et `purchaseCanCreate`, mission en cours) ; les messages `purchase_request` sont rendus par
 * la carte de leur demande (`conversation.purchaseRequests`), les `purchase_event` par une ligne système. Toute action de
 * la carte passe par les actions serveur (fenêtres de `purchase-flow.jsx`) puis relit la page ; un message d'achat reçu
 * en direct la relit aussi.
 * @param {{ conversation: object, now?: string, paymentsEnabled?: boolean, initialAction?: "new"|null, focusRequestId?: string|null }} props
 *   `conversation` : réponse de getStudentConversation ; `paymentsEnabled` : lu côté serveur par la page (formulation du
 *   bandeau) ; `initialAction` : drapeau `?achat=nouveau` (ouvre le formulaire, sans rien envoyer) ; `focusRequestId` :
 *   drapeau `?demande=<id>` (fait défiler jusqu'à la carte)
 */
export function StudentConversationView({ conversation, now, paymentsEnabled = false, initialAction = null, focusRequestId = null }) {
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
  const router = useRouter()
  const refreshTimer = useRef(null)
  const refreshQueued = useRef(false)
  // Relit la page : la première demande part tout de suite, les suivantes de la fenêtre n'en font qu'une, après elle.
  const refreshPurchases = useCallback(() => {
    if (refreshTimer.current) {
      refreshQueued.current = true
      return
    }
    router.refresh()
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      if (refreshQueued.current) {
        refreshQueued.current = false
        refreshPurchases()
      }
    }, REFRESH_WINDOW_MS)
  }, [router])
  useEffect(() => () => clearTimeout(refreshTimer.current), [])
  const { messages, append, refreshMedia } = useRealtimeMessages({
    missionId,
    studentId: clientId,
    userId,
    initialMessages: conversation.messages,
    onIncoming: markRead,
    onPurchaseMessage: refreshPurchases,
    resolveMedia,
  })
  const upload = useMessageMediaUpload(userId)
  const uploadProof = usePurchaseProofUpload(userId)
  const [pending, setPending] = useState([])
  const [reporting, setReporting] = useState(null)
  const [maskedNote, setMaskedNote] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [purchaseNote, setPurchaseNote] = useState(null)
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
        setMaskedNote(Boolean(outcome.contactMasked))
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

  // Adaptateur du contrat de ReportDialog ({ reason, details } -> { reference } | { error }).
  const submitReport = async ({ reason, details }) => {
    const result = await reportStudentMessage({ messageId: reporting.id, reason, details })
    if (result?.error) return { error: result.error }
    if (!result?.reference) return { error: REPORT_FALLBACK_ERROR }
    return { reference: result.reference }
  }

  const requests = Array.isArray(conversation.purchaseRequests) ? conversation.purchaseRequests : []
  const canRequestPurchase = canWrite && conversation.purchasesAvailable === true && conversation.purchaseCanCreate === true
  const editingId = dialog?.kind === "form" && dialog.mode === "edit" ? dialog.request.id : null
  const otherRequested = requests
    .filter((r) => r.status !== "cancelled" && r.id !== editingId)
    .reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0)

  // Une seule fenêtre à la fois ; un second appui sur le bouton ticket ne remplace pas le formulaire ouvert.
  const openDialog = (next) => {
    setPurchaseNote(null)
    setDialog((current) => current ?? next)
  }
  const openNewRequest = () =>
    openDialog({ kind: "form", mode: "create", requestId: newRequestId(), seq: nextSeq(requests) })
  const cardActions = {
    onEdit: (request) => openDialog({ kind: "form", mode: "edit", request }),
    onCancel: (request) => openDialog({ kind: "cancel", request }),
    onConfirmReceived: (request) => openDialog({ kind: "received", request }),
    onReport: (request) => openDialog({ kind: "report", request }),
  }
  const purchaseFor = (message) => {
    if (!isPurchaseMessageType(message.type)) return undefined
    const request = requests.find((r) => r.id === message.purchaseRequestId)
    return {
      request,
      clientName: client.name,
      missionStatus: mission.status,
      busy: Boolean(request) && dialog?.request?.id === request.id,
      ...cardActions,
    }
  }

  // Drapeaux d'URL : ils n'ouvrent qu'une fenêtre ou ne font que défiler, sans rien envoyer.
  useEffect(() => {
    if (initialAction === "new" && canRequestPurchase) openNewRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (focusRequestId) document.getElementById(purchaseAnchorId(focusRequestId))?.scrollIntoView?.({ block: "center" })
  }, [focusRequestId])

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
        <MessagingNotice />
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
            <Bubble
              message={message}
              onMediaError={refreshMedia}
              senderName={client.name}
              onReport={setReporting}
              purchase={purchaseFor(message)}
            />
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

      {maskedNote ? (
        <div className="banner banner--info" role="status">
          <Icon name="i-info" />
          <div className="banner__body">{MASKED_SENDER_NOTE}</div>
        </div>
      ) : null}

      {purchaseNote ? (
        <div className="banner banner--info" role="status">
          <Icon name="i-info" />
          <div className="banner__body">{purchaseNote}</div>
        </div>
      ) : null}

      {canWrite ? (
        <Composer onSend={onSend} onRequestPurchase={canRequestPurchase ? openNewRequest : undefined} />
      ) : (
        <LockedComposer text={LOCKED_TEXT[state] ?? LOCKED_TEXT.closed} />
      )}
      {reporting ? <ReportDialog senderName={client.name} onSubmit={submitReport} onClose={() => setReporting(null)} /> : null}
      <PurchaseDialogs
        dialog={dialog}
        missionId={missionId}
        clientName={client.name}
        estimate={mission.purchasesEstimate}
        otherRequested={otherRequested}
        upload={uploadProof}
        onChanged={(text) => {
          if (text) setPurchaseNote(text)
          refreshPurchases()
        }}
        onClose={() => setDialog(null)}
        onReport={(request) => setDialog({ kind: "report", request })}
      />
    </section>
  )
}

export default StudentConversationView
