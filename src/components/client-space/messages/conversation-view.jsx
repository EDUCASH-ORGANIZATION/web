"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Avatar } from "@/components/app-ui/avatar"
import { MessagingNotice } from "@/components/messaging/messaging-notice"
import { REPORT_FALLBACK_ERROR, ReportDialog } from "@/components/messaging/report-dialog"
import { usePurchaseProofUpload } from "@/hooks/use-purchase-proof-upload"
import { useMessageMediaUpload, useRealtimeMessages } from "@/hooks/use-realtime-messages"
import { getClientMessageMedia, markClientConversationRead, sendClientMessage } from "@/lib/actions/message.actions"
import { reportClientMessage } from "@/lib/actions/message-report.actions"
import { getClientPurchaseRequests, markPurchasePaid, reportPurchaseRequestAsClient } from "@/lib/actions/purchase-request.actions"
import { publicTalentHref } from "@/lib/app/student-routes"
import { MASKED_SENDER_NOTE } from "@/lib/messaging/contact-copy"
import { MEDIA_CONTENT, dayOf, formatDayLabel } from "@/lib/client-space/conversations"
import { exceedsEstimate, purchaseTotals } from "@/lib/purchases/requests"
import { Bubble } from "./bubble"
import { Composer, LockedComposer } from "./composer"
import { PaidDialog } from "./purchase/paid-dialog"
import { PurchaseReportDialog } from "./purchase/purchase-report-dialog"
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
    return { ok: true, message: result.message, contactMasked: result.contactMasked ?? null }
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

// Sous-titre de l'en-tête : le lien de l'étudiant avec la mission (retenu ou candidat) tant qu'elle est ouverte ou en
// cours, l'issue sinon.
function subtitleOf({ state, relation }, title) {
  const quoted = `« ${title} »`
  if (state === "done") return `Mission terminée : ${quoted}`
  if (state === "cancelled") return `Mission annulée : ${quoted}`
  if (state === "rejected") return `Candidature refusée sur ${quoted}`
  return relation === "selected" ? `Retenu sur ${quoted}` : `Candidat sur ${quoted}`
}

/**
 * Conversation (mission, étudiant) dans le volet droit de la messagerie : en-tête, bandeau de statut, journal des
 * messages (annoncé poliment), saisie. Le nom de l'étudiant est un h2 : le h1 « Messages » est celui du layout.
 * Les messages arrivent par le temps réel du hook, l'envoi passe par l'action serveur.
 * Demandes de paiement d'achats (RD-ACHATS-01) : les messages `purchase_request` s'affichent en carte, avec la demande de
 * `conversation.purchaseRequests` (ligne neutre si elle manque) ; « Payé » téléverse la capture du SMS dans le
 * compartiment privé puis appelle l'action serveur ; le signalement passe par `reportPurchaseRequestAsClient`.
 * @param {{ conversation: object, now?: string, paymentsEnabled?: boolean, focusRequestId?: string }} props
 *   `conversation` : réponse de getClientConversation ; `paymentsEnabled` : lu côté serveur par la page (formulation
 *   du bandeau) ; `focusRequestId` : demande à faire défiler dans la vue (drapeau d'URL `?demande=`, sans action)
 */
export function ConversationView({ conversation, now, paymentsEnabled = false, focusRequestId }) {
  const { userId, missionId, studentId, student, mission, state, relation, canWrite, completionDeclaredAt, completionAvailable } =
    conversation
  const nowDate = useMemo(() => (now ? new Date(now) : new Date()), [now])
  const markRead = useCallback(() => {
    markClientConversationRead({ missionId, studentId }).catch(() => {})
  }, [missionId, studentId])
  const resolveMedia = useCallback(
    (messageIds) => getClientMessageMedia({ missionId, studentId, messageIds }),
    [missionId, studentId],
  )
  const router = useRouter()
  const reloadPurchases = useCallback(() => router.refresh(), [router])
  const { messages, append, refreshMedia } = useRealtimeMessages({
    missionId,
    studentId,
    userId,
    initialMessages: conversation.messages,
    onIncoming: markRead,
    onPurchaseMessage: reloadPurchases,
    resolveMedia,
  })
  const upload = useMessageMediaUpload(userId)
  const uploadProof = usePurchaseProofUpload(userId)
  const [pending, setPending] = useState([])
  const [maskedIds, setMaskedIds] = useState(() => new Set())
  const [reporting, setReporting] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [reportingPurchaseId, setReportingPurchaseId] = useState(null)
  // Relecture des demandes après une adresse de photo expirée : valable tant que le serveur n'a pas renvoyé de nouvelles données.
  const [reread, setReread] = useState(null)
  const [renewals, setRenewals] = useState({})
  const renewed = useRef(new Set())
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
        if (outcome.contactMasked?.kinds?.length) setMaskedIds((ids) => new Set(ids).add(outcome.message.id))
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

  const submitReport = useCallback(
    async ({ reason, details }) => {
      const result = await reportClientMessage({ messageId: reporting.id, reason, details })
      if (result?.error) return { error: result.error }
      return result?.reference ? { reference: result.reference } : { error: REPORT_FALLBACK_ERROR }
    },
    [reporting],
  )

  const baseRequests = conversation.purchaseRequests
  const requests = useMemo(() => {
    const list = reread && reread.source === baseRequests ? reread.requests : baseRequests
    return Array.isArray(list) ? list : []
  }, [reread, baseRequests])
  const requestsById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests])
  const purchasesOn = conversation.purchasesAvailable === true
  const missionStatus = mission.status ?? state
  const totals = useMemo(() => purchaseTotals(requests.map((r) => ({ status: r.status, amount: r.amount }))), [requests])
  // Dépassement de l'estimation (D2) : avertissement non bloquant, jamais additionné à l'estimation.
  const estimateExceeded = exceedsEstimate({ requested: totals.requested, estimate: mission.purchasesEstimate })
  const purchaseWaiting = purchasesOn && state === "in_progress" && requests.some((r) => r.status === "pending")

  // Demande ciblée par ?demande= : défilement jusqu'à la carte, sans aucune action.
  useEffect(() => {
    if (!focusRequestId) return
    document.getElementById(`demande-${focusRequestId}`)?.scrollIntoView?.({ block: "center" })
  }, [focusRequestId, requests.length])

  const renewPhoto = useCallback(
    async (requestId, kind) => {
      const key = `${requestId}:${kind}`
      if (renewed.current.has(key)) return
      renewed.current.add(key)
      try {
        const result = await getClientPurchaseRequests({ missionId })
        if (!result || result.error || !Array.isArray(result.requests)) return
        setReread({ source: baseRequests, requests: result.requests })
        setRenewals((current) => ({ ...current, [requestId]: (current[requestId] ?? 0) + 1 }))
      } catch {
        // Le repli « Photo indisponible » reste affiché.
      }
    },
    [missionId, baseRequests],
  )

  // Téléverse la capture du SMS (dossier du client, jamais écrasée), puis déclare la demande payée.
  const submitPaid = useCallback(
    async ({ requestId, expectedVersion, smsFile, paidReference, beneficiaryConfirmed }) => {
      const uploaded = await uploadProof({ requestId, kind: "sms", file: smsFile })
      if (uploaded.error) return { error: uploaded.error }
      const result = await markPurchasePaid({ requestId, expectedVersion, smsPhotoPath: uploaded.path, beneficiaryConfirmed, paidReference })
      if (result?.error) {
        // Demande modifiée entre-temps : la carte est relue pour afficher la version à jour.
        if (result.stale) reloadPurchases()
        return { error: result.error, stale: result.stale === true }
      }
      reloadPurchases()
      return {}
    },
    [uploadProof, reloadPurchases],
  )

  const submitPurchaseReport = useCallback(
    async ({ reason, details }) => {
      const result = await reportPurchaseRequestAsClient({ requestId: reportingPurchaseId, reason, details })
      if (result?.error) return { error: result.error }
      reloadPurchases()
      return result?.reference ? { reference: result.reference } : { error: REPORT_FALLBACK_ERROR }
    },
    [reportingPurchaseId, reloadPurchases],
  )

  const payingRequest = payingId ? requestsById.get(payingId) : null
  const reportingRequest = reportingPurchaseId ? requestsById.get(reportingPurchaseId) : null

  const purchaseOf = (message) => {
    const request = message.purchaseRequestId ? requestsById.get(message.purchaseRequestId) : undefined
    return {
      request,
      studentName: student.name,
      missionStatus,
      estimateExceeded,
      onMarkPaid: (r) => setPayingId(r.id),
      onReport: (r) => setReportingPurchaseId(r.id),
      onPhotoError: renewPhoto,
    }
  }

  const empty = messages.length === 0 && pending.length === 0

  return (
    <section className="conv2" aria-label={`Conversation avec ${student.name}`}>
      <header className="c-inbox__head conv2__head">
        <Link className="btn-icon btn-icon--plain conv2__back" href="/client/messages" aria-label="Retour aux messages">
          <Icon name="i-arrow-left" />
        </Link>
        <Avatar name={student.name} src={student.avatarUrl} />
        <div className="grow conv2__who">
          <h2 className="conv2__name">{student.name}</h2>
          <span className="convo__mission conv2__sub">{subtitleOf({ state, relation }, mission.title)}</span>
        </div>
        <Link className="link2 conv2__profile" href={publicTalentHref(student.id)}>
          <Icon name="i-user" />
          <span className="conv2__profile-label">Voir le profil</span>
        </Link>
      </header>

      <StatusBanner
        state={state}
        missionId={missionId}
        studentId={studentId}
        studentName={student.name}
        mission={mission}
        paymentsEnabled={paymentsEnabled}
        completionDeclaredAt={completionDeclaredAt}
        completionAvailable={completionAvailable}
        purchasesPaid={purchasesOn ? totals.paid : 0}
        purchaseWaiting={purchaseWaiting}
      />

      <div ref={chatRef} className="chat" role="log" aria-label="Messages de la conversation" aria-relevant="additions">
        <MessagingNotice />
        {empty ? (
          <div className="msg-system">
            <Icon name="i-message" />
            {canWrite
              ? `Aucun message pour l'instant. Écrivez à ${student.name} pour démarrer la discussion.`
              : "Aucun message dans cette conversation."}
          </div>
        ) : null}
        {messages.map((message, index) => (
          // La clé change après une relecture des photos : la carte repart sans l'état « photo indisponible ».
          <Fragment key={`${message.id}:${message.purchaseRequestId ? (renewals[message.purchaseRequestId] ?? 0) : 0}`}>
            {index === 0 || dayOf(message.createdAt) !== dayOf(messages[index - 1].createdAt) ? (
              <span className="chat__day">{formatDayLabel(message.createdAt, nowDate)}</span>
            ) : null}
            <Bubble
              message={message}
              onMediaError={refreshMedia}
              senderName={student.name}
              onReport={setReporting}
              maskedNote={maskedIds.has(message.id) ? MASKED_SENDER_NOTE : undefined}
              purchase={message.type === "purchase_request" ? purchaseOf(message) : undefined}
            />
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
      {reporting ? <ReportDialog senderName={student.name} onSubmit={submitReport} onClose={() => setReporting(null)} /> : null}
      {payingRequest ? (
        <PaidDialog request={payingRequest} studentName={student.name} onSubmit={submitPaid} onClose={() => setPayingId(null)} />
      ) : null}
      {reportingRequest ? (
        <PurchaseReportDialog request={reportingRequest} onSubmit={submitPurchaseReport} onClose={() => setReportingPurchaseId(null)} />
      ) : null}
    </section>
  )
}

export default ConversationView
