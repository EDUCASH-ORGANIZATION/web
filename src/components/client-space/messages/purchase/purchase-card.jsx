"use client"

// Carte « Demande de paiement d'achats » vue par le CLIENT (maquette C13 v2.1). Vue pure : la demande arrive en
// props (adresses de photos déjà signées par le serveur, jamais via next/image), les actions sortent par callbacks.
// Le client voit le numéro à payer et le nom du vendeur : c'est lui qui paie, directement, hors EduCash.
// Un seul bouton encre par carte : « Payé » (demande en attente). Aucun montant n'est additionné ici.

import { useState } from "react"
import { Icon } from "@/components/design/icon"
import { Amount } from "@/components/app-ui/amount"
import { formatClock } from "@/lib/client-space/conversations"
import {
  PAYEE_KINDS,
  PAYMENT_WARNING,
  PURCHASE_ESTIMATE_EXCEEDED_NOTE,
  PURCHASE_NO_REFUND_NOTE,
  PURCHASE_REVIEWED_LABEL,
  allowedActions,
  formatPayeeNumber,
  formatPurchaseAmount,
  purchaseReportReasonLabel,
  requestNumber,
  statusBadge,
} from "@/lib/purchases/requests"

const cx = (...parts) => parts.filter(Boolean).join(" ")

const STATUS_ICONS = {
  pending: "i-clock",
  paid: "i-check",
  received: "i-check-double",
  reported: "i-flag",
  cancelled: "i-x",
}

// « de Ulrich » ou, sans nom connu, « de l'étudiant ».
const ofStudent = (name) => (name ? `de ${name}` : "de l'étudiant")
const studentOrDefault = (name) => name || "L'étudiant"

function Note({ icon, children }) {
  return (
    <p className="payreq2__note">
      <Icon name={icon} />
      <span>{children}</span>
    </p>
  )
}

// Vignette d'une photo : adresse signée en prop, repli lisible si elle manque ou ne se charge plus.
function Shot({ kind, caption, url, failed, onError }) {
  return (
    <figure className="c-shot">
      <span>
        {url && !failed ? (
          // Adresse signée à courte durée de vie : jamais next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={url} alt="" loading="lazy" onError={() => onError(kind)} />
        ) : (
          <small className="muted">Photo indisponible</small>
        )}
      </span>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

function payeeLine(request) {
  const number = formatPayeeNumber(request.payeeNumber)
  const kind = PAYEE_KINDS.find((k) => k.value === request.payeeKind)
  if (!number) return "Non renseigné"
  return kind ? `${number} · ${kind.label}` : number
}

/**
 * Carte d'une demande de paiement d'achats, côté client.
 *
 * `request` : { id, seq, status, version, amount, vendorName, items, payeeKind, payeeNumber, payeePhotoUrl,
 *   ticketPhotoUrl, smsPhotoUrl, createdAt, editedAt, paidAt, receivedAt, paidReference, alreadyReportedByMe,
 *   reportReason, reportReference, reviewed }.
 * `studentName` : prénom de l'étudiant retenu. `missionStatus` : statut de la mission (règles d'`allowedActions`).
 * `estimateExceeded` : vrai quand le total des demandes dépasse largement l'estimation (note non bloquante).
 * Callbacks : `onMarkPaid(request)` ouvre la fenêtre « Payé », `onReport(request)` ouvre le signalement,
 * `onPhotoError(requestId, kind)` ("payee", "ticket" ou "sms") sert à renouveler une adresse signée expirée.
 * Un bouton dont le callback manque n'est pas affiché.
 */
export function PurchaseCard({ request, studentName, missionStatus, estimateExceeded = false, onMarkPaid, onReport, onPhotoError }) {
  const [failed, setFailed] = useState({})
  const { status } = request
  const badge = statusBadge(status)
  const number = requestNumber(request.seq)
  const amount = formatPurchaseAmount(request.amount)
  const actions = allowedActions({
    status,
    role: "client",
    missionStatus,
    alreadyReportedByMe: request.alreadyReportedByMe === true,
  })
  const canPay = actions.includes("markPaid") && Boolean(onMarkPaid)
  const canReport = actions.includes("report") && Boolean(onReport)
  const personal = request.payeeKind === "personal"
  const cancelled = status === "cancelled"
  const reportedByMe = status === "reported" && request.alreadyReportedByMe === true
  const reason = reportedByMe ? purchaseReportReasonLabel(request.reportReason) : ""

  const reference = request.paidReference ? ` · réf. ${request.paidReference}` : ""
  let paidCaption = ""
  if (status === "paid" && request.paidReference) paidCaption = `Réf. ${request.paidReference}`
  else if ((status === "received" || status === "reported") && request.paidAt) {
    paidCaption = `Payé à ${formatClock(request.paidAt)}${reference}`
  }

  const photoFailed = (kind) => {
    setFailed((current) => ({ ...current, [kind]: true }))
    onPhotoError?.(request.id, kind)
  }

  return (
    <article
      className={cx("c-payreq", status === "reported" && "c-payreq--flagged")}
      aria-label={`Demande de paiement d'achats ${number}, ${request.vendorName}, ${amount}`}
    >
      <div className="c-payreq__head">
        <span className="ic-sq ic-sq--sm">
          <Icon name="i-receipt" />
        </span>
        <div className="grow">
          <b>Demande de paiement</b>
          <small>
            {number} · Achats · {studentOrDefault(studentName)} · {formatClock(request.createdAt)}
          </small>
        </div>
        <span className={`badge badge--${badge.variant} badge--sm`}>
          <Icon name={STATUS_ICONS[status] ?? "i-clock"} />
          {badge.label}
        </span>
      </div>

      <div className="c-payreq__shots">
        <Shot
          kind="payee"
          caption={personal ? "Panneau du vendeur" : "Numéro marchand"}
          url={request.payeePhotoUrl}
          failed={failed.payee}
          onError={photoFailed}
        />
        <Shot kind="ticket" caption="Ticket ou articles" url={request.ticketPhotoUrl} failed={failed.ticket} onError={photoFailed} />
        {request.smsPhotoUrl || failed.sms ? (
          <Shot kind="sms" caption="Capture du SMS" url={request.smsPhotoUrl} failed={failed.sms} onError={photoFailed} />
        ) : null}
      </div>

      <dl className="kv">
        <dt>Vendeur</dt>
        <dd>{request.vendorName}</dd>
        <dt>Payer sur</dt>
        <dd>{payeeLine(request)}</dd>
        {request.items ? (
          <>
            <dt>Articles</dt>
            <dd>{request.items}</dd>
          </>
        ) : null}
      </dl>

      {status === "pending" && personal ? (
        <p className="caption muted">
          Ce vendeur n&apos;a pas de numéro marchand : {studentOrDefault(studentName)} a photographié son panneau et son numéro MoMo personnel.
        </p>
      ) : null}

      <div className="c-payreq__total">
        <span>{status === "pending" ? "Montant total à payer" : "Montant total"}</span>
        <Amount value={request.amount} size="m" />
      </div>

      {status === "pending" ? (
        <>
          <div className="c-payreq__warn" role="note">
            <Icon name="i-alert-triangle" className="ic ic--16" />
            <span>{PAYMENT_WARNING}</span>
          </div>
          {request.editedAt ? <Note icon="i-pencil">Modifiée à {formatClock(request.editedAt)}</Note> : null}
          {estimateExceeded ? <Note icon="i-alert-circle">{PURCHASE_ESTIMATE_EXCEEDED_NOTE}</Note> : null}
          <Note icon="i-info">
            Payez {amount} dans votre application MoMo, puis touchez « Payé » et joignez la capture du SMS.
          </Note>
        </>
      ) : null}

      {status === "paid" ? (
        <Note icon="i-clock">
          Vous avez payé à {formatClock(request.paidAt)}. En attente de la confirmation {ofStudent(studentName)} : « Reçu par le vendeur ».
        </Note>
      ) : null}

      {status === "received" ? (
        <Note icon="i-check-double">
          {studentOrDefault(studentName)} confirme à {formatClock(request.receivedAt)} : le vendeur a bien reçu {amount}.
        </Note>
      ) : null}

      {status === "reported" ? (
        <>
          <Note icon="i-flag">
            {reportedByMe
              ? `Vous avez signalé cette demande${reason ? ` : « ${reason} »` : ""}.${request.reportReference ? ` Signalement ${request.reportReference}.` : ""}`
              : "Cette demande a été signalée."}
          </Note>
          {request.reviewed ? (
            <Note icon="i-check-circle">{PURCHASE_REVIEWED_LABEL}</Note>
          ) : (
            <Note icon="i-info">L&apos;équipe EduCash examine les photos et la conversation. {PURCHASE_NO_REFUND_NOTE}</Note>
          )}
        </>
      ) : null}

      {cancelled ? <Note icon="i-x">{studentOrDefault(studentName)} a annulé cette demande.</Note> : null}

      {canPay || canReport || paidCaption ? (
        <div className="c-payreq__actions">
          {canReport ? (
            <button type="button" className="btn btn--ghost btn--sm" aria-label={`Signaler la demande ${number}`} onClick={() => onReport(request)}>
              <Icon name="i-flag" />
              Signaler
            </button>
          ) : null}
          <span className="grow" />
          {canPay ? (
            <button type="button" className="btn btn--dark btn--sm" aria-label={`Marquer comme payé, demande ${number}`} onClick={() => onMarkPaid(request)}>
              <Icon name="i-check" />
              Payé
            </button>
          ) : null}
          {paidCaption ? <span className="caption muted">{paidCaption}</span> : null}
        </div>
      ) : null}
    </article>
  )
}

export default PurchaseCard
