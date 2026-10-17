"use client"

// @ds-screen RD-STUDENT-01
// Carte « Demande de paiement d'achats » vue par l'étudiant (E07, décision 24), dans ses statuts : En attente de
// paiement (modifiable, annulable), Payé (capture du SMS jointe), Reçu par le vendeur (verrouillée) et Signalé, plus
// Annulée. Vue pure, non câblée (ST-10) : la demande arrive prête à afficher, les actions sortent en callbacks.
// Les actions proposées viennent de `allowedActions` (rôle « student »), les textes de `@/lib/purchases/requests`.
//
// Contrat des props :
// - request : { id, seq, status, vendorName, items?, amount, payeeKind, payeeNumber (normalisé), paidReference?,
//   payeePhotoUrl?, ticketPhotoUrl?, smsPhotoUrl? (adresses signées), sentAt, editedAt?, paidAt?, receivedAt?,
//   reportReason? (motif de signalement à montrer), reviewed? (signalement clos) } ;
// - clientName : nom du client ; missionStatus : statut de la mission (défaut « in_progress ») ;
// - alreadyReportedByMe : l'étudiant a déjà signalé cette demande (le lien « Signaler » disparaît) ;
// - busy : une action est en cours, les boutons sont inactifs ;
// - onEdit(request), onCancel(request), onConfirmReceived(request), onReport(request) ; onViewReport(request)
//   facultatif : sans lui, aucun lien « Voir le signalement » n'est affiché (pas de lien mort).
import { Icon } from "@/components/design/icon"
import { formatClock } from "@/lib/client-space/conversations"
import {
  PAYEE_KINDS,
  PAYMENT_WARNING,
  PURCHASE_NO_REFUND_NOTE,
  PURCHASE_REVIEWED_LABEL,
  allowedActions,
  formatPayeeNumber,
  formatPurchaseAmount,
  purchaseReportReasonLabel,
  requestNumber,
  statusBadge,
} from "@/lib/purchases/requests"
import { Thumb } from "./purchase-parts"

const STATUS_ICONS = {
  pending: "i-clock",
  paid: "i-check",
  received: "i-check-circle",
  reported: "i-flag",
  cancelled: "i-x",
}

export function PurchaseCard({
  request,
  clientName,
  missionStatus = "in_progress",
  alreadyReportedByMe = false,
  busy = false,
  onEdit,
  onCancel,
  onConfirmReceived,
  onReport,
  onViewReport,
  onPhotoError,
}) {
  const { status } = request
  const badge = statusBadge(status)
  const actions = allowedActions({ status, role: "student", missionStatus, alreadyReportedByMe })
  const client = clientName || "Le client"
  const number = requestNumber(request.seq)
  const payeeKind = PAYEE_KINDS.find((kind) => kind.value === request.payeeKind)
  const showSms = Boolean(request.smsPhotoUrl) || ["paid", "received"].includes(status)
  const payeeNumber = formatPayeeNumber(request.payeeNumber)
  const reason = purchaseReportReasonLabel(request.reportReason)
  const paidClock = formatClock(request.paidAt)
  const receivedClock = formatClock(request.receivedAt)
  const sentClock = formatClock(request.sentAt)
  const editedClock = formatClock(request.editedAt)
  const meta = [sentClock && `Envoyée à ${sentClock}`, editedClock && `Modifiée à ${editedClock}`].filter(Boolean).join(" · ")
  const canReceive = actions.includes("confirmReceived")
  // Adresse signée expirée : la conversation relit les demandes pour en obtenir de nouvelles.
  const renewPhoto = onPhotoError ? (kind) => onPhotoError(request.id, kind) : undefined
  const showViewReport = status === "reported" && alreadyReportedByMe && typeof onViewReport === "function"

  return (
    <div
      className="e-achat e-achat--full e2-07-achat"
      role="group"
      aria-label={`Demande de paiement d'achats${number ? ` numéro ${request.seq}` : ""}`}
    >
      <div className="e-achat__band">
        <span className={`badge badge--sm badge--${badge.variant}`}>
          <Icon name={STATUS_ICONS[status] ?? "i-clock"} />
          {badge.label}
        </span>
        {number ? <small>{number}</small> : null}
      </div>

      <div className="e-achat__body">
        <div className="e-achat__title">
          <span className="e2-07-ic">
            <Icon name="i-receipt" />
          </span>
          <span>
            {"Demande de paiement d'achats"}
            {request.items ? <small>{request.items}</small> : null}
          </span>
        </div>

        <div className={showSms ? "e-achat__photos e-achat__photos--3" : "e-achat__photos"}>
          <Thumb url={request.payeePhotoUrl} icon="i-smartphone" caption={payeeKind?.label ?? "Numéro MoMo"} kind="payee" noun="du numéro de paiement" onPhotoError={renewPhoto} />
          <Thumb url={request.ticketPhotoUrl} icon="i-receipt" variant="ticket" caption="Ticket ou articles" kind="ticket" noun="du ticket" onPhotoError={renewPhoto} />
          {showSms ? <Thumb url={request.smsPhotoUrl} icon="i-message" variant="sms" tag="Client" caption="Capture du SMS" kind="sms" noun="de la capture du SMS" onPhotoError={renewPhoto} /> : null}
        </div>

        <dl className="e-achat__rows">
          <dt>Vendeur</dt>
          <dd>{request.vendorName}</dd>
          {payeeNumber ? (
            <>
              <dt>Numéro à payer</dt>
              <dd>{payeeNumber}</dd>
            </>
          ) : null}
          <dt>Montant total</dt>
          <dd>
            <span className="e-achat__total">{formatPurchaseAmount(request.amount)}</span>
          </dd>
          <dt>Payé par</dt>
          <dd>{client}, hors EduCash</dd>
          {request.paidReference ? (
            <>
              <dt>Référence</dt>
              <dd>{request.paidReference}</dd>
            </>
          ) : null}
        </dl>

        {status === "pending" ? (
          <>
            <div className="e2-note">
              <Icon name="i-alert-triangle" />
              <div className="e2-note__body e2-note__text">{PAYMENT_WARNING}</div>
            </div>
            <p className="e-achat__note">
              {client} paie le vendeur par MoMo hors EduCash, puis marque la carte « Payé » avec la capture du SMS.
            </p>
          </>
        ) : null}
        {status === "paid" ? (
          <p className="e-achat__note">
            {client} a marqué « Payé »{paidClock ? ` à ${paidClock}` : ""} avec la capture du SMS.
            {canReceive ? " Confirmez quand le vendeur a bien reçu l'argent." : ""}
          </p>
        ) : null}
        {status === "received" ? (
          <p className="e-achat__note">
            Vous avez confirmé{receivedClock ? ` à ${receivedClock}` : ""} que le vendeur a reçu le paiement.
          </p>
        ) : null}
        {status === "reported" ? (
          <p className="e-achat__note">
            {alreadyReportedByMe ? "Vous avez signalé cette demande" : "Cette demande a été signalée"}
            {reason ? ` : « ${reason} »` : ""}. {request.reviewed ? PURCHASE_REVIEWED_LABEL : "L'équipe EduCash examine le signalement."}{" "}
            {PURCHASE_NO_REFUND_NOTE}
          </p>
        ) : null}
        {status === "cancelled" ? <p className="e-achat__note">Cette demande a été annulée.</p> : null}
      </div>

      {actions.length > 0 || showViewReport ? (
        <div className="e-achat__foot">
          {actions.includes("edit") ? (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onEdit?.(request)}>
              <Icon name="i-pencil" />
              Modifier
            </button>
          ) : null}
          {actions.includes("cancel") ? (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onCancel?.(request)}>
              <Icon name="i-x" />
              Annuler la demande
            </button>
          ) : null}
          {canReceive ? (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onConfirmReceived?.(request)}>
              <Icon name="i-check" />
              Reçu par le vendeur
            </button>
          ) : null}
          {showViewReport ? (
            <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => onViewReport(request)}>
              Voir le signalement
            </button>
          ) : null}
          {actions.includes("report") ? (
            <button type="button" className="e2-link" disabled={busy} onClick={() => onReport?.(request)}>
              <Icon name="i-flag" />
              Signaler
            </button>
          ) : null}
        </div>
      ) : null}

      {meta ? <div className="e-achat__meta">{meta}</div> : null}
    </div>
  )
}

export default PurchaseCard
